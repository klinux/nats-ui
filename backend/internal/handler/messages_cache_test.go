package handler

import (
	"sync/atomic"
	"testing"
	"time"
)

func TestTTLCacheServesWithinWindow(t *testing.T) {
	var calls int32
	cache := newTTLCache[string](50 * time.Millisecond)

	load := func() (string, error) {
		atomic.AddInt32(&calls, 1)
		return "value", nil
	}

	for i := 0; i < 5; i++ {
		got, err := cache.get(load)
		if err != nil {
			t.Fatalf("get: %v", err)
		}
		if got != "value" {
			t.Fatalf("got %q, want value", got)
		}
	}

	if n := atomic.LoadInt32(&calls); n != 1 {
		t.Errorf("loader ran %d times, want 1 within the TTL window", n)
	}
}

func TestTTLCacheRefreshesAfterExpiry(t *testing.T) {
	var calls int32
	cache := newTTLCache[int](10 * time.Millisecond)

	load := func() (int, error) {
		return int(atomic.AddInt32(&calls, 1)), nil
	}

	if _, err := cache.get(load); err != nil {
		t.Fatalf("get: %v", err)
	}
	time.Sleep(20 * time.Millisecond)
	got, err := cache.get(load)
	if err != nil {
		t.Fatalf("get: %v", err)
	}

	if got != 2 {
		t.Errorf("got %d, want a refreshed value", got)
	}
}

// A failed load must not be cached, or one blip would be served for the whole
// TTL window.
func TestTTLCacheDoesNotCacheErrors(t *testing.T) {
	var calls int32
	cache := newTTLCache[string](time.Hour)

	failing := func() (string, error) {
		atomic.AddInt32(&calls, 1)
		return "", errTest
	}

	if _, err := cache.get(failing); err == nil {
		t.Fatal("expected the loader error to surface")
	}
	if _, err := cache.get(failing); err == nil {
		t.Fatal("expected the loader error to surface again")
	}

	if n := atomic.LoadInt32(&calls); n != 2 {
		t.Errorf("loader ran %d times, want 2 (errors must not be cached)", n)
	}
}

func TestTTLCacheConcurrentReaders(t *testing.T) {
	cache := newTTLCache[int](time.Hour)

	done := make(chan struct{})
	for i := 0; i < 8; i++ {
		go func() {
			defer func() { done <- struct{}{} }()
			for j := 0; j < 50; j++ {
				if _, err := cache.get(func() (int, error) { return 1, nil }); err != nil {
					return
				}
			}
		}()
	}
	for i := 0; i < 8; i++ {
		<-done
	}
}
