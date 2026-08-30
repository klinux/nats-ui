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

	"nats-ui-backend/internal/testutil"
)

// listAllFixture builds several streams, each with its own consumers.
func listAllFixture(t *testing.T, streams, consumersPerStream int) *gin.Engine {
	t.Helper()
	gin.SetMode(gin.TestMode)

	nc := testutil.StartNATS(t)
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	for i := 0; i < streams; i++ {
		name := "STREAM" + string(rune('A'+i))
		stream, err := nc.JS().CreateStream(ctx, jetstream.StreamConfig{
			Name:     name,
			Subjects: []string{name + ".>"},
		})
		if err != nil {
			t.Fatalf("create stream %s: %v", name, err)
		}
		for j := 0; j < consumersPerStream; j++ {
			if _, err := stream.CreateOrUpdateConsumer(ctx, jetstream.ConsumerConfig{
				Durable:   name + "-worker" + string(rune('0'+j)),
				AckPolicy: jetstream.AckExplicitPolicy,
			}); err != nil {
				t.Fatalf("create consumer on %s: %v", name, err)
			}
		}
	}

	r := gin.New()
	r.GET("/consumers", NewConsumersHandler(nc).ListAll)
	return r
}

func listAll(t *testing.T, r *gin.Engine) []map[string]any {
	t.Helper()

	w := httptest.NewRecorder()
	r.ServeHTTP(w, httptest.NewRequest(http.MethodGet, "/consumers", nil))
	if w.Code != http.StatusOK {
		t.Fatalf("ListAll returned %d: %s", w.Code, w.Body.String())
	}

	var consumers []map[string]any
	if err := json.Unmarshal(w.Body.Bytes(), &consumers); err != nil {
		t.Fatalf("decode response: %v (body %s)", err, w.Body.String())
	}
	return consumers
}

// TestListAllConsumers replaces the frontend's N+1: it walked every stream and
// issued one request per stream every 10 seconds, which on its own exceeded the
// default 20 rps rate limit.
func TestListAllConsumers(t *testing.T) {
	r := listAllFixture(t, 4, 3)

	consumers := listAll(t, r)
	if len(consumers) != 12 {
		t.Fatalf("got %d consumers, want 12", len(consumers))
	}

	// Every entry must carry its stream, which the caller needs to act on it.
	streams := make(map[string]int)
	for _, consumer := range consumers {
		name, ok := consumer["stream_name"].(string)
		if !ok || name == "" {
			t.Fatalf("consumer %v has no stream_name", consumer)
		}
		if _, ok := consumer["name"].(string); !ok {
			t.Errorf("consumer %v has no name", consumer)
		}
		streams[name]++
	}
	if len(streams) != 4 {
		t.Errorf("got consumers from %d streams, want 4", len(streams))
	}
	for name, count := range streams {
		if count != 3 {
			t.Errorf("stream %s returned %d consumers, want 3", name, count)
		}
	}
}

func TestListAllConsumersWithNoStreams(t *testing.T) {
	r := listAllFixture(t, 0, 0)

	if consumers := listAll(t, r); len(consumers) != 0 {
		t.Errorf("got %d consumers, want 0", len(consumers))
	}
}

func TestListAllConsumersWithStreamWithoutConsumers(t *testing.T) {
	r := listAllFixture(t, 2, 0)

	if consumers := listAll(t, r); len(consumers) != 0 {
		t.Errorf("got %d consumers, want 0", len(consumers))
	}
}
