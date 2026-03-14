package middleware

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
)

func TestGenerateToken(t *testing.T) {
	auth := NewAuthMiddleware("test-secret")

	tokenStr, err := auth.GenerateToken("admin")
	if err != nil {
		t.Fatalf("GenerateToken returned error: %v", err)
	}
	if tokenStr == "" {
		t.Fatal("GenerateToken returned empty token")
	}

	// Parse and verify claims
	token, err := jwt.Parse(tokenStr, func(t *jwt.Token) (any, error) {
		return []byte("test-secret"), nil
	})
	if err != nil {
		t.Fatalf("failed to parse generated token: %v", err)
	}
	claims, ok := token.Claims.(jwt.MapClaims)
	if !ok {
		t.Fatal("claims are not MapClaims")
	}
	if claims["sub"] != "admin" {
		t.Errorf("got sub %q, want %q", claims["sub"], "admin")
	}
}

func TestRequireAuth(t *testing.T) {
	secret := "test-secret-key"
	auth := NewAuthMiddleware(secret)
	validToken, _ := auth.GenerateToken("testuser")

	// Build an expired token
	expiredClaims := jwt.MapClaims{
		"sub": "testuser",
		"iat": time.Now().Add(-2 * time.Hour).Unix(),
		"exp": time.Now().Add(-1 * time.Hour).Unix(),
	}
	expiredToken, _ := jwt.NewWithClaims(jwt.SigningMethodHS256, expiredClaims).
		SignedString([]byte(secret))

	// Build a token with wrong signing method (RS256 header but HMAC signed)
	wrongMethodToken := forgeWrongMethodToken(t)

	tests := []struct {
		name      string
		authHeader string
		wantCode  int
		wantError string
		wantUser  string
	}{
		{
			name:       "valid token sets user in context",
			authHeader: "Bearer " + validToken,
			wantCode:   http.StatusOK,
			wantUser:   "testuser",
		},
		{
			name:       "no authorization header",
			authHeader: "",
			wantCode:   http.StatusUnauthorized,
			wantError:  "missing authorization header",
		},
		{
			name:       "invalid format without Bearer prefix",
			authHeader: "Token " + validToken,
			wantCode:   http.StatusUnauthorized,
			wantError:  "invalid authorization format",
		},
		{
			name:       "just Bearer with no token",
			authHeader: "Basic abc123",
			wantCode:   http.StatusUnauthorized,
			wantError:  "invalid authorization format",
		},
		{
			name:       "expired token",
			authHeader: "Bearer " + expiredToken,
			wantCode:   http.StatusUnauthorized,
			wantError:  "invalid or expired token",
		},
		{
			name:       "wrong signing method",
			authHeader: "Bearer " + wrongMethodToken,
			wantCode:   http.StatusUnauthorized,
			wantError:  "invalid or expired token",
		},
		{
			name:       "malformed token string",
			authHeader: "Bearer not.a.valid.jwt",
			wantCode:   http.StatusUnauthorized,
			wantError:  "invalid or expired token",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			w := httptest.NewRecorder()
			c, r := gin.CreateTestContext(w)

			var capturedUser any
			r.GET("/protected", auth.RequireAuth(), func(c *gin.Context) {
				capturedUser, _ = c.Get("user")
				c.Status(http.StatusOK)
			})

			req := httptest.NewRequest(http.MethodGet, "/protected", nil)
			if tt.authHeader != "" {
				req.Header.Set("Authorization", tt.authHeader)
			}
			c.Request = req
			r.ServeHTTP(w, c.Request)

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

			if tt.wantUser != "" {
				if capturedUser != tt.wantUser {
					t.Errorf("got user %v, want %q", capturedUser, tt.wantUser)
				}
			}
		})
	}
}

// forgeWrongMethodToken creates a token that claims RS256 in header but is
// actually signed with a different key, causing the signing method check to fail.
func forgeWrongMethodToken(t *testing.T) string {
	t.Helper()
	// Use "none" signing method — the middleware rejects anything not HMAC
	token := jwt.NewWithClaims(jwt.SigningMethodNone, jwt.MapClaims{
		"sub": "hacker",
		"exp": time.Now().Add(time.Hour).Unix(),
	})
	s, err := token.SignedString(jwt.UnsafeAllowNoneSignatureType)
	if err != nil {
		t.Fatalf("failed to create none-signed token: %v", err)
	}
	return s
}
