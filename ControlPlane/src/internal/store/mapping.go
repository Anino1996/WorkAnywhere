package store

import (
	"database/sql"

	"github.com/workanywhere/controlplane/internal/domain"
	"github.com/workanywhere/controlplane/internal/store/db"
)

func toWorkspace(row db.Workspace) domain.Workspace {
	ws := domain.Workspace{
		ID:         row.ID,
		Name:       row.Name,
		ResourceID: row.ResourceID,
		Status:     domain.WorkspaceStatus(row.Status),
		AccountID:  row.AccountID,
		ETag:       row.Etag,
		CreatedAt:  row.CreatedAt,
	}

	if row.DeletedAt.Valid {
		ws.DeletedAt = &row.DeletedAt.Time
	}

	return ws
}

func fromWorkspace(ws domain.Workspace, etag string) db.CreateWorkspaceParams {
	var deletedAt sql.NullTime

	if ws.DeletedAt != nil {
		deletedAt = sql.NullTime{Time: *ws.DeletedAt, Valid: true}
	}

	return db.CreateWorkspaceParams{
		ID:         ws.ID,
		Name:       ws.Name,
		ResourceID: ws.ResourceID,
		Status:     string(ws.Status),
		AccountID:  ws.AccountID,
		Etag:       etag,
		CreatedAt:  ws.CreatedAt,
		DeletedAt:  deletedAt,
	}
}

func toOperation(row db.Operation) domain.Operation {
	op := domain.Operation{
		ID:          row.ID,
		WorkspaceID: row.WorkspaceID,
		ResourceID:  row.ResourceID,
		AccountID:   row.AccountID,
		Type:        domain.OperationType(row.Type),
		Status:      domain.OperationStatus(row.Status),
		ETag:        row.Etag,
		StartedAt:   row.StartedAt,
	}

	if row.CompletedAt.Valid {
		op.CompletedAt = &row.CompletedAt.Time
	}

	if row.ErrorCode.Valid || row.ErrorMessage.Valid {
		op.Error = &domain.OperationError{
			Code:    row.ErrorCode.String,
			Message: row.ErrorMessage.String,
		}
	}

	return op
}

func fromOperation(op domain.Operation, etag string) db.AddOperationParams {
	var completedAt sql.NullTime

	if op.CompletedAt != nil {
		completedAt = sql.NullTime{Time: *op.CompletedAt, Valid: true}
	}

	var errorCode, errorMessage sql.NullString

	if op.Error != nil {
		errorCode = sql.NullString{String: op.Error.Code, Valid: true}
		errorMessage = sql.NullString{String: op.Error.Message, Valid: true}
	}

	return db.AddOperationParams{
		ID:           op.ID,
		WorkspaceID:  op.WorkspaceID,
		ResourceID:   op.ResourceID,
		AccountID:    op.AccountID,
		Type:         string(op.Type),
		Status:       string(op.Status),
		Etag:         etag,
		ErrorCode:    errorCode,
		ErrorMessage: errorMessage,
		StartedAt:    op.StartedAt,
		CompletedAt:  completedAt,
		CreatedAt:    op.StartedAt,
	}
}
