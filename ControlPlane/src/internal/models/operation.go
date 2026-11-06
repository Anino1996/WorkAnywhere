package models

import "time"

type OperationResponse struct {
	OperationID string                  `json:"operation_id"`
	WorkspaceID string                  `json:"workspace_id"`
	Type        string                  `json:"type"`
	Status      string                  `json:"status"`
	StartedAt   time.Time               `json:"started_at"`
	CompletedAt *time.Time              `json:"completed_at,omitempty"`
	Error       *OperationErrorResponse `json:"error,omitempty"`
}

type OperationErrorResponse struct {
	Code    string `json:"code"`
	Message string `json:"message"`
}
