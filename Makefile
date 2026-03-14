.PHONY: dev stop dev-backend dev-frontend dev-nats stop-nats install build lint test clean logs help

# --- Config ---
NATS_CONTAINER  := nats-ui-dev-nats
NATS_USER       ?= admin
NATS_PASS       ?= nats-secret
LOG_DIR         := .dev-logs

# Backend env (defaults matching docker-compose)
export PORT            ?= 8080
export NATS_URL        ?= nats://localhost:4222
export NATS_USER
export NATS_PASS
export NATS_MONITORING_URL ?= http://localhost:8222
export ADMIN_USER      ?= admin
export ADMIN_PASS      ?= admin
export JWT_SECRET      ?= dev-secret
export BASE_URL        ?= http://localhost:5173
export CORS_ORIGINS    ?= http://localhost:5173,http://localhost:8080
export GIN_MODE        ?= debug

## ──────────────────────────────────────
## Development
## ──────────────────────────────────────

dev: install dev-nats dev-backend dev-frontend ## Start full dev stack (NATS + backend with air + frontend with vite)
	@echo ""
	@echo "══════════════════════════════════════════"
	@echo "  nats-ui dev stack running"
	@echo "  Frontend : http://localhost:5173"
	@echo "  Backend  : http://localhost:$(PORT)"
	@echo "  NATS     : nats://localhost:4222"
	@echo "  NATS Mon : http://localhost:8222"
	@echo ""
	@echo "  make logs    - tail all logs"
	@echo "  make stop    - stop everything"
	@echo "══════════════════════════════════════════"

dev-nats: ## Start NATS server in Docker
	@if [ -z "$$(docker ps -q -f name=$(NATS_CONTAINER) 2>/dev/null)" ]; then \
		echo "Starting NATS..."; \
		docker run -d --rm --name $(NATS_CONTAINER) \
			-p 4222:4222 -p 8222:8222 \
			nats:2.11-alpine \
			-js -sd /data -m 8222 \
			--user $(NATS_USER) --pass $(NATS_PASS) \
			>/dev/null && echo "NATS started"; \
	else \
		echo "NATS already running"; \
	fi

dev-backend: ## Start backend with air (hot reload)
	@mkdir -p $(LOG_DIR)
	@echo "Starting backend (air)..."
	@cd backend && nohup air > ../$(LOG_DIR)/backend.log 2>&1 & echo $$! > ../$(LOG_DIR)/backend.pid
	@sleep 1 && tail -5 $(LOG_DIR)/backend.log 2>/dev/null || true

dev-frontend: ## Start frontend with vite (hot reload)
	@mkdir -p $(LOG_DIR)
	@echo "Starting frontend (vite)..."
	@cd frontend && nohup pnpm dev > ../$(LOG_DIR)/frontend.log 2>&1 & echo $$! > ../$(LOG_DIR)/frontend.pid
	@sleep 2 && tail -5 $(LOG_DIR)/frontend.log 2>/dev/null || true

## ──────────────────────────────────────
## Stop
## ──────────────────────────────────────

stop: ## Stop everything
	@echo "Stopping backend..."
	@-if [ -f $(LOG_DIR)/backend.pid ]; then kill $$(cat $(LOG_DIR)/backend.pid) 2>/dev/null; rm -f $(LOG_DIR)/backend.pid; fi
	@-pkill -f "air.*backend" 2>/dev/null || true
	@-pkill -f "nats-ui-backend" 2>/dev/null || true
	@echo "Stopping frontend..."
	@-if [ -f $(LOG_DIR)/frontend.pid ]; then kill $$(cat $(LOG_DIR)/frontend.pid) 2>/dev/null; rm -f $(LOG_DIR)/frontend.pid; fi
	@-pkill -f "node.*vite" 2>/dev/null || true
	@echo "Stopping NATS..."
	@-docker stop $(NATS_CONTAINER) 2>/dev/null || true
	@echo "All stopped."

## ──────────────────────────────────────
## Build & Test
## ──────────────────────────────────────

install: ## Install dependencies
	@echo "Installing frontend dependencies..."
	@cd frontend && pnpm install
	@echo "Installing backend dependencies..."
	@cd backend && go mod download

build: ## Build both frontend and backend
	@echo "Building frontend..."
	@cd frontend && pnpm build
	@echo "Building backend..."
	@cd backend && go build -o ./bin/nats-ui-backend ./cmd/server
	@echo "Build complete."

lint: ## Lint both frontend and backend
	@echo "Linting frontend..."
	@cd frontend && pnpm lint
	@echo "Vetting backend..."
	@cd backend && go vet ./...

test: ## Run tests
	@echo "Running backend tests..."
	@cd backend && go test ./...
	@echo "Type-checking frontend..."
	@cd frontend && npx tsc --noEmit

## ──────────────────────────────────────
## Docker
## ──────────────────────────────────────

docker-build: ## Build Docker image
	docker build -t nats-ui:dev .

docker-up: ## Start with docker-compose
	docker compose up -d

docker-down: ## Stop docker-compose
	docker compose down

## ──────────────────────────────────────
## Utilities
## ──────────────────────────────────────

logs: ## Tail all dev logs
	@tail -f $(LOG_DIR)/*.log

clean: ## Clean build artifacts and logs
	@rm -rf backend/tmp backend/bin frontend/dist $(LOG_DIR)
	@echo "Cleaned."

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}'
