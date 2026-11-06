package store

import (
	"context"
	"database/sql"
	"embed"
	"fmt"

	"github.com/google/uuid"
	_ "github.com/jackc/pgx/v5/stdlib"
	"github.com/pressly/goose/v3"
	"github.com/workanywhere/controlplane/internal/domain"
	"github.com/workanywhere/controlplane/internal/store/db"
)

//go:embed migrations/*.sql
var migrations embed.FS

type PostgresStore struct {
	conn    *sql.DB
	queries *db.Queries
}

func NewPostgresStore(postgresURL string) (*PostgresStore, error) {
	conn, err := sql.Open("pgx", postgresURL)

	if err != nil {
		return nil, fmt.Errorf("opening postgres connection: %w", err)
	}

	if err := conn.Ping(); err != nil {
		return nil, fmt.Errorf("pinging postgres: %w", err)
	}

	if err := runMigrations(conn); err != nil {
		return nil, fmt.Errorf("running migrations: %w", err)
	}

	return &PostgresStore{
		conn:    conn,
		queries: db.New(conn),
	}, nil
}

func (s *PostgresStore) Close() error {
	return s.conn.Close()
}

func runMigrations(conn *sql.DB) error {
	goose.SetBaseFS(migrations)

	if err := goose.SetDialect("postgres"); err != nil {
		return err
	}

	return goose.Up(conn, "migrations")
}

func (s *PostgresStore) CreateWorkspace(ctx context.Context, ws domain.Workspace) error {
	etag := uuid.NewString()
	return s.queries.CreateWorkspace(ctx, fromWorkspace(ws, etag))
}

func (s *PostgresStore) GetWorkspace(ctx context.Context, accountID string, workspaceID string) (domain.Workspace, error) {
	row, err := s.queries.GetWorkspace(ctx, db.GetWorkspaceParams{
		AccountID: accountID,
		ID:        workspaceID,
	})

	if err != nil {
		if err == sql.ErrNoRows {
			return domain.Workspace{}, ErrNotFound
		}

		return domain.Workspace{}, fmt.Errorf("getting workspace: %w", err)
	}

	return toWorkspace(row), nil
}

func (s *PostgresStore) UpdateWorkspaceStatus(ctx context.Context, ws domain.Workspace, status domain.WorkspaceStatus) error {
	rowsAffected, err := s.queries.UpdateWorkspaceStatus(ctx, db.UpdateWorkspaceStatusParams{
		Status:      string(status),
		NewEtag:     uuid.NewString(),
		AccountID:   ws.AccountID,
		ID:          ws.ID,
		CurrentEtag: ws.ETag,
	})

	if err != nil {
		return fmt.Errorf("updating workspace status: %w", err)
	}

	if rowsAffected == 0 {
		return ErrConflict
	}

	return nil
}

func (s *PostgresStore) AddOperation(ctx context.Context, op domain.Operation) error {
	etag := uuid.NewString()
	return s.queries.AddOperation(ctx, fromOperation(op, etag))
}

func (s *PostgresStore) GetOperation(ctx context.Context, accountID string, operationID string) (domain.Operation, error) {
	row, err := s.queries.GetOperation(ctx, db.GetOperationParams{
		AccountID: accountID,
		ID:        operationID,
	})

	if err != nil {
		if err == sql.ErrNoRows {
			return domain.Operation{}, ErrNotFound
		}

		return domain.Operation{}, fmt.Errorf("getting operation: %w", err)
	}

	return toOperation(row), nil
}

func (s *PostgresStore) UpdateOperation(ctx context.Context, accountID string, op domain.Operation) error {
	var completedAt sql.NullTime

	if op.CompletedAt != nil {
		completedAt = sql.NullTime{Time: *op.CompletedAt, Valid: true}
	}

	var errorCode, errorMessage sql.NullString

	if op.Error != nil {
		errorCode = sql.NullString{String: op.Error.Code, Valid: true}
		errorMessage = sql.NullString{String: op.Error.Message, Valid: true}
	}

	rowsAffected, err := s.queries.UpdateOperation(ctx, db.UpdateOperationParams{
		Status:       string(op.Status),
		ErrorCode:    errorCode,
		ErrorMessage: errorMessage,
		CompletedAt:  completedAt,
		NewEtag:      uuid.NewString(),
		AccountID:    accountID,
		ID:           op.ID,
		CurrentEtag:  op.ETag,
	})

	if err != nil {
		return fmt.Errorf("updating operation: %w", err)
	}

	if rowsAffected == 0 {
		return ErrConflict
	}

	return nil
}
