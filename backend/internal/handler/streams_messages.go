package handler

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/nats-io/nats.go/jetstream"
)

const (
	defaultMessageLimit = 50
	maxMessageLimit     = 200
)

// GetMessages retrieves messages from a stream with flexible filtering.
// Query params: seq, last, subject, start_time (RFC3339), limit (default 50, max 200).
func (h *StreamsHandler) GetMessages(c *gin.Context) {
	ctx, cancel := context.WithTimeout(c.Request.Context(), 15*time.Second)
	defer cancel()

	name := c.Param("name")
	stream, err := h.nc.JS().Stream(ctx, name)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	limit := parseIntQuery(c, "limit", defaultMessageLimit)
	if limit <= 0 || limit > maxMessageLimit {
		limit = defaultMessageLimit
	}

	subject := c.Query("subject")
	seqStr := c.Query("seq")
	lastStr := c.Query("last")
	startTimeStr := c.Query("start_time")

	consumerCfg := jetstream.ConsumerConfig{
		AckPolicy:     jetstream.AckNonePolicy,
		MemoryStorage: true,
	}

	if subject != "" {
		consumerCfg.FilterSubject = subject
	}

	switch {
	case seqStr != "":
		seq, err := strconv.ParseUint(seqStr, 10, 64)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid seq parameter"})
			return
		}
		consumerCfg.DeliverPolicy = jetstream.DeliverByStartSequencePolicy
		consumerCfg.OptStartSeq = seq

	case startTimeStr != "":
		t, err := time.Parse(time.RFC3339, startTimeStr)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid start_time, expected RFC3339 format"})
			return
		}
		consumerCfg.DeliverPolicy = jetstream.DeliverByStartTimePolicy
		consumerCfg.OptStartTime = &t

	case lastStr != "":
		last, err := strconv.Atoi(lastStr)
		if err != nil || last <= 0 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid last parameter"})
			return
		}
		if last > maxMessageLimit {
			last = maxMessageLimit
		}
		info, err := stream.Info(ctx)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		if info.State.Msgs == 0 {
			c.JSON(http.StatusOK, []map[string]any{})
			return
		}
		consumerCfg.DeliverPolicy = jetstream.DeliverByStartSequencePolicy
		consumerCfg.OptStartSeq = lastNStartSeq(info.State.FirstSeq, info.State.LastSeq, uint64(last))
		limit = last

	default:
		consumerCfg.DeliverPolicy = jetstream.DeliverAllPolicy
	}

	consumer, err := stream.CreateOrUpdateConsumer(ctx, consumerCfg)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("failed to create consumer: %v", err)})
		return
	}
	defer func() {
		cleanCtx, cleanCancel := context.WithTimeout(context.Background(), 3*time.Second)
		defer cleanCancel()
		_ = stream.DeleteConsumer(cleanCtx, consumer.CachedInfo().Name)
	}()

	msgs, err := consumer.Fetch(limit, jetstream.FetchMaxWait(2*time.Second))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("failed to fetch messages: %v", err)})
		return
	}

	messages := make([]map[string]any, 0, limit)
	for msg := range msgs.Messages() {
		meta, err := msg.Metadata()
		if err != nil {
			continue
		}

		var data any
		if err := json.Unmarshal(msg.Data(), &data); err != nil {
			data = string(msg.Data())
		}

		headers := make(map[string]string)
		if msg.Headers() != nil {
			for k, v := range msg.Headers() {
				if len(v) > 0 {
					headers[k] = v[0]
				}
			}
		}

		messages = append(messages, map[string]any{
			"sequence":  meta.Sequence.Stream,
			"subject":   msg.Subject(),
			"data":      data,
			"headers":   headers,
			"timestamp": meta.Timestamp,
		})
	}

	if msgs.Error() != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("fetch error: %v", msgs.Error())})
		return
	}

	c.JSON(http.StatusOK, messages)
}

// lastNStartSeq returns the stream sequence to start delivery from in order to
// fetch the last `last` messages, clamped to [firstSeq, lastSeq] and guarded
// against uint64 underflow when the stream has fewer messages than requested.
func lastNStartSeq(firstSeq, lastSeq, last uint64) uint64 {
	if last == 0 || last >= lastSeq {
		return firstSeq
	}
	start := lastSeq - last + 1
	if start < firstSeq {
		return firstSeq
	}
	return start
}

func parseIntQuery(c *gin.Context, key string, defaultVal int) int {
	v := c.Query(key)
	if v == "" {
		return defaultVal
	}
	n, err := strconv.Atoi(v)
	if err != nil {
		return defaultVal
	}
	return n
}
