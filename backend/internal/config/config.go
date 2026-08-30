package config

import (
	"fmt"
	"log"
	"os"
	"strconv"
	"strings"
)

const (
	defaultJWTSecret = "change-me-in-production"
	defaultAdminPass = "admin"

	// defaultMaxUploadBytes bounds object-store uploads. Without a ceiling a
	// single request could stream an unbounded body into memory.
	defaultMaxUploadBytes int64 = 100 << 20 // 100 MiB
)

type Config struct {
	Port                  string
	BaseURL               string
	NatsURL               string
	NatsUser              string
	NatsPass              string
	NatsMonitoringURL     string // HTTP monitoring URL, defaults to derived from NatsURL
	AdminUser             string
	AdminPass             string
	JWTSecret             string
	CORSOrigins           string // comma-separated allowed origins, "*" for all
	GoogleClientID        string
	GoogleClientSecret    string
	GitHubClientID        string
	GitHubClientSecret    string
	AllowedOAuth2Users    string // comma-separated emails, "*" for all
	RateLimitRPS          string // requests per second, default "20"
	TrustedProxies        string // comma-separated proxy IPs/CIDRs allowed to set X-Forwarded-For
	MaxUploadSize         string // max object-store upload size in bytes
	AllowInsecureDefaults bool   // permit default secrets in production

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
		AdminPass:         getEnv("ADMIN_PASS", defaultAdminPass),
		JWTSecret:         getEnv("JWT_SECRET", defaultJWTSecret),
		CORSOrigins:       getEnv("CORS_ORIGINS", "*"),
		RateLimitRPS:      getEnv("RATE_LIMIT_RPS", "20"),
		TrustedProxies:    os.Getenv("TRUSTED_PROXIES"),
		MaxUploadSize:     os.Getenv("MAX_UPLOAD_SIZE"),

		AllowInsecureDefaults: os.Getenv("ALLOW_INSECURE_DEFAULTS") == "true",
		GoogleClientID:        os.Getenv("GOOGLE_CLIENT_ID"),
		GoogleClientSecret:    os.Getenv("GOOGLE_CLIENT_SECRET"),
		GitHubClientID:        os.Getenv("GITHUB_CLIENT_ID"),
		GitHubClientSecret:    os.Getenv("GITHUB_CLIENT_SECRET"),
		AllowedOAuth2Users:    getEnv("ALLOWED_OAUTH2_USERS", "*"),

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

	if cfg.JWTSecret == defaultJWTSecret {
		log.Println("WARNING: using default JWT_SECRET, set a strong secret in production")
	}
	if cfg.AdminPass == defaultAdminPass {
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

// Validate reports configuration that must not reach production. Shipping the
// packaged defaults means anyone can mint a valid session, so in production
// they are a hard failure rather than a log line — set ALLOW_INSECURE_DEFAULTS
// to override (development, demos, CI).
func (c *Config) Validate(production bool) error {
	if !production || c.AllowInsecureDefaults {
		return nil
	}

	var insecure []string
	if c.JWTSecret == defaultJWTSecret {
		insecure = append(insecure, "JWT_SECRET")
	}
	if c.AdminPass == defaultAdminPass {
		insecure = append(insecure, "ADMIN_PASS")
	}
	if len(insecure) == 0 {
		return nil
	}

	return fmt.Errorf(
		"refusing to start with default %s: set a strong value, or set ALLOW_INSECURE_DEFAULTS=true to override",
		strings.Join(insecure, " and "),
	)
}

// TrustedProxiesList returns the proxies allowed to set forwarded-for headers.
// An empty list means trust none — gin trusts every proxy by default, which
// lets any client spoof its IP and walk straight past the rate limiter.
func (c *Config) TrustedProxiesList() []string {
	var proxies []string
	for _, p := range strings.Split(c.TrustedProxies, ",") {
		if p = strings.TrimSpace(p); p != "" {
			proxies = append(proxies, p)
		}
	}
	return proxies
}

// MaxUploadBytes returns the object-store upload ceiling in bytes.
func (c *Config) MaxUploadBytes() int64 {
	n, err := strconv.ParseInt(strings.TrimSpace(c.MaxUploadSize), 10, 64)
	if err != nil || n <= 0 {
		return defaultMaxUploadBytes
	}
	return n
}
