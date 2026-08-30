package handler

import (
	"context"
	"log"
	"net/http"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
)

const (
	// listAllTimeout bounds the whole aggregation.
	listAllTimeout = 20 * time.Second

	// listAllConcurrency caps how many streams are queried at once, so a
	// cluster with hundreds of streams cannot flood the NATS connection.
	listAllConcurrency = 8
)

// ListAll returns every consumer across every stream in one response.
//
// The UI polls this every few seconds; doing it stream by stream from the
// browser meant N+1 sequential requests per refresh, which by itself blew past
// the per-IP rate limit on any sizeable deployment.
func (h *ConsumersHandler) ListAll(c *gin.Context) {
	ctx, cancel := context.WithTimeout(c.Request.Context(), listAllTimeout)
	defer cancel()

	names, err := h.streamNames(ctx)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	var (
		mu        sync.Mutex
		consumers = make([]map[string]any, 0, len(names))
		wg        sync.WaitGroup
		sem       = make(chan struct{}, listAllConcurrency)
	)

	for _, name := range names {
		wg.Add(1)
		go func() {
			defer wg.Done()

			select {
			case sem <- struct{}{}:
				defer func() { <-sem }()
			case <-ctx.Done():
				return
			}

			found, err := h.consumersOf(ctx, name)
			if err != nil {
				// One unreachable stream must not blank the whole page.
				log.Printf("consumers: listing consumers of %q: %v", name, err)
				return
			}

			mu.Lock()
			consumers = append(consumers, found...)
			mu.Unlock()
		}()
	}
	wg.Wait()

	c.JSON(http.StatusOK, consumers)
}

func (h *ConsumersHandler) streamNames(ctx context.Context) ([]string, error) {
	var names []string
	lister := h.nc.JS().StreamNames(ctx)
	for name := range lister.Name() {
		names = append(names, name)
	}
	if err := lister.Err(); err != nil {
		return nil, err
	}
	return names, nil
}

func (h *ConsumersHandler) consumersOf(ctx context.Context, streamName string) ([]map[string]any, error) {
	stream, err := h.nc.JS().Stream(ctx, streamName)
	if err != nil {
		return nil, err
	}

	var consumers []map[string]any
	lister := stream.ListConsumers(ctx)
	for info := range lister.Info() {
		consumers = append(consumers, consumerPayload(streamName, info))
	}
	if err := lister.Err(); err != nil {
		return nil, err
	}
	return consumers, nil
}
