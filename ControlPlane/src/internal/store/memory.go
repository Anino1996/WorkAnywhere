package store

import (
	"context"
	"fmt"
	"sync"

	"github.com/google/uuid"
	"github.com/workanywhere/controlplane/internal/domain"
)

type MemoryStore struct {
	mu         sync.RWMutex
	workspaces map[string]domain.Workspace
	operations map[string]domain.Operation
}

func NewMemoryStore() *MemoryStore {
	return &MemoryStore{
		workspaces: make(map[string]domain.Workspace),
		operations: make(map[string]domain.Operation),
	}
}

func (s *MemoryStore) CreateWorkspace(ctx context.Context, ws domain.Workspace) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	ws.ETag = uuid.NewString()
	s.workspaces[ws.ID] = ws
	return nil
}

func (s *MemoryStore) GetWorkspace(ctx context.Context, accountID string, workspaceID string) (domain.Workspace, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	ws, ok := s.workspaces[workspaceID]
	if !ok || ws.AccountID != accountID {
		return domain.Workspace{}, fmt.Errorf("workspace not found: %s", workspaceID)
	}
	return ws, nil
}

func (s *MemoryStore) UpdateWorkspaceStatus(ctx context.Context, ws domain.Workspace, status domain.WorkspaceStatus) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	existing, ok := s.workspaces[ws.ID]
	if !ok || existing.AccountID != ws.AccountID {
		return fmt.Errorf("workspace not found: %s", ws.ID)
	}
	if existing.ETag != ws.ETag {
		return fmt.Errorf("etag mismatch for workspace: %s", ws.ID)
	}
	existing.Status = status
	existing.ETag = uuid.NewString()
	s.workspaces[ws.ID] = existing
	return nil
}

func (s *MemoryStore) AddOperation(ctx context.Context, op domain.Operation) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.operations[op.ID] = op
	return nil
}

func (s *MemoryStore) GetOperation(ctx context.Context, accountID string, operationID string) (domain.Operation, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	op, ok := s.operations[operationID]
	if !ok || op.AccountID != accountID {
		return domain.Operation{}, fmt.Errorf("operation not found: %s", operationID)
	}
	return op, nil
}

func (s *MemoryStore) UpdateOperation(ctx context.Context, accountID string, op domain.Operation) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	existing, ok := s.operations[op.ID]
	if !ok || existing.AccountID != accountID {
		return fmt.Errorf("operation not found: %s", op.ID)
	}
	s.operations[op.ID] = op
	return nil
}
