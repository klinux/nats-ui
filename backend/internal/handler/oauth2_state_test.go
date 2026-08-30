package handler

import (
	"testing"
	"time"
)

func TestStateStoreSingleUse(t *testing.T) {
	s := newStateStore(time.Minute, 100)

	state, err := s.issue()
	if err != nil {
		t.Fatalf("issue: %v", err)
	}
	if !s.consume(state) {
		t.Fatal("freshly issued state was rejected")
	}
	if s.consume(state) {
		t.Error("state was accepted twice; it must be single use")
	}
}

func TestStateStoreRejectsUnknown(t *testing.T) {
	s := newStateStore(time.Minute, 100)

	if s.consume("never-issued") {
		t.Error("unknown state accepted")
	}
	if s.consume("") {
		t.Error("empty state accepted")
	}
}

func TestStateStoreRejectsExpired(t *testing.T) {
	s := newStateStore(-time.Second, 100) // already expired on issue

	state, err := s.issue()
	if err != nil {
		t.Fatalf("issue: %v", err)
	}
	if s.consume(state) {
		t.Error("expired state accepted")
	}
}

// TestStateStoreDoesNotGrowUnbounded covers the leak: /authorize is a public
// route and every call stored a state that was only ever removed by a matching
// callback, so unmatched states accumulated forever.
func TestStateStoreDoesNotGrowUnbounded(t *testing.T) {
	s := newStateStore(-time.Second, 1000)

	for i := 0; i < 500; i++ {
		if _, err := s.issue(); err != nil {
			t.Fatalf("issue %d: %v", i, err)
		}
	}

	// Expired entries must not be retained.
	if got := s.len(); got > 1 {
		t.Errorf("store kept %d expired states, want them evicted", got)
	}
}

func TestStateStoreEnforcesCapacity(t *testing.T) {
	const capacity = 50
	s := newStateStore(time.Hour, capacity) // nothing expires on its own

	for i := 0; i < capacity*4; i++ {
		if _, err := s.issue(); err != nil {
			t.Fatalf("issue %d: %v", i, err)
		}
	}

	if got := s.len(); got > capacity {
		t.Errorf("store holds %d states, want at most %d", got, capacity)
	}
}

func TestStateStoreIssuesUniqueValues(t *testing.T) {
	s := newStateStore(time.Minute, 100)

	seen := make(map[string]bool)
	for i := 0; i < 200; i++ {
		state, err := s.issue()
		if err != nil {
			t.Fatalf("issue: %v", err)
		}
		if state == "" {
			t.Fatal("issued an empty state")
		}
		if seen[state] {
			t.Fatalf("duplicate state issued: %q", state)
		}
		seen[state] = true
	}
}

func TestStateStoreConcurrentUse(t *testing.T) {
	s := newStateStore(time.Minute, 1000)

	done := make(chan struct{})
	for i := 0; i < 8; i++ {
		go func() {
			defer func() { done <- struct{}{} }()
			for j := 0; j < 100; j++ {
				state, err := s.issue()
				if err != nil {
					return
				}
				s.consume(state)
			}
		}()
	}
	for i := 0; i < 8; i++ {
		<-done
	}
}
