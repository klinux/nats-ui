package nats

import (
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"

	"github.com/nats-io/nats.go"
	"github.com/nats-io/nats.go/jetstream"

	"nats-ui-backend/internal/config"
)

var httpClient = &http.Client{Timeout: 10 * time.Second}

const (
	// monitoringPort is the NATS HTTP monitoring port.
	monitoringPort = 8222

	// subscribeChanBuffer sizes the per-subscription delivery channel. NATS
	// drops messages for a slow consumer once this fills, so it is generous.
	subscribeChanBuffer = 256

	// flushTimeout bounds a publish confirmation round trip.
	flushTimeout = 5 * time.Second
)

type Client struct {
	conn    *nats.Conn
	js      jetstream.JetStream
	httpURL string
}

func NewClient(cfg *config.Config) (*Client, error) {
	opts := []nats.Option{
		nats.Name("nats-ui-backend"),
		nats.Timeout(10 * time.Second),
		nats.ReconnectWait(2 * time.Second),
		nats.MaxReconnects(-1),
		// Slow-consumer drops are otherwise completely silent: messages simply
		// never reach the SSE stream and nobody can tell why.
		nats.ErrorHandler(func(_ *nats.Conn, sub *nats.Subscription, err error) {
			subject := "<none>"
			if sub != nil {
				subject = sub.Subject
			}
			log.Printf("nats: async error on %q: %v", subject, err)
		}),
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
func (c *Client) JS() jetstream.JetStream { return c.js }

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
	if err := c.conn.PublishMsg(msg); err != nil {
		return err
	}
	// Flush confirms the publish reached the server; bound it so a stalled
	// connection cannot hang the request indefinitely.
	return c.conn.FlushTimeout(flushTimeout)
}

// Subscribe creates a subscription and sends messages to a channel
func (c *Client) Subscribe(subject string) (*nats.Subscription, chan *nats.Msg, error) {
	ch := make(chan *nats.Msg, subscribeChanBuffer)
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

// deriveHTTPURL maps a NATS client URL onto the server's monitoring endpoint:
// nats://host:4222 -> http://host:8222.
//
// Parsing properly matters — splitting on ":" reported "user" as the host for
// nats://user:pass@host and "[" for an IPv6 literal.
func deriveHTTPURL(natsURL string) string {
	// A cluster list is comma-separated; monitor the first server.
	if first, _, found := strings.Cut(natsURL, ","); found {
		natsURL = first
	}
	natsURL = strings.TrimSpace(natsURL)
	if natsURL == "" {
		return fmt.Sprintf("http://localhost:%d", monitoringPort)
	}

	// url.Parse needs a scheme to recognise the authority section.
	if !strings.Contains(natsURL, "://") {
		natsURL = "nats://" + natsURL
	}

	u, err := url.Parse(natsURL)
	if err != nil || u.Hostname() == "" {
		return fmt.Sprintf("http://localhost:%d", monitoringPort)
	}

	scheme := "http"
	if u.Scheme == "tls" || u.Scheme == "wss" {
		scheme = "https"
	}

	// net.JoinHostPort re-brackets IPv6 literals, which Hostname() strips.
	return scheme + "://" + net.JoinHostPort(u.Hostname(), strconv.Itoa(monitoringPort))
}
