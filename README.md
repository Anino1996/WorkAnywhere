# WorkAnywhere — CloudAgent Workspace

Cloud dev environments you can drive from anywhere. WorkAnywhere provisions
containerized coding workspaces, exposes their filesystems over a typed HTTP
API, and lets you review and apply AI-proposed code edits from the web or your
phone.

> **Status:** MVP / active development. Each component works standalone; the
> end-to-end wiring (routing layer, JWT auth, real HTTP clients in the web app)
> is on the roadmap below.

## How it fits together

```
   Web App (Vite/React)        iOS App (SwiftUI)
            │                        │
            ▼                        ▼
        ┌─────────────────────────────────┐
        │          Control Plane          │   Go — workspace lifecycle
        │  workspaces · operations API    │   Postgres (sqlc) or in-memory
        │  container provisioning (Docker)│   async ops with polling
        └───────────────┬─────────────────┘
                        │  mounts agent + workspace volumes,
                        │  overrides entrypoint
                        ▼
        ┌─────────────────────────────────┐
        │      Workspace containers       │   one container per workspace
        │   ┌───────────────────────────┐ │
        │   │  Data Plane agent (Go)    │ │   file/dir HTTP API, ETags,
        │   │  /v1/fs · /v1/dirs        │ │   path-traversal guard,
        │   └───────────────────────────┘ │   healthz / readyz
        └─────────────────────────────────┘
```

Workspaces move through a lifecycle, with long-running transitions tracked as
pollable operations:

```
PROVISIONING → ACTIVE → SAVING → SAVED → RESUMING → ACTIVE
                        ↘ DELETING → DELETED
```

## Repository layout

| Path | What it is |
|---|---|
| `ControlPlane/` | Go service — workspace & operations API, Postgres store (sqlc + goose migrations) with in-memory fallback, Docker container lifecycle |
| `DataPlane/` | Go agent — runs inside each workspace container, serves the file/dir API with ETag optimistic concurrency |
| `web/WorkAnywhere/WebApp/` | Vite + React + TypeScript + Tailwind client — chat-centric coding UI, diff review with Apply/Undo, files browser |
| `web/WorkAnywhere/AGENTS/` | Product & architecture docs (design notes, API contract, diff application strategy) |
| `iOS/` | SwiftUI app with a streaming Anthropic Messages client (API key stored in Keychain) |
| `CLAUDE.md` | Project code rules enforced across all stacks |

## Components

### Control Plane

Manages the full workspace lifecycle: create, save, resume, delete. Container
operations are asynchronous — every mutating call returns an `operation_id`
that clients poll until `COMPLETED` or `FAILED`. All writes are CAS-guarded by
ETags, and every store query is scoped by account for tenant isolation.

- **Router:** chi · **Storage:** PostgreSQL via `sqlc`-generated queries
  (migrations embedded and run at startup), or in-memory when `DATABASE_URL`
  is unset · **Containers:** Docker Engine API via the Moby SDK behind a
  `ContainerService` interface (Kubernetes-swappable)
- **Auth:** Bearer token; in the current MVP the token also acts as the
  account ID (see roadmap)

### Data Plane

A single Go binary volume-mounted into every workspace container (not baked
into images), so any base image works and one binary serves all containers.

```
GET    /v1/fs/{path}     read file (ETag header, raw bytes)
PUT    /v1/fs/{path}     atomic write, optional If-Match CAS (412 on mismatch)
DELETE /v1/fs/{path}     delete file
GET    /v1/dirs/{path}   list directory
GET    /healthz /readyz  liveness / readiness
```

ETags are content hashes (xxhash) stored as extended attributes — invisible to
listings, cheap to read, wire-format ready. All paths resolve inside the
workspace root; anything that escapes it returns `403`.

### Web App

Mobile-first, chat-centric coding UI: workspace home, chat with AI-proposed
edits, full-screen diff review with Apply/Undo (inverse-table based, per-file
ETag guards), and a files browser. Runs fully offline against in-browser mocks
that exercise the real polling / ETag / Apply-Undo loops — set
`VITE_USE_MOCKS=0` to switch to the real HTTP clients.

### iOS App

SwiftUI client with a streaming Anthropic Messages integration (SSE parsing,
tool-use accumulation). The API key lives in the Keychain, never in code.

## Quick start

**Control plane** (needs Docker; Postgres optional):

```bash
cd ControlPlane/src
go run .                 # in-memory store on :8080
DATABASE_URL=postgres://... go run .
```

**Data plane agent** (local dev):

```bash
cd DataPlane/src
AGENT_TOKEN=dev-token WORKSPACE_ROOT=./tmp-workspace go run .
```

**Web app** (mock mode, no backend needed):

```bash
cd web/WorkAnywhere/WebApp
pnpm install
pnpm dev                 # http://localhost:5173
```

**iOS app:** open `iOS/CloudAgentWorkspace.xcodeproj` in Xcode.

## API reference

Both services publish OpenAPI 3.0 specs as the source of truth:
[`ControlPlane/openapi.yml`](ControlPlane/openapi.yml) and
[`DataPlane/openapi.yml`](DataPlane/openapi.yml). Full narrative docs,
including request flows and the diff-application strategy, live in
[`web/WorkAnywhere/AGENTS/Architecture.md`](web/WorkAnywhere/AGENTS/Architecture.md).

## Development

Code style rules live in [`CLAUDE.md`](CLAUDE.md) — explicit types everywhere,
and a blank line before/after control-flow blocks.

```bash
# Go — format, vet, test (both services)
cd ControlPlane/src && gofmt -l . && go vet ./... && go test ./...
cd DataPlane/src      && gofmt -l . && go vet ./... && go test ./...

# Web — lint (ESLint), typecheck, tests
cd web/WorkAnywhere/WebApp
pnpm lint && pnpm verify
```

## Roadmap

- Data plane v0.2 — exec (`POST /v1/exec` + WebSocket streaming) and v0.3 —
  file watch events
- Asymmetric JWT auth for the data plane (short-lived, per-workspace tokens
  minted by the control plane) replacing the pre-shared `AGENT_TOKEN`
- Traefik routing layer — publish/unpublish workspace ports behind TLS
- VCS integration — clone a repo/branch into a new workspace at create time
- Real BFF/auth for the web app; wire HTTP clients end-to-end
- Kubernetes orchestration behind the existing `ContainerService` interface
