package models

import "time"

type CreateWorkspaceRequest struct {
	Name string `json:"name"`
}

type CreateWorkspaceResponse struct {
	WorkspaceID string    `json:"workspace_id"`
	Status      string    `json:"status"`
	OperationID string    `json:"operation_id"`
	CreatedAt   time.Time `json:"created_at"`
}
