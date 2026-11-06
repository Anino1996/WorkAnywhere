package handlers

import (
	"encoding/json"
	"net/http"
	"time"

	"github.com/google/uuid"

	"github.com/workanywhere/controlplane/internal/container"
	"github.com/workanywhere/controlplane/internal/domain"
	"github.com/workanywhere/controlplane/internal/httputil"
	"github.com/workanywhere/controlplane/internal/models"
	"github.com/workanywhere/controlplane/internal/store"
)

type WorkspaceHandler struct {
	Workspaces store.WorkspaceStore
	Operations store.OperationStore
	Container  container.ContainerService
}

func (h *WorkspaceHandler) CreateWorkspace(w http.ResponseWriter, r *http.Request) {
	var req models.CreateWorkspaceRequest

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		models.WriteError(w, http.StatusBadRequest, "INVALID_REQUEST_BODY", err.Error(), httputil.ReqID(r))
		return
	}

	if req.Name == "" {
		models.WriteError(w, http.StatusBadRequest, "INVALID_REQUEST_BODY", "field 'name' is required", httputil.ReqID(r))
		return
	}

	accountID := httputil.AccountID(r)

	resourceID, err := h.Container.CreateContainer(r.Context(), req.Name)

	if err != nil {
		models.WriteError(w, http.StatusInternalServerError, "CONTAINER_CREATE_FAILED", err.Error(), httputil.ReqID(r))
		return
	}

	now := time.Now().UTC()
	ws := domain.Workspace{
		ID:         uuid.NewString(),
		Name:       req.Name,
		ResourceID: resourceID,
		Status:     domain.WorkspaceStatusProvisioning,
		AccountID:  accountID,
		CreatedAt:  now,
	}

	if err := h.Workspaces.CreateWorkspace(r.Context(), ws); err != nil {
		models.WriteError(w, http.StatusInternalServerError, "STORAGE_ERROR", err.Error(), httputil.ReqID(r))
		return
	}

	op := domain.Operation{
		ID:          uuid.NewString(),
		WorkspaceID: ws.ID,
		ResourceID:  ws.ResourceID,
		AccountID:   accountID,
		Type:        domain.OperationTypeProvision,
		Status:      domain.OperationStatusInProgress,
		StartedAt:   now,
	}

	if err := h.Operations.AddOperation(r.Context(), op); err != nil {
		models.WriteError(w, http.StatusInternalServerError, "STORAGE_ERROR", err.Error(), httputil.ReqID(r))
		return
	}

	resp := models.CreateWorkspaceResponse{
		WorkspaceID: ws.ID,
		Status:      string(ws.Status),
		OperationID: op.ID,
		CreatedAt:   ws.CreatedAt,
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusAccepted)
	_ = json.NewEncoder(w).Encode(resp)
}
