package config

import (
	"testing"
)

func TestCORSOriginsList(t *testing.T) {
	tests := []struct {
		name        string
		corsOrigins string
		want        []string
	}{
		{
			name:        "wildcard returns star",
			corsOrigins: "*",
			want:        []string{"*"},
		},
		{
			name:        "single origin",
			corsOrigins: "http://localhost:3000",
			want:        []string{"http://localhost:3000"},
		},
		{
			name:        "comma-separated origins",
			corsOrigins: "http://localhost:3000,https://example.com",
			want:        []string{"http://localhost:3000", "https://example.com"},
		},
		{
			name:        "comma-separated with spaces",
			corsOrigins: " http://localhost:3000 , https://example.com ",
			want:        []string{"http://localhost:3000", "https://example.com"},
		},
		{
			name:        "empty string returns wildcard",
			corsOrigins: "",
			want:        []string{"*"},
		},
		{
			name:        "only commas and spaces returns wildcard",
			corsOrigins: " , , ",
			want:        []string{"*"},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			cfg := &Config{CORSOrigins: tt.corsOrigins}
			got := cfg.CORSOriginsList()

			if len(got) != len(tt.want) {
				t.Fatalf("got %v (len %d), want %v (len %d)", got, len(got), tt.want, len(tt.want))
			}
			for i := range got {
				if got[i] != tt.want[i] {
					t.Errorf("index %d: got %q, want %q", i, got[i], tt.want[i])
				}
			}
		})
	}
}

func TestIsAllowedOAuth2User(t *testing.T) {
	tests := []struct {
		name           string
		allowedUsers   string
		email          string
		want           bool
	}{
		{
			name:         "wildcard allows everyone",
			allowedUsers: "*",
			email:        "anyone@example.com",
			want:         true,
		},
		{
			name:         "specific email matches",
			allowedUsers: "admin@example.com,user@example.com",
			email:        "user@example.com",
			want:         true,
		},
		{
			name:         "specific email first in list",
			allowedUsers: "admin@example.com,user@example.com",
			email:        "admin@example.com",
			want:         true,
		},
		{
			name:         "non-matching email rejected",
			allowedUsers: "admin@example.com,user@example.com",
			email:        "hacker@evil.com",
			want:         false,
		},
		{
			name:         "single allowed email matches",
			allowedUsers: "only@example.com",
			email:        "only@example.com",
			want:         true,
		},
		{
			name:         "single allowed email rejects other",
			allowedUsers: "only@example.com",
			email:        "other@example.com",
			want:         false,
		},
		{
			name:         "empty allowed users rejects all",
			allowedUsers: "",
			email:        "anyone@example.com",
			want:         false,
		},
		{
			name:         "spaces around emails are trimmed",
			allowedUsers: " admin@example.com , user@example.com ",
			email:        "user@example.com",
			want:         true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			cfg := &Config{AllowedOAuth2Users: tt.allowedUsers}
			got := cfg.IsAllowedOAuth2User(tt.email)
			if got != tt.want {
				t.Errorf("IsAllowedOAuth2User(%q) = %v, want %v", tt.email, got, tt.want)
			}
		})
	}
}
