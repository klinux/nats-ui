package middleware

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
)

func TestRateLimit(t *testing.T) {
	tests := []struct {
		name        string
		rps         float64
		numRequests int
		wantOK      int
		wantLimited int
	}{
		{
			name:        "all requests within limit",
			rps:         10,
			numRequests: 10, // initial tokens = rps = 10
			wantOK:      10,
			wantLimited: 0,
		},
		{
			name:        "exceeds limit gets 429",
			rps:         2,
			numRequests: 5, // initial tokens = 2, so 2 OK + 3 rejected
			wantOK:      2,
			wantLimited: 3,
		},
		{
			name:        "single request at rps 1",
			rps:         1,
			numRequests: 1,
			wantOK:      1,
			wantLimited: 0,
		},
		{
			name:        "burst allows initial tokens equal to rps",
			rps:         5,
			numRequests: 7,
			wantOK:      5,
			wantLimited: 2,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			r := gin.New()
			r.Use(RateLimit(tt.rps))
			r.GET("/test", func(c *gin.Context) {
				c.Status(http.StatusOK)
			})

			var gotOK, gotLimited int
			for i := 0; i < tt.numRequests; i++ {
				w := httptest.NewRecorder()
				req := httptest.NewRequest(http.MethodGet, "/test", nil)
				req.RemoteAddr = "192.168.1.1:12345"
				r.ServeHTTP(w, req)

				switch w.Code {
				case http.StatusOK:
					gotOK++
				case http.StatusTooManyRequests:
					gotLimited++

					var resp map[string]string
					if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
						t.Fatalf("failed to parse 429 response: %v", err)
					}
					if resp["error"] != "rate limit exceeded" {
						t.Errorf("got error %q, want %q", resp["error"], "rate limit exceeded")
					}
				default:
					t.Fatalf("unexpected status code: %d", w.Code)
				}
			}

			if gotOK != tt.wantOK {
				t.Errorf("got %d OK responses, want %d", gotOK, tt.wantOK)
			}
			if gotLimited != tt.wantLimited {
				t.Errorf("got %d limited responses, want %d", gotLimited, tt.wantLimited)
			}
		})
	}
}

func TestRateLimitPerIP(t *testing.T) {
	r := gin.New()
	r.Use(RateLimit(1)) // 1 rps → 1 initial token per IP
	r.GET("/test", func(c *gin.Context) {
		c.Status(http.StatusOK)
	})

	// First IP uses its single token
	w1 := httptest.NewRecorder()
	req1 := httptest.NewRequest(http.MethodGet, "/test", nil)
	req1.RemoteAddr = "10.0.0.1:1234"
	r.ServeHTTP(w1, req1)

	if w1.Code != http.StatusOK {
		t.Errorf("IP1 first request: got %d, want 200", w1.Code)
	}

	// Second IP should still have its own token
	w2 := httptest.NewRecorder()
	req2 := httptest.NewRequest(http.MethodGet, "/test", nil)
	req2.RemoteAddr = "10.0.0.2:1234"
	r.ServeHTTP(w2, req2)

	if w2.Code != http.StatusOK {
		t.Errorf("IP2 first request: got %d, want 200", w2.Code)
	}

	// First IP should now be limited
	w3 := httptest.NewRecorder()
	req3 := httptest.NewRequest(http.MethodGet, "/test", nil)
	req3.RemoteAddr = "10.0.0.1:1234"
	r.ServeHTTP(w3, req3)

	if w3.Code != http.StatusTooManyRequests {
		t.Errorf("IP1 second request: got %d, want 429", w3.Code)
	}
}
