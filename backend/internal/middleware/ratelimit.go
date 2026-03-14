package middleware

import (
	"net/http"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
)

type rateLimiter struct {
	mu       sync.Mutex
	tokens   float64
	maxTokens float64
	refillRate float64 // tokens per second
	lastRefill time.Time
}

func newRateLimiter(rps float64) *rateLimiter {
	return &rateLimiter{
		tokens:     rps,
		maxTokens:  rps * 2, // burst = 2x rate
		refillRate: rps,
		lastRefill: time.Now(),
	}
}

func (r *rateLimiter) allow() bool {
	r.mu.Lock()
	defer r.mu.Unlock()

	now := time.Now()
	elapsed := now.Sub(r.lastRefill).Seconds()
	r.tokens += elapsed * r.refillRate
	if r.tokens > r.maxTokens {
		r.tokens = r.maxTokens
	}
	r.lastRefill = now

	if r.tokens < 1 {
		return false
	}
	r.tokens--
	return true
}

// RateLimit returns a per-IP token bucket rate limiter middleware.
func RateLimit(rps float64) gin.HandlerFunc {
	var mu sync.Mutex
	limiters := make(map[string]*rateLimiter)

	// Cleanup old entries every minute
	go func() {
		for range time.Tick(time.Minute) {
			mu.Lock()
			for ip, rl := range limiters {
				rl.mu.Lock()
				if time.Since(rl.lastRefill) > 5*time.Minute {
					delete(limiters, ip)
				}
				rl.mu.Unlock()
			}
			mu.Unlock()
		}
	}()

	return func(c *gin.Context) {
		ip := c.ClientIP()

		mu.Lock()
		rl, ok := limiters[ip]
		if !ok {
			rl = newRateLimiter(rps)
			limiters[ip] = rl
		}
		mu.Unlock()

		if !rl.allow() {
			c.AbortWithStatusJSON(http.StatusTooManyRequests, gin.H{"error": "rate limit exceeded"})
			return
		}
		c.Next()
	}
}
