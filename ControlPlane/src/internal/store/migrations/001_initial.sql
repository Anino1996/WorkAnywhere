-- +goose Up

CREATE TABLE workspaces (
    id          TEXT        NOT NULL,
    name        TEXT        NOT NULL,
    resource_id TEXT        NOT NULL DEFAULT '',
    status      TEXT        NOT NULL,
    account_id  TEXT        NOT NULL,
    etag        TEXT        NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL,
    deleted_at  TIMESTAMPTZ
);

CREATE UNIQUE INDEX workspaces_pkey ON workspaces (account_id, id);

CREATE TABLE operations (
    id            TEXT        NOT NULL,
    workspace_id  TEXT        NOT NULL,
    resource_id   TEXT        NOT NULL DEFAULT '',
    account_id    TEXT        NOT NULL,
    type          TEXT        NOT NULL,
    status        TEXT        NOT NULL,
    etag          TEXT        NOT NULL,
    error_code    TEXT,
    error_message TEXT,
    started_at    TIMESTAMPTZ NOT NULL,
    completed_at  TIMESTAMPTZ,
    created_at    TIMESTAMPTZ NOT NULL
);

CREATE UNIQUE INDEX operations_pkey ON operations (account_id, id);

-- +goose Down

DROP TABLE operations;
DROP TABLE workspaces;
