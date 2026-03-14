# Stage 1: Build frontend
FROM node:22-alpine AS frontend-builder
RUN corepack enable && corepack prepare pnpm@latest --activate
ARG APP_VERSION=""
WORKDIR /app/frontend
COPY frontend/package.json frontend/pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY frontend/ .
RUN APP_VERSION=${APP_VERSION} pnpm build

# Stage 2: Build Go backend
FROM golang:1.25-alpine AS backend-builder
WORKDIR /app/backend
COPY backend/go.mod backend/go.sum ./
RUN go mod download
COPY backend/ .
RUN CGO_ENABLED=0 GOOS=linux go build -o /nats-ui-server ./cmd/server

# Stage 3: Final image
FROM alpine:3.21
RUN apk add --no-cache ca-certificates
WORKDIR /app
COPY --from=backend-builder /nats-ui-server .
COPY --from=frontend-builder /app/frontend/dist ./static
EXPOSE 8080
CMD ["./nats-ui-server"]
