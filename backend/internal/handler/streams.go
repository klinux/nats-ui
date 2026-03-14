package handler

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/nats-io/nats.go/jetstream"

	natsclient "nats-ui-backend/internal/nats"
)

type StreamsHandler struct {
	nc *natsclient.Client
}

func NewStreamsHandler(nc *natsclient.Client) *StreamsHandler {
	return &StreamsHandler{nc: nc}
}

func (h *StreamsHandler) List(c *gin.Context) {
	ctx, cancel := context.WithTimeout(c.Request.Context(), 10*time.Second)
	defer cancel()

	var streams []map[string]any
	lister := h.nc.JS().ListStreams(ctx)
	for info := range lister.Info() {
		streams = append(streams, map[string]any{
			"config": info.Config,
			"state":  info.State,
		})
	}
	if lister.Err() != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": lister.Err().Error()})
		return
	}
	if streams == nil {
		streams = []map[string]any{}
	}
	c.JSON(http.StatusOK, streams)
}

func (h *StreamsHandler) Get(c *gin.Context) {
	ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
	defer cancel()

	name := c.Param("name")
	stream, err := h.nc.JS().Stream(ctx, name)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	info, err := stream.Info(ctx)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, map[string]any{
		"config": info.Config,
		"state":  info.State,
	})
}

type createStreamRequest struct {
	Name        string   `json:"name" binding:"required"`
	Subjects    []string `json:"subjects" binding:"required"`
	Description string   `json:"description"`
	Retention   string   `json:"retention"`
	Storage     string   `json:"storage"`
	MaxMsgs     int64    `json:"maxMsgs"`
	MaxBytes    int64    `json:"maxBytes"`
	MaxAge      int64    `json:"maxAge"` // seconds
	Replicas    int      `json:"replicas"`
}

func (req *createStreamRequest) toStreamConfig() jetstream.StreamConfig {
	cfg := jetstream.StreamConfig{
		Name:        req.Name,
		Subjects:    req.Subjects,
		Description: req.Description,
		MaxMsgs:     req.MaxMsgs,
		MaxBytes:    req.MaxBytes,
		MaxAge:      time.Duration(req.MaxAge) * time.Second,
		Replicas:    req.Replicas,
	}
	switch req.Retention {
	case "interest":
		cfg.Retention = jetstream.InterestPolicy
	case "workqueue":
		cfg.Retention = jetstream.WorkQueuePolicy
	default:
		cfg.Retention = jetstream.LimitsPolicy
	}
	switch req.Storage {
	case "memory":
		cfg.Storage = jetstream.MemoryStorage
	default:
		cfg.Storage = jetstream.FileStorage
	}
	if cfg.Replicas == 0 {
		cfg.Replicas = 1
	}
	return cfg
}

func (h *StreamsHandler) Create(c *gin.Context) {
	var req createStreamRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
	defer cancel()

	stream, err := h.nc.JS().CreateStream(ctx, req.toStreamConfig())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	info, err := stream.Info(ctx)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, map[string]any{
		"config": info.Config,
		"state":  info.State,
	})
}

func (h *StreamsHandler) Update(c *gin.Context) {
	var req createStreamRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
	defer cancel()

	req.Name = c.Param("name")

	stream, err := h.nc.JS().UpdateStream(ctx, req.toStreamConfig())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	info, err := stream.Info(ctx)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, map[string]any{
		"config": info.Config,
		"state":  info.State,
	})
}

type purgeRequest struct {
	Subject string `json:"subject"`
}

func (h *StreamsHandler) Purge(c *gin.Context) {
	ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
	defer cancel()

	name := c.Param("name")
	stream, err := h.nc.JS().Stream(ctx, name)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	var req purgeRequest
	// Ignore bind errors — body is optional
	_ = c.ShouldBindJSON(&req)

	if req.Subject != "" {
		err = stream.Purge(ctx, jetstream.WithPurgeSubject(req.Subject))
	} else {
		err = stream.Purge(ctx)
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"purged": name, "subject": req.Subject})
}

func (h *StreamsHandler) GetMessage(c *gin.Context) {
	ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
	defer cancel()

	name := c.Param("name")
	stream, err := h.nc.JS().Stream(ctx, name)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	// Get last N messages or by sequence
	lastN := 10
	if v := c.Query("last"); v != "" {
		fmt.Sscanf(v, "%d", &lastN)
		if lastN > 100 {
			lastN = 100
		}
	}

	info, err := stream.Info(ctx)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	var messages []map[string]any
	if info.State.Msgs == 0 {
		c.JSON(http.StatusOK, []map[string]any{})
		return
	}

	// Calculate start sequence
	startSeq := info.State.LastSeq - uint64(lastN) + 1
	if startSeq < info.State.FirstSeq {
		startSeq = info.State.FirstSeq
	}

	for seq := startSeq; seq <= info.State.LastSeq; seq++ {
		msg, err := stream.GetMsg(ctx, seq)
		if err != nil {
			continue
		}
		var data any
		if err := json.Unmarshal(msg.Data, &data); err != nil {
			data = string(msg.Data)
		}
		headers := make(map[string]string)
		for k, v := range msg.Header {
			if len(v) > 0 {
				headers[k] = v[0]
			}
		}
		messages = append(messages, map[string]any{
			"sequence":  msg.Sequence,
			"subject":   msg.Subject,
			"data":      data,
			"headers":   headers,
			"timestamp": msg.Time,
		})
	}
	if messages == nil {
		messages = []map[string]any{}
	}
	c.JSON(http.StatusOK, messages)
}

func (h *StreamsHandler) Delete(c *gin.Context) {
	ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
	defer cancel()

	name := c.Param("name")
	if err := h.nc.JS().DeleteStream(ctx, name); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"deleted": name})
}
