package middleware

import (
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
)

type AuthMiddleware struct {
	secret []byte
}

func NewAuthMiddleware(secret string) *AuthMiddleware {
	return &AuthMiddleware{secret: []byte(secret)}
}

func (a *AuthMiddleware) GenerateToken(username string) (string, error) {
	claims := jwt.MapClaims{
		"sub": username,
		"iat": time.Now().Unix(),
		"exp": time.Now().Add(24 * time.Hour).Unix(),
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString(a.secret)
}

func (a *AuthMiddleware) RequireAuth() gin.HandlerFunc {
	parser := jwt.NewParser(jwt.WithValidMethods([]string{jwt.SigningMethodHS256.Alg()}))

	return func(c *gin.Context) {
		auth := c.GetHeader("Authorization")
		if auth == "" {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "missing authorization header"})
			return
		}

		tokenStr := strings.TrimPrefix(auth, "Bearer ")
		if tokenStr == auth {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "invalid authorization format"})
			return
		}

		claims, ok := a.parseClaims(parser, tokenStr)
		if !ok {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "invalid or expired token"})
			return
		}

		// Stream tickets travel in URLs and are therefore easier to leak; they
		// must never be replayable as a session token.
		if isStreamTicket(claims) {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "stream ticket is not a session token"})
			return
		}

		c.Set("user", claims["sub"])
		c.Next()
	}
}
