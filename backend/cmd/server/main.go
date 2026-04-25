package main

import (
	"log"
	"net/http"
	"os"
	"os/signal"
	"path/filepath"
	"strconv"
	"strings"
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
	objH := handler.NewObjectStoreHandler(nc)
	messagesH := handler.NewMessagesHandler(nc)
	benchH := handler.NewBenchHandler(nc)

	// Router
	if os.Getenv("GIN_MODE") == "" {
		gin.SetMode(gin.ReleaseMode)
	}
	r := gin.Default()

	// CORS
	origins := cfg.CORSOriginsList()
	allowCredentials := origins[0] != "*"
	r.Use(cors.New(cors.Config{
		AllowOrigins:     origins,
		AllowMethods:     []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Authorization", "Content-Type"},
		AllowCredentials: allowCredentials,
	}))

	// Rate limiting
	rps, _ := strconv.ParseFloat(cfg.RateLimitRPS, 64)
	if rps <= 0 {
		rps = 20
	}
	r.Use(middleware.RateLimit(rps))

	// Validation helpers
	validateName := middleware.ValidatePathParam("name")
	validateConsumer := middleware.ValidatePathParam("consumer")
	validateBucket := middleware.ValidatePathParam("bucket")
	validateAccount := middleware.ValidatePathParam("account")

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
		protected.GET("/server/gateways", serverH.Gateways)
		protected.GET("/server/leafnodes", serverH.Leafnodes)
		protected.GET("/server/accounts", serverH.Accounts)
		protected.GET("/server/accounts/:account", validateAccount, serverH.AccountDetail)
		protected.GET("/server/varz", serverH.ServerVarz)
		protected.GET("/server/healthz", serverH.HealthCheck)
		protected.GET("/server/events", serverH.SystemEvents)

		// Streams
		protected.GET("/streams", streamsH.List)
		protected.POST("/streams", streamsH.Create)
		protected.GET("/streams/:name", validateName, streamsH.Get)
		protected.PUT("/streams/:name", validateName, streamsH.Update)
		protected.DELETE("/streams/:name", validateName, streamsH.Delete)
		protected.POST("/streams/:name/purge", validateName, streamsH.Purge)
		protected.POST("/streams/:name/seal", validateName, streamsH.Seal)
		protected.GET("/streams/:name/messages", validateName, streamsH.GetMessages)

		// Consumers
		protected.GET("/streams/:name/consumers", validateName, consumersH.List)
		protected.POST("/streams/:name/consumers", validateName, consumersH.Create)
		protected.GET("/streams/:name/consumers/:consumer", validateName, validateConsumer, consumersH.Get)
		protected.DELETE("/streams/:name/consumers/:consumer", validateName, validateConsumer, consumersH.Delete)
		protected.POST("/streams/:name/consumers/:consumer/pause", validateName, validateConsumer, consumersH.Pause)
		protected.POST("/streams/:name/consumers/:consumer/resume", validateName, validateConsumer, consumersH.Resume)
		protected.POST("/streams/:name/consumers/:consumer/next", validateName, validateConsumer, consumersH.NextMessage)

		// KV Store
		protected.GET("/kv", kvH.ListBuckets)
		protected.POST("/kv", kvH.CreateBucket)
		protected.DELETE("/kv/:bucket", validateBucket, kvH.DeleteBucket)
		protected.GET("/kv/:bucket/keys", validateBucket, kvH.ListKeys)
		protected.GET("/kv/:bucket/keys/:key", validateBucket, kvH.GetValue)
		protected.PUT("/kv/:bucket/keys/:key", validateBucket, kvH.PutValue)
		protected.DELETE("/kv/:bucket/keys/:key", validateBucket, kvH.DeleteKey)
		protected.GET("/kv/:bucket/watch", validateBucket, kvH.WatchKeys)

		// Object Store
		protected.GET("/objectstore", objH.ListBuckets)
		protected.POST("/objectstore", objH.CreateBucket)
		protected.GET("/objectstore/:bucket", validateBucket, objH.GetBucket)
		protected.DELETE("/objectstore/:bucket", validateBucket, objH.DeleteBucket)
		protected.GET("/objectstore/:bucket/objects", validateBucket, objH.ListObjects)
		protected.GET("/objectstore/:bucket/objects/:name", validateBucket, validateName, objH.GetObject)
		protected.PUT("/objectstore/:bucket/objects/:name", validateBucket, validateName, objH.PutObject)
		protected.DELETE("/objectstore/:bucket/objects/:name", validateBucket, validateName, objH.DeleteObject)
		protected.GET("/objectstore/:bucket/objects/:name/info", validateBucket, validateName, objH.GetObjectInfo)

		// Messages
		protected.POST("/messages/publish", messagesH.Publish)
		protected.POST("/messages/request", messagesH.RequestReply)
		protected.GET("/messages/subscribe", messagesH.Subscribe)
		protected.GET("/messages/subjects", messagesH.ActiveSubjects)

		// Benchmark
		protected.POST("/bench", benchH.Run)
	}

	// SPA fallback for client-side routing
	r.NoRoute(func(c *gin.Context) {
		if _, err := os.Stat("./static/index.html"); err == nil {
			c.File("./static/index.html")
		}
	})

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
