package middleware

import (
	"net/http"
	"slices"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
)

const (
	// streamAudience scopes a token to the SSE endpoints only.
	streamAudience = "sse"

	// StreamTicketTTL is how long a stream ticket stays valid. Tickets travel in
	// the query string (EventSource cannot send an Authorization header), so they
	// can end up in proxy access logs — keep the exposure window small. The
	// frontend mints a fresh ticket on every connection attempt, so a short TTL
	// never interferes with reconnects.
	StreamTicketTTL = 2 * time.Minute
)

// GenerateStreamTicket issues a short-lived, audience-scoped token for the SSE
// endpoints. It is deliberately NOT interchangeable with a session token:
// RequireAuth rejects it, and RequireStreamAuth rejects session tokens.
func (a *AuthMiddleware) GenerateStreamTicket(username string) (string, error) {
	now := time.Now()
	claims := jwt.MapClaims{
		"sub": username,
		"aud": streamAudience,
		"iat": now.Unix(),
		"exp": now.Add(StreamTicketTTL).Unix(),
	}
	return jwt.NewWithClaims(jwt.SigningMethodHS256, claims).SignedString(a.secret)
}

// RequireStreamAuth authenticates SSE requests using a ticket query parameter.
func (a *AuthMiddleware) RequireStreamAuth() gin.HandlerFunc {
	parser := jwt.NewParser(
		jwt.WithValidMethods([]string{jwt.SigningMethodHS256.Alg()}),
		jwt.WithAudience(streamAudience),
		jwt.WithExpirationRequired(),
	)

	return func(c *gin.Context) {
		ticket := c.Query("ticket")
		if ticket == "" {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "missing stream ticket"})
			return
		}

		claims, ok := a.parseClaims(parser, ticket)
		if !ok {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "invalid or expired stream ticket"})
			return
		}

		c.Set("user", claims["sub"])
		c.Next()
	}
}

// parseClaims validates a token with the given parser and returns its claims.
func (a *AuthMiddleware) parseClaims(parser *jwt.Parser, tokenStr string) (jwt.MapClaims, bool) {
	token, err := parser.Parse(tokenStr, func(*jwt.Token) (any, error) { return a.secret, nil })
	if err != nil || !token.Valid {
		return nil, false
	}
	claims, ok := token.Claims.(jwt.MapClaims)
	if !ok {
		return nil, false
	}
	return claims, true
}

// isStreamTicket reports whether the claims carry the SSE audience.
func isStreamTicket(claims jwt.MapClaims) bool {
	aud, err := claims.GetAudience()
	if err != nil {
		return false
	}
	return slices.Contains(aud, streamAudience)
}
