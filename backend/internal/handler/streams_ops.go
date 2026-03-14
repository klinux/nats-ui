package handler

import (
	"context"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
)

// Seal marks a stream as sealed (read-only, no further writes allowed).
func (h *StreamsHandler) Seal(c *gin.Context) {
	name := c.Param("name")

	ctx, cancel := context.WithTimeout(c.Request.Context(), 10*time.Second)
	defer cancel()

	stream, err := h.nc.JS().Stream(ctx, name)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	info, err := stream.Info(ctx)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	cfg := info.Config
	cfg.Sealed = true

	updated, err := h.nc.JS().UpdateStream(ctx, cfg)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	updatedInfo, err := updated.Info(ctx)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, map[string]any{
		"config": updatedInfo.Config,
		"state":  updatedInfo.State,
		"sealed": true,
	})
}
