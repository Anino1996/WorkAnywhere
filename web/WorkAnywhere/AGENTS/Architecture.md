# Architecture

> _Technical architecture for CloudAgent Workspace. See [[CloudAgent Workspace]] for the full product overview._

---

## High-Level Overview

CloudAgent Workspace is built around three core layers: a **control plane** that manages workspace lifecycle, a **compute layer** that runs user containers, and a **routing layer** that controls traffic to published workspaces.

---

## Control Plane

The control plane is responsible for all workspace management operations:

- Workspace creation, resumption, suspension, and deletion
- SSH key-pair generation and injection on session start
- Container provisioning and teardown
- Publishing logic — opening and closing container ports
- Traefik routing rule updates on publish/unpublish events

### Workspace States

A workspace moves through the following states during its lifecycle:

```
PROVISIONING → ACTIVE → SAVING → SAVED → RESUMING → ACTIVE
                      ↘ DELETING → DELETED
```

| State | Description |
|---|---|
| `PROVISIONING` | Container is being created and configured; SSH keys are being injected |
| `ACTIVE` | Container is running and accessible via SSH |
| `SAVING` | Workspace filesystem and state are being snapshotted |
| `SAVED` | Container is stopped; state is persisted and restorable |
| `RESUMING` | Saved state is being restored and container is restarting |
| `DELETING` | Container and all associated resources are being torn down |
| `DELETED` | Workspace no longer exists |

State transitions that involve container operations (`PROVISIONING`, `SAVING`, `RESUMING`, `DELETING`) are asynchronous long-running operations. All such operations return an `operation_id` that the client should poll via the Operations API.

---

### Control Plane API

All endpoints are prefixed: `/api/v1`

Authentication: Bearer token on all requests.

---

#### Workspaces

---

##### Create workspace

```
POST /workspaces
```

Provisions a new workspace container. This is an async operation.

**Request body**

```json
{
  "name": "my-workspace"
}
```

**Response `202 Accepted`**

```json
{
  "workspace_id": "ws_abc123",
  "status": "PROVISIONING",
  "operation_id": "op_xyz789",
  "created_at": "2026-04-10T10:00:00Z"
}
```

---

##### List workspaces

```
GET /workspaces
```

Returns all workspaces for the authenticated user.

**Query params**

| Param | Type | Description |
|---|---|---|
| `status` | string | Filter by workspace state (e.g. `ACTIVE`, `SAVED`) |
| `limit` | integer | Max results to return (default: 20) |
| `cursor` | string | Pagination cursor |

**Response `200 OK`**

```json
{
  "workspaces": [
    {
      "workspace_id": "ws_abc123",
      "name": "my-workspace",
      "status": "ACTIVE",
      "created_at": "2026-04-10T10:00:00Z",
      "last_active_at": "2026-04-10T11:30:00Z"
    }
  ],
  "next_cursor": "cursor_xyz"
}
```

---

##### Get workspace

```
GET /workspaces/{workspace_id}
```

Returns the full detail of a single workspace.

**Response `200 OK`**

```json
{
  "workspace_id": "ws_abc123",
  "name": "my-workspace",
  "status": "ACTIVE",
  "data_plane_url": "https://workspace-ws_abc123.data.example.com",
  "data_plane_token": "<short-lived JWT>",
  "data_plane_token_expires_at": "2026-04-10T10:15:00Z",
  "created_at": "2026-04-10T10:00:00Z",
  "last_active_at": "2026-04-10T11:30:00Z"
}
```

---

##### Save workspace

```
POST /workspaces/{workspace_id}/save
```

Snapshots the current workspace filesystem and state, then stops the container. This is an async operation.

**Request body**

```json
{
  "note": "Before refactoring auth module"
}
```

**Response `202 Accepted`**

```json
{
  "workspace_id": "ws_abc123",
  "status": "SAVING",
  "operation_id": "op_xyz790"
}
```

---

##### Resume workspace

```
POST /workspaces/{workspace_id}/resume
```

Restores a `SAVED` workspace from its snapshot and starts the container. This is an async operation. SSH credentials are regenerated on resume.

**Response `202 Accepted`**

```json
{
  "workspace_id": "ws_abc123",
  "status": "RESUMING",
  "operation_id": "op_xyz791"
}
```

---

##### Delete workspace

```
DELETE /workspaces/{workspace_id}
```

Permanently tears down the container and all associated resources. This is an async operation and is irreversible.

**Query params**

| Param | Type | Description |
|---|---|---|
| `force` | boolean | If `true`, deletes even if workspace is `ACTIVE`. Defaults to `false`. |

**Response `202 Accepted`**

```json
{
  "workspace_id": "ws_abc123",
  "status": "DELETING",
  "operation_id": "op_xyz792"
}
```

---

#### Operations

Long-running control plane actions (provisioning, saving, resuming, deleting) are tracked as operations. The client polls the operations endpoint at **500ms intervals** until `status` is `COMPLETED` or `FAILED`. Polling should stop immediately on either terminal state.

---

##### Polling behaviour

```
Client receives operation_id from a 202 response
    → Poll GET /operations/{operation_id} every 500ms
    → On COMPLETED: proceed with success flow, stop polling
    → On FAILED:    surface error to user, stop polling
    → On timeout (client-side, recommended 1 min): treat as FAILED, stop polling
```

The server does not enforce or signal polling intervals — this is a client-side convention. The 500ms interval balances UI responsiveness against unnecessary request volume.

---

##### Get operation status

```
GET /operations/{operation_id}
```

Returns the current status of a long-running operation.

**Response `200 OK`**

```json
{
  "operation_id": "op_xyz789",
  "type": "PROVISION" | "SAVE" | "RESUME" | "DELETE",
  "status": "PENDING" | "IN_PROGRESS" | "COMPLETED" | "FAILED",
  "workspace_id": "ws_abc123",
  "started_at": "2026-04-10T10:00:00Z",
  "completed_at": null,
  "error": null
}
```

**On failure**, `error` is populated:

```json
{
  "error": {
    "code": "CONTAINER_START_FAILED",
    "message": "Container failed to start within timeout period"
  }
}
```

---

##### List operations

```
GET /operations
```

Returns recent operations for the authenticated user.

**Query params**

| Param | Type | Description |
|---|---|---|
| `workspace_id` | string | Filter operations by workspace |
| `status` | string | Filter by operation status |
| `limit` | integer | Max results (default: 20) |

**Response `200 OK`**

```json
{
  "operations": [
    {
      "operation_id": "op_xyz789",
      "type": "PROVISION",
      "status": "COMPLETED",
      "workspace_id": "ws_abc123",
      "started_at": "2026-04-10T10:00:00Z",
      "completed_at": "2026-04-10T10:01:12Z"
    }
  ]
}
```

---

### Error Responses

All endpoints return a consistent error shape:

```json
{
  "error": {
    "code": "WORKSPACE_NOT_FOUND",
    "message": "No workspace found with id ws_abc123",
    "request_id": "req_def456"
  }
}
```

| HTTP status | When |
|---|---|
| `400` | Invalid request body or params |
| `401` | Missing or invalid auth token |
| `403` | Action not permitted for this workspace |
| `404` | Workspace or operation not found |
| `409` | Conflict — ETag mismatch on workspace or operation update |
| `412` | Precondition failed — ETag mismatch on conditional file write |
| `422` | Valid request but unprocessable — e.g. deleting a workspace mid-provisioning without `force` |
| `500` | Internal control plane error |

---

## Compute Layer

Each workspace maps to an isolated container (one container per workspace). Containers are:

- Spun up on demand when a workspace is created or resumed
- Suspended when idle, resumed on next access
- Accessed via the data plane agent — the control plane mounts the agent binary and configures routing at container create time

### Orchestration

| Stage | Technology | Notes |
|---|---|---|
| MVP | Docker SDK (Go client) | Direct use of Docker Engine API via `github.com/moby/moby/client`. `CreateContainer` + `StartContainer` per workspace. |
| Production | Kubernetes | Pod-per-workspace model, native scaling, lifecycle management, and cloud-native tooling. |

The container abstraction layer uses a `ContainerService` interface so that the Docker implementation can be swapped for Kubernetes without changes to handlers or business logic.

---

## Routing Layer

A reverse proxy (Traefik) sits in front of all containers and handles all inbound traffic — both to the data plane agent and to published workspace ports.

- Container ports are **closed by default** — never exposed unless explicitly published
- On publish, the control plane updates Traefik's dynamic configuration to forward traffic to the relevant container port
- On unpublish (or workspace pause/termination), the routing rule is torn down and the port is closed
- Traefik also handles TLS termination for all endpoints

### Port lifecycle

```
Workspace created     → all ports closed; data plane agent route added
User publishes        → control plane opens port, adds Traefik rule
User unpublishes      → Traefik rule removed, port closed
Workspace saved       → all active routing rules torn down eagerly
Workspace resumed     → previously published state does not auto-restore (TBD)
```

---

## Publishing Modes

| Mode | Mechanism |
|---|---|
| **API endpoint** | Container port exposed via Traefik, routed to a stable subdomain or path |
| **Frontend PoC** | Same routing mechanism; container serves a static or dynamic frontend on the exposed port |

---

## VCS Integration

On workspace load from a branch:

1. Control plane clones the target repo and checks out the specified branch into the container's working directory
2. Supported providers: GitHub, GitLab, Azure DevOps
3. Credentials are handled at the control plane level — not exposed to the user session directly

---

## Implementation Architecture

> _How the Control Plane codebase is structured internally. Covers package layout, model separation, interfaces, and dependency wiring._

---

### Tenant Isolation

All data access is scoped by `AccountID`. Both `domain.Workspace` and `domain.Operation` carry an `AccountID` field, and every store query requires it as a parameter. This enforces tenant isolation at the data layer — even if an auth bug leaks a valid token, queries are scoped to the authenticated account. No cross-tenant data access is possible through the store interface.

`AccountID` is an internal field used for scoping. It is not returned in API responses — the caller already knows their own account. Because response and storage models are kept separate, this requires no special handling: `AccountID` simply has no corresponding field in any API response type.

---

### Model Separation: API Types vs Domain Types

The codebase maintains two distinct model layers:

| Layer | Package | Purpose | Characteristics |
|---|---|---|---|
| **API types** | `internal/models/` | HTTP request/response serialisation | JSON tags, `omitempty`, optional pointer fields, shaped for the wire format |
| **Domain types** | `internal/domain/` | Internal business/storage representation | No JSON tags, no serialisation concerns, system-controlled fields (ID, timestamps, ETag) |

**Domain Workspace model:**

| Field | Type | Description |
|---|---|---|
| `ID` | string | System-generated workspace identifier |
| `Name` | string | User-provided workspace name |
| `ResourceID` | string | Underlying compute resource identifier (Docker container ID in MVP, Kubernetes pod name in production) |
| `Status` | WorkspaceStatus | Current lifecycle state |
| `AccountID` | string | Owning account — used for tenant-scoped queries, never returned in responses |
| `ETag` | string | Optimistic concurrency token — populated on every read, required on every update |
| `CreatedAt` | time.Time | Creation timestamp |
| `DeletedAt` | *time.Time | Soft-delete timestamp (nullable) |

**Domain Operation model:**

| Field | Type | Description |
|---|---|---|
| `ID` | string | System-generated operation identifier |
| `WorkspaceID` | string | The workspace this operation acts on |
| `ResourceID` | string | Compute resource identifier — copied from the workspace at operation creation time so the operation handler can inspect the container without a separate workspace lookup |
| `AccountID` | string | Owning account — used for tenant-scoped queries, never returned in responses |
| `Type` | OperationType | PROVISION, SAVE, RESUME, or DELETE |
| `Status` | OperationStatus | PENDING, IN_PROGRESS, COMPLETED, or FAILED |
| `ETag` | string | Optimistic concurrency token — populated on every read, required on every update |
| `StartedAt` | time.Time | When the operation was created |
| `CompletedAt` | *time.Time | When the operation reached a terminal state (nullable) |
| `Error` | *OperationError | Error details if FAILED (nullable) |

`ResourceID` is denormalised onto the operation at creation time. This means the `GetOperation` handler can inspect the container directly using the operation record alone — no secondary workspace lookup is needed.

---

### Storage Layer

The control plane uses PostgreSQL as its production store, with an in-memory store for development and testing. Both satisfy the same `WorkspaceStore` and `OperationStore` interfaces — the rest of the application has no knowledge of which is active.

**Store selection:** `DATABASE_URL` env var controls which implementation is used at startup. If unset, the in-memory store is used.

**Code generation:** SQL queries are written by hand and `sqlc` generates the type-safe Go functions and row structs from them. The generated code lives in `internal/store/db/` and is never edited directly. The `PostgresStore` maps generated row structs to domain types via explicit mapping functions in `internal/store/mapping.go`.

**Migrations:** `goose` runs migrations automatically at startup using SQL files embedded in the binary (`internal/store/migrations/`). No separate migration step is required.

**Schema:**

```sql
workspaces  (id, name, resource_id, status, account_id, etag, created_at, deleted_at)
operations  (id, workspace_id, resource_id, account_id, type, status, etag,
             error_code, error_message, started_at, completed_at, created_at)
```

Unique indexes on `(account_id, id)` for both tables enforce tenant isolation and prevent duplicate inserts at the database level.

**Optimistic concurrency (CAS):** Every row carries an `etag` column. On every write:

- `CreateWorkspace` / `AddOperation` — store generates a UUID etag and writes it. No etag from caller.
- `UpdateWorkspaceStatus` / `UpdateOperation` — store generates a new UUID etag (`NewEtag`) and writes it only if the row's current etag matches the one on the domain object the caller holds (`CurrentEtag`). Zero rows affected → `ErrConflict`.

```
GET  → returns domain.Workspace{ETag: "abc", ...}
UPDATE ws.Status → WHERE etag = "abc" AND SET etag = uuid.New()
                 → 0 rows affected if another writer changed the row → ErrConflict
```

No read-before-write on updates. The caller's stale ETag is the gate — one round-trip per update.

**Cleanup:** `pg_cron` runs a scheduled delete of completed and dead work items older than 7 days. Registered once in a migration:

```sql
SELECT cron.schedule('cleanup-work-items', '0 2 * * *',
  $$DELETE FROM work_items WHERE status IN ('complete', 'dead')
    AND created_at < NOW() - INTERVAL '7 days'$$);
```

---

### Package Layout

```
ControlPlane/
├── openapi.yml                          OpenAPI 3.0 spec (source of truth for API contract)
└── src/
    ├── main.go                          Entry point — wires all dependencies, starts server
    ├── sqlc.yaml                        sqlc code generation config
    └── internal/
        ├── models/                      API request/response types (JSON-tagged)
        │   ├── workspace.go
        │   ├── operation.go
        │   └── errors.go
        ├── domain/                      Domain/storage types (no JSON tags)
        │   ├── workspace.go
        │   └── operation.go
        ├── store/                       Storage interfaces + implementations
        │   ├── workspace.go             WorkspaceStore interface
        │   ├── operation.go             OperationStore interface
        │   ├── errors.go                ErrNotFound, ErrConflict
        │   ├── memory.go                In-memory implementation (dev/test)
        │   ├── postgres.go              PostgresStore — production implementation
        │   ├── mapping.go               Row → domain, domain → params mapping functions
        │   ├── migrations/              goose SQL migration files
        │   │   └── 001_initial.sql
        │   ├── queries/                 Hand-written SQL queries (sqlc input)
        │   │   ├── workspaces.sql
        │   │   └── operations.sql
        │   └── db/                      sqlc generated — never edited
        │       ├── db.go
        │       ├── models.go
        │       ├── workspaces.sql.go
        │       └── operations.sql.go
        ├── container/                   Container lifecycle interface + implementations
        │   ├── service.go               ContainerService interface
        │   └── docker.go                Moby SDK implementation (github.com/moby/moby/client)
        ├── handlers/                    HTTP handlers (hold injected dependencies)
        │   ├── workspaces.go
        │   └── operations.go
        ├── router/                      chi router setup
        │   └── router.go
        ├── middleware/                  HTTP middleware (auth, etc.)
        │   └── auth.go
        └── httputil/                   Shared HTTP helpers
            └── request.go
```

---

### Interfaces

Three interfaces define the seams between handlers and external dependencies.

**WorkspaceStore** (`internal/store/workspace.go`)

```
WorkspaceStore
    CreateWorkspace(ctx, domain.Workspace) → error
    GetWorkspace(ctx, accountID string, workspaceID string) → (domain.Workspace, error)
    UpdateWorkspaceStatus(ctx, ws domain.Workspace, status WorkspaceStatus) → error
```

**OperationStore** (`internal/store/operation.go`)

```
OperationStore
    AddOperation(ctx, domain.Operation) → error
    GetOperation(ctx, accountID string, operationID string) → (domain.Operation, error)
    UpdateOperation(ctx, accountID string, domain.Operation) → error
```

`UpdateWorkspaceStatus` takes the full `domain.Workspace` rather than loose string params. The workspace's `ETag` field is used as the CAS token — no separate etag parameter. The store generates the new etag internally.

All read/update operations on both stores require `accountID` as an explicit parameter — enforcing tenant isolation at the interface level.

**ContainerService** (`internal/container/service.go`)

```
ContainerService
    CreateContainer(ctx, name string) → (resourceID string, error)
    InspectContainer(ctx, resourceID string) → (ContainerState, error)
```

- `CreateContainer` calls Docker `ContainerCreate` + `ContainerStart`, returns the container ID as `resourceID`.
- `InspectContainer` calls Docker `ContainerInspect`, returns the current container state.

---

### Dependency Flow

```
main.go
  │
  │  DATABASE_URL set?
  │    yes → PostgresStore (runs migrations on startup)
  │    no  → MemoryStore
  │
  │  constructs:
  │    Store                 (satisfies WorkspaceStore + OperationStore)
  │    DockerContainerService (satisfies ContainerService)
  │
  │  injects into:
  ▼
WorkspaceHandler  { WorkspaceStore, OperationStore, ContainerService }
OperationHandler  { OperationStore, WorkspaceStore, ContainerService }
  │
  │  passed to:
  ▼
router.New(wh, oh) → chi.Router → http.ListenAndServe
```

---

### CreateWorkspace Request Flow

```
POST /api/v1/workspaces
         │
         ▼
   ┌─────────────┐
   │  Middleware  │  BearerAuth — validate token, extract accountID
   └──────┬──────┘
          ▼
   ┌──────────────────────────┐
   │   WorkspaceHandler       │
   │                          │
   │  1. Decode + validate    │  → 400 if invalid
   │     { name }             │
   │                          │
   │  2. ContainerService     │──▶ CreateContainer(ctx, name)
   │     .CreateContainer()   │    → returns resourceID
   │                          │    → 500 if fails
   │                          │
   │  3. Build domain.        │  Generate workspace ID (uuid)
   │     Workspace            │  set ResourceID, Status = PROVISIONING
   │                          │  set AccountID, CreatedAt
   │                          │
   │  4. WorkspaceStore       │──▶ CreateWorkspace(ctx, workspace)
   │     .CreateWorkspace()   │    → store generates ETag, writes row
   │                          │    → 500 if fails
   │                          │
   │  5. Build domain.        │  Generate operation ID (uuid)
   │     Operation            │  copy ResourceID from workspace
   │                          │  set WorkspaceID, AccountID, Type = PROVISION
   │                          │  Status = IN_PROGRESS, StartedAt = now
   │                          │
   │  6. OperationStore       │──▶ AddOperation(ctx, operation)
   │     .AddOperation()      │    → store generates ETag, writes row
   │                          │    → 500 if fails
   │                          │
   │  7. Map to API response  │  → models.CreateWorkspaceResponse
   └──────────┬───────────────┘
              ▼
    HTTP 202 + CreateWorkspaceResponse
    { workspace_id, status, operation_id, created_at }
```

---

### GetOperation Request Flow

```
GET /api/v1/operations/{operation_id}
         │
         ▼
   ┌─────────────┐
   │  Middleware  │  BearerAuth — validate token, extract accountID
   └──────┬──────┘
          ▼
   ┌──────────────────────────────────┐
   │   OperationHandler               │
   │                                  │
   │  1. OperationStore               │──▶ GetOperation(ctx, accountID, operationID)
   │     .GetOperation()              │    → scoped to account, ETag populated
   │                                  │    → 404 if not found or wrong account
   │                                  │
   │  2. If terminal                  │  Status is COMPLETED or FAILED
   │     → return immediately         │  no container check needed
   │                                  │
   │  3. If non-terminal:             │  operation.ResourceID available directly
   │     ContainerService             │──▶ InspectContainer(ctx, operation.ResourceID)
   │     .InspectContainer()          │    → returns ContainerState
   │                                  │
   │  4. Map container state          │  running → COMPLETED
   │     to operation status          │  exited  → FAILED
   │                                  │  other   → IN_PROGRESS (unchanged)
   │                                  │
   │  5. If status changed to         │  Fire-and-forget goroutine:
   │     terminal → async update      │  → UpdateOperation(ctx, accountID, op)
   │     (don't block response)       │  → GetWorkspace(ctx, accountID, workspaceID)
   │                                  │  → UpdateWorkspaceStatus(ctx, ws, newStatus)
   │                                  │    ETag from GetWorkspace used for CAS
   │                                  │
   │  6. Return operation with        │
   │     resolved status              │
   └──────────┬───────────────────────┘
              ▼
    HTTP 200 + Operation
    { operation_id, type, status, workspace_id, ... }
```

**Known trade-offs (MVP-acceptable):**

- **Docker polled on each non-terminal check.** Acceptable at MVP scale. Future: background reconciliation loop or Docker event stream.
- **Async update is fire-and-forget.** If the store write fails, the next poll self-heals by re-inspecting Docker. No data loss risk.
- **Concurrent polls may trigger duplicate async updates.** Updates are CAS-guarded — only the first writer lands, subsequent ones return `ErrConflict` which the goroutine logs and discards.

---

## Data Plane

> _The data plane is the in-container agent that gives clients (AI agents, iOS app, web) direct access to workspace files. It is separate from the control plane, which manages workspace lifecycle._

---

### Protocol Choice

The data plane uses a **custom HTTP API**. Two alternatives were considered and rejected:

| Option | Reason Rejected |
|---|---|
| SSH + SFTP | Terminal-oriented, designed for humans. No native file watching, per-operation auth handshake overhead, no clean Kubernetes equivalent. `libssh2` required on iOS — no native support. |
| VSCode Server protocol | Reverse-engineered, not an open spec, tightly coupled to editor UI state (tabs, cursor positions). No iOS SDK. |

HTTP is the right fit for an agent-first product: typed RPC primitives, composable with Traefik, natively supported on iOS (`URLSession`) and every other client without additional libraries. WebSocket is added only for operations that are genuinely bidirectional and long-lived (process exec streaming, file watch events) — not for file operations.

---

### Architecture

The data plane is a **Go binary (`agent`) that runs inside every workspace container**. It is not baked into the container image — it is mounted at container start via a read-only shared volume:

```
Host volume:  workanywhere-agent  →  /.workanywhere  (read-only, shared across all containers)
User volume:  workspace-{id}      →  /workspace      (read-write, one per workspace)
```

The control plane overrides the container entrypoint to `["/.workanywhere/agent"]` and injects configuration via environment variables at container create time:

| Variable | Purpose |
|---|---|
| `AGENT_TOKEN` | Bearer token for request authentication |
| `WORKSPACE_ROOT` | Workspace root path inside the container (default: `/workspace`) |
| `PORT` | Port the agent binds to (default: `8081`) |

**Why volume-mounted, not image-baked:**
- Any container image works unchanged — `ubuntu`, `node`, `python`, `debian`, custom images
- Agent upgrades happen by updating the shared volume binary; no per-image rebuild required
- The same binary serves all concurrent workspace containers simultaneously — each execution is an independent process with its own memory space

**Multiple readers, one binary:** The agent volume is read-only and shared. Any number of containers can execute `/.workanywhere/agent` concurrently — the kernel loads each into its own process and heap. No locking, no coordination.

**Docker health check:** Configured at container creation via the Docker API:

```go
Healthcheck: &mobycontainer.HealthConfig{
    Test:        []string{"CMD", "/.workanywhere/agent", "healthcheck"},
    Interval:    30 * time.Second,
    Timeout:     5 * time.Second,
    StartPeriod: 15 * time.Second,
    Retries:     3,
}
```

The agent handles the `healthcheck` subcommand by calling its own `/healthz` endpoint over localhost and exiting 0 (healthy) or 1 (unhealthy). Docker reads the exit code and exposes health status via `ContainerInspect`.

---

### API Surface

#### v0.1 — Files (MVP)

All endpoints require `Authorization: Bearer <token>` except `/healthz`.

Responses always use `Content-Type: application/octet-stream` — never inferred from file extension. The filesystem is byte-oriented; encoding is the client's concern.

```
GET    /v1/fs/{path}        Read file. Returns ETag header. Body is raw file bytes.

PUT    /v1/fs/{path}        Write file. Body is raw bytes. Atomic (temp file + os.Rename).
                            Optional If-Match header for optimistic concurrency (CAS).
                            Returns 200 (overwrite) or 201 (new file), with new ETag header.

DELETE /v1/fs/{path}        Delete file. Returns 204.

GET    /v1/dirs/{path}      List directory. Returns JSON: [{name, type, size, modified_at}].

GET    /healthz             Unauthenticated liveness probe. Returns 200.
GET    /readyz              Readiness probe. Returns 200 when agent is ready.
```

#### v0.2 — Exec (planned)

```
POST /v1/exec/sync          Run a one-shot command, return stdout/stderr/exit_code in body.
POST /v1/exec               Spawn a long-running/interactive process, return session_id.
GET  /v1/exec/{id}/stream   WebSocket: bidirectional stdin/stdout/stderr streaming.
POST /v1/exec/{id}/signal   Send a signal to a running process (SIGTERM, SIGKILL, etc.).
```

#### v0.3 — Watch (planned)

```
GET  /v1/watch              WebSocket or SSE stream of filesystem change events.
                            Emits: {event: "modified"|"created"|"deleted", path: "..."}
```

---

### ETag Design

ETags enable optimistic concurrency on file writes — an agent that read a file and wants to write it back can detect if another writer changed it in the interim.

**Storage:** ETags are stored as Linux extended attributes (`user.etag` xattr on the inode). Stored as a quoted hex string matching the HTTP ETag wire format (e.g. `"a1b2c3d4e5f60708"`). xattrs are invisible to directory listings, survive renames, and are automatically removed when the file is deleted.

**Hash algorithm:** `xxhash (XXH64)` — non-cryptographic, ~10–20 GB/s throughput (vs ~500 MB/s for SHA-256). ETags are change-detection signals, not security primitives.

**Write flow:**
1. Write content to temp file, computing xxhash via `io.TeeReader`
2. `os.Rename(tmp → target)` — atomic on Linux
3. Format ETag as `"<hex>"` and `Setxattr("user.etag", etag)`
4. Return ETag in response header — no transformation needed, stored value is wire-ready

**Read flow:**
1. `Getxattr("user.etag")` — cheap inode syscall, no file content read
2. Set `ETag` response header directly from stored value
3. Stream file body — one file read total

**If-Match on PUT:**
- Strip quotes from `If-Match` header value, compare directly to stored xattr value
- Match → write proceeds; mismatch → `412 Precondition Failed`

**Cold start fallback:** Files with no xattr get one computed on first `GET`. Subsequent reads use the cache.

---

### Path Safety

Every file operation resolves the request path against the workspace root using `filepath.Clean(filepath.Join(root, relPath))`, then verifies the result still has the root prefix. Any path that resolves outside the root returns `403 Forbidden` — distinct from `404 Not Found`.

---

### Client Compatibility

| Client | Notes |
|---|---|
| **iOS** | `URLSession` for HTTP. No libraries needed. |
| **Web / WKWebView** | All responses include CORS headers. |
| **CLI / AI agents** | Plain HTTP — any HTTP client works. |

---

### Package Layout

```
DataPlane/
├── openapi.yml                          OpenAPI 3.0 spec
├── dist/
│   ├── agent                            Compiled binary — linux/amd64 (for containers)
│   └── agent-darwin-arm64               Compiled binary — macOS arm64 (local dev)
└── src/
    ├── main.go                          Entry point — PORT, WORKSPACE_ROOT, AGENT_TOKEN
    └── internal/
        ├── handler/
        │   ├── fs.go                    GET/PUT/DELETE /v1/fs/*
        │   ├── dir.go                   GET /v1/dirs/*
        │   └── health.go                /healthz, /readyz
        ├── middleware/
        │   └── auth.go                  Bearer token validation
        ├── pathutil/
        │   └── pathutil.go              SafeJoin — path traversal prevention
        ├── router/
        │   └── router.go                chi router, standard middleware stack
        └── xattr/
            ├── xattr_linux.go           syscall.Getxattr / Setxattr (production)
            └── xattr_other.go           Stub for non-Linux builds
```

---

### Control Plane Integration (required for end-to-end)

The following control plane changes are required before the data plane can be reached end-to-end:

1. **`GET /api/v1/workspaces/{id}`** — response includes `data_plane_url` and `data_plane_token` alongside existing workspace fields.
2. **JWT minting** — new `internal/auth/jwt.go` package. Signing key injected via env.
3. **`ContainerService.CreateContainer`** — extended to: mount agent volume, mount workspace volume (10GB), override entrypoint, inject env vars, configure Docker health check, attach to Traefik network.

---

## Open Items

- Persistent volume strategy for workspace state across container restarts
- Behaviour of published routes when a workspace is paused or recycled
- Whether workspace resumption restores previously published state automatically
- Network policy and inter-container isolation details
- **TODO — Asymmetric JWT auth for DataPlane:** Replace the current pre-shared `AGENT_TOKEN` with JWT-based auth using RS256 or ES256. ControlPlane holds the private key and mints a short-lived JWT (e.g. 1 hour) per workspace at container create time. DataPlane holds only the public key (injected via env var at startup) and validates incoming tokens with a pure crypto check — no network call required. JWT claims: `sub` (workspace_id), `aud` (dataplane), `exp`. This eliminates the pre-shared secret, scopes credentials per workspace, and enables automatic expiry. Change is localised to `internal/middleware/auth.go` on the DataPlane and a new JWT minting function on the ControlPlane.
# Control Plane Integration (required for end-to-end)

The following control plane changes are required before the data plane can be reached end-to-end:

1. **`GET /api/v1/workspaces/{id}`** — response includes `data_plane_url` and `data_plane_token` alongside existing workspace fields.
2. **JWT minting** — new `internal/auth/jwt.go` package. Signing key injected via env.
3. **`ContainerService.CreateContainer`** — extended to: mount agent volume, mount workspace volume (10GB), override entrypoint, inject env vars, configure Docker health check, attach to Traefik network.

**Building the workspace image:**

```bash
docker build -t workanywhere-workspace DataPlane/
```

The Dockerfile lives in `DataPlane/` and uses `DataPlane/` as its build context, so `src/` resolves to `DataPlane/src/`.
