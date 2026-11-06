package handlers

import (
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/workanywhere/controlplane/internal/domain"
	"github.com/workanywhere/controlplane/internal/models"
)

func TestCreateWorkspace(t *testing.T) {
	newHandler := func(ctr *mockContainerService, ws *mockWorkspaceStore, ops *mockOperationStore) *WorkspaceHandler {
		return &WorkspaceHandler{Workspaces: ws, Operations: ops, Container: ctr}
	}

	t.Run("happy path", func(t *testing.T) {
		ctr := &mockContainerService{createResult: "ctr-1"}
		ws := &mockWorkspaceStore{}
		ops := &mockOperationStore{}
		h := newHandler(ctr, ws, ops)

		r := newRequest(http.MethodPost, "/", "acc-1", strings.NewReader(`{"name":"my-workspace"}`))
		w := httptest.NewRecorder()
		h.CreateWorkspace(w, r)

		if w.Code != http.StatusAccepted {
			t.Fatalf("status: got %d, want %d", w.Code, http.StatusAccepted)
		}

		var resp models.CreateWorkspaceResponse

		if err := json.NewDecoder(w.Body).Decode(&resp); err != nil {
			t.Fatalf("decode response: %v", err)
		}

		if resp.WorkspaceID == "" {
			t.Error("workspace_id is empty")
		}

		if resp.OperationID == "" {
			t.Error("operation_id is empty")
		}

		if resp.Status != string(domain.WorkspaceStatusProvisioning) {
			t.Errorf("status: got %q, want %q", resp.Status, domain.WorkspaceStatusProvisioning)
		}

		if resp.CreatedAt.IsZero() {
			t.Error("created_at is zero")
		}

		if len(ws.created) != 1 {
			t.Fatalf("expected 1 created workspace, got %d", len(ws.created))
		}

		created := ws.created[0]

		if created.ResourceID != "ctr-1" {
			t.Errorf("resourceID: got %q, want %q", created.ResourceID, "ctr-1")
		}

		if created.AccountID != "acc-1" {
			t.Errorf("accountID: got %q, want %q", created.AccountID, "acc-1")
		}

		if created.Status != domain.WorkspaceStatusProvisioning {
			t.Errorf("workspace status: got %q, want %q", created.Status, domain.WorkspaceStatusProvisioning)
		}

		if len(ops.added) != 1 {
			t.Fatalf("expected 1 added operation, got %d", len(ops.added))
		}

		addedOp := ops.added[0]

		if addedOp.WorkspaceID != created.ID {
			t.Errorf("operation.WorkspaceID: got %q, want %q", addedOp.WorkspaceID, created.ID)
		}

		if addedOp.ResourceID != "ctr-1" {
			t.Errorf("operation.ResourceID: got %q, want %q", addedOp.ResourceID, "ctr-1")
		}

		if addedOp.Type != domain.OperationTypeProvision {
			t.Errorf("operation.Type: got %q, want %q", addedOp.Type, domain.OperationTypeProvision)
		}

		if addedOp.Status != domain.OperationStatusInProgress {
			t.Errorf("operation.Status: got %q, want %q", addedOp.Status, domain.OperationStatusInProgress)
		}
	})

	t.Run("missing name returns 400", func(t *testing.T) {
		ctr := &mockContainerService{}
		h := newHandler(ctr, &mockWorkspaceStore{}, &mockOperationStore{})

		r := newRequest(http.MethodPost, "/", "acc-1", strings.NewReader(`{}`))
		w := httptest.NewRecorder()
		h.CreateWorkspace(w, r)

		if w.Code != http.StatusBadRequest {
			t.Fatalf("status: got %d, want %d", w.Code, http.StatusBadRequest)
		}

		assertErrorCode(t, w, "INVALID_REQUEST_BODY")

		if ctr.createCalled {
			t.Error("CreateContainer should not be called when name is missing")
		}
	})

	t.Run("malformed JSON returns 400", func(t *testing.T) {
		ctr := &mockContainerService{}
		h := newHandler(ctr, &mockWorkspaceStore{}, &mockOperationStore{})

		r := newRequest(http.MethodPost, "/", "acc-1", strings.NewReader(`not-json`))
		w := httptest.NewRecorder()
		h.CreateWorkspace(w, r)

		if w.Code != http.StatusBadRequest {
			t.Fatalf("status: got %d, want %d", w.Code, http.StatusBadRequest)
		}

		assertErrorCode(t, w, "INVALID_REQUEST_BODY")

		if ctr.createCalled {
			t.Error("CreateContainer should not be called on malformed JSON")
		}
	})

	t.Run("container create failure returns 500", func(t *testing.T) {
		ctr := &mockContainerService{createErr: errors.New("docker error")}
		ws := &mockWorkspaceStore{}
		h := newHandler(ctr, ws, &mockOperationStore{})

		r := newRequest(http.MethodPost, "/", "acc-1", strings.NewReader(`{"name":"ws"}`))
		w := httptest.NewRecorder()
		h.CreateWorkspace(w, r)

		if w.Code != http.StatusInternalServerError {
			t.Fatalf("status: got %d, want %d", w.Code, http.StatusInternalServerError)
		}

		assertErrorCode(t, w, "CONTAINER_CREATE_FAILED")

		if len(ws.created) != 0 {
			t.Error("CreateWorkspace should not be called after container failure")
		}
	})

	t.Run("workspace store failure returns 500", func(t *testing.T) {
		ctr := &mockContainerService{createResult: "ctr-1"}
		ws := &mockWorkspaceStore{createErr: errors.New("store error")}
		ops := &mockOperationStore{}
		h := newHandler(ctr, ws, ops)

		r := newRequest(http.MethodPost, "/", "acc-1", strings.NewReader(`{"name":"ws"}`))
		w := httptest.NewRecorder()
		h.CreateWorkspace(w, r)

		if w.Code != http.StatusInternalServerError {
			t.Fatalf("status: got %d, want %d", w.Code, http.StatusInternalServerError)
		}

		assertErrorCode(t, w, "STORAGE_ERROR")

		if len(ops.added) != 0 {
			t.Error("AddOperation should not be called after workspace store failure")
		}
	})

	t.Run("operation store failure returns 500", func(t *testing.T) {
		ctr := &mockContainerService{createResult: "ctr-1"}
		ops := &mockOperationStore{addErr: errors.New("store error")}
		h := newHandler(ctr, &mockWorkspaceStore{}, ops)

		r := newRequest(http.MethodPost, "/", "acc-1", strings.NewReader(`{"name":"ws"}`))
		w := httptest.NewRecorder()
		h.CreateWorkspace(w, r)

		if w.Code != http.StatusInternalServerError {
			t.Fatalf("status: got %d, want %d", w.Code, http.StatusInternalServerError)
		}

		assertErrorCode(t, w, "STORAGE_ERROR")
	})

	t.Run("request ID propagated into error response", func(t *testing.T) {
		ctr := &mockContainerService{createErr: errors.New("docker error")}
		h := newHandler(ctr, &mockWorkspaceStore{}, &mockOperationStore{})

		r := newRequest(http.MethodPost, "/", "acc-1", strings.NewReader(`{"name":"ws"}`))
		r.Header.Set("X-Request-Id", "test-req-id")
		w := httptest.NewRecorder()
		h.CreateWorkspace(w, r)

		var resp models.ErrorResponse

		if err := json.NewDecoder(w.Body).Decode(&resp); err != nil {
			t.Fatalf("decode: %v", err)
		}

		if resp.Error.RequestID != "test-req-id" {
			t.Errorf("request_id: got %q, want %q", resp.Error.RequestID, "test-req-id")
		}
	})
}

func assertErrorCode(t *testing.T, w *httptest.ResponseRecorder, code string) {
	t.Helper()
	var resp models.ErrorResponse

	if err := json.NewDecoder(w.Body).Decode(&resp); err != nil {
		t.Fatalf("decode error response: %v", err)
	}

	if resp.Error.Code != code {
		t.Errorf("error code: got %q, want %q", resp.Error.Code, code)
	}
}
