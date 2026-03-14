package nats

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/nats-io/nats.go"
	"github.com/nats-io/nats.go/jetstream"

	"nats-ui-backend/internal/config"
)

var httpClient = &http.Client{Timeout: 10 * time.Second}

type Client struct {
	conn    *nats.Conn
	js      jetstream.JetStream
	httpURL string
	mu      sync.RWMutex
}

func NewClient(cfg *config.Config) (*Client, error) {
	opts := []nats.Option{
		nats.Name("nats-ui-backend"),
		nats.Timeout(10 * time.Second),
		nats.ReconnectWait(2 * time.Second),
		nats.MaxReconnects(-1),
	}

	if cfg.NatsUser != "" && cfg.NatsPass != "" {
		opts = append(opts, nats.UserInfo(cfg.NatsUser, cfg.NatsPass))
	}

	conn, err := nats.Connect(cfg.NatsURL, opts...)
	if err != nil {
		return nil, fmt.Errorf("nats connect: %w", err)
	}

	js, err := jetstream.New(conn)
	if err != nil {
		return nil, fmt.Errorf("jetstream init: %w", err)
	}

	httpURL := cfg.NatsMonitoringURL
	if httpURL == "" {
		httpURL = deriveHTTPURL(cfg.NatsURL)
	}

	return &Client{
		conn:    conn,
		js:      js,
		httpURL: httpURL,
	}, nil
}

func (c *Client) Conn() *nats.Conn        { return c.conn }
func (c *Client) JS() jetstream.JetStream  { return c.js }

func (c *Client) Close() {
	c.conn.Close()
}

func (c *Client) IsConnected() bool {
	return c.conn.IsConnected()
}

// Publish sends a message to a subject
func (c *Client) Publish(subject string, data []byte, headers map[string]string) error {
	msg := &nats.Msg{
		Subject: subject,
		Data:    data,
	}
	if len(headers) > 0 {
		msg.Header = nats.Header{}
		for k, v := range headers {
			msg.Header.Set(k, v)
		}
	}
	return c.conn.PublishMsg(msg)
}

// Subscribe creates a subscription and sends messages to a channel
func (c *Client) Subscribe(subject string) (*nats.Subscription, chan *nats.Msg, error) {
	ch := make(chan *nats.Msg, 64)
	sub, err := c.conn.ChanSubscribe(subject, ch)
	if err != nil {
		return nil, nil, err
	}
	return sub, ch, nil
}

// FetchMonitoring proxies HTTP monitoring API requests
func (c *Client) FetchMonitoring(path string) (json.RawMessage, error) {
	url := c.httpURL + path
	resp, err := httpClient.Get(url)
	if err != nil {
		return nil, fmt.Errorf("monitoring fetch %s: %w", path, err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("monitoring read %s: %w", path, err)
	}

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("monitoring %s: HTTP %d", path, resp.StatusCode)
	}

	return json.RawMessage(body), nil
}

func deriveHTTPURL(natsURL string) string {
	// nats://host:4222 → http://host:8222
	u := strings.TrimPrefix(natsURL, "nats://")
	u = strings.TrimPrefix(u, "tls://")
	parts := strings.Split(u, ":")
	host := parts[0]
	return fmt.Sprintf("http://%s:8222", host)
}
