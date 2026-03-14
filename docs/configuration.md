# Configuration Guide

NATS UI is configured entirely through environment variables. No config files are needed.

## Table of Contents

- [Features](#features)
  - [Dashboard](#dashboard)
  - [Streams](#streams)
  - [Consumers](#consumers)
  - [Key-Value Store](#key-value-store)
  - [Messages](#messages)
  - [Server Monitoring](#server-monitoring)
- [NATS Connection](#nats-connection)
- [Authentication](#authentication)
  - [Username/Password](#usernamepassword)
  - [JWT](#jwt)
- [OAuth2 / OIDC Providers](#oauth2--oidc-providers)
  - [Google](#google)
  - [GitHub](#github)
  - [Keycloak](#keycloak)
  - [Generic OIDC](#generic-oidc)
  - [Restricting Access](#restricting-access)
- [Deployment](#deployment)
  - [Docker Compose](#docker-compose)
  - [Docker Standalone](#docker-standalone)
  - [Helm / Kubernetes](#helm--kubernetes)
- [API Reference](#api-reference)
- [Environment Variables Reference](#environment-variables-reference)

---

## Features

### Dashboard

The dashboard provides an overview of your NATS server:

- Server version, uptime, and cluster info
- JetStream status — total streams, consumers, messages, and storage usage
- Active connections count
- Memory and CPU usage
- Real-time data refresh

### Streams

Full lifecycle management for JetStream streams.

**What you can do:**

- **List** all streams with their state (messages, bytes, consumers)
- **Create** a stream with:
  - Name and subject patterns (supports wildcards like `orders.>`)
  - Retention policy: `limits` (default), `interest`, or `workqueue`
  - Storage type: `file` (persistent) or `memory` (fast)
  - Limits: max messages, max bytes, max age (TTL)
  - Replication factor for clustered setups
- **Update** stream configuration (subjects, limits, retention)
- **View messages** stored in a stream (last N messages, up to 100)
- **Purge** all messages from a stream
- **Delete** a stream entirely

### Consumers

Manage consumers attached to streams.

**What you can do:**

- **List** all consumers for a given stream
- **Create** a consumer with:
  - Name and optional subject filter
  - Deliver policy: `all`, `last`, `new`, `by_start_sequence`, `by_start_time`
  - Ack policy: `explicit` (default), `none`, `all`
  - Max deliver attempts (redelivery limit)
  - Max ack pending (backpressure control)
  - Durable or ephemeral mode
- **Inspect** consumer state:
  - Delivered / acknowledged message counts
  - Pending messages and pending acks
  - Waiting pull requests
- **Delete** a consumer

### Key-Value Store

Manage NATS KV buckets and their entries.

**What you can do:**

- **List** all KV buckets with stats (keys count, bytes, history depth, TTL)
- **Create** a bucket with optional TTL and history depth
- **Delete** a bucket
- **Browse** all keys in a bucket
- **Get** a key's value with revision number and creation timestamp
- **Put** (create or update) a key's value
- **Delete** a specific key

### Messages

Real-time messaging — publish, subscribe, and request-reply.

**What you can do:**

- **Publish** a message to any subject with:
  - Custom payload (JSON or text)
  - Custom headers
- **Subscribe** to subjects in real-time via Server-Sent Events (SSE):
  - Supports wildcards (`orders.>`, `events.*`)
  - Live message stream with subject, payload, headers, and timestamp
  - Automatic keepalive (30s ping)
- **Request-Reply** — send a request and wait for a response:
  - Configurable timeout (default 5 seconds)
  - Returns the reply message or a timeout error
- **View active subjects** — see all subjects with active subscriptions across connections

### Server Monitoring

Inspect the NATS server state in detail.

**What you can do:**

- **Server info** — version, uptime, connections, memory, CPU, slow consumers
- **Connections** — list all active client connections with optional subscription details
- **JetStream info** — storage usage, stream/consumer counts, cluster state, API stats
- **Subscriptions** — view all active subscriptions across the server
- **Routes** — inspect inter-server routes in a cluster
- **Health check** — `GET /api/health` returns connection status (useful for liveness probes)

---

## NATS Connection

NATS UI connects to a NATS server via the standard client protocol. JetStream must be enabled on the server.

| Variable | Default | Description |
|----------|---------|-------------|
| `NATS_URL` | `nats://localhost:4222` | NATS server address |
| `NATS_USER` | `admin` | NATS authentication user |
| `NATS_PASS` | _(empty)_ | NATS authentication password |

Example with authentication:

```bash
NATS_URL=nats://nats.production.internal:4222
NATS_USER=nats-ui
NATS_PASS=strong-password
```

For TLS connections, use `tls://` scheme in `NATS_URL`.

---

## Authentication

NATS UI requires authentication to access the dashboard. Two mechanisms are available: username/password and OAuth2/OIDC. Both can be active simultaneously.

### Username/Password

A single admin account is configured via environment variables:

| Variable | Default | Description |
|----------|---------|-------------|
| `ADMIN_USER` | `admin` | Login username |
| `ADMIN_PASS` | `admin` | Login password (bcrypt-hashed internally) |

Change these in production:

```bash
ADMIN_USER=admin
ADMIN_PASS=a-secure-password
```

### JWT

All sessions (both password and OAuth2) are backed by JWT tokens with a 24-hour expiry.

| Variable | Default | Description |
|----------|---------|-------------|
| `JWT_SECRET` | `change-me-in-production` | HMAC-SHA256 signing key |

Use a strong random string in production:

```bash
JWT_SECRET=$(openssl rand -hex 32)
```

---

## OAuth2 / OIDC Providers

OAuth2 providers are optional. A provider is enabled when its client ID is set. Multiple providers can be active at the same time — they all appear as buttons on the login page.

Every provider requires `BASE_URL` to be set correctly for callback redirects:

| Variable | Default | Description |
|----------|---------|-------------|
| `BASE_URL` | `http://localhost:3001` | Public URL of the backend (used to build OAuth2 callback URLs) |

The callback URL registered with each provider must be:

```
{BASE_URL}/api/auth/oauth2/{provider}/callback
```

Where `{provider}` is `google`, `github`, `keycloak`, or `oidc`.

### Google

1. Go to [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
2. Create an OAuth 2.0 Client ID (type: Web application)
3. Add the authorized redirect URI: `{BASE_URL}/api/auth/oauth2/google/callback`
4. Set the environment variables:

```bash
GOOGLE_CLIENT_ID=123456789.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-xxxxx
```

Scopes requested: `openid email profile`

### GitHub

1. Go to [GitHub Developer Settings](https://github.com/settings/developers)
2. Create a new OAuth App
3. Set the authorization callback URL: `{BASE_URL}/api/auth/oauth2/github/callback`
4. Set the environment variables:

```bash
GITHUB_CLIENT_ID=Iv1.xxxxxxxxxx
GITHUB_CLIENT_SECRET=xxxxxxxxxxxxxxxx
```

Scopes requested: `read:user user:email`

> GitHub may not expose the user's email in the profile endpoint. NATS UI automatically falls back to the `/user/emails` API to retrieve the primary verified email.

### Keycloak

NATS UI builds the OAuth2 endpoints from the Keycloak base URL and realm name. No discovery request is needed.

1. In Keycloak, create a new client in your realm with:
   - Client type: OpenID Connect
   - Valid redirect URIs: `{BASE_URL}/api/auth/oauth2/keycloak/callback`
   - Client authentication: On (to get a client secret)
2. Set the environment variables:

```bash
KEYCLOAK_URL=https://keycloak.example.com
KEYCLOAK_REALM=my-realm
KEYCLOAK_CLIENT_ID=nats-ui
KEYCLOAK_CLIENT_SECRET=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
```

| Variable | Default | Description |
|----------|---------|-------------|
| `KEYCLOAK_URL` | _(empty)_ | Keycloak base URL (e.g. `https://keycloak.example.com`) |
| `KEYCLOAK_REALM` | `master` | Keycloak realm name |
| `KEYCLOAK_CLIENT_ID` | _(empty)_ | Client ID |
| `KEYCLOAK_CLIENT_SECRET` | _(empty)_ | Client secret |

The following endpoints are derived automatically:

```
Auth:     {KEYCLOAK_URL}/realms/{KEYCLOAK_REALM}/protocol/openid-connect/auth
Token:    {KEYCLOAK_URL}/realms/{KEYCLOAK_REALM}/protocol/openid-connect/token
UserInfo: {KEYCLOAK_URL}/realms/{KEYCLOAK_REALM}/protocol/openid-connect/userinfo
```

Scopes requested: `openid email profile`

### Generic OIDC

For any OpenID Connect-compliant provider (Auth0, Okta, Azure AD, Authentik, Zitadel, etc.), NATS UI uses the standard discovery mechanism.

At startup, it fetches `{OIDC_ISSUER_URL}/.well-known/openid-configuration` to discover the authorization, token, and userinfo endpoints automatically.

1. Create a client/application in your identity provider
2. Set the redirect URI: `{BASE_URL}/api/auth/oauth2/oidc/callback`
3. Set the environment variables:

```bash
OIDC_NAME=Corporate SSO
OIDC_ISSUER_URL=https://auth.example.com/realms/corp
OIDC_CLIENT_ID=nats-ui
OIDC_CLIENT_SECRET=your-client-secret
OIDC_SCOPES=openid email profile
```

| Variable | Default | Description |
|----------|---------|-------------|
| `OIDC_NAME` | `SSO` | Display name shown on the login button |
| `OIDC_ISSUER_URL` | _(empty)_ | Issuer URL (must serve `/.well-known/openid-configuration`) |
| `OIDC_CLIENT_ID` | _(empty)_ | Client ID |
| `OIDC_CLIENT_SECRET` | _(empty)_ | Client secret |
| `OIDC_SCOPES` | `openid email profile` | Space-separated scopes |

**Provider examples:**

| Provider | Issuer URL format |
|----------|-------------------|
| Auth0 | `https://your-tenant.auth0.com/` |
| Okta | `https://your-org.okta.com/oauth2/default` |
| Azure AD | `https://login.microsoftonline.com/{tenant-id}/v2.0` |
| Authentik | `https://auth.example.com/application/o/nats-ui/` |
| Zitadel | `https://your-instance.zitadel.cloud` |

> The OIDC provider's userinfo endpoint must return a JSON object with an `email` field.

### Restricting Access

By default, any user who successfully authenticates via OAuth2 is granted access. To restrict access to specific users:

```bash
ALLOWED_OAUTH2_USERS=alice@example.com,bob@example.com
```

Set to `*` (default) to allow all authenticated users.

---

## Deployment

### Docker Compose

The included `docker-compose.yml` runs both NATS (with JetStream) and NATS UI.

```bash
cp .env.example .env
# Edit .env with your values
docker compose up -d
```

The NATS server is configured with JetStream, persistent storage, and a healthcheck. NATS UI waits for NATS to be healthy before starting.

**Exposed ports:**

| Port | Service |
|------|---------|
| `4222` | NATS client connections |
| `8222` | NATS HTTP monitoring |
| `8080` | NATS UI web interface |

### Docker Standalone

If you already have a NATS server, run only the UI:

```bash
docker build -t nats-ui .

docker run -d --name nats-ui \
  -p 8080:8080 \
  -e NATS_URL=nats://your-nats:4222 \
  -e ADMIN_PASS=changeme \
  -e JWT_SECRET=$(openssl rand -hex 32) \
  nats-ui
```

### Helm / Kubernetes

The Helm chart is in `helm/nats-ui/`. It creates a Deployment, Service, ConfigMap, and Secret.

**Basic install:**

```bash
helm install nats-ui ./helm/nats-ui \
  --set config.natsURL=nats://nats:4222 \
  --set secrets.adminPass=changeme \
  --set secrets.jwtSecret=your-secret
```

**With Ingress:**

```bash
helm install nats-ui ./helm/nats-ui \
  --set ingress.enabled=true \
  --set ingress.className=nginx \
  --set "ingress.hosts[0].host=nats-ui.example.com" \
  --set "ingress.hosts[0].paths[0].path=/" \
  --set "ingress.hosts[0].paths[0].pathType=Prefix"
```

**With Gateway API:**

```bash
helm install nats-ui ./helm/nats-ui \
  --set gateway.enabled=true \
  --set "gateway.parentRefs[0].name=my-gateway" \
  --set "gateway.hostnames[0]=nats-ui.example.com"
```

**With Keycloak (values file):**

```yaml
# values-production.yaml
config:
  natsURL: nats://nats:4222
  baseURL: https://nats-ui.example.com

secrets:
  adminPass: changeme
  jwtSecret: your-secret

oauth2:
  keycloak:
    url: https://keycloak.example.com
    realm: production
    clientID: nats-ui
    clientSecret: your-keycloak-secret
  allowedUsers: "admin@example.com,ops@example.com"

ingress:
  enabled: true
  className: nginx
  hosts:
    - host: nats-ui.example.com
      paths:
        - path: /
          pathType: Prefix
  tls:
    - secretName: nats-ui-tls
      hosts:
        - nats-ui.example.com
```

```bash
helm install nats-ui ./helm/nats-ui -f values-production.yaml
```

**Using an existing Kubernetes Secret:**

If you manage secrets externally (e.g. Sealed Secrets, External Secrets Operator), create a secret with the required keys and reference it:

```bash
helm install nats-ui ./helm/nats-ui \
  --set existingSecret=my-nats-ui-secret
```

The secret must contain: `NATS_PASS`, `ADMIN_PASS`, `JWT_SECRET`, and any OAuth2 client IDs/secrets you need.

---

## API Reference

All endpoints are under `/api`. Protected routes require `Authorization: Bearer <token>`.

### Authentication

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/auth/login` | No | Login with username/password, returns JWT |
| GET | `/api/auth/me` | Yes | Get current user info |
| GET | `/api/auth/oauth2/providers` | No | List enabled OAuth2 providers |
| GET | `/api/auth/oauth2/:provider/authorize` | No | Redirect to OAuth2 provider |
| GET | `/api/auth/oauth2/:provider/callback` | No | OAuth2 callback, returns JWT via redirect |

### Server

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/health` | Health check (public) |
| GET | `/api/server/info` | Server metrics (varz) |
| GET | `/api/server/connections` | Active connections (query: `subs` to include subscriptions) |
| GET | `/api/server/jetstream` | JetStream status and stats |
| GET | `/api/server/subscriptions` | All active subscriptions |
| GET | `/api/server/routes` | Cluster routes |

### Streams

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/streams` | List all streams |
| POST | `/api/streams` | Create a stream |
| GET | `/api/streams/:name` | Get stream details |
| PUT | `/api/streams/:name` | Update stream config |
| DELETE | `/api/streams/:name` | Delete a stream |
| POST | `/api/streams/:name/purge` | Purge all messages |
| GET | `/api/streams/:name/messages` | Fetch messages (query: `last`, max 100) |

### Consumers

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/streams/:name/consumers` | List consumers for a stream |
| POST | `/api/streams/:name/consumers` | Create a consumer |
| GET | `/api/streams/:name/consumers/:consumer` | Get consumer details |
| DELETE | `/api/streams/:name/consumers/:consumer` | Delete a consumer |

### Key-Value Store

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/kv` | List all KV buckets |
| POST | `/api/kv` | Create a bucket |
| DELETE | `/api/kv/:bucket` | Delete a bucket |
| GET | `/api/kv/:bucket/keys` | List keys in a bucket |
| GET | `/api/kv/:bucket/keys/:key` | Get key value |
| PUT | `/api/kv/:bucket/keys/:key` | Set key value |
| DELETE | `/api/kv/:bucket/keys/:key` | Delete a key |

### Messages

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/messages/publish` | Publish a message (body: `{subject, data, headers?}`) |
| GET | `/api/messages/subscribe` | Subscribe via SSE (query: `subject`) |
| POST | `/api/messages/request` | Request-reply (body: `{subject, data, headers?, timeout?}`) |
| GET | `/api/messages/subjects` | List active subjects |

---

## Environment Variables Reference

| Variable | Default | Required | Description |
|----------|---------|----------|-------------|
| `PORT` | `3001` | No | Backend HTTP port |
| `BASE_URL` | `http://localhost:3001` | For OAuth2 | Public URL (OAuth2 callbacks) |
| `NATS_URL` | `nats://localhost:4222` | Yes | NATS server address |
| `NATS_USER` | `admin` | No | NATS auth user |
| `NATS_PASS` | _(empty)_ | No | NATS auth password |
| `ADMIN_USER` | `admin` | No | UI login username |
| `ADMIN_PASS` | `admin` | Yes | UI login password |
| `JWT_SECRET` | `change-me-in-production` | Yes | JWT signing key |
| `ALLOWED_OAUTH2_USERS` | `*` | No | Allowed OAuth2 emails |
| `GOOGLE_CLIENT_ID` | _(empty)_ | No | Google OAuth2 |
| `GOOGLE_CLIENT_SECRET` | _(empty)_ | No | Google OAuth2 |
| `GITHUB_CLIENT_ID` | _(empty)_ | No | GitHub OAuth2 |
| `GITHUB_CLIENT_SECRET` | _(empty)_ | No | GitHub OAuth2 |
| `KEYCLOAK_URL` | _(empty)_ | No | Keycloak base URL |
| `KEYCLOAK_REALM` | `master` | No | Keycloak realm |
| `KEYCLOAK_CLIENT_ID` | _(empty)_ | No | Keycloak client |
| `KEYCLOAK_CLIENT_SECRET` | _(empty)_ | No | Keycloak secret |
| `OIDC_NAME` | `SSO` | No | OIDC display name |
| `OIDC_ISSUER_URL` | _(empty)_ | No | OIDC issuer URL |
| `OIDC_CLIENT_ID` | _(empty)_ | No | OIDC client |
| `OIDC_CLIENT_SECRET` | _(empty)_ | No | OIDC secret |
| `OIDC_SCOPES` | `openid email profile` | No | OIDC scopes |
