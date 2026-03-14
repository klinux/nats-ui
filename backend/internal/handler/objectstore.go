package handler

import (
	"bytes"
	"context"
	"io"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/nats-io/nats.go/jetstream"

	natsclient "nats-ui-backend/internal/nats"
)

type ObjectStoreHandler struct {
	nc *natsclient.Client
}

func NewObjectStoreHandler(nc *natsclient.Client) *ObjectStoreHandler {
	return &ObjectStoreHandler{nc: nc}
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
	ctx, cancel := context.WithTimeout(c.Request.Context(), 10*time.Second)
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
	defer result.Close()

	data, err := io.ReadAll(result)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	contentType := http.DetectContentType(data)
	c.Data(http.StatusOK, contentType, data)
}

func (h *ObjectStoreHandler) PutObject(c *gin.Context) {
	ctx, cancel := context.WithTimeout(c.Request.Context(), 10*time.Second)
	defer cancel()

	bucket := c.Param("bucket")
	name := c.Param("name")

	store, err := h.nc.JS().ObjectStore(ctx, bucket)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	data, err := io.ReadAll(c.Request.Body)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	info, err := store.Put(ctx, jetstream.ObjectMeta{Name: name}, bytes.NewReader(data))
	if err != nil {
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
