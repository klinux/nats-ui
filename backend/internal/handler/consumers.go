package handler

import (
	"context"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/nats-io/nats.go/jetstream"

	natsclient "nats-ui-backend/internal/nats"
)

type ConsumersHandler struct {
	nc *natsclient.Client
}

func NewConsumersHandler(nc *natsclient.Client) *ConsumersHandler {
	return &ConsumersHandler{nc: nc}
}

type createConsumerRequest struct {
	Name          string `json:"name" binding:"required"`
	FilterSubject string `json:"filterSubject"`
	DeliverPolicy string `json:"deliverPolicy"` // all, last, new, by_start_sequence, by_start_time
	AckPolicy     string `json:"ackPolicy"`     // explicit, none, all
	MaxDeliver    int    `json:"maxDeliver"`
	MaxAckPending int    `json:"maxAckPending"`
	Description   string `json:"description"`
	Durable       bool   `json:"durable"`
}

func (h *ConsumersHandler) Create(c *gin.Context) {
	var req createConsumerRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
	defer cancel()

	streamName := c.Param("name")
	stream, err := h.nc.JS().Stream(ctx, streamName)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	cfg := jetstream.ConsumerConfig{
		Name:          req.Name,
		Description:   req.Description,
		FilterSubject: req.FilterSubject,
	}

	if req.Durable {
		cfg.Durable = req.Name
	}

	switch req.DeliverPolicy {
	case "last":
		cfg.DeliverPolicy = jetstream.DeliverLastPolicy
	case "new":
		cfg.DeliverPolicy = jetstream.DeliverNewPolicy
	default:
		cfg.DeliverPolicy = jetstream.DeliverAllPolicy
	}

	switch req.AckPolicy {
	case "none":
		cfg.AckPolicy = jetstream.AckNonePolicy
	case "all":
		cfg.AckPolicy = jetstream.AckAllPolicy
	default:
		cfg.AckPolicy = jetstream.AckExplicitPolicy
	}

	if req.MaxDeliver > 0 {
		cfg.MaxDeliver = req.MaxDeliver
	}
	if req.MaxAckPending > 0 {
		cfg.MaxAckPending = req.MaxAckPending
	}

	consumer, err := stream.CreateOrUpdateConsumer(ctx, cfg)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	info, err := consumer.Info(ctx)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, map[string]any{
		"config":      info.Config,
		"stream_name": streamName,
		"name":        info.Config.Name,
		"delivered":   info.Delivered,
		"ack_floor":   info.AckFloor,
		"num_pending":  info.NumPending,
		"num_waiting":  info.NumWaiting,
		"num_ack_pending": info.NumAckPending,
		"created":     info.Created,
	})
}

func (h *ConsumersHandler) List(c *gin.Context) {
	ctx, cancel := context.WithTimeout(c.Request.Context(), 10*time.Second)
	defer cancel()

	streamName := c.Param("name")
	stream, err := h.nc.JS().Stream(ctx, streamName)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	var consumers []map[string]any
	lister := stream.ListConsumers(ctx)
	for info := range lister.Info() {
		consumers = append(consumers, map[string]any{
			"config":      info.Config,
			"stream_name": streamName,
			"name":        info.Config.Name,
			"delivered":   info.Delivered,
			"ack_floor":   info.AckFloor,
			"num_pending":  info.NumPending,
			"num_waiting":  info.NumWaiting,
			"num_ack_pending": info.NumAckPending,
			"created":     info.Created,
		})
	}
	if lister.Err() != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": lister.Err().Error()})
		return
	}
	if consumers == nil {
		consumers = []map[string]any{}
	}
	c.JSON(http.StatusOK, consumers)
}

func (h *ConsumersHandler) Get(c *gin.Context) {
	ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
	defer cancel()

	streamName := c.Param("name")
	consumerName := c.Param("consumer")

	stream, err := h.nc.JS().Stream(ctx, streamName)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	consumer, err := stream.Consumer(ctx, consumerName)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	info, err := consumer.Info(ctx)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, map[string]any{
		"config":      info.Config,
		"stream_name": streamName,
		"delivered":   info.Delivered,
		"ack_floor":   info.AckFloor,
		"num_pending":  info.NumPending,
		"num_waiting":  info.NumWaiting,
		"num_ack_pending": info.NumAckPending,
		"created":     info.Created,
	})
}

func (h *ConsumersHandler) Delete(c *gin.Context) {
	ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
	defer cancel()

	streamName := c.Param("name")
	consumerName := c.Param("consumer")

	stream, err := h.nc.JS().Stream(ctx, streamName)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	if err := stream.DeleteConsumer(ctx, consumerName); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"deleted": consumerName})
}

type pauseConsumerRequest struct {
	PauseUntil string `json:"pause_until"`
}

func (h *ConsumersHandler) Pause(c *gin.Context) {
	ctx, cancel := context.WithTimeout(c.Request.Context(), 10*time.Second)
	defer cancel()

	streamName := c.Param("name")
	consumerName := c.Param("consumer")

	stream, err := h.nc.JS().Stream(ctx, streamName)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	consumer, err := stream.Consumer(ctx, consumerName)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	info, err := consumer.Info(ctx)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	pauseUntil := time.Date(2099, 1, 1, 0, 0, 0, 0, time.UTC)

	var req pauseConsumerRequest
	if c.Request.ContentLength > 0 {
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		if req.PauseUntil != "" {
			parsed, err := time.Parse(time.RFC3339, req.PauseUntil)
			if err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"error": "invalid pause_until format, expected RFC3339"})
				return
			}
			pauseUntil = parsed
		}
	}

	cfg := info.Config
	cfg.PauseUntil = &pauseUntil

	if _, err := stream.CreateOrUpdateConsumer(ctx, cfg); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"paused": true, "pause_until": pauseUntil.Format(time.RFC3339)})
}

func (h *ConsumersHandler) Resume(c *gin.Context) {
	ctx, cancel := context.WithTimeout(c.Request.Context(), 10*time.Second)
	defer cancel()

	streamName := c.Param("name")
	consumerName := c.Param("consumer")

	stream, err := h.nc.JS().Stream(ctx, streamName)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	consumer, err := stream.Consumer(ctx, consumerName)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	info, err := consumer.Info(ctx)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	cfg := info.Config
	zeroTime := time.Time{}
	cfg.PauseUntil = &zeroTime

	if _, err := stream.CreateOrUpdateConsumer(ctx, cfg); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"paused": false})
}
