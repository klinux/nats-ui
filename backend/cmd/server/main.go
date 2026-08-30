package main

import (
	"log"
	"net/http"
	"os"
	"os/signal"
	"path/filepath"
	"strings"
	"syscall"

	"nats-ui-backend/internal/config"
	"nats-ui-backend/internal/handler"
	"nats-ui-backend/internal/middleware"
	natsclient "nats-ui-backend/internal/nats"
)

func main() {
	cfg := config.Load()

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
	objH := handler.NewObjectStoreHandler(nc)
	messagesH := handler.NewMessagesHandler(nc)
	benchH := handler.NewBenchHandler(nc)

	r := newRouter(cfg, nc, auth, authH, oauth2H, serverH, streamsH, consumersH, kvH, objH, messagesH, benchH)

	// Graceful shutdown
	go func() {
		sig := make(chan os.Signal, 1)
		signal.Notify(sig, syscall.SIGINT, syscall.SIGTERM)
		<-sig
		log.Println("shutting down...")
		nc.Close()
		os.Exit(0)
	}()

	// Build final handler: static files first, then Gin router
	var handler http.Handler = r
	if _, err := os.Stat("./static"); err == nil {
		staticFS := http.Dir("./static")
		fileServer := http.FileServer(staticFS)
		handler = http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
			// Try static file first (skip /api routes)
			if !strings.HasPrefix(req.URL.Path, "/api") {
				p := filepath.Clean(req.URL.Path)
				if f, err := staticFS.Open(p); err == nil {
					stat, _ := f.Stat()
					f.Close()
					if stat != nil && !stat.IsDir() {
						fileServer.ServeHTTP(w, req)
						return
					}
				}
			}
			// Fallback to Gin router
			r.ServeHTTP(w, req)
		})
	}

	log.Printf("nats-ui backend listening on :%s", cfg.Port)
	srv := &http.Server{Addr: ":" + cfg.Port, Handler: handler}
	if err := srv.ListenAndServe(); err != nil {
		log.Fatal(err)
	}
}
