package config

import (
	"os"
	"strings"
)

type Config struct {
	Port               string
	BaseURL            string
	NatsURL            string
	NatsUser           string
	NatsPass           string
	AdminUser          string
	AdminPass          string
	JWTSecret          string
	GoogleClientID     string
	GoogleClientSecret string
	GitHubClientID     string
	GitHubClientSecret string
	AllowedOAuth2Users string // comma-separated emails, "*" for all

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
	return &Config{
		Port:               getEnv("PORT", "3001"),
		BaseURL:            getEnv("BASE_URL", "http://localhost:3001"),
		NatsURL:            getEnv("NATS_URL", "nats://localhost:4222"),
		NatsUser:           getEnv("NATS_USER", "admin"),
		NatsPass:           getEnv("NATS_PASS", ""),
		AdminUser:          getEnv("ADMIN_USER", "admin"),
		AdminPass:          getEnv("ADMIN_PASS", "admin"),
		JWTSecret:          getEnv("JWT_SECRET", "change-me-in-production"),
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
