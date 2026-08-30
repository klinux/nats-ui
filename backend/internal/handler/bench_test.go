package handler

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/gin-gonic/gin"

	natsclient "nats-ui-backend/internal/nats"
	"nats-ui-backend/internal/testutil"
)

func benchRouter(t *testing.T) (*gin.Engine, *natsclient.Client) {
	t.Helper()
	gin.SetMode(gin.TestMode)

	nc := testutil.StartNATS(t)
	r := gin.New()
	r.POST("/bench", NewBenchHandler(nc).Run)
	return r, nc
}

func runBench(t *testing.T, r *gin.Engine, body string) *httptest.ResponseRecorder {
	t.Helper()
	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/bench", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	r.ServeHTTP(w, req)
	return w
}

// TestBenchDoesNotLeakSubscriptions covers the leak that made every benchmark
// run permanently strand goroutines: subscriber goroutines ranged over a
// channel that is never closed, so they blocked forever and their
// subscriptions were never torn down.
func TestBenchDoesNotLeakSubscriptions(t *testing.T) {
	r, nc := benchRouter(t)

	before := nc.Conn().NumSubscriptions()

	// 100 messages across 3 publishers: integer division published only 99, so
	// the subscriber's "received >= num_msgs" exit condition was unreachable
	// and its goroutine blocked on the channel forever.
	w := runBench(t, r, `{"subject":"bench.leak","num_msgs":100,"num_subs":1,"num_pubs":3,"msg_size":16}`)
	if w.Code != http.StatusOK {
		t.Fatalf("bench returned %d: %s", w.Code, w.Body.String())
	}

	deadline := time.Now().Add(5 * time.Second)
	for nc.Conn().NumSubscriptions() > before && time.Now().Before(deadline) {
		time.Sleep(20 * time.Millisecond)
	}

	if got := nc.Conn().NumSubscriptions(); got > before {
		t.Errorf("benchmark leaked %d subscription(s)", got-before)
	}
}

func TestBenchRejectsOversizedPayload(t *testing.T) {
	r, _ := benchRouter(t)

	w := runBench(t, r, `{"subject":"bench.big","msg_size":2000000000,"num_msgs":1}`)
	if w.Code != http.StatusBadRequest {
		t.Errorf("oversized msg_size returned %d, want 400", w.Code)
	}
}

func TestBenchReportsResults(t *testing.T) {
	r, _ := benchRouter(t)

	w := runBench(t, r, `{"subject":"bench.ok","num_msgs":100,"num_pubs":3,"num_subs":1,"msg_size":32}`)
	if w.Code != http.StatusOK {
		t.Fatalf("bench returned %d: %s", w.Code, w.Body.String())
	}

	var result BenchResult
	if err := json.Unmarshal(w.Body.Bytes(), &result); err != nil {
		t.Fatalf("decode result: %v", err)
	}

	// 100 messages across 3 publishers must not silently drop the remainder.
	if result.TotalMsgs != 100 {
		t.Errorf("got total_msgs %d, want 100", result.TotalMsgs)
	}
	if result.TotalBytes != 100*32 {
		t.Errorf("got total_bytes %d, want %d", result.TotalBytes, 100*32)
	}
	if result.MsgsPerSec <= 0 {
		t.Errorf("got msgs_per_sec %f, want > 0", result.MsgsPerSec)
	}
}

func TestBenchDefaultsAreClamped(t *testing.T) {
	r, _ := benchRouter(t)

	w := runBench(t, r, `{"subject":"bench.clamp","num_msgs":10,"num_pubs":-4,"num_subs":-1,"msg_size":0}`)
	if w.Code != http.StatusOK {
		t.Fatalf("bench returned %d: %s", w.Code, w.Body.String())
	}

	var result BenchResult
	if err := json.Unmarshal(w.Body.Bytes(), &result); err != nil {
		t.Fatalf("decode result: %v", err)
	}
	if result.Publishers != 1 {
		t.Errorf("got publishers %d, want 1", result.Publishers)
	}
	if result.Subscribers != 0 {
		t.Errorf("got subscribers %d, want 0", result.Subscribers)
	}
	if result.MsgSize <= 0 {
		t.Errorf("got msg_size %d, want the default", result.MsgSize)
	}
}
