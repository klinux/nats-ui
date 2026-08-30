package handler

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/nats-io/nats.go/jetstream"

	natsclient "nats-ui-backend/internal/nats"
	"nats-ui-backend/internal/testutil"
)

// fetchFixture creates a stream with a durable pull consumer and n messages.
func fetchFixture(t *testing.T, n int) (*gin.Engine, *natsclient.Client) {
	t.Helper()
	gin.SetMode(gin.TestMode)

	nc := testutil.StartNATS(t)
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	stream, err := nc.JS().CreateStream(ctx, jetstream.StreamConfig{
		Name:     "ORDERS",
		Subjects: []string{"orders.>"},
	})
	if err != nil {
		t.Fatalf("create stream: %v", err)
	}
	if _, err := stream.CreateOrUpdateConsumer(ctx, jetstream.ConsumerConfig{
		Durable:   "worker",
		AckPolicy: jetstream.AckExplicitPolicy,
	}); err != nil {
		t.Fatalf("create consumer: %v", err)
	}

	for i := 0; i < n; i++ {
		payload, err := json.Marshal(map[string]int{"n": i})
		if err != nil {
			t.Fatalf("marshal payload: %v", err)
		}
		if _, err := nc.JS().Publish(ctx, "orders.created", payload); err != nil {
			t.Fatalf("publish: %v", err)
		}
	}

	h := NewConsumersHandler(nc)
	r := gin.New()
	r.POST("/streams/:name/consumers/:consumer/next", h.NextMessage)
	return r, nc
}

type fetchedMessage struct {
	Sequence uint64 `json:"sequence"`
	Subject  string `json:"subject"`
}

func fetchNext(t *testing.T, r *gin.Engine, query string) []fetchedMessage {
	t.Helper()

	w := httptest.NewRecorder()
	r.ServeHTTP(w, httptest.NewRequest(http.MethodPost, "/streams/ORDERS/consumers/worker/next"+query, nil))
	if w.Code != http.StatusOK {
		t.Fatalf("fetch returned %d: %s", w.Code, w.Body.String())
	}

	var msgs []fetchedMessage
	if err := json.Unmarshal(w.Body.Bytes(), &msgs); err != nil {
		t.Fatalf("decode fetch response: %v (body %s)", err, w.Body.String())
	}
	return msgs
}

// TestNextMessageIsNonDestructiveByDefault: browsing a consumer from the UI
// must not consume its messages. Previously every fetch acked, so simply
// looking at a message removed it from the consumer for good.
func TestNextMessageIsNonDestructiveByDefault(t *testing.T) {
	r, _ := fetchFixture(t, 3)

	first := fetchNext(t, r, "?batch=1")
	if len(first) != 1 {
		t.Fatalf("got %d messages, want 1", len(first))
	}

	second := fetchNext(t, r, "?batch=1")
	if len(second) != 1 {
		t.Fatalf("got %d messages on second fetch, want 1", len(second))
	}
	if second[0].Sequence != first[0].Sequence {
		t.Errorf("message was consumed: first fetch seq %d, second fetch seq %d",
			first[0].Sequence, second[0].Sequence)
	}
}

// TestNextMessageAcksWhenAsked keeps the drain workflow available behind an
// explicit opt-in.
func TestNextMessageAcksWhenAsked(t *testing.T) {
	r, _ := fetchFixture(t, 3)

	first := fetchNext(t, r, "?batch=1&ack=true")
	if len(first) != 1 {
		t.Fatalf("got %d messages, want 1", len(first))
	}

	second := fetchNext(t, r, "?batch=1&ack=true")
	if len(second) != 1 {
		t.Fatalf("got %d messages on second fetch, want 1", len(second))
	}
	if second[0].Sequence == first[0].Sequence {
		t.Errorf("ack=true did not consume the message: both fetches returned seq %d",
			first[0].Sequence)
	}
}

func TestNextMessageEmptyConsumer(t *testing.T) {
	r, _ := fetchFixture(t, 0)

	msgs := fetchNext(t, r, "?batch=5")
	if len(msgs) != 0 {
		t.Errorf("got %d messages from an empty stream, want 0", len(msgs))
	}
}

func TestNextMessageUnknownConsumer(t *testing.T) {
	r, _ := fetchFixture(t, 1)

	w := httptest.NewRecorder()
	r.ServeHTTP(w, httptest.NewRequest(http.MethodPost, "/streams/ORDERS/consumers/ghost/next", nil))
	if w.Code != http.StatusNotFound {
		t.Errorf("got status %d for unknown consumer, want 404", w.Code)
	}
}

func TestParseBatch(t *testing.T) {
	tests := []struct {
		raw  string
		want int
	}{
		{"", defaultFetchBatch},
		{"garbage", defaultFetchBatch},
		{"0", defaultFetchBatch},
		{"-5", defaultFetchBatch},
		{"1", 1},
		{"50", 50},
		{"100", maxFetchBatch},
		{"9999", maxFetchBatch},
		{"99999999999999999999", defaultFetchBatch}, // overflows Atoi
	}

	for _, tt := range tests {
		if got := parseBatch(tt.raw); got != tt.want {
			t.Errorf("parseBatch(%q) = %d, want %d", tt.raw, got, tt.want)
		}
	}
}
