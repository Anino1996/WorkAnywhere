package store

import (
	"fmt"
	"sync"
	"testing"
	"time"

	"github.com/workanywhere/controlplane/internal/domain"
)

func TestMemoryStore_Workspace(t *testing.T) {
	t.Run("create and get round-trips correctly", func(t *testing.T) {
		s := NewMemoryStore()
		ws := domain.Workspace{
			ID:        "ws-1",
			Name:      "my-workspace",
			AccountID: "acc-1",
			Status:    domain.WorkspaceStatusProvisioning,
			CreatedAt: time.Now().UTC(),
		}

		if err := s.CreateWorkspace(t.Context(), ws); err != nil {
			t.Fatalf("CreateWorkspace: %v", err)
		}

		got, err := s.GetWorkspace(t.Context(), "acc-1", "ws-1")

		if err != nil {
			t.Fatalf("GetWorkspace: %v", err)
		}

		if got.ID != ws.ID || got.Name != ws.Name || got.AccountID != ws.AccountID || got.Status != ws.Status {
			t.Errorf("got %+v, want %+v", got, ws)
		}
	})

	t.Run("get with wrong accountID returns error", func(t *testing.T) {
		s := NewMemoryStore()
		_ = s.CreateWorkspace(t.Context(), domain.Workspace{ID: "ws-1", AccountID: "acc-1"})
		_, err := s.GetWorkspace(t.Context(), "acc-other", "ws-1")

		if err == nil {
			t.Fatal("expected error for wrong accountID, got nil")
		}
	})

	t.Run("get unknown workspaceID returns error", func(t *testing.T) {
		s := NewMemoryStore()
		_, err := s.GetWorkspace(t.Context(), "acc-1", "ws-unknown")

		if err == nil {
			t.Fatal("expected error for unknown workspace, got nil")
		}
	})

	t.Run("update status reflects in subsequent get", func(t *testing.T) {
		s := NewMemoryStore()
		_ = s.CreateWorkspace(t.Context(), domain.Workspace{ID: "ws-1", AccountID: "acc-1", Status: domain.WorkspaceStatusProvisioning})
		ws, _ := s.GetWorkspace(t.Context(), "acc-1", "ws-1")

		if err := s.UpdateWorkspaceStatus(t.Context(), ws, domain.WorkspaceStatusActive); err != nil {
			t.Fatalf("UpdateWorkspaceStatus: %v", err)
		}

		got, _ := s.GetWorkspace(t.Context(), "acc-1", "ws-1")

		if got.Status != domain.WorkspaceStatusActive {
			t.Errorf("status: got %q, want %q", got.Status, domain.WorkspaceStatusActive)
		}
	})

	t.Run("update status with wrong accountID returns error", func(t *testing.T) {
		s := NewMemoryStore()
		_ = s.CreateWorkspace(t.Context(), domain.Workspace{ID: "ws-1", AccountID: "acc-1"})
		ws, _ := s.GetWorkspace(t.Context(), "acc-1", "ws-1")
		ws.AccountID = "acc-other"
		err := s.UpdateWorkspaceStatus(t.Context(), ws, domain.WorkspaceStatusActive)

		if err == nil {
			t.Fatal("expected error for wrong accountID, got nil")
		}
	})

	t.Run("update status for unknown workspace returns error", func(t *testing.T) {
		s := NewMemoryStore()
		err := s.UpdateWorkspaceStatus(t.Context(), domain.Workspace{ID: "ws-unknown", AccountID: "acc-1"}, domain.WorkspaceStatusActive)

		if err == nil {
			t.Fatal("expected error for unknown workspace, got nil")
		}
	})

	t.Run("concurrent creates do not race", func(t *testing.T) {
		s := NewMemoryStore()
		var wg sync.WaitGroup

		for i := range 50 {
			wg.Add(1)
			go func(n int) {
				defer wg.Done()
				_ = s.CreateWorkspace(t.Context(), domain.Workspace{
					ID:        fmt.Sprintf("ws-%d", n),
					AccountID: "acc-1",
				})
			}(i)
		}

		wg.Wait()
	})
}

func TestMemoryStore_Operation(t *testing.T) {
	t.Run("add and get round-trips correctly", func(t *testing.T) {
		s := NewMemoryStore()
		op := domain.Operation{
			ID:        "op-1",
			AccountID: "acc-1",
			Status:    domain.OperationStatusInProgress,
		}

		if err := s.AddOperation(t.Context(), op); err != nil {
			t.Fatalf("AddOperation: %v", err)
		}

		got, err := s.GetOperation(t.Context(), "acc-1", "op-1")

		if err != nil {
			t.Fatalf("GetOperation: %v", err)
		}

		if got.ID != op.ID || got.AccountID != op.AccountID || got.Status != op.Status {
			t.Errorf("got %+v, want %+v", got, op)
		}
	})

	t.Run("get with wrong accountID returns error", func(t *testing.T) {
		s := NewMemoryStore()
		_ = s.AddOperation(t.Context(), domain.Operation{ID: "op-1", AccountID: "acc-1"})
		_, err := s.GetOperation(t.Context(), "acc-other", "op-1")

		if err == nil {
			t.Fatal("expected error for wrong accountID, got nil")
		}
	})

	t.Run("get unknown operationID returns error", func(t *testing.T) {
		s := NewMemoryStore()
		_, err := s.GetOperation(t.Context(), "acc-1", "op-unknown")

		if err == nil {
			t.Fatal("expected error for unknown operation, got nil")
		}
	})

	t.Run("update operation mutates stored record", func(t *testing.T) {
		s := NewMemoryStore()
		op := domain.Operation{ID: "op-1", AccountID: "acc-1", Status: domain.OperationStatusInProgress}
		_ = s.AddOperation(t.Context(), op)
		op.Status = domain.OperationStatusCompleted

		if err := s.UpdateOperation(t.Context(), "acc-1", op); err != nil {
			t.Fatalf("UpdateOperation: %v", err)
		}

		got, _ := s.GetOperation(t.Context(), "acc-1", "op-1")

		if got.Status != domain.OperationStatusCompleted {
			t.Errorf("status: got %q, want %q", got.Status, domain.OperationStatusCompleted)
		}
	})

	t.Run("update with wrong accountID returns error", func(t *testing.T) {
		s := NewMemoryStore()
		_ = s.AddOperation(t.Context(), domain.Operation{ID: "op-1", AccountID: "acc-1"})
		err := s.UpdateOperation(t.Context(), "acc-other", domain.Operation{ID: "op-1", AccountID: "acc-1"})

		if err == nil {
			t.Fatal("expected error for wrong accountID, got nil")
		}
	})

	t.Run("update unknown operation returns error", func(t *testing.T) {
		s := NewMemoryStore()
		err := s.UpdateOperation(t.Context(), "acc-1", domain.Operation{ID: "op-unknown", AccountID: "acc-1"})

		if err == nil {
			t.Fatal("expected error for unknown operation, got nil")
		}
	})

	t.Run("concurrent add and update do not race", func(t *testing.T) {
		s := NewMemoryStore()
		_ = s.AddOperation(t.Context(), domain.Operation{ID: "op-1", AccountID: "acc-1", Status: domain.OperationStatusInProgress})
		var wg sync.WaitGroup

		for range 50 {
			wg.Add(1)
			go func() {
				defer wg.Done()
				_ = s.UpdateOperation(t.Context(), "acc-1", domain.Operation{
					ID:        "op-1",
					AccountID: "acc-1",
					Status:    domain.OperationStatusCompleted,
				})
			}()
		}

		wg.Wait()
	})
}
