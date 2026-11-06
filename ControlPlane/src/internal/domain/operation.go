package domain

import "time"

type OperationType string

const (
	OperationTypeProvision OperationType = "PROVISION"
	OperationTypeSave      OperationType = "SAVE"
	OperationTypeResume    OperationType = "RESUME"
	OperationTypeDelete    OperationType = "DELETE"
)

type OperationStatus string

const (
	OperationStatusPending    OperationStatus = "PENDING"
	OperationStatusInProgress OperationStatus = "IN_PROGRESS"
	OperationStatusCompleted  OperationStatus = "COMPLETED"
	OperationStatusFailed     OperationStatus = "FAILED"
)

type OperationError struct {
	Code    string
	Message string
}

type Operation struct {
	ID          string
	WorkspaceID string
	ResourceID  string
	AccountID   string
	Type        OperationType
	Status      OperationStatus
	ETag        string
	StartedAt   time.Time
	CompletedAt *time.Time
	Error       *OperationError
}
