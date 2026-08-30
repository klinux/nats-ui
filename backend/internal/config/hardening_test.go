package config

import (
	"strings"
	"testing"
)

func TestValidateRejectsDefaultSecretsInProduction(t *testing.T) {
	tests := []struct {
		name      string
		cfg       Config
		wantError string
	}{
		{
			name:      "default jwt secret",
			cfg:       Config{JWTSecret: defaultJWTSecret, AdminPass: "strong-pass"},
			wantError: "JWT_SECRET",
		},
		{
			name:      "default admin password",
			cfg:       Config{JWTSecret: "a-real-secret", AdminPass: defaultAdminPass},
			wantError: "ADMIN_PASS",
		},
		{
			name:      "both defaults",
			cfg:       Config{JWTSecret: defaultJWTSecret, AdminPass: defaultAdminPass},
			wantError: "JWT_SECRET",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := tt.cfg.Validate(true)
			if err == nil {
				t.Fatal("Validate accepted insecure defaults in production")
			}
			if !strings.Contains(err.Error(), tt.wantError) {
				t.Errorf("error %q does not mention %s", err, tt.wantError)
			}
			if !strings.Contains(err.Error(), "ALLOW_INSECURE_DEFAULTS") {
				t.Errorf("error %q does not point at the escape hatch", err)
			}
		})
	}
}

func TestValidateAllowsSecureConfig(t *testing.T) {
	cfg := Config{JWTSecret: "a-real-secret", AdminPass: "a-real-password"}
	if err := cfg.Validate(true); err != nil {
		t.Errorf("Validate rejected a secure config: %v", err)
	}
}

func TestValidateAllowsDefaultsOutsideProduction(t *testing.T) {
	cfg := Config{JWTSecret: defaultJWTSecret, AdminPass: defaultAdminPass}
	if err := cfg.Validate(false); err != nil {
		t.Errorf("Validate rejected dev defaults: %v", err)
	}
}

// The escape hatch keeps existing docker-compose and Helm installs bootable.
func TestValidateHonoursEscapeHatch(t *testing.T) {
	cfg := Config{
		JWTSecret:             defaultJWTSecret,
		AdminPass:             defaultAdminPass,
		AllowInsecureDefaults: true,
	}
	if err := cfg.Validate(true); err != nil {
		t.Errorf("Validate ignored ALLOW_INSECURE_DEFAULTS: %v", err)
	}
}

func TestTrustedProxiesList(t *testing.T) {
	tests := []struct {
		name    string
		proxies string
		want    []string
	}{
		{"empty trusts nothing", "", nil},
		{"single proxy", "10.0.0.1", []string{"10.0.0.1"}},
		{"cidr list", "10.0.0.0/8, 192.168.0.0/16", []string{"10.0.0.0/8", "192.168.0.0/16"}},
		{"blank entries dropped", " , 10.0.0.1 , ", []string{"10.0.0.1"}},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			cfg := Config{TrustedProxies: tt.proxies}
			got := cfg.TrustedProxiesList()

			if len(got) != len(tt.want) {
				t.Fatalf("got %v, want %v", got, tt.want)
			}
			for i := range got {
				if got[i] != tt.want[i] {
					t.Errorf("got %v, want %v", got, tt.want)
				}
			}
		})
	}
}

func TestMaxUploadBytes(t *testing.T) {
	tests := []struct {
		raw  string
		want int64
	}{
		{"", defaultMaxUploadBytes},
		{"garbage", defaultMaxUploadBytes},
		{"0", defaultMaxUploadBytes},
		{"-1", defaultMaxUploadBytes},
		{"1048576", 1048576},
	}

	for _, tt := range tests {
		cfg := Config{MaxUploadSize: tt.raw}
		if got := cfg.MaxUploadBytes(); got != tt.want {
			t.Errorf("MaxUploadBytes(%q) = %d, want %d", tt.raw, got, tt.want)
		}
	}
}
