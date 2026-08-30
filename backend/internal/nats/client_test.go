package nats

import "testing"

func TestDeriveHTTPURL(t *testing.T) {
	tests := []struct {
		name    string
		natsURL string
		want    string
	}{
		{"plain host", "nats://localhost:4222", "http://localhost:8222"},
		{"no scheme", "localhost:4222", "http://localhost:8222"},
		{"host only", "nats://nats", "http://nats:8222"},
		{"tls uses https", "tls://nats.example.com:4222", "https://nats.example.com:8222"},
		// The old string-splitting derivation returned "user" as the host here.
		{"credentials are stripped", "nats://user:pass@nats.example.com:4222", "http://nats.example.com:8222"},
		{"user without password", "nats://user@nats.example.com:4222", "http://nats.example.com:8222"},
		// ...and "[" here.
		{"ipv6 literal", "nats://[::1]:4222", "http://[::1]:8222"},
		{"ipv6 without port", "nats://[2001:db8::1]", "http://[2001:db8::1]:8222"},
		{"ipv4", "nats://192.168.1.10:4222", "http://192.168.1.10:8222"},
		{"first host of a cluster list", "nats://a.example.com:4222,nats://b.example.com:4222", "http://a.example.com:8222"},
		{"empty falls back to localhost", "", "http://localhost:8222"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := deriveHTTPURL(tt.natsURL); got != tt.want {
				t.Errorf("deriveHTTPURL(%q) = %q, want %q", tt.natsURL, got, tt.want)
			}
		})
	}
}
