package handler

import (
	"bytes"
	"context"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/nats-io/nats.go/jetstream"

	"nats-ui-backend/internal/testutil"
)

const testUploadLimit = 1024

func objectStoreRouter(t *testing.T) *gin.Engine {
	t.Helper()
	gin.SetMode(gin.TestMode)

	nc := testutil.StartNATS(t)
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	if _, err := nc.JS().CreateObjectStore(ctx, jetstream.ObjectStoreConfig{Bucket: "assets"}); err != nil {
		t.Fatalf("create object store: %v", err)
	}

	h := NewObjectStoreHandler(nc, testUploadLimit)
	r := gin.New()
	r.PUT("/objectstore/:bucket/objects/:name", h.PutObject)
	r.GET("/objectstore/:bucket/objects/:name", h.GetObject)
	return r
}

func putObject(t *testing.T, r *gin.Engine, name string, body []byte) *httptest.ResponseRecorder {
	t.Helper()
	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPut, "/objectstore/assets/objects/"+name, bytes.NewReader(body))
	r.ServeHTTP(w, req)
	return w
}

// TestPutObjectRejectsOversizedUpload: the handler used to io.ReadAll the whole
// request body into memory with no ceiling, so one request could exhaust RAM.
func TestPutObjectRejectsOversizedUpload(t *testing.T) {
	r := objectStoreRouter(t)

	w := putObject(t, r, "big.bin", bytes.Repeat([]byte("x"), testUploadLimit+1))
	if w.Code != http.StatusRequestEntityTooLarge {
		t.Errorf("oversized upload returned %d, want 413 (body %s)", w.Code, w.Body.String())
	}
}

func TestPutObjectAcceptsUploadAtTheLimit(t *testing.T) {
	r := objectStoreRouter(t)

	w := putObject(t, r, "exact.bin", bytes.Repeat([]byte("x"), testUploadLimit))
	if w.Code != http.StatusOK {
		t.Errorf("upload at the limit returned %d, want 200 (body %s)", w.Code, w.Body.String())
	}
}

func TestObjectRoundTripPreservesBytes(t *testing.T) {
	r := objectStoreRouter(t)

	// Binary payload with a PNG magic number so content sniffing has something
	// to detect beyond plain text.
	payload := append([]byte("\x89PNG\r\n\x1a\n"), bytes.Repeat([]byte{0x00, 0xff, 0x7f}, 100)...)

	if w := putObject(t, r, "image.png", payload); w.Code != http.StatusOK {
		t.Fatalf("upload returned %d: %s", w.Code, w.Body.String())
	}

	w := httptest.NewRecorder()
	r.ServeHTTP(w, httptest.NewRequest(http.MethodGet, "/objectstore/assets/objects/image.png", nil))
	if w.Code != http.StatusOK {
		t.Fatalf("download returned %d: %s", w.Code, w.Body.String())
	}
	if !bytes.Equal(w.Body.Bytes(), payload) {
		t.Errorf("downloaded %d bytes, want the %d uploaded", w.Body.Len(), len(payload))
	}
	if ct := w.Header().Get("Content-Type"); ct != "image/png" {
		t.Errorf("got Content-Type %q, want image/png", ct)
	}
}

func TestGetObjectHandlesEmptyObject(t *testing.T) {
	r := objectStoreRouter(t)

	if w := putObject(t, r, "empty.bin", nil); w.Code != http.StatusOK {
		t.Fatalf("upload returned %d: %s", w.Code, w.Body.String())
	}

	w := httptest.NewRecorder()
	r.ServeHTTP(w, httptest.NewRequest(http.MethodGet, "/objectstore/assets/objects/empty.bin", nil))
	if w.Code != http.StatusOK {
		t.Fatalf("download returned %d: %s", w.Code, w.Body.String())
	}
	if w.Body.Len() != 0 {
		t.Errorf("got %d bytes for an empty object, want 0", w.Body.Len())
	}
}

func TestGetObjectMissing(t *testing.T) {
	r := objectStoreRouter(t)

	w := httptest.NewRecorder()
	r.ServeHTTP(w, httptest.NewRequest(http.MethodGet, "/objectstore/assets/objects/ghost.bin", nil))
	if w.Code != http.StatusNotFound {
		t.Errorf("missing object returned %d, want 404", w.Code)
	}
}
