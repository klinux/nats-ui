package handler

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"

	"nats-ui-backend/internal/config"
	"nats-ui-backend/internal/middleware"
)

// TestStreamTicketHandler checks that a ticket is only issued to an
// authenticated caller and that the issued ticket actually opens SSE routes.
func TestStreamTicketHandler(t *testing.T) {
	gin.SetMode(gin.TestMode)

	cfg := &config.Config{JWTSecret: "handler-test-secret", AdminUser: "admin", AdminPass: "pw"}
	auth := middleware.NewAuthMiddleware(cfg.JWTSecret)
	h := NewAuthHandler(cfg, auth)

	r := gin.New()
	r.POST("/api/auth/stream-ticket", auth.RequireAuth(), h.StreamTicket)
	r.GET("/api/stream", auth.RequireStreamAuth(), func(c *gin.Context) { c.String(http.StatusOK, "ok") })

	t.Run("requires authentication", func(t *testing.T) {
		w := httptest.NewRecorder()
		r.ServeHTTP(w, httptest.NewRequest(http.MethodPost, "/api/auth/stream-ticket", nil))
		if w.Code != http.StatusUnauthorized {
			t.Fatalf("got status %d, want 401", w.Code)
		}
	})

	sessionToken, err := auth.GenerateToken("admin")
	if err != nil {
		t.Fatalf("GenerateToken: %v", err)
	}

	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/api/auth/stream-ticket", nil)
	req.Header.Set("Authorization", "Bearer "+sessionToken)
	r.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("got status %d, want 200 (body %s)", w.Code, w.Body.String())
	}

	var body struct {
		Ticket    string `json:"ticket"`
		ExpiresIn int    `json:"expires_in"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &body); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if body.Ticket == "" {
		t.Fatal("response carries no ticket")
	}
	if body.ExpiresIn <= 0 {
		t.Errorf("got expires_in %d, want > 0", body.ExpiresIn)
	}

	// The ticket must open an SSE route.
	w = httptest.NewRecorder()
	r.ServeHTTP(w, httptest.NewRequest(http.MethodGet, "/api/stream?ticket="+body.Ticket, nil))
	if w.Code != http.StatusOK {
		t.Errorf("issued ticket rejected by SSE route: status %d", w.Code)
	}
}
