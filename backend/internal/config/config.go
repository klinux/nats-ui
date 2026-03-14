package config

import (
	"log"
	"os"
	"strings"
)

type Config struct {
	Port               string
	BaseURL            string
	NatsURL            string
	NatsUser           string
	NatsPass           string
	NatsMonitoringURL  string // HTTP monitoring URL, defaults to derived from NatsURL
	AdminUser          string
	AdminPass          string
	JWTSecret          string
	CORSOrigins        string // comma-separated allowed origins, "*" for all
	GoogleClientID     string
	GoogleClientSecret string
	GitHubClientID     string
	GitHubClientSecret string
	AllowedOAuth2Users string // comma-separated emails, "*" for all
	RateLimitRPS       string // requests per second, default "20"

	// Keycloak
	KeycloakURL          string // e.g. https://keycloak.example.com
	KeycloakRealm        string
	KeycloakClientID     string
	KeycloakClientSecret string

	// Generic OIDC
	OIDCName         string // display name, e.g. "Corporate SSO"
	OIDCIssuerURL    string // OIDC issuer URL (used for discovery)
	OIDCClientID     string
	OIDCClientSecret string
	OIDCScopes       string // space-separated, defaults to "openid email profile"
}

func Load() *Config {
	cfg := &Config{
		Port:              getEnv("PORT", "3001"),
		BaseURL:           getEnv("BASE_URL", "http://localhost:3001"),
		NatsURL:           getEnv("NATS_URL", "nats://localhost:4222"),
		NatsUser:          getEnv("NATS_USER", "admin"),
		NatsPass:          getEnv("NATS_PASS", ""),
		NatsMonitoringURL: os.Getenv("NATS_MONITORING_URL"),
		AdminUser:         getEnv("ADMIN_USER", "admin"),
		AdminPass:         getEnv("ADMIN_PASS", "admin"),
		JWTSecret:         getEnv("JWT_SECRET", "change-me-in-production"),
		CORSOrigins:       getEnv("CORS_ORIGINS", "*"),
		RateLimitRPS:      getEnv("RATE_LIMIT_RPS", "20"),
		GoogleClientID:     os.Getenv("GOOGLE_CLIENT_ID"),
		GoogleClientSecret: os.Getenv("GOOGLE_CLIENT_SECRET"),
		GitHubClientID:     os.Getenv("GITHUB_CLIENT_ID"),
		GitHubClientSecret: os.Getenv("GITHUB_CLIENT_SECRET"),
		AllowedOAuth2Users: getEnv("ALLOWED_OAUTH2_USERS", "*"),

		KeycloakURL:          os.Getenv("KEYCLOAK_URL"),
		KeycloakRealm:        getEnv("KEYCLOAK_REALM", "master"),
		KeycloakClientID:     os.Getenv("KEYCLOAK_CLIENT_ID"),
		KeycloakClientSecret: os.Getenv("KEYCLOAK_CLIENT_SECRET"),

		OIDCName:         getEnv("OIDC_NAME", "SSO"),
		OIDCIssuerURL:    os.Getenv("OIDC_ISSUER_URL"),
		OIDCClientID:     os.Getenv("OIDC_CLIENT_ID"),
		OIDCClientSecret: os.Getenv("OIDC_CLIENT_SECRET"),
		OIDCScopes:       getEnv("OIDC_SCOPES", "openid email profile"),
	}

	if cfg.JWTSecret == "change-me-in-production" {
		log.Println("WARNING: using default JWT_SECRET, set a strong secret in production")
	}
	if cfg.AdminPass == "admin" {
		log.Println("WARNING: using default ADMIN_PASS, change it in production")
	}

	return cfg
}

func (c *Config) CORSOriginsList() []string {
	if c.CORSOrigins == "*" {
		return []string{"*"}
	}
	var origins []string
	for _, o := range strings.Split(c.CORSOrigins, ",") {
		o = strings.TrimSpace(o)
		if o != "" {
			origins = append(origins, o)
		}
	}
	if len(origins) == 0 {
		return []string{"*"}
	}
	return origins
}

func (c *Config) IsAllowedOAuth2User(email string) bool {
	if c.AllowedOAuth2Users == "*" {
		return true
	}
	for _, allowed := range strings.Split(c.AllowedOAuth2Users, ",") {
		if strings.TrimSpace(allowed) == email {
			return true
		}
	}
	return false
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
