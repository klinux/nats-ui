package main

import (
	"log"
	"os"
	"os/signal"
	"syscall"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"

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
	messagesH := handler.NewMessagesHandler(nc)

	// Router
	if os.Getenv("GIN_MODE") == "" {
		gin.SetMode(gin.ReleaseMode)
	}
	r := gin.Default()

	r.Use(cors.New(cors.Config{
		AllowOrigins:     []string{"*"},
		AllowMethods:     []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Authorization", "Content-Type"},
		AllowCredentials: true,
	}))

	// Public routes
	api := r.Group("/api")
	{
		api.GET("/health", serverH.Health)
		api.POST("/auth/login", authH.Login)
		api.GET("/auth/oauth2/providers", oauth2H.ListProviders)
		api.GET("/auth/oauth2/:provider/authorize", oauth2H.Authorize)
		api.GET("/auth/oauth2/:provider/callback", oauth2H.Callback)
	}

	// Protected routes
	protected := api.Group("", auth.RequireAuth())
	{
		protected.GET("/auth/me", authH.Me)

		// Server monitoring
		protected.GET("/server/info", serverH.Info)
		protected.GET("/server/connections", serverH.Connections)
		protected.GET("/server/jetstream", serverH.JetStreamInfo)
		protected.GET("/server/subscriptions", serverH.Subscriptions)
		protected.GET("/server/routes", serverH.Routes)

		// Streams
		protected.GET("/streams", streamsH.List)
		protected.POST("/streams", streamsH.Create)
		protected.GET("/streams/:name", streamsH.Get)
		protected.PUT("/streams/:name", streamsH.Update)
		protected.DELETE("/streams/:name", streamsH.Delete)
		protected.POST("/streams/:name/purge", streamsH.Purge)
		protected.GET("/streams/:name/messages", streamsH.GetMessage)

		// Consumers
		protected.GET("/streams/:name/consumers", consumersH.List)
		protected.POST("/streams/:name/consumers", consumersH.Create)
		protected.GET("/streams/:name/consumers/:consumer", consumersH.Get)
		protected.DELETE("/streams/:name/consumers/:consumer", consumersH.Delete)

		// KV Store
		protected.GET("/kv", kvH.ListBuckets)
		protected.POST("/kv", kvH.CreateBucket)
		protected.DELETE("/kv/:bucket", kvH.DeleteBucket)
		protected.GET("/kv/:bucket/keys", kvH.ListKeys)
		protected.GET("/kv/:bucket/keys/:key", kvH.GetValue)
		protected.PUT("/kv/:bucket/keys/:key", kvH.PutValue)
		protected.DELETE("/kv/:bucket/keys/:key", kvH.DeleteKey)

		// Messages
		protected.POST("/messages/publish", messagesH.Publish)
		protected.POST("/messages/request", messagesH.RequestReply)
		protected.GET("/messages/subscribe", messagesH.Subscribe)
		protected.GET("/messages/subjects", messagesH.ActiveSubjects)
	}

	// Serve frontend static files
	if _, err := os.Stat("./static"); err == nil {
		r.NoRoute(func(c *gin.Context) {
			c.File("./static/index.html")
		})
		r.Static("/assets", "./static/assets")
	}

	// Graceful shutdown
	go func() {
		sig := make(chan os.Signal, 1)
		signal.Notify(sig, syscall.SIGINT, syscall.SIGTERM)
		<-sig
		log.Println("shutting down...")
		nc.Close()
		os.Exit(0)
	}()

	log.Printf("nats-ui backend listening on :%s", cfg.Port)
	if err := r.Run(":" + cfg.Port); err != nil {
		log.Fatal(err)
	}
}
