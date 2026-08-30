package handler

import (
	"context"
	"log"
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/nats-io/nats.go/jetstream"
)

const (
	defaultFetchBatch = 1
	maxFetchBatch     = 100
)

// NextMessage fetches the next N messages from a pull consumer.
//
// Browsing is non-destructive by default: fetched messages are Nak'd so they
// are redelivered immediately and stay available to the real consumer. Pass
// ack=true to actually consume them (draining a consumer from the UI).
//
// Note that a Nak still counts as a delivery attempt, so repeatedly browsing a
// consumer with a low MaxDeliver can eventually exhaust it — far less
// destructive than the previous behaviour, which consumed on the first look.
func (h *ConsumersHandler) NextMessage(c *gin.Context) {
	streamName := c.Param("name")
	consumerName := c.Param("consumer")
	shouldAck := c.Query("ack") == "true"

	batch := parseBatch(c.Query("batch"))

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

	results := make([]gin.H, 0, batch)
	for msg := range msgs.Messages() {
		meta, err := msg.Metadata()
		if err != nil {
			log.Printf("consumers: skipping message without metadata on %s/%s: %v",
				streamName, consumerName, err)
			continue
		}

		results = append(results, gin.H{
			"subject":   msg.Subject(),
			"data":      string(msg.Data()),
			"headers":   msg.Headers(),
			"sequence":  meta.Sequence.Stream,
			"timestamp": meta.Timestamp,
		})

		settle(msg, shouldAck, streamName, consumerName, meta.Sequence.Stream)
	}

	if err := msgs.Error(); err != nil {
		// Messages already pulled are still valid; only fail the request when
		// nothing could be delivered at all.
		if len(results) == 0 {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		log.Printf("consumers: partial fetch on %s/%s: %v", streamName, consumerName, err)
	}

	c.JSON(http.StatusOK, results)
}

// settle acks or naks a browsed message, logging failures rather than dropping
// them silently. A failed Nak only delays redelivery until AckWait expires, so
// it must not fail the request.
func settle(msg jetstream.Msg, shouldAck bool, stream, consumer string, seq uint64) {
	var err error
	action := "nak"
	if shouldAck {
		action = "ack"
		err = msg.Ack()
	} else {
		err = msg.Nak()
	}
	if err != nil {
		log.Printf("consumers: %s failed for %s/%s seq %d: %v", action, stream, consumer, seq, err)
	}
}

// parseBatch clamps the requested batch size to a safe range.
func parseBatch(raw string) int {
	if raw == "" {
		return defaultFetchBatch
	}
	batch, err := strconv.Atoi(raw)
	if err != nil || batch < 1 {
		return defaultFetchBatch
	}
	if batch > maxFetchBatch {
		return maxFetchBatch
	}
	return batch
}
