package handler

import (
	"sync"
	"time"
)

// ttlCache memoises one expensive value for a short window.
//
// It exists for endpoints the UI polls where the upstream call is costly —
// /connz?subs=1 walks every connection's subscription list on the NATS server.
// Errors are never cached, so one blip is not served for the whole window.
type ttlCache[T any] struct {
	mu      sync.Mutex
	value   T
	expires time.Time
	ttl     time.Duration
}

func newTTLCache[T any](ttl time.Duration) *ttlCache[T] {
	return &ttlCache[T]{ttl: ttl}
}

// get returns the cached value, calling load when it is missing or stale.
func (c *ttlCache[T]) get(load func() (T, error)) (T, error) {
	c.mu.Lock()
	defer c.mu.Unlock()

	if time.Now().Before(c.expires) {
		return c.value, nil
	}

	value, err := load()
	if err != nil {
		var zero T
		return zero, err
	}

	c.value = value
	c.expires = time.Now().Add(c.ttl)

	return value, nil
}
