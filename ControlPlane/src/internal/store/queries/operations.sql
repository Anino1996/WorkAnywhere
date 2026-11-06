-- name: AddOperation :exec
INSERT INTO operations (id, workspace_id, resource_id, account_id, type, status, etag, error_code, error_message, started_at, completed_at, created_at)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12);

-- name: GetOperation :one
SELECT id, workspace_id, resource_id, account_id, type, status, etag, error_code, error_message, started_at, completed_at, created_at
FROM operations
WHERE account_id = $1 AND id = $2;

-- name: UpdateOperation :execrows
UPDATE operations
SET status = sqlc.arg(status), error_code = sqlc.arg(error_code), error_message = sqlc.arg(error_message), completed_at = sqlc.arg(completed_at), etag = sqlc.arg(new_etag)
WHERE account_id = sqlc.arg(account_id) AND id = sqlc.arg(id) AND etag = sqlc.arg(current_etag);
