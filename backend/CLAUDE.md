# Backend — Development Instructions

## Stack

- **Language:** Go 1.25+
- **Framework:** Gin
- **NATS Client:** nats.go v1.49+
- **Auth:** JWT (golang-jwt/v5) + bcrypt + OAuth2/OIDC

## Project Structure

```
cmd/server/        Entry point (main.go)
internal/
  config/          Configuration from env vars
  handler/         HTTP handlers (one file per domain)
  middleware/      Auth, rate limiting, validation
  nats/            NATS client wrapper
```

## TDD Workflow

1. Write test in `*_test.go` next to the source file
2. Run: `go test ./...`
3. Implement the minimum code to pass
4. Refactor and re-run tests

### Test Guidelines

- Use table-driven tests for multiple cases
- Mock external dependencies (NATS, HTTP clients) using interfaces
- Test error paths, not just happy paths
- Use `httptest.NewRecorder()` for handler tests

## Code Rules

### File Size

- **Max 300 lines per file.** Split large handlers into separate files.
- One handler struct per file (e.g., `streams.go`, `consumers.go`, `kv.go`).

### Error Handling

- **Never use `_ :=` to ignore errors.** Always check and return.
- Return structured JSON errors: `c.JSON(status, gin.H{"error": err.Error()})`
- Use `context.WithTimeout` on all NATS/HTTP operations.
- Log failed auth attempts with IP and username.

### HTTP Clients

- Never use `http.DefaultClient` — always create clients with explicit timeouts.
- The shared OAuth2 client is `oauth2HTTPClient` in `handler/oauth2.go`.
- The NATS monitoring client is in `nats/client.go`.

### Security

- All path parameters are validated by `middleware.ValidatePathParam()`.
- Rate limiting is per-IP via token bucket (`middleware.RateLimit()`).
- CORS origins are configurable via `CORS_ORIGINS` env var.
- JWT secret must be changed from default in production.

### Configuration

- All configuration comes from environment variables (see `internal/config/config.go`).
- Startup warnings are logged for default/insecure values.
- No config files — 12-factor app style.

### Adding a New Handler

1. Create `internal/handler/newdomain.go`
2. Define the struct with a `*natsclient.Client` field
3. Add constructor `NewXHandler(nc *natsclient.Client)`
4. Register routes in `cmd/server/main.go`
5. Add path validation middleware for parameterized routes
6. Write tests first

### Running

```bash
cd backend
air                    # Hot reload dev server
go build ./cmd/server  # Production build
go test ./...          # Run tests
go vet ./...           # Lint
```
