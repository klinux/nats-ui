# Stage 1: Build frontend
FROM node:22-alpine AS frontend-builder
# pnpm version comes from the "packageManager" field in frontend/package.json.
# Do not use pnpm@latest: an unpinned upgrade broke the image build once already.
RUN corepack enable
ARG APP_VERSION=""
WORKDIR /app/frontend
# pnpm-workspace.yaml carries the approved/ignored build-script policy and must
# be present before install, otherwise pnpm fails with ERR_PNPM_IGNORED_BUILDS.
COPY frontend/package.json frontend/pnpm-lock.yaml frontend/pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile
COPY frontend/ .
RUN APP_VERSION=${APP_VERSION} pnpm build

# Stage 2: Build Go backend
# Keep in step with the go directive in backend/go.mod, which CI reads too.
FROM golang:1.26-alpine AS backend-builder
WORKDIR /app/backend
COPY backend/go.mod backend/go.sum ./
RUN go mod download
COPY backend/ .
RUN CGO_ENABLED=0 GOOS=linux go build -o /nats-ui-server ./cmd/server

# Stage 3: Final image
FROM alpine:3.21
RUN apk add --no-cache ca-certificates mailcap
WORKDIR /app
COPY --from=backend-builder /nats-ui-server .
COPY --from=frontend-builder /app/frontend/dist ./static
EXPOSE 8080
CMD ["./nats-ui-server"]
