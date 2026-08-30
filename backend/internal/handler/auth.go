package handler

import (
	"log"
	"net/http"

	"github.com/gin-gonic/gin"
	"golang.org/x/crypto/bcrypt"

	"nats-ui-backend/internal/config"
	"nats-ui-backend/internal/middleware"
)

type AuthHandler struct {
	cfg  *config.Config
	auth *middleware.AuthMiddleware
	hash []byte
}

func NewAuthHandler(cfg *config.Config, auth *middleware.AuthMiddleware) *AuthHandler {
	hash, _ := bcrypt.GenerateFromPassword([]byte(cfg.AdminPass), bcrypt.DefaultCost)
	return &AuthHandler{cfg: cfg, auth: auth, hash: hash}
}

type loginRequest struct {
	Username string `json:"username" binding:"required"`
	Password string `json:"password" binding:"required"`
}

func (h *AuthHandler) Login(c *gin.Context) {
	var req loginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "username and password required"})
		return
	}

	if req.Username != h.cfg.AdminUser {
		log.Printf("auth: failed login attempt for user %q from %s", req.Username, c.ClientIP())
		c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid credentials"})
		return
	}

	if err := bcrypt.CompareHashAndPassword(h.hash, []byte(req.Password)); err != nil {
		log.Printf("auth: failed login attempt for user %q from %s", req.Username, c.ClientIP())
		c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid credentials"})
		return
	}

	token, err := h.auth.GenerateToken(req.Username)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to generate token"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"token":    token,
		"username": req.Username,
	})
}

func (h *AuthHandler) Me(c *gin.Context) {
	user, _ := c.Get("user")
	c.JSON(http.StatusOK, gin.H{"username": user})
}

// StreamTicket issues a short-lived, SSE-scoped ticket for the caller.
//
// EventSource cannot send an Authorization header, so the SSE endpoints
// authenticate with this ticket in the query string instead of the 24h session
// token — a URL-borne credential ends up in proxy logs, so it must expire fast
// and be useless anywhere else.
func (h *AuthHandler) StreamTicket(c *gin.Context) {
	user, ok := c.Get("user")
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "not authenticated"})
		return
	}

	username, ok := user.(string)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid user claim"})
		return
	}

	ticket, err := h.auth.GenerateStreamTicket(username)
	if err != nil {
		log.Printf("auth: failed to generate stream ticket for %q: %v", username, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to generate stream ticket"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"ticket":     ticket,
		"expires_in": int(middleware.StreamTicketTTL.Seconds()),
	})
}
