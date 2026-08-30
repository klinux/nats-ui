package testutil

import "testing"

func TestStartNATS(t *testing.T) {
	client := StartNATS(t)

	if !client.IsConnected() {
		t.Fatal("expected client to be connected to the embedded server")
	}
	if client.JS() == nil {
		t.Fatal("expected JetStream to be initialised")
	}
}
