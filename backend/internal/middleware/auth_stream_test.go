package middleware

import (
	"net/http"
	"net/http/httptest"
	"net/url"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
)

const testSecret = "stream-test-secret"

func streamRouter(a *AuthMiddleware) *gin.Engine {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.GET("/stream", a.RequireStreamAuth(), func(c *gin.Context) { c.String(http.StatusOK, "ok") })
	r.GET("/api", a.RequireAuth(), func(c *gin.Context) { c.String(http.StatusOK, "ok") })
	return r
}

// expiredTicket builds a ticket that carries the sse audience but is past exp.
func expiredTicket(t *testing.T) string {
	t.Helper()
	claims := jwt.MapClaims{
		"sub": "admin",
		"aud": streamAudience,
		"iat": time.Now().Add(-10 * time.Minute).Unix(),
		"exp": time.Now().Add(-5 * time.Minute).Unix(),
	}
	tok, err := jwt.NewWithClaims(jwt.SigningMethodHS256, claims).SignedString([]byte(testSecret))
	if err != nil {
		t.Fatalf("sign expired ticket: %v", err)
	}
	return tok
}

// TestRequireStreamAuth covers the EventSource flow: the browser cannot set an
// Authorization header, so SSE routes authenticate with a short-lived, audience
// scoped ticket passed in the query string.
func TestRequireStreamAuth(t *testing.T) {
	auth := NewAuthMiddleware(testSecret)

	sessionToken, err := auth.GenerateToken("admin")
	if err != nil {
		t.Fatalf("GenerateToken: %v", err)
	}
	ticket, err := auth.GenerateStreamTicket("admin")
	if err != nil {
		t.Fatalf("GenerateStreamTicket: %v", err)
	}

	tests := []struct {
		name       string
		ticket     string
		wantStatus int
	}{
		{"valid ticket is accepted", ticket, http.StatusOK},
		{"session token is not usable as a ticket", sessionToken, http.StatusUnauthorized},
		{"expired ticket is rejected", expiredTicket(t), http.StatusUnauthorized},
		{"missing ticket is rejected", "", http.StatusUnauthorized},
		{"garbage ticket is rejected", "not-a-jwt", http.StatusUnauthorized},
	}

	r := streamRouter(auth)
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			w := httptest.NewRecorder()
			target := "/stream"
			if tt.ticket != "" {
				target += "?ticket=" + url.QueryEscape(tt.ticket)
			}
			r.ServeHTTP(w, httptest.NewRequest(http.MethodGet, target, nil))

			if w.Code != tt.wantStatus {
				t.Errorf("got status %d, want %d (body %s)", w.Code, tt.wantStatus, w.Body.String())
			}
		})
	}
}

// TestStreamTicketRejectedOnNormalRoutes makes sure a leaked ticket (it travels
// in a URL, so it can land in proxy logs) cannot be replayed as a session.
func TestStreamTicketRejectedOnNormalRoutes(t *testing.T) {
	auth := NewAuthMiddleware(testSecret)
	ticket, err := auth.GenerateStreamTicket("admin")
	if err != nil {
		t.Fatalf("GenerateStreamTicket: %v", err)
	}

	r := streamRouter(auth)
	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/api", nil)
	req.Header.Set("Authorization", "Bearer "+ticket)
	r.ServeHTTP(w, req)

	if w.Code != http.StatusUnauthorized {
		t.Errorf("stream ticket accepted on a normal route: status %d", w.Code)
	}
}

func TestStreamTicketIsShortLived(t *testing.T) {
	auth := NewAuthMiddleware(testSecret)
	ticket, err := auth.GenerateStreamTicket("admin")
	if err != nil {
		t.Fatalf("GenerateStreamTicket: %v", err)
	}

	parsed, err := jwt.Parse(ticket, func(*jwt.Token) (any, error) { return []byte(testSecret), nil })
	if err != nil {
		t.Fatalf("parse ticket: %v", err)
	}
	exp, err := parsed.Claims.GetExpirationTime()
	if err != nil {
		t.Fatalf("ticket has no exp: %v", err)
	}
	if ttl := time.Until(exp.Time); ttl > StreamTicketTTL+time.Second || ttl <= 0 {
		t.Errorf("ticket ttl %v, want <= %v", ttl, StreamTicketTTL)
	}
}

func TestStreamTicketCarriesUser(t *testing.T) {
	auth := NewAuthMiddleware(testSecret)
	ticket, err := auth.GenerateStreamTicket("alice@example.com")
	if err != nil {
		t.Fatalf("GenerateStreamTicket: %v", err)
	}

	gin.SetMode(gin.TestMode)
	r := gin.New()
	var seen any
	r.GET("/stream", auth.RequireStreamAuth(), func(c *gin.Context) {
		seen = c.MustGet("user")
		c.Status(http.StatusOK)
	})

	w := httptest.NewRecorder()
	r.ServeHTTP(w, httptest.NewRequest(http.MethodGet, "/stream?ticket="+url.QueryEscape(ticket), nil))

	if seen != "alice@example.com" {
		t.Errorf("got user %v, want alice@example.com", seen)
	}
}
