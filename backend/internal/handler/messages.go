package handler

import (
	"encoding/json"
	"io"
	"log"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/nats-io/nats.go"

	natsclient "nats-ui-backend/internal/nats"
)

// activeSubjectsTTL is how long the active-subject list is reused. The UI polls
// it, and each miss walks every connection's subscription list on the server.
const activeSubjectsTTL = 3 * time.Second

type MessagesHandler struct {
	nc             *natsclient.Client
	activeSubjects *ttlCache[[]string]
}

func NewMessagesHandler(nc *natsclient.Client) *MessagesHandler {
	return &MessagesHandler{
		nc:             nc,
		activeSubjects: newTTLCache[[]string](activeSubjectsTTL),
	}
}

type publishRequest struct {
	Subject string            `json:"subject" binding:"required"`
	Data    json.RawMessage   `json:"data" binding:"required"`
	Headers map[string]string `json:"headers"`
}

func (h *MessagesHandler) Publish(c *gin.Context) {
	var req publishRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := h.nc.Publish(req.Subject, req.Data, req.Headers); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"published": req.Subject})
}

// Subscribe uses Server-Sent Events for real-time message streaming
func (h *MessagesHandler) Subscribe(c *gin.Context) {
	subject := c.Query("subject")
	if subject == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "subject query param required"})
		return
	}

	sub, ch, err := h.nc.Subscribe(subject)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer func() {
		if err := sub.Unsubscribe(); err != nil {
			log.Printf("messages: unsubscribe from %q: %v", subject, err)
		}
	}()

	streamEvents(c, func(out io.Writer, w *sseWriter, keepalive <-chan time.Time) bool {
		select {
		case msg := <-ch:
			var data any
			if err := json.Unmarshal(msg.Data, &data); err != nil {
				data = string(msg.Data)
			}

			headers := make(map[string]string)
			for k, v := range msg.Header {
				if len(v) > 0 {
					headers[k] = v[0]
				}
			}

			w.sendJSON(out, map[string]any{
				"subject":   msg.Subject,
				"data":      data,
				"headers":   headers,
				"timestamp": time.Now().UnixMilli(),
				"reply":     msg.Reply,
			})
			return true

		case <-c.Request.Context().Done():
			return false

		case <-keepalive:
			w.keepAlive(out)
			return true
		}
	})
}

type requestReplyReq struct {
	Subject string            `json:"subject" binding:"required"`
	Data    json.RawMessage   `json:"data" binding:"required"`
	Headers map[string]string `json:"headers"`
	Timeout int               `json:"timeout"` // milliseconds, default 5000
}

func (h *MessagesHandler) RequestReply(c *gin.Context) {
	var req requestReplyReq
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	timeout := 5 * time.Second
	if req.Timeout > 0 {
		timeout = time.Duration(req.Timeout) * time.Millisecond
	}

	natsMsg := &nats.Msg{
		Subject: req.Subject,
		Data:    req.Data,
	}
	if len(req.Headers) > 0 {
		natsMsg.Header = nats.Header{}
		for k, v := range req.Headers {
			natsMsg.Header.Set(k, v)
		}
	}

	resp, err := h.nc.Conn().RequestMsg(natsMsg, timeout)
	if err != nil {
		c.JSON(http.StatusGatewayTimeout, gin.H{"error": err.Error()})
		return
	}

	var data any
	if err := json.Unmarshal(resp.Data, &data); err != nil {
		data = string(resp.Data)
	}

	headers := make(map[string]string)
	for k, v := range resp.Header {
		if len(v) > 0 {
			headers[k] = v[0]
		}
	}

	c.JSON(http.StatusOK, map[string]any{
		"subject":   resp.Subject,
		"data":      data,
		"headers":   headers,
		"timestamp": time.Now().UnixMilli(),
	})
}

func (h *MessagesHandler) ActiveSubjects(c *gin.Context) {
	subjects, err := h.activeSubjects.get(h.loadActiveSubjects)
	if err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, subjects)
}

// loadActiveSubjects collects the distinct subjects every client is subscribed to.
func (h *MessagesHandler) loadActiveSubjects() ([]string, error) {
	data, err := h.nc.FetchMonitoring("/connz?subs=1")
	if err != nil {
		return nil, err
	}

	var connz struct {
		Connections []struct {
			SubsList []string `json:"subscriptions_list"`
		} `json:"connections"`
	}
	if err := json.Unmarshal(data, &connz); err != nil {
		return nil, err
	}

	seen := make(map[string]bool)
	subjects := []string{}
	for _, conn := range connz.Connections {
		for _, sub := range conn.SubsList {
			if !seen[sub] {
				seen[sub] = true
				subjects = append(subjects, sub)
			}
		}
	}
	return subjects, nil
}
