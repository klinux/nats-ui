package handler

import "testing"

func TestLastNStartSeq(t *testing.T) {
	cases := []struct {
		name     string
		first    uint64
		last     uint64
		n        uint64
		expected uint64
	}{
		{"middle of stream", 1, 100, 10, 91},
		{"exact match returns first", 1, 10, 10, 1},
		{"n greater than stream size returns first (no underflow)", 1, 5, 50, 1},
		{"n=0 returns first", 1, 100, 0, 1},
		{"single message", 1, 1, 1, 1},
		{"firstSeq > 1 (after purge)", 50, 100, 10, 91},
		{"n > range after purge clamps to firstSeq", 50, 100, 200, 50},
	}

	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			got := lastNStartSeq(c.first, c.last, c.n)
			if got != c.expected {
				t.Fatalf("lastNStartSeq(%d, %d, %d) = %d, want %d", c.first, c.last, c.n, got, c.expected)
			}
		})
	}
}
