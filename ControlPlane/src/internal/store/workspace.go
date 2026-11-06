package store

import (
	"context"

	"github.com/workanywhere/controlplane/internal/domain"
)

type WorkspaceStore interface {
	CreateWorkspace(ctx context.Context, ws domain.Workspace) error
	GetWorkspace(ctx context.Context, accountID string, workspaceID string) (domain.Workspace, error)
	UpdateWorkspaceStatus(ctx context.Context, ws domain.Workspace, status domain.WorkspaceStatus) error
}
