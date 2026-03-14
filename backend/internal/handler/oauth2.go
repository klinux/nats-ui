package handler

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"net/url"
	"strings"
	"sync"
	"time"

	"github.com/gin-gonic/gin"

	"nats-ui-backend/internal/config"
	"nats-ui-backend/internal/middleware"
)

var oauth2HTTPClient = &http.Client{Timeout: 10 * time.Second}

type OAuth2Provider struct {
	Name         string `json:"name"`
	ClientID     string `json:"clientId"`
	ClientSecret string `json:"-"`
	AuthURL      string `json:"authUrl"`
	TokenURL     string `json:"tokenUrl"`
	UserInfoURL  string `json:"userInfoUrl"`
	Scopes       string `json:"scopes"`
	EmailField   string `json:"-"` // field name in userinfo response
}

type OAuth2Handler struct {
	cfg       *config.Config
	auth      *middleware.AuthMiddleware
	providers map[string]*OAuth2Provider
	states    sync.Map // CSRF state tokens
}

func NewOAuth2Handler(cfg *config.Config, auth *middleware.AuthMiddleware) *OAuth2Handler {
	h := &OAuth2Handler{
		cfg:       cfg,
		auth:      auth,
		providers: make(map[string]*OAuth2Provider),
	}
	h.loadProviders()
	return h
}

func (h *OAuth2Handler) loadProviders() {
	if id := h.cfg.GoogleClientID; id != "" {
		h.providers["google"] = &OAuth2Provider{
			Name:         "google",
			ClientID:     id,
			ClientSecret: h.cfg.GoogleClientSecret,
			AuthURL:      "https://accounts.google.com/o/oauth2/v2/auth",
			TokenURL:     "https://oauth2.googleapis.com/token",
			UserInfoURL:  "https://www.googleapis.com/oauth2/v2/userinfo",
			Scopes:       "openid email profile",
			EmailField:   "email",
		}
	}
	if id := h.cfg.GitHubClientID; id != "" {
		h.providers["github"] = &OAuth2Provider{
			Name:         "github",
			ClientID:     id,
			ClientSecret: h.cfg.GitHubClientSecret,
			AuthURL:      "https://github.com/login/oauth/authorize",
			TokenURL:     "https://github.com/login/oauth/access_token",
			UserInfoURL:  "https://api.github.com/user",
			Scopes:       "read:user user:email",
			EmailField:   "email",
		}
	}
	if id := h.cfg.KeycloakClientID; id != "" && h.cfg.KeycloakURL != "" {
		base := strings.TrimRight(h.cfg.KeycloakURL, "/") +
			"/realms/" + h.cfg.KeycloakRealm + "/protocol/openid-connect"
		h.providers["keycloak"] = &OAuth2Provider{
			Name:         "keycloak",
			ClientID:     id,
			ClientSecret: h.cfg.KeycloakClientSecret,
			AuthURL:      base + "/auth",
			TokenURL:     base + "/token",
			UserInfoURL:  base + "/userinfo",
			Scopes:       "openid email profile",
			EmailField:   "email",
		}
	}
	if id := h.cfg.OIDCClientID; id != "" && h.cfg.OIDCIssuerURL != "" {
		p := &OAuth2Provider{
			Name:         h.cfg.OIDCName,
			ClientID:     id,
			ClientSecret: h.cfg.OIDCClientSecret,
			Scopes:       h.cfg.OIDCScopes,
			EmailField:   "email",
		}
		if err := discoverOIDC(h.cfg.OIDCIssuerURL, p); err != nil {
			log.Printf("warning: OIDC discovery failed for %s: %v", h.cfg.OIDCIssuerURL, err)
		} else {
			h.providers["oidc"] = p
		}
	}
}

// discoverOIDC fetches the OpenID Connect discovery document and populates provider URLs.
func discoverOIDC(issuerURL string, p *OAuth2Provider) error {
	discoveryURL := strings.TrimRight(issuerURL, "/") + "/.well-known/openid-configuration"
	resp, err := oauth2HTTPClient.Get(discoveryURL)
	if err != nil {
		return fmt.Errorf("fetch discovery: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("discovery returned status %d", resp.StatusCode)
	}

	var doc struct {
		AuthorizationEndpoint string `json:"authorization_endpoint"`
		TokenEndpoint         string `json:"token_endpoint"`
		UserinfoEndpoint      string `json:"userinfo_endpoint"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&doc); err != nil {
		return fmt.Errorf("decode discovery: %w", err)
	}

	if doc.AuthorizationEndpoint == "" || doc.TokenEndpoint == "" {
		return fmt.Errorf("discovery document missing required endpoints")
	}

	p.AuthURL = doc.AuthorizationEndpoint
	p.TokenURL = doc.TokenEndpoint
	p.UserInfoURL = doc.UserinfoEndpoint
	return nil
}

// ListProviders returns enabled OAuth2 providers (without secrets).
func (h *OAuth2Handler) ListProviders(c *gin.Context) {
	var providers []map[string]string
	for name, p := range h.providers {
		providers = append(providers, map[string]string{
			"name":     name,
			"clientId": p.ClientID,
		})
	}
	if providers == nil {
		providers = []map[string]string{}
	}
	c.JSON(http.StatusOK, providers)
}

// Authorize redirects to the OAuth2 provider.
func (h *OAuth2Handler) Authorize(c *gin.Context) {
	provider := c.Param("provider")
	p, ok := h.providers[provider]
	if !ok {
		c.JSON(http.StatusNotFound, gin.H{"error": "unknown provider"})
		return
	}

	state := generateState()
	h.states.Store(state, true)

	redirectURI := h.cfg.BaseURL + "/api/auth/oauth2/" + provider + "/callback"

	authURL := fmt.Sprintf("%s?client_id=%s&redirect_uri=%s&response_type=code&scope=%s&state=%s",
		p.AuthURL,
		url.QueryEscape(p.ClientID),
		url.QueryEscape(redirectURI),
		url.QueryEscape(p.Scopes),
		url.QueryEscape(state),
	)

	c.Redirect(http.StatusTemporaryRedirect, authURL)
}

// Callback handles the OAuth2 callback.
func (h *OAuth2Handler) Callback(c *gin.Context) {
	provider := c.Param("provider")
	p, ok := h.providers[provider]
	if !ok {
		c.JSON(http.StatusNotFound, gin.H{"error": "unknown provider"})
		return
	}

	state := c.Query("state")
	if _, ok := h.states.LoadAndDelete(state); !ok {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid state"})
		return
	}

	code := c.Query("code")
	if code == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "missing code"})
		return
	}

	redirectURI := h.cfg.BaseURL + "/api/auth/oauth2/" + provider + "/callback"

	// Exchange code for token
	accessToken, err := exchangeCode(p, code, redirectURI)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "token exchange failed: " + err.Error()})
		return
	}

	// Get user info
	email, err := getUserEmail(p, accessToken)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to get user info: " + err.Error()})
		return
	}

	// Check if user is allowed
	if !h.cfg.IsAllowedOAuth2User(email) {
		c.JSON(http.StatusForbidden, gin.H{"error": "user not authorized"})
		return
	}

	// Generate JWT
	token, err := h.auth.GenerateToken(email)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to generate token"})
		return
	}

	// Redirect to frontend with token
	c.Redirect(http.StatusTemporaryRedirect, "/?token="+url.QueryEscape(token))
}

func generateState() string {
	b := make([]byte, 16)
	rand.Read(b)
	return hex.EncodeToString(b)
}
