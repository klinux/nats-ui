package handler

import (
	"context"
	"errors"
	"fmt"
	"io"
	"log"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/nats-io/nats.go/jetstream"

	natsclient "nats-ui-backend/internal/nats"
)

// sniffLen is the number of bytes http.DetectContentType inspects.
const sniffLen = 512

// objectTransferTimeout covers a full object upload or download. The 10s used
// for metadata calls is far too short to move a large object.
const objectTransferTimeout = 5 * time.Minute

type ObjectStoreHandler struct {
	nc             *natsclient.Client
	maxUploadBytes int64
}

func NewObjectStoreHandler(nc *natsclient.Client, maxUploadBytes int64) *ObjectStoreHandler {
	return &ObjectStoreHandler{nc: nc, maxUploadBytes: maxUploadBytes}
}

func (h *ObjectStoreHandler) ListBuckets(c *gin.Context) {
	ctx, cancel := context.WithTimeout(c.Request.Context(), 10*time.Second)
	defer cancel()

	var buckets []map[string]any
	lister := h.nc.JS().ObjectStoreNames(ctx)
	for name := range lister.Name() {
		store, err := h.nc.JS().ObjectStore(ctx, name)
		if err != nil {
			continue
		}
		status, err := store.Status(ctx)
		if err != nil {
			buckets = append(buckets, map[string]any{"name": name})
			continue
		}
		buckets = append(buckets, map[string]any{
			"name":        status.Bucket(),
			"description": status.Description(),
			"sealed":      status.Sealed(),
			"size":        status.Size(),
			"bucket":      status.Bucket(),
		})
	}
	if err := lister.Error(); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	if buckets == nil {
		buckets = []map[string]any{}
	}
	c.JSON(http.StatusOK, buckets)
}

func (h *ObjectStoreHandler) GetBucket(c *gin.Context) {
	ctx, cancel := context.WithTimeout(c.Request.Context(), 10*time.Second)
	defer cancel()

	name := c.Param("bucket")
	store, err := h.nc.JS().ObjectStore(ctx, name)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	status, err := store.Status(ctx)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, map[string]any{
		"bucket":      status.Bucket(),
		"description": status.Description(),
		"sealed":      status.Sealed(),
		"size":        status.Size(),
		"ttl":         status.TTL().Seconds(),
		"storage":     status.Storage().String(),
		"replicas":    status.Replicas(),
		"compressed":  status.IsCompressed(),
		"metadata":    status.Metadata(),
	})
}

type createObjectBucketRequest struct {
	Name         string `json:"name" binding:"required"`
	Description  string `json:"description"`
	MaxBytes     int64  `json:"max_bytes"`
	MaxChunkSize int32  `json:"max_chunk_size"`
	TTL          int64  `json:"ttl"` // seconds
}

func (h *ObjectStoreHandler) CreateBucket(c *gin.Context) {
	var req createObjectBucketRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 10*time.Second)
	defer cancel()

	cfg := jetstream.ObjectStoreConfig{
		Bucket:      req.Name,
		Description: req.Description,
	}
	if req.MaxBytes > 0 {
		cfg.MaxBytes = req.MaxBytes
	}
	if req.TTL > 0 {
		cfg.TTL = time.Duration(req.TTL) * time.Second
	}

	store, err := h.nc.JS().CreateObjectStore(ctx, cfg)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	status, err := store.Status(ctx)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, map[string]any{
		"bucket":      status.Bucket(),
		"description": status.Description(),
		"size":        status.Size(),
	})
}

func (h *ObjectStoreHandler) DeleteBucket(c *gin.Context) {
	ctx, cancel := context.WithTimeout(c.Request.Context(), 10*time.Second)
	defer cancel()

	name := c.Param("bucket")
	if err := h.nc.JS().DeleteObjectStore(ctx, name); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"deleted": name})
}

func (h *ObjectStoreHandler) ListObjects(c *gin.Context) {
	ctx, cancel := context.WithTimeout(c.Request.Context(), 10*time.Second)
	defer cancel()

	bucket := c.Param("bucket")
	store, err := h.nc.JS().ObjectStore(ctx, bucket)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	objects, err := store.List(ctx)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	result := make([]map[string]any, 0, len(objects))
	for _, obj := range objects {
		if obj.Deleted {
			continue
		}
		result = append(result, map[string]any{
			"name":        obj.Name,
			"description": obj.Description,
			"size":        obj.Size,
			"chunks":      obj.Chunks,
			"digest":      obj.Digest,
			"modified":    obj.ModTime,
		})
	}
	c.JSON(http.StatusOK, result)
}

func (h *ObjectStoreHandler) GetObject(c *gin.Context) {
	ctx, cancel := context.WithTimeout(c.Request.Context(), objectTransferTimeout)
	defer cancel()

	bucket := c.Param("bucket")
	name := c.Param("name")

	store, err := h.nc.JS().ObjectStore(ctx, bucket)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	result, err := store.Get(ctx, name)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}
	defer func() {
		if err := result.Close(); err != nil {
			log.Printf("objectstore: closing %s/%s: %v", bucket, name, err)
		}
	}()

	// Sniff the content type from the leading bytes, then stream the rest —
	// buffering the whole object just to detect its type put every download's
	// full size in memory.
	head := make([]byte, sniffLen)
	n, err := io.ReadFull(result, head)
	if err != nil && !errors.Is(err, io.EOF) && !errors.Is(err, io.ErrUnexpectedEOF) {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	head = head[:n]

	c.Header("Content-Type", http.DetectContentType(head))
	c.Status(http.StatusOK)

	if _, err := c.Writer.Write(head); err != nil {
		log.Printf("objectstore: writing %s/%s: %v", bucket, name, err)
		return
	}
	if _, err := io.Copy(c.Writer, result); err != nil {
		// Headers are already sent, so the status cannot be changed here.
		log.Printf("objectstore: streaming %s/%s: %v", bucket, name, err)
	}
}

func (h *ObjectStoreHandler) PutObject(c *gin.Context) {
	ctx, cancel := context.WithTimeout(c.Request.Context(), objectTransferTimeout)
	defer cancel()

	bucket := c.Param("bucket")
	name := c.Param("name")

	store, err := h.nc.JS().ObjectStore(ctx, bucket)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	// Stream the body straight into the store, capped: the previous io.ReadAll
	// held the entire upload in memory with no ceiling at all.
	body := http.MaxBytesReader(c.Writer, c.Request.Body, h.maxUploadBytes)
	defer func() {
		if err := body.Close(); err != nil {
			log.Printf("objectstore: closing upload body for %s/%s: %v", bucket, name, err)
		}
	}()

	info, err := store.Put(ctx, jetstream.ObjectMeta{Name: name}, body)
	if err != nil {
		var maxBytesErr *http.MaxBytesError
		if errors.As(err, &maxBytesErr) {
			c.JSON(http.StatusRequestEntityTooLarge, gin.H{
				"error": fmt.Sprintf("upload exceeds the %d byte limit", h.maxUploadBytes),
			})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, map[string]any{
		"name":   info.Name,
		"size":   info.Size,
		"chunks": info.Chunks,
		"digest": info.Digest,
	})
}

func (h *ObjectStoreHandler) DeleteObject(c *gin.Context) {
	ctx, cancel := context.WithTimeout(c.Request.Context(), 10*time.Second)
	defer cancel()

	bucket := c.Param("bucket")
	name := c.Param("name")

	store, err := h.nc.JS().ObjectStore(ctx, bucket)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	if err := store.Delete(ctx, name); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"deleted": name})
}

func (h *ObjectStoreHandler) GetObjectInfo(c *gin.Context) {
	ctx, cancel := context.WithTimeout(c.Request.Context(), 10*time.Second)
	defer cancel()

	bucket := c.Param("bucket")
	name := c.Param("name")

	store, err := h.nc.JS().ObjectStore(ctx, bucket)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	info, err := store.GetInfo(ctx, name)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, map[string]any{
		"name":        info.Name,
		"description": info.Description,
		"size":        info.Size,
		"chunks":      info.Chunks,
		"digest":      info.Digest,
		"modified":    info.ModTime,
		"deleted":     info.Deleted,
		"bucket":      info.Bucket,
		"headers":     info.Headers,
		"metadata":    info.Metadata,
	})
}
