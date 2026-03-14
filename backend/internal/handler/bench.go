package handler

import (
	"net/http"
	"sync"
	"sync/atomic"
	"time"

	"github.com/gin-gonic/gin"

	natsclient "nats-ui-backend/internal/nats"
)

type BenchHandler struct {
	nc *natsclient.Client
}

func NewBenchHandler(nc *natsclient.Client) *BenchHandler {
	return &BenchHandler{nc: nc}
}

type BenchRequest struct {
	Subject string `json:"subject" binding:"required"`
	MsgSize int    `json:"msg_size"`
	NumMsgs int    `json:"num_msgs"`
	NumPubs int    `json:"num_pubs"`
	NumSubs int    `json:"num_subs"`
}

type BenchResult struct {
	Duration    float64 `json:"duration_ms"`
	MsgsPerSec  float64 `json:"msgs_per_sec"`
	BytesPerSec float64 `json:"bytes_per_sec"`
	TotalMsgs   int     `json:"total_msgs"`
	TotalBytes  int64   `json:"total_bytes"`
	MsgSize     int     `json:"msg_size"`
	Publishers  int     `json:"publishers"`
	Subscribers int     `json:"subscribers"`
}

func (h *BenchHandler) Run(c *gin.Context) {
	var req BenchRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if req.MsgSize <= 0 {
		req.MsgSize = 128
	}
	if req.NumMsgs <= 0 {
		req.NumMsgs = 10000
	}
	if req.NumMsgs > 1000000 {
		req.NumMsgs = 1000000
	}
	if req.NumPubs <= 0 {
		req.NumPubs = 1
	}
	if req.NumPubs > 10 {
		req.NumPubs = 10
	}
	if req.NumSubs < 0 {
		req.NumSubs = 0
	}
	if req.NumSubs > 10 {
		req.NumSubs = 10
	}

	payload := make([]byte, req.MsgSize)

	// Start subscribers first
	var subWg sync.WaitGroup
	var received int64
	for i := 0; i < req.NumSubs; i++ {
		sub, ch, err := h.nc.Subscribe(req.Subject)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		subWg.Add(1)
		go func() {
			defer subWg.Done()
			defer sub.Unsubscribe()
			for range ch {
				if atomic.AddInt64(&received, 1) >= int64(req.NumMsgs) {
					return
				}
			}
		}()
	}

	// Publish
	msgsPerPub := req.NumMsgs / req.NumPubs
	var pubWg sync.WaitGroup
	start := time.Now()

	for i := 0; i < req.NumPubs; i++ {
		pubWg.Add(1)
		go func() {
			defer pubWg.Done()
			for j := 0; j < msgsPerPub; j++ {
				if err := h.nc.Conn().Publish(req.Subject, payload); err != nil {
					return
				}
			}
			if err := h.nc.Conn().Flush(); err != nil {
				return
			}
		}()
	}
	pubWg.Wait()
	duration := time.Since(start)

	totalMsgs := msgsPerPub * req.NumPubs
	totalBytes := int64(totalMsgs) * int64(req.MsgSize)

	result := BenchResult{
		Duration:    float64(duration.Milliseconds()),
		MsgsPerSec:  float64(totalMsgs) / duration.Seconds(),
		BytesPerSec: float64(totalBytes) / duration.Seconds(),
		TotalMsgs:   totalMsgs,
		TotalBytes:  totalBytes,
		MsgSize:     req.MsgSize,
		Publishers:  req.NumPubs,
		Subscribers: req.NumSubs,
	}

	c.JSON(http.StatusOK, result)
}
