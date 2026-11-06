-- name: CreateWorkspace :exec
INSERT INTO workspaces (id, name, resource_id, status, account_id, etag, created_at, deleted_at)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8);

-- name: GetWorkspace :one
SELECT id, name, resource_id, status, account_id, etag, created_at, deleted_at
FROM workspaces
WHERE account_id = $1 AND id = $2 AND deleted_at IS NULL;

-- name: UpdateWorkspaceStatus :execrows
UPDATE workspaces
SET status = sqlc.arg(status), etag = sqlc.arg(new_etag)
WHERE account_id = sqlc.arg(account_id) AND id = sqlc.arg(id) AND etag = sqlc.arg(current_etag) AND deleted_at IS NULL;
