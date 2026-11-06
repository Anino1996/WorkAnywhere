package domain

import "time"

type WorkspaceStatus string

const (
	WorkspaceStatusProvisioning WorkspaceStatus = "PROVISIONING"
	WorkspaceStatusActive       WorkspaceStatus = "ACTIVE"
	WorkspaceStatusSaving       WorkspaceStatus = "SAVING"
	WorkspaceStatusSaved        WorkspaceStatus = "SAVED"
	WorkspaceStatusResuming     WorkspaceStatus = "RESUMING"
	WorkspaceStatusDeleting     WorkspaceStatus = "DELETING"
	WorkspaceStatusDeleted      WorkspaceStatus = "DELETED"
)

type Workspace struct {
	ID         string
	Name       string
	ResourceID string
	Status     WorkspaceStatus
	AccountID  string
	ETag       string
	CreatedAt  time.Time
	DeletedAt  *time.Time
}
