package middleware

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
)

func init() {
	gin.SetMode(gin.TestMode)
}

func TestValidatePathParam(t *testing.T) {
	tests := []struct {
		name       string
		paramValue string
		wantCode   int
		wantError  string
	}{
		{name: "valid alphanumeric", paramValue: "myStream123", wantCode: http.StatusOK},
		{name: "valid with dash", paramValue: "my-stream", wantCode: http.StatusOK},
		{name: "valid with underscore", paramValue: "my_stream", wantCode: http.StatusOK},
		{name: "valid with dot", paramValue: "my.stream", wantCode: http.StatusOK},
		{name: "valid mixed", paramValue: "a-b_c.d", wantCode: http.StatusOK},
		{name: "exactly 256 chars", paramValue: strings.Repeat("a", 256), wantCode: http.StatusOK},
		{name: "too long 257 chars", paramValue: strings.Repeat("a", 257), wantCode: http.StatusBadRequest, wantError: "name is too long (max 256)"},
		{name: "invalid with @", paramValue: "my@stream", wantCode: http.StatusBadRequest, wantError: "name contains invalid characters"},
		{name: "invalid with !", paramValue: "stream!", wantCode: http.StatusBadRequest, wantError: "name contains invalid characters"},
		{name: "invalid with backslash", paramValue: `my\stream`, wantCode: http.StatusBadRequest, wantError: "name contains invalid characters"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			w := httptest.NewRecorder()
			_, r := gin.CreateTestContext(w)

			r.GET("/test/:name", ValidatePathParam("name"), func(c *gin.Context) {
				c.Status(http.StatusOK)
			})

			req := httptest.NewRequest(http.MethodGet, "/test/"+tt.paramValue, nil)
			r.ServeHTTP(w, req)

			if w.Code != tt.wantCode {
				t.Errorf("got status %d, want %d", w.Code, tt.wantCode)
			}

			if tt.wantError != "" {
				var resp map[string]string
				if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
					t.Fatalf("failed to parse response: %v", err)
				}
				if resp["error"] != tt.wantError {
					t.Errorf("got error %q, want %q", resp["error"], tt.wantError)
				}
			}
		})
	}
}

func TestValidatePathParamEmpty(t *testing.T) {
	// Gin returns 404 for empty path params since the route doesn't match.
	// The middleware itself handles empty params with 400, but gin routing
	// intercepts first. This test verifies that behavior.
	w := httptest.NewRecorder()
	_, r := gin.CreateTestContext(w)

	r.GET("/test/:name", ValidatePathParam("name"), func(c *gin.Context) {
		c.Status(http.StatusOK)
	})

	req := httptest.NewRequest(http.MethodGet, "/test/", nil)
	r.ServeHTTP(w, req)

	// Gin returns 301 redirect for trailing slash or 404, not 400
	if w.Code == http.StatusOK {
		t.Error("expected non-200 for empty param, got 200")
	}
}
