// Package testutil provides helpers shared by the backend test suites.
package testutil

import (
	"os"
	"testing"
	"time"

	natsserver "github.com/nats-io/nats-server/v2/server"

	"nats-ui-backend/internal/config"
	natsclient "nats-ui-backend/internal/nats"
)

// StartNATS boots an in-process NATS server with JetStream enabled on a random
// port and returns a Client connected to it. The server and client are shut
// down when the test finishes.
func StartNATS(t *testing.T) *natsclient.Client {
	t.Helper()

	storeDir, err := os.MkdirTemp("", "nats-ui-js-")
	if err != nil {
		t.Fatalf("create jetstream store dir: %v", err)
	}

	srv, err := natsserver.NewServer(&natsserver.Options{
		Host:      "127.0.0.1",
		Port:      -1, // random free port
		JetStream: true,
		StoreDir:  storeDir,
		NoLog:     true,
		NoSigs:    true,
	})
	if err != nil {
		t.Fatalf("create nats server: %v", err)
	}

	go srv.Start()
	if !srv.ReadyForConnections(10 * time.Second) {
		srv.Shutdown()
		t.Fatal("nats server did not become ready")
	}

	cfg := &config.Config{NatsURL: srv.ClientURL()}
	client, err := natsclient.NewClient(cfg)
	if err != nil {
		srv.Shutdown()
		t.Fatalf("connect to test nats server: %v", err)
	}

	t.Cleanup(func() {
		client.Close()
		srv.Shutdown()
		srv.WaitForShutdown()
		if err := os.RemoveAll(storeDir); err != nil {
			t.Logf("cleanup jetstream store dir: %v", err)
		}
	})

	return client
}
