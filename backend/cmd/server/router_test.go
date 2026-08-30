package main

import (
	"bufio"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/gin-gonic/gin"

	"nats-ui-backend/internal/config"
	"nats-ui-backend/internal/handler"
	"nats-ui-backend/internal/middleware"
	natsclient "nats-ui-backend/internal/nats"
	"nats-ui-backend/internal/testutil"
)

// testServer boots the real route table against an embedded NATS server.
// SSE handlers need a real http.ResponseWriter (httptest.ResponseRecorder does
// not implement CloseNotifier), so tests drive an actual HTTP server.
func testServer(t *testing.T) (*httptest.Server, *middleware.AuthMiddleware, *natsclient.Client) {
	t.Helper()
	// 1000 rps keeps the limiter out of the way of the other tests.
	return testServerWithConfig(t, "1000")
}

func testServerWithConfig(t *testing.T, rateLimitRPS string) (*httptest.Server, *middleware.AuthMiddleware, *natsclient.Client) {
	t.Helper()
	gin.SetMode(gin.TestMode)

	nc := testutil.StartNATS(t)
	cfg := &config.Config{
		JWTSecret:    "router-test-secret",
		AdminUser:    "admin",
		AdminPass:    "pw",
		CORSOrigins:  "*",
		RateLimitRPS: rateLimitRPS,
	}
	auth := middleware.NewAuthMiddleware(cfg.JWTSecret)

	r := newRouter(cfg, nc, auth,
		handler.NewAuthHandler(cfg, auth),
		handler.NewOAuth2Handler(cfg, auth),
		handler.NewServerHandler(nc),
		handler.NewStreamsHandler(nc),
		handler.NewConsumersHandler(nc),
		handler.NewKVHandler(nc),
		handler.NewObjectStoreHandler(nc, cfg.MaxUploadBytes()),
		handler.NewMessagesHandler(nc),
		handler.NewBenchHandler(nc),
	)

	srv := httptest.NewServer(r)
	t.Cleanup(srv.Close)
	return srv, auth, nc
}

// sseRoutes are the endpoints a browser opens with EventSource, which cannot
// send an Authorization header. Each already carries a query string so callers
// can append credentials with "&".
var sseRoutes = []string{
	"/api/messages/subscribe?subject=test.subject",
	"/api/server/events?subject=test.events",
	"/api/kv/testbucket/watch?key=x",
}

func get(t *testing.T, ctx context.Context, url string) *http.Response {
	t.Helper()
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		t.Fatalf("build request: %v", err)
	}
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatalf("GET %s: %v", url, err)
	}
	return resp
}

func mintTicket(t *testing.T, srv *httptest.Server, auth *middleware.AuthMiddleware) string {
	t.Helper()

	session, err := auth.GenerateToken("admin")
	if err != nil {
		t.Fatalf("GenerateToken: %v", err)
	}

	req, err := http.NewRequest(http.MethodPost, srv.URL+"/api/auth/stream-ticket", nil)
	if err != nil {
		t.Fatalf("build ticket request: %v", err)
	}
	req.Header.Set("Authorization", "Bearer "+session)

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatalf("mint ticket: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		t.Fatalf("mint ticket: status %d (%s)", resp.StatusCode, body)
	}

	var minted struct {
		Ticket string `json:"ticket"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&minted); err != nil {
		t.Fatalf("decode ticket: %v", err)
	}
	if minted.Ticket == "" {
		t.Fatal("mint ticket: empty ticket")
	}
	return minted.Ticket
}

// TestSSERoutesRejectSessionTokens guards the regression that shipped: the SSE
// routes sat behind header-only auth, so EventSource always got a 401. The fix
// must not simply widen RequireAuth to accept 24h tokens from the URL.
func TestSSERoutesRejectSessionTokens(t *testing.T) {
	srv, auth, _ := testServer(t)
	session, err := auth.GenerateToken("admin")
	if err != nil {
		t.Fatalf("GenerateToken: %v", err)
	}

	for _, route := range sseRoutes {
		t.Run(route, func(t *testing.T) {
			ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
			defer cancel()

			resp := get(t, ctx, srv.URL+route+"&token="+session)
			defer resp.Body.Close()

			if resp.StatusCode != http.StatusUnauthorized {
				t.Errorf("session token in query accepted: status %d", resp.StatusCode)
			}
		})
	}
}

func TestSSERoutesRejectMissingTicket(t *testing.T) {
	srv, _, _ := testServer(t)

	for _, route := range sseRoutes {
		t.Run(route, func(t *testing.T) {
			ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
			defer cancel()

			resp := get(t, ctx, srv.URL+route)
			defer resp.Body.Close()

			if resp.StatusCode != http.StatusUnauthorized {
				t.Errorf("unauthenticated SSE request returned %d, want 401", resp.StatusCode)
			}
		})
	}
}

// TestMessageSubscribeStreamsWithTicket is the end-to-end proof: mint a ticket
// the way the frontend does, open the stream, publish, and read the event back.
func TestMessageSubscribeStreamsWithTicket(t *testing.T) {
	srv, auth, nc := testServer(t)
	ticket := mintTicket(t, srv, auth)

	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()

	// Publish on a ticker from the start: the handler only flushes response
	// headers once it writes its first event, so the client would otherwise
	// block waiting for a message that is never sent.
	stop := make(chan struct{})
	defer close(stop)
	go func() {
		ticker := time.NewTicker(50 * time.Millisecond)
		defer ticker.Stop()
		for {
			select {
			case <-stop:
				return
			case <-ticker.C:
				_ = nc.Publish("test.subject", []byte(`{"hello":"world"}`), nil)
			}
		}
	}()

	resp := get(t, ctx, srv.URL+"/api/messages/subscribe?subject=test.subject&ticket="+ticket)
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		t.Fatalf("SSE stream returned %d (%s), want 200", resp.StatusCode, body)
	}
	if ct := resp.Header.Get("Content-Type"); !strings.HasPrefix(ct, "text/event-stream") {
		t.Errorf("got Content-Type %q, want text/event-stream", ct)
	}

	scanner := bufio.NewScanner(resp.Body)
	for scanner.Scan() {
		line := scanner.Text()
		if !strings.HasPrefix(line, "data: ") {
			continue // keepalive comment or blank separator
		}

		var evt struct {
			Subject string          `json:"subject"`
			Data    json.RawMessage `json:"data"`
		}
		if err := json.Unmarshal([]byte(strings.TrimPrefix(line, "data: ")), &evt); err != nil {
			t.Fatalf("decode SSE event %q: %v", line, err)
		}
		if evt.Subject != "test.subject" {
			t.Errorf("got subject %q, want test.subject", evt.Subject)
		}
		if string(evt.Data) != `{"hello":"world"}` {
			t.Errorf("got data %s, want {\"hello\":\"world\"}", evt.Data)
		}
		return
	}
	t.Fatalf("stream closed before delivering an event: %v", scanner.Err())
}

func TestProtectedRoutesStillRequireHeader(t *testing.T) {
	srv, _, _ := testServer(t)

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	resp := get(t, ctx, srv.URL+"/api/streams")
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusUnauthorized {
		t.Errorf("unauthenticated /api/streams returned %d, want 401", resp.StatusCode)
	}
}

func TestHealthIsPublic(t *testing.T) {
	srv, _, _ := testServer(t)

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	resp := get(t, ctx, srv.URL+"/api/health")
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		t.Errorf("public /api/health returned %d, want 200", resp.StatusCode)
	}
}

// TestRateLimitIgnoresForwardedForSpoofing covers the bypass: gin trusts every
// proxy by default, so ClientIP echoed an attacker-controlled X-Forwarded-For
// and each spoofed value got its own fresh token bucket.
func TestRateLimitIgnoresForwardedForSpoofing(t *testing.T) {
	srv, _, _ := testServerWithConfig(t, "1")

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	limited := false
	for i := 0; i < 20; i++ {
		req, err := http.NewRequestWithContext(ctx, http.MethodGet, srv.URL+"/api/health", nil)
		if err != nil {
			t.Fatalf("build request: %v", err)
		}
		// A different "source" every time; the limiter must not believe it.
		req.Header.Set("X-Forwarded-For", fmt.Sprintf("203.0.113.%d", i+1))

		resp, err := http.DefaultClient.Do(req)
		if err != nil {
			t.Fatalf("GET /api/health: %v", err)
		}
		if err := resp.Body.Close(); err != nil {
			t.Fatalf("close body: %v", err)
		}
		if resp.StatusCode == http.StatusTooManyRequests {
			limited = true
			break
		}
	}

	if !limited {
		t.Error("spoofed X-Forwarded-For headers bypassed the rate limiter")
	}
}

// TestNoRouteWithoutFrontend: with no built frontend there is nothing to serve,
// which used to come back as 200 with an empty body.
func TestNoRouteWithoutFrontend(t *testing.T) {
	srv, _, _ := testServer(t)

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	resp := get(t, ctx, srv.URL+"/no/such/path")
	defer resp.Body.Close()

	if _, err := os.Stat("./static/index.html"); err == nil {
		t.Skip("a built frontend is present; the SPA fallback applies instead")
	}
	if resp.StatusCode != http.StatusNotFound {
		t.Errorf("unknown path returned %d, want 404", resp.StatusCode)
	}
}

// TestSSEHeadersArriveBeforeAnyEvent: response headers used to flush only with
// the first event, so EventSource's onopen could sit unfired for the full
// 30-second keepalive interval on a quiet subject.
func TestSSEHeadersArriveBeforeAnyEvent(t *testing.T) {
	srv, auth, _ := testServer(t)
	ticket := mintTicket(t, srv, auth)

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	// Nothing is ever published on this subject.
	resp := get(t, ctx, srv.URL+"/api/messages/subscribe?subject=silent.subject&ticket="+ticket)
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		t.Fatalf("silent stream returned %d, want 200", resp.StatusCode)
	}
	if ct := resp.Header.Get("Content-Type"); !strings.HasPrefix(ct, "text/event-stream") {
		t.Errorf("got Content-Type %q, want text/event-stream", ct)
	}
}
