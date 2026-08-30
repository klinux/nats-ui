package handler

import (
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
)

// sseKeepAlive is how often a comment line is sent on an idle stream to keep
// proxies from closing it.
const sseKeepAlive = 30 * time.Second

// sseWriter streams Server-Sent Events to a client.
type sseWriter struct {
	ctx     *gin.Context
	flusher http.Flusher
}

// newSSEWriter sets the SSE response headers and flushes them immediately, so
// the browser's EventSource fires `onopen` on connect rather than waiting for
// the first event — which on a quiet subject could be 30 seconds away.
func newSSEWriter(c *gin.Context) *sseWriter {
	c.Header("Content-Type", "text/event-stream")
	c.Header("Cache-Control", "no-cache")
	c.Header("Connection", "keep-alive")
	c.Header("X-Accel-Buffering", "no")
	c.Status(http.StatusOK)

	w := &sseWriter{ctx: c}
	if flusher, ok := c.Writer.(http.Flusher); ok {
		w.flusher = flusher
		flusher.Flush()
	}
	return w
}

// sendJSON marshals v and writes it as one SSE data frame.
func (w *sseWriter) sendJSON(out io.Writer, v any) {
	payload, err := json.Marshal(v)
	if err != nil {
		log.Printf("sse: marshalling event: %v", err)
		w.write(out, "data: {\"error\":\"marshal failed\"}\n\n")
		return
	}
	w.write(out, fmt.Sprintf("data: %s\n\n", payload))
}

// keepAlive writes a comment line, which clients ignore.
func (w *sseWriter) keepAlive(out io.Writer) {
	w.write(out, ": keepalive\n\n")
}

func (w *sseWriter) write(out io.Writer, s string) {
	if _, err := io.WriteString(out, s); err != nil {
		// The client is gone; c.Stream notices via the request context.
		log.Printf("sse: writing to client: %v", err)
		return
	}
	if w.flusher != nil {
		w.flusher.Flush()
	}
}

// streamEvents pumps events until the client disconnects. next is called for
// each event source read; returning false ends the stream.
//
// The keepalive ticker is created once rather than per iteration: the previous
// `case <-time.After(30s)` inside the select allocated a fresh timer for every
// single message.
func streamEvents(c *gin.Context, next func(out io.Writer, w *sseWriter, keepalive <-chan time.Time) bool) {
	w := newSSEWriter(c)

	ticker := time.NewTicker(sseKeepAlive)
	defer ticker.Stop()

	c.Stream(func(out io.Writer) bool {
		return next(out, w, ticker.C)
	})
}
