package main

import (
	"context"
	"errors"
	"log"
	"net/http"
	"os"
	"os/signal"
	"path/filepath"
	"strings"
	"syscall"
	"time"

	"github.com/gin-gonic/gin"

	"nats-ui-backend/internal/config"
	"nats-ui-backend/internal/handler"
	"nats-ui-backend/internal/middleware"
	natsclient "nats-ui-backend/internal/nats"
)

const (
	// readHeaderTimeout bounds how long a client may take to send its request
	// headers, which is what a Slowloris attack stretches out.
	readHeaderTimeout = 10 * time.Second

	// idleTimeout closes keep-alive connections that go quiet.
	idleTimeout = 120 * time.Second

	// shutdownTimeout is how long in-flight requests get to finish. SSE streams
	// end as soon as their request context is cancelled.
	shutdownTimeout = 15 * time.Second
)

func main() {
	cfg := config.Load()

	// gin defaults to release mode unless GIN_MODE says otherwise.
	production := os.Getenv("GIN_MODE") == "" || os.Getenv("GIN_MODE") == gin.ReleaseMode
	if err := cfg.Validate(production); err != nil {
		log.Fatalf("invalid configuration: %v", err)
	}

	// Connect to NATS
	nc, err := natsclient.NewClient(cfg)
	if err != nil {
		log.Fatalf("failed to connect to NATS: %v", err)
	}
	defer nc.Close()
	log.Printf("connected to NATS at %s", cfg.NatsURL)

	// Auth
	auth := middleware.NewAuthMiddleware(cfg.JWTSecret)

	// Handlers
	authH := handler.NewAuthHandler(cfg, auth)
	oauth2H := handler.NewOAuth2Handler(cfg, auth)
	serverH := handler.NewServerHandler(nc)
	streamsH := handler.NewStreamsHandler(nc)
	consumersH := handler.NewConsumersHandler(nc)
	kvH := handler.NewKVHandler(nc)
	objH := handler.NewObjectStoreHandler(nc, cfg.MaxUploadBytes())
	messagesH := handler.NewMessagesHandler(nc)
	benchH := handler.NewBenchHandler(nc)

	r := newRouter(cfg, nc, auth, authH, oauth2H, serverH, streamsH, consumersH, kvH, objH, messagesH, benchH)

	srv := &http.Server{
		Addr:    ":" + cfg.Port,
		Handler: staticOrAPI(r),
		// ReadTimeout and WriteTimeout stay unset on purpose: SSE streams are
		// long-lived and object uploads are slow. Requests are bounded by
		// per-handler contexts and by the upload size limit instead.
		ReadHeaderTimeout: readHeaderTimeout,
		IdleTimeout:       idleTimeout,
	}

	go awaitShutdown(srv, nc)

	log.Printf("nats-ui backend listening on :%s", cfg.Port)
	if err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
		log.Fatal(err)
	}
}

// awaitShutdown drains in-flight requests before closing NATS, so a rolling
// restart does not cut active responses mid-write.
func awaitShutdown(srv *http.Server, nc *natsclient.Client) {
	sig := make(chan os.Signal, 1)
	signal.Notify(sig, syscall.SIGINT, syscall.SIGTERM)
	<-sig

	log.Println("shutting down...")
	ctx, cancel := context.WithTimeout(context.Background(), shutdownTimeout)
	defer cancel()

	if err := srv.Shutdown(ctx); err != nil {
		log.Printf("graceful shutdown failed: %v", err)
	}
	nc.Close()
}

// staticOrAPI serves the built frontend when present, falling back to the API
// router for everything it does not have a file for.
func staticOrAPI(r http.Handler) http.Handler {
	if _, err := os.Stat("./static"); err != nil {
		return r
	}

	staticFS := http.Dir("./static")
	fileServer := http.FileServer(staticFS)

	return http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		if !strings.HasPrefix(req.URL.Path, "/api") {
			p := filepath.Clean(req.URL.Path)
			if f, err := staticFS.Open(p); err == nil {
				stat, statErr := f.Stat()
				if closeErr := f.Close(); closeErr != nil {
					log.Printf("static: closing %s: %v", p, closeErr)
				}
				if statErr == nil && !stat.IsDir() {
					fileServer.ServeHTTP(w, req)
					return
				}
			}
		}
		r.ServeHTTP(w, req)
	})
}
