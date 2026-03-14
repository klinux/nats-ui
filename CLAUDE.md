# NATS UI — Project Instructions

## Overview

NATS UI is a web-based management interface for NATS JetStream. It consists of a Go (Gin) backend serving a React (Vite + shadcn/ui) frontend as static files in production.

## Architecture

```
backend/          Go backend (Gin framework)
frontend/         React frontend (Vite + TypeScript + shadcn/ui)
helm/             Helm chart for Kubernetes deployment
docs/             Configuration documentation
```

## Development Workflow

### TDD First

Always follow Test-Driven Development:

1. **Write the test first** — before any implementation
2. **Run the test** — confirm it fails for the right reason
3. **Write minimal code** — just enough to make the test pass
4. **Refactor** — clean up while tests stay green
5. **Repeat**

No feature or bugfix should be submitted without corresponding tests.

### Running the Dev Stack

```bash
make dev      # Start NATS + backend (air) + frontend (vite) with hot reload
make stop     # Stop everything
make test     # Run all tests (go test + tsc)
make lint     # Lint both frontend and backend
make build    # Production build
```

## Code Quality Rules

### File Size

- **Max 300 lines per file.** If a file exceeds this, split it into smaller, focused modules.
- Each file should have a single responsibility.
- Prefer many small files over few large ones.

### No Code Duplication

- Extract shared logic into utility modules (`lib/`, `internal/`, `utils/`).
- If you see the same pattern in 2+ files, extract it immediately.
- Frontend shared utilities go in `frontend/src/lib/`.
- Backend shared utilities go in `backend/internal/`.

### Error Handling

- **Never ignore errors.** No `_, _ :=` or `catch {}` without handling.
- Always handle and propagate errors with meaningful messages.
- Use defensive checks for values from external sources (API responses, user input).

### Security

- Never commit secrets, `.env` files, or credentials.
- Validate all user input at system boundaries.
- Use parameterized queries / safe encoding for any dynamic content.
- HTTP clients must have explicit timeouts.
- Follow OWASP top 10 guidelines.

### Dependencies

- Don't add dependencies for trivial operations.
- Keep dependencies up to date.
- Prefer standard library when possible (especially in Go).

### Git Practices

- Atomic commits — one logical change per commit.
- Meaningful commit messages following conventional commits (`feat:`, `fix:`, `chore:`, etc.).
- Never force push to `main`.
- Never skip pre-commit hooks.

## Project-Specific Conventions

- Backend uses `gin.H{}` for JSON error responses with `{"error": "message"}` format.
- Frontend uses shadcn/ui components — don't install alternative UI libraries.
- Frontend layout follows the shadcn sidebar-07 pattern.
- All formatting utilities (formatBytes, formatUptime, etc.) live in `frontend/src/lib/format.ts`.
- Environment variables are documented in `docs/configuration.md`.
- Docker image is published to `klinux/nats-ui` on Docker Hub.
