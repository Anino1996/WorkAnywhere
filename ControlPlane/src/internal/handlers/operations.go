package handlers

import (
	"context"
	"encoding/json"
	"log"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"

	"github.com/workanywhere/controlplane/internal/container"
	"github.com/workanywhere/controlplane/internal/domain"
	"github.com/workanywhere/controlplane/internal/httputil"
	"github.com/workanywhere/controlplane/internal/models"
	"github.com/workanywhere/controlplane/internal/store"
)

type OperationHandler struct {
	Operations store.OperationStore
	Workspaces store.WorkspaceStore
	Container  container.ContainerService
}

func (h *OperationHandler) GetOperation(w http.ResponseWriter, r *http.Request) {
	operationID := chi.URLParam(r, "operation_id")
	accountID := httputil.AccountID(r)

	op, err := h.Operations.GetOperation(r.Context(), accountID, operationID)
	if err != nil {
		models.WriteError(w, http.StatusNotFound, "OPERATION_NOT_FOUND", "operation not found", httputil.ReqID(r))
		return
	}

	if op.Status == domain.OperationStatusCompleted || op.Status == domain.OperationStatusFailed {
		writeOperationResponse(w, op)
		return
	}

	state, err := h.Container.InspectContainer(r.Context(), op.ResourceID)
	if err != nil {
		models.WriteError(w, http.StatusInternalServerError, "CONTAINER_INSPECT_FAILED", err.Error(), httputil.ReqID(r))
		return
	}

	resolvedStatus := resolveOperationStatus(state)

	if resolvedStatus != op.Status {
		now := time.Now().UTC()
		updatedOp := op
		updatedOp.Status = resolvedStatus
		updatedOp.CompletedAt = &now

		if state.ExitCode != 0 {
			updatedOp.Error = &domain.OperationError{
				Code:    "CONTAINER_EXITED",
				Message: "container exited unexpectedly",
			}
		}

		go func(op domain.Operation, wsStatus domain.WorkspaceStatus) {
			ctx := context.Background()
			if err := h.Operations.UpdateOperation(ctx, op.AccountID, op); err != nil {
				log.Printf("async: failed to update operation %s: %v", op.ID, err)
			}
			ws, err := h.Workspaces.GetWorkspace(ctx, op.AccountID, op.WorkspaceID)
			if err != nil {
				log.Printf("async: failed to fetch workspace %s: %v", op.WorkspaceID, err)
				return
			}
			if err := h.Workspaces.UpdateWorkspaceStatus(ctx, ws, wsStatus); err != nil {
				log.Printf("async: failed to update workspace status for %s: %v", op.WorkspaceID, err)
			}
		}(updatedOp, mapOperationStatusToWorkspaceStatus(resolvedStatus))

		op = updatedOp
	}

	writeOperationResponse(w, op)
}

func resolveOperationStatus(state container.ContainerState) domain.OperationStatus {
	if state.Running {
		return domain.OperationStatusCompleted
	}
	if state.ExitCode != 0 {
		return domain.OperationStatusFailed
	}
	return domain.OperationStatusInProgress
}

func mapOperationStatusToWorkspaceStatus(status domain.OperationStatus) domain.WorkspaceStatus {
	switch status {
	case domain.OperationStatusCompleted:
		return domain.WorkspaceStatusActive
	case domain.OperationStatusFailed:
		return domain.WorkspaceStatusProvisioning
	default:
		return domain.WorkspaceStatusProvisioning
	}
}

func writeOperationResponse(w http.ResponseWriter, op domain.Operation) {
	resp := models.OperationResponse{
		OperationID: op.ID,
		WorkspaceID: op.WorkspaceID,
		Type:        string(op.Type),
		Status:      string(op.Status),
		StartedAt:   op.StartedAt,
		CompletedAt: op.CompletedAt,
	}
	if op.Error != nil {
		resp.Error = &models.OperationErrorResponse{
			Code:    op.Error.Code,
			Message: op.Error.Message,
		}
	}
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	_ = json.NewEncoder(w).Encode(resp)
}
