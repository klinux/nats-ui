package handler

import (
	"fmt"
	"log"
	"net/http"
	"sync"
	"sync/atomic"
	"time"

	"github.com/gin-gonic/gin"

	natsclient "nats-ui-backend/internal/nats"
)

const (
	// maxBenchMsgSize caps the payload allocation: msg_size was unbounded, so a
	// single request could ask the server to allocate gigabytes.
	maxBenchMsgSize = 1 << 20 // 1 MiB

	// benchDrainWindow is how long subscribers keep draining after the last
	// message is published.
	benchDrainWindow = 500 * time.Millisecond

	// benchCancelCheckEvery is how often a publisher checks for cancellation.
	benchCancelCheckEvery = 512
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
	Received    int64   `json:"received"`
}

func (h *BenchHandler) Run(c *gin.Context) {
	var req BenchRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if req.MsgSize > maxBenchMsgSize {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": fmt.Sprintf("msg_size must not exceed %d bytes", maxBenchMsgSize),
		})
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

	ctx := c.Request.Context()
	payload := make([]byte, req.MsgSize)

	// Subscribers stop on `done` (or request cancellation) rather than ranging
	// over a channel that is never closed: the receive count is not guaranteed
	// to reach num_msgs (drops, cancellation), and a goroutine waiting for that
	// blocks forever, stranding its subscription with it.
	done := make(chan struct{})
	var subWg sync.WaitGroup
	var received int64

	for i := 0; i < req.NumSubs; i++ {
		sub, ch, err := h.nc.Subscribe(req.Subject)
		if err != nil {
			close(done)
			subWg.Wait()
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		subWg.Add(1)
		go func() {
			defer subWg.Done()
			defer func() {
				if err := sub.Unsubscribe(); err != nil {
					log.Printf("bench: unsubscribe from %q: %v", req.Subject, err)
				}
			}()
			for {
				select {
				case <-ch:
					if atomic.AddInt64(&received, 1) >= int64(req.NumMsgs) {
						return
					}
				case <-done:
					return
				case <-ctx.Done():
					return
				}
			}
		}()
	}

	// Publish. The remainder of num_msgs/num_pubs is spread over the first
	// publishers so the requested total is actually sent.
	var pubWg sync.WaitGroup
	start := time.Now()
	var published int64

	for i := 0; i < req.NumPubs; i++ {
		count := req.NumMsgs / req.NumPubs
		if i < req.NumMsgs%req.NumPubs {
			count++
		}
		pubWg.Add(1)
		go func() {
			defer pubWg.Done()
			for j := 0; j < count; j++ {
				// Stop early when the client goes away instead of pushing a
				// million messages nobody is waiting for.
				if j%benchCancelCheckEvery == 0 && ctx.Err() != nil {
					return
				}
				if err := h.nc.Conn().Publish(req.Subject, payload); err != nil {
					log.Printf("bench: publish to %q failed after %d messages: %v", req.Subject, j, err)
					return
				}
				atomic.AddInt64(&published, 1)
			}
			if err := h.nc.Conn().Flush(); err != nil {
				log.Printf("bench: flush for %q: %v", req.Subject, err)
			}
		}()
	}
	pubWg.Wait()
	duration := time.Since(start)

	// Give subscribers a bounded window to drain what is still in flight,
	// then stop them for good.
	select {
	case <-time.After(benchDrainWindow):
	case <-ctx.Done():
	}
	close(done)
	subWg.Wait()

	totalMsgs := int(atomic.LoadInt64(&published))
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
		Received:    atomic.LoadInt64(&received),
	}

	c.JSON(http.StatusOK, result)
}
