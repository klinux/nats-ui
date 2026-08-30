package handler

import (
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"sync"
	"time"
)

const (
	// oauth2StateTTL is how long a CSRF state stays valid — long enough for a
	// user to complete a provider login, short enough to bound memory.
	oauth2StateTTL = 10 * time.Minute

	// oauth2StateCapacity caps how many states are held at once. /authorize is
	// a public route, so without a ceiling anyone could grow the map forever.
	oauth2StateCapacity = 10000
)

// stateStore holds single-use CSRF states with an expiry and a hard capacity.
type stateStore struct {
	mu       sync.Mutex
	states   map[string]time.Time // state -> expiry
	ttl      time.Duration
	capacity int
}

func newStateStore(ttl time.Duration, capacity int) *stateStore {
	return &stateStore{
		states:   make(map[string]time.Time),
		ttl:      ttl,
		capacity: capacity,
	}
}

// issue creates a new random state and records it.
func (s *stateStore) issue() (string, error) {
	b := make([]byte, 16)
	if _, err := rand.Read(b); err != nil {
		return "", fmt.Errorf("generate oauth2 state: %w", err)
	}
	state := hex.EncodeToString(b)

	s.mu.Lock()
	defer s.mu.Unlock()

	s.evictExpiredLocked()
	if len(s.states) >= s.capacity {
		s.dropOldestLocked()
	}
	s.states[state] = time.Now().Add(s.ttl)

	return state, nil
}

// consume validates a state and removes it, so it can never be replayed.
func (s *stateStore) consume(state string) bool {
	if state == "" {
		return false
	}

	s.mu.Lock()
	defer s.mu.Unlock()

	expiry, ok := s.states[state]
	if !ok {
		return false
	}
	delete(s.states, state)

	return time.Now().Before(expiry)
}

func (s *stateStore) len() int {
	s.mu.Lock()
	defer s.mu.Unlock()
	return len(s.states)
}

func (s *stateStore) evictExpiredLocked() {
	now := time.Now()
	for state, expiry := range s.states {
		if !now.Before(expiry) {
			delete(s.states, state)
		}
	}
}

// dropOldestLocked makes room by discarding the state closest to expiring.
func (s *stateStore) dropOldestLocked() {
	var oldest string
	var oldestExpiry time.Time
	for state, expiry := range s.states {
		if oldest == "" || expiry.Before(oldestExpiry) {
			oldest, oldestExpiry = state, expiry
		}
	}
	if oldest != "" {
		delete(s.states, oldest)
	}
}
