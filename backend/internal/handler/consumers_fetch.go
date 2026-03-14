package handler

import (
	"context"
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/nats-io/nats.go/jetstream"
)

// NextMessage fetches the next N messages from a pull consumer.
func (h *ConsumersHandler) NextMessage(c *gin.Context) {
	streamName := c.Param("name")
	consumerName := c.Param("consumer")

	batch, _ := strconv.Atoi(c.DefaultQuery("batch", "1"))
	if batch < 1 {
		batch = 1
	}
	if batch > 100 {
		batch = 100
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 10*time.Second)
	defer cancel()

	consumer, err := h.nc.JS().Consumer(ctx, streamName, consumerName)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	msgs, err := consumer.Fetch(batch, jetstream.FetchMaxWait(5*time.Second))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	var results []gin.H
	for msg := range msgs.Messages() {
		meta, err := msg.Metadata()
		if err != nil {
			continue
		}
		results = append(results, gin.H{
			"subject":   msg.Subject(),
			"data":      string(msg.Data()),
			"headers":   msg.Headers(),
			"sequence":  meta.Sequence.Stream,
			"timestamp": meta.Timestamp,
		})
		if err := msg.Ack(); err != nil {
			continue
		}
	}

	if err := msgs.Error(); err != nil {
		if results == nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
	}

	if results == nil {
		results = []gin.H{}
	}
	c.JSON(http.StatusOK, results)
}
