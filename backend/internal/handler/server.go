package handler

import (
	"net/http"

	"github.com/gin-gonic/gin"

	natsclient "nats-ui-backend/internal/nats"
)

type ServerHandler struct {
	nc *natsclient.Client
}

func NewServerHandler(nc *natsclient.Client) *ServerHandler {
	return &ServerHandler{nc: nc}
}

func (h *ServerHandler) Info(c *gin.Context) {
	data, err := h.nc.FetchMonitoring("/varz")
	if err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"error": err.Error()})
		return
	}
	c.Data(http.StatusOK, "application/json", data)
}

func (h *ServerHandler) Connections(c *gin.Context) {
	path := "/connz"
	if subs := c.Query("subs"); subs != "" {
		path += "?subs=" + subs
	}
	data, err := h.nc.FetchMonitoring(path)
	if err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"error": err.Error()})
		return
	}
	c.Data(http.StatusOK, "application/json", data)
}

func (h *ServerHandler) JetStreamInfo(c *gin.Context) {
	path := "/jsz"
	q := c.Request.URL.RawQuery
	if q != "" {
		path += "?" + q
	}
	data, err := h.nc.FetchMonitoring(path)
	if err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"error": err.Error()})
		return
	}
	c.Data(http.StatusOK, "application/json", data)
}

func (h *ServerHandler) Subscriptions(c *gin.Context) {
	path := "/subsz"
	q := c.Request.URL.RawQuery
	if q != "" {
		path += "?" + q
	}
	data, err := h.nc.FetchMonitoring(path)
	if err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"error": err.Error()})
		return
	}
	c.Data(http.StatusOK, "application/json", data)
}

func (h *ServerHandler) Routes(c *gin.Context) {
	data, err := h.nc.FetchMonitoring("/routez")
	if err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"error": err.Error()})
		return
	}
	c.Data(http.StatusOK, "application/json", data)
}

func (h *ServerHandler) Health(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"status":    "ok",
		"connected": h.nc.IsConnected(),
	})
}

func (h *ServerHandler) Gateways(c *gin.Context) {
	data, err := h.nc.FetchMonitoring("/gatewayz")
	if err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"error": err.Error()})
		return
	}
	c.Data(http.StatusOK, "application/json", data)
}

func (h *ServerHandler) Leafnodes(c *gin.Context) {
	data, err := h.nc.FetchMonitoring("/leafz")
	if err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"error": err.Error()})
		return
	}
	c.Data(http.StatusOK, "application/json", data)
}

func (h *ServerHandler) Accounts(c *gin.Context) {
	data, err := h.nc.FetchMonitoring("/accountz")
	if err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"error": err.Error()})
		return
	}
	c.Data(http.StatusOK, "application/json", data)
}

func (h *ServerHandler) AccountDetail(c *gin.Context) {
	account := c.Param("account")
	data, err := h.nc.FetchMonitoring("/accountz?acc=" + account)
	if err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"error": err.Error()})
		return
	}
	c.Data(http.StatusOK, "application/json", data)
}

func (h *ServerHandler) ServerVarz(c *gin.Context) {
	data, err := h.nc.FetchMonitoring("/varz")
	if err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"error": err.Error()})
		return
	}
	c.Data(http.StatusOK, "application/json", data)
}
