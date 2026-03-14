package handler

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/nats-io/nats.go/jetstream"

	natsclient "nats-ui-backend/internal/nats"
)

type KVHandler struct {
	nc *natsclient.Client
}

func NewKVHandler(nc *natsclient.Client) *KVHandler {
	return &KVHandler{nc: nc}
}

func (h *KVHandler) ListBuckets(c *gin.Context) {
	ctx, cancel := context.WithTimeout(c.Request.Context(), 10*time.Second)
	defer cancel()

	var buckets []map[string]any
	lister := h.nc.JS().KeyValueStoreNames(ctx)
	for name := range lister.Name() {
		kv, err := h.nc.JS().KeyValue(ctx, name)
		if err != nil {
			continue
		}
		status, err := kv.Status(ctx)
		if err != nil {
			buckets = append(buckets, map[string]any{"name": name})
			continue
		}
		buckets = append(buckets, map[string]any{
			"name":    name,
			"values":  status.Values(),
			"bytes":   status.Bytes(),
			"history": status.History(),
			"ttl":     status.TTL().Seconds(),
		})
	}
	if buckets == nil {
		buckets = []map[string]any{}
	}
	c.JSON(http.StatusOK, buckets)
}

type createBucketRequest struct {
	Name    string `json:"name" binding:"required"`
	TTL     int64  `json:"ttl"` // seconds
	History int    `json:"history"`
}

func (h *KVHandler) CreateBucket(c *gin.Context) {
	var req createBucketRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
	defer cancel()

	cfg := jetstream.KeyValueConfig{
		Bucket: req.Name,
	}
	if req.TTL > 0 {
		cfg.TTL = time.Duration(req.TTL) * time.Second
	}
	if req.History > 0 {
		cfg.History = uint8(req.History)
	}

	kv, err := h.nc.JS().CreateKeyValue(ctx, cfg)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	status, err := kv.Status(ctx)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, map[string]any{
		"name":   req.Name,
		"values": status.Values(),
		"bytes":  status.Bytes(),
	})
}

func (h *KVHandler) DeleteBucket(c *gin.Context) {
	ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
	defer cancel()

	name := c.Param("bucket")
	if err := h.nc.JS().DeleteKeyValue(ctx, name); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"deleted": name})
}

func (h *KVHandler) ListKeys(c *gin.Context) {
	ctx, cancel := context.WithTimeout(c.Request.Context(), 10*time.Second)
	defer cancel()

	bucket := c.Param("bucket")
	kv, err := h.nc.JS().KeyValue(ctx, bucket)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	lister, err := kv.ListKeys(ctx)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	var keys []string
	for key := range lister.Keys() {
		keys = append(keys, key)
	}
	if keys == nil {
		keys = []string{}
	}
	c.JSON(http.StatusOK, keys)
}

func (h *KVHandler) GetValue(c *gin.Context) {
	ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
	defer cancel()

	bucket := c.Param("bucket")
	key := c.Param("key")

	kv, err := h.nc.JS().KeyValue(ctx, bucket)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	entry, err := kv.Get(ctx, key)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, map[string]any{
		"key":      key,
		"value":    string(entry.Value()),
		"revision": entry.Revision(),
		"created":  entry.Created(),
	})
}

type putValueRequest struct {
	Value string `json:"value" binding:"required"`
}

func (h *KVHandler) PutValue(c *gin.Context) {
	var req putValueRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
	defer cancel()

	bucket := c.Param("bucket")
	key := c.Param("key")

	kv, err := h.nc.JS().KeyValue(ctx, bucket)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	rev, err := kv.PutString(ctx, key, req.Value)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"key": key, "revision": rev})
}

func (h *KVHandler) DeleteKey(c *gin.Context) {
	ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
	defer cancel()

	bucket := c.Param("bucket")
	key := c.Param("key")

	kv, err := h.nc.JS().KeyValue(ctx, bucket)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	if err := kv.Delete(ctx, key); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"deleted": key})
}

// WatchKeys uses Server-Sent Events to stream KV bucket changes
func (h *KVHandler) WatchKeys(c *gin.Context) {
	bucket := c.Param("bucket")
	key := c.DefaultQuery("key", ">")

	ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Minute)
	defer cancel()

	kv, err := h.nc.JS().KeyValue(ctx, bucket)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	watcher, err := kv.Watch(ctx, key)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer watcher.Stop()

	c.Header("Content-Type", "text/event-stream")
	c.Header("Cache-Control", "no-cache")
	c.Header("Connection", "keep-alive")
	c.Header("X-Accel-Buffering", "no")

	flusher, _ := c.Writer.(http.Flusher)

	c.Stream(func(w io.Writer) bool {
		select {
		case entry := <-watcher.Updates():
			if entry == nil {
				return true
			}
			data, err := json.Marshal(gin.H{
				"key":       entry.Key(),
				"value":     string(entry.Value()),
				"revision":  entry.Revision(),
				"operation": entry.Operation().String(),
				"created":   entry.Created(),
			})
			if err != nil {
				fmt.Fprintf(w, "data: {\"error\":\"marshal failed\"}\n\n")
				if flusher != nil {
					flusher.Flush()
				}
				return true
			}
			fmt.Fprintf(w, "data: %s\n\n", data)
			if flusher != nil {
				flusher.Flush()
			}
			return true

		case <-ctx.Done():
			return false

		case <-c.Request.Context().Done():
			return false
		}
	})
}
