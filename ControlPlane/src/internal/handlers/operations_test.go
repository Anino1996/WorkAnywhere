package handlers

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"sync"
	"testing"
	"encoding/json"

	"github.com/go-chi/chi/v5"

	"github.com/workanywhere/controlplane/internal/container"
	"github.com/workanywhere/controlplane/internal/domain"
	"github.com/workanywhere/controlplane/internal/models"
)

func TestResolveOperationStatus(t *testing.T) {
	cases := []struct {
		state container.ContainerState
		want  domain.OperationStatus
	}{
		{container.ContainerState{Running: true, ExitCode: 0}, domain.OperationStatusCompleted},
		{container.ContainerState{Running: false, ExitCode: 1}, domain.OperationStatusFailed},
		{container.ContainerState{Running: false, ExitCode: 0}, domain.OperationStatusInProgress},
	}
	for _, tc := range cases {
		got := resolveOperationStatus(tc.state)
		if got != tc.want {
			t.Errorf("resolveOperationStatus(%+v) = %q, want %q", tc.state, got, tc.want)
		}
	}
}

func TestMapOperationStatusToWorkspaceStatus(t *testing.T) {
	cases := []struct {
		status domain.OperationStatus
		want   domain.WorkspaceStatus
	}{
		{domain.OperationStatusCompleted, domain.WorkspaceStatusActive},
		{domain.OperationStatusFailed, domain.WorkspaceStatusProvisioning},
		{domain.OperationStatusInProgress, domain.WorkspaceStatusProvisioning},
		{domain.OperationStatusPending, domain.WorkspaceStatusProvisioning},
	}
	for _, tc := range cases {
		got := mapOperationStatusToWorkspaceStatus(tc.status)
		if got != tc.want {
			t.Errorf("mapOperationStatusToWorkspaceStatus(%q) = %q, want %q", tc.status, got, tc.want)
		}
	}
}

func TestGetOperation(t *testing.T) {
	newHandler := func(ops *mockOperationStore, ws *mockWorkspaceStore, ctr *mockContainerService) *OperationHandler {
		return &OperationHandler{Operations: ops, Workspaces: ws, Container: ctr}
	}

	withOperationID := func(r *http.Request, id string) *http.Request {
		rctx := chi.NewRouteContext()
		rctx.URLParams.Add("operation_id", id)
		return r.WithContext(context.WithValue(r.Context(), chi.RouteCtxKey, rctx))
	}

	t.Run("operation not found returns 404", func(t *testing.T) {
		ops := &mockOperationStore{getErr: errors.New("not found")}
		ctr := &mockContainerService{}
		h := newHandler(ops, &mockWorkspaceStore{}, ctr)

		r := withOperationID(newRequest(http.MethodGet, "/", "acc-1", nil), "op-1")
		w := httptest.NewRecorder()
		h.GetOperation(w, r)

		if w.Code != http.StatusNotFound {
			t.Fatalf("status: got %d, want %d", w.Code, http.StatusNotFound)
		}
		assertErrorCode(t, w, "OPERATION_NOT_FOUND")
		if ctr.inspectCalled {
			t.Error("InspectContainer should not be called when operation not found")
		}
	})

	t.Run("already completed returns immediately without inspect", func(t *testing.T) {
		ops := &mockOperationStore{getResult: domain.Operation{
			ID:     "op-1",
			Status: domain.OperationStatusCompleted,
		}}
		ctr := &mockContainerService{}
		h := newHandler(ops, &mockWorkspaceStore{}, ctr)

		r := withOperationID(newRequest(http.MethodGet, "/", "acc-1", nil), "op-1")
		w := httptest.NewRecorder()
		h.GetOperation(w, r)

		if w.Code != http.StatusOK {
			t.Fatalf("status: got %d, want %d", w.Code, http.StatusOK)
		}
		assertOperationStatus(t, w, "COMPLETED")
		if ctr.inspectCalled {
			t.Error("InspectContainer should not be called for terminal operation")
		}
	})

	t.Run("already failed returns immediately without inspect", func(t *testing.T) {
		ops := &mockOperationStore{getResult: domain.Operation{
			ID:     "op-1",
			Status: domain.OperationStatusFailed,
		}}
		h := newHandler(ops, &mockWorkspaceStore{}, &mockContainerService{})

		r := withOperationID(newRequest(http.MethodGet, "/", "acc-1", nil), "op-1")
		w := httptest.NewRecorder()
		h.GetOperation(w, r)

		if w.Code != http.StatusOK {
			t.Fatalf("status: got %d, want %d", w.Code, http.StatusOK)
		}
		assertOperationStatus(t, w, "FAILED")
	})

	t.Run("inspect error returns 500", func(t *testing.T) {
		ops := &mockOperationStore{getResult: domain.Operation{ID: "op-1", Status: domain.OperationStatusInProgress}}
		ctr := &mockContainerService{inspectErr: errors.New("docker error")}
		h := newHandler(ops, &mockWorkspaceStore{}, ctr)

		r := withOperationID(newRequest(http.MethodGet, "/", "acc-1", nil), "op-1")
		w := httptest.NewRecorder()
		h.GetOperation(w, r)

		if w.Code != http.StatusInternalServerError {
			t.Fatalf("status: got %d, want %d", w.Code, http.StatusInternalServerError)
		}
		assertErrorCode(t, w, "CONTAINER_INSPECT_FAILED")
	})

	t.Run("status unchanged does not fire goroutine", func(t *testing.T) {
		ops := &mockOperationStore{getResult: domain.Operation{
			ID:     "op-1",
			Status: domain.OperationStatusInProgress,
		}}
		ctr := &mockContainerService{inspectResult: container.ContainerState{Running: false, ExitCode: 0}}
		h := newHandler(ops, &mockWorkspaceStore{}, ctr)

		r := withOperationID(newRequest(http.MethodGet, "/", "acc-1", nil), "op-1")
		w := httptest.NewRecorder()
		h.GetOperation(w, r)

		if w.Code != http.StatusOK {
			t.Fatalf("status: got %d, want %d", w.Code, http.StatusOK)
		}
		assertOperationStatus(t, w, "IN_PROGRESS")
		ops.mu.Lock()
		updatedCount := len(ops.updated)
		ops.mu.Unlock()
		if updatedCount != 0 {
			t.Errorf("UpdateOperation should not be called when status unchanged, got %d calls", updatedCount)
		}
	})

	t.Run("transitions to completed fires async update", func(t *testing.T) {
		var wg sync.WaitGroup
		wg.Add(2)

		ops := &mockOperationStore{
			getResult: domain.Operation{
				ID:          "op-1",
				WorkspaceID: "ws-1",
				AccountID:   "acc-1",
				Status:      domain.OperationStatusInProgress,
			},
			updateWg: &wg,
		}
		ws := &mockWorkspaceStore{updateWg: &wg}
		ctr := &mockContainerService{inspectResult: container.ContainerState{Running: true}}
		h := newHandler(ops, ws, ctr)

		r := withOperationID(newRequest(http.MethodGet, "/", "acc-1", nil), "op-1")
		w := httptest.NewRecorder()
		h.GetOperation(w, r)

		if w.Code != http.StatusOK {
			t.Fatalf("status: got %d, want %d", w.Code, http.StatusOK)
		}
		assertOperationStatus(t, w, "COMPLETED")

		wg.Wait()

		ops.mu.Lock()
		updatedOp := ops.updated[0]
		ops.mu.Unlock()
		if updatedOp.Status != domain.OperationStatusCompleted {
			t.Errorf("updated operation status: got %q, want %q", updatedOp.Status, domain.OperationStatusCompleted)
		}
		if updatedOp.CompletedAt == nil {
			t.Error("updated operation CompletedAt should be set")
		}

		ws.mu.Lock()
		updatedWsStatus := ws.updatedStatus
		ws.mu.Unlock()
		if updatedWsStatus != domain.WorkspaceStatusActive {
			t.Errorf("updated workspace status: got %q, want %q", updatedWsStatus, domain.WorkspaceStatusActive)
		}
	})

	t.Run("transitions to failed with non-zero exit sets error field", func(t *testing.T) {
		var wg sync.WaitGroup
		wg.Add(2)

		ops := &mockOperationStore{
			getResult: domain.Operation{
				ID:          "op-1",
				WorkspaceID: "ws-1",
				AccountID:   "acc-1",
				Status:      domain.OperationStatusInProgress,
			},
			updateWg: &wg,
		}
		ws := &mockWorkspaceStore{updateWg: &wg}
		ctr := &mockContainerService{inspectResult: container.ContainerState{Running: false, ExitCode: 1}}
		h := newHandler(ops, ws, ctr)

		r := withOperationID(newRequest(http.MethodGet, "/", "acc-1", nil), "op-1")
		w := httptest.NewRecorder()
		h.GetOperation(w, r)

		if w.Code != http.StatusOK {
			t.Fatalf("status: got %d, want %d", w.Code, http.StatusOK)
		}

		var resp models.OperationResponse
		if err := json.NewDecoder(w.Body).Decode(&resp); err != nil {
			t.Fatalf("decode: %v", err)
		}
		if resp.Status != "FAILED" {
			t.Errorf("status: got %q, want %q", resp.Status, "FAILED")
		}
		if resp.Error == nil {
			t.Fatal("expected error field to be set")
		}
		if resp.Error.Code != "CONTAINER_EXITED" {
			t.Errorf("error code: got %q, want %q", resp.Error.Code, "CONTAINER_EXITED")
		}

		wg.Wait()

		ws.mu.Lock()
		updatedWsStatus := ws.updatedStatus
		ws.mu.Unlock()
		if updatedWsStatus != domain.WorkspaceStatusProvisioning {
			t.Errorf("updated workspace status: got %q, want %q", updatedWsStatus, domain.WorkspaceStatusProvisioning)
		}
	})

	t.Run("goroutine store error does not affect response", func(t *testing.T) {
		var wg sync.WaitGroup
		wg.Add(2)

		ops := &mockOperationStore{
			getResult: domain.Operation{
				ID:          "op-1",
				WorkspaceID: "ws-1",
				AccountID:   "acc-1",
				Status:      domain.OperationStatusInProgress,
			},
			updateErr: errors.New("store error"),
			updateWg:  &wg,
		}
		ws := &mockWorkspaceStore{updateWg: &wg}
		ctr := &mockContainerService{inspectResult: container.ContainerState{Running: true}}
		h := newHandler(ops, ws, ctr)

		r := withOperationID(newRequest(http.MethodGet, "/", "acc-1", nil), "op-1")
		w := httptest.NewRecorder()
		h.GetOperation(w, r)

		if w.Code != http.StatusOK {
			t.Fatalf("status: got %d, want %d", w.Code, http.StatusOK)
		}

		wg.Wait()
	})
}

func assertOperationStatus(t *testing.T, w *httptest.ResponseRecorder, status string) {
	t.Helper()
	var resp models.OperationResponse
	if err := json.NewDecoder(w.Body).Decode(&resp); err != nil {
		t.Fatalf("decode operation response: %v", err)
	}
	if resp.Status != status {
		t.Errorf("operation status: got %q, want %q", resp.Status, status)
	}
}
