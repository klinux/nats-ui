package middleware

import (
	"net/http"
	"regexp"

	"github.com/gin-gonic/gin"
)

// validName matches NATS-safe identifiers: alphanumeric, dash, underscore, dot
var validName = regexp.MustCompile(`^[a-zA-Z0-9_\-\.]+$`)

// ValidatePathParam validates that a URL parameter is a safe NATS identifier.
func ValidatePathParam(paramName string) gin.HandlerFunc {
	return func(c *gin.Context) {
		value := c.Param(paramName)
		if value == "" {
			c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{"error": paramName + " is required"})
			return
		}
		if len(value) > 256 {
			c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{"error": paramName + " is too long (max 256)"})
			return
		}
		if !validName.MatchString(value) {
			c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{"error": paramName + " contains invalid characters"})
			return
		}
		c.Next()
	}
}
