package handlers

import (
	"context"
	"io"
	"net/http"
	"net/http/httptest"
	"sync"

	"github.com/workanywhere/controlplane/internal/container"
	"github.com/workanywhere/controlplane/internal/domain"
	"github.com/workanywhere/controlplane/internal/httputil"
)

type mockContainerService struct {
	createResult  string
	createErr     error
	createCalled  bool
	inspectResult container.ContainerState
	inspectErr    error
	inspectCalled bool
}

func (m *mockContainerService) CreateContainer(_ context.Context, _ string) (string, error) {
	m.createCalled = true
	return m.createResult, m.createErr
}

func (m *mockContainerService) InspectContainer(_ context.Context, _ string) (container.ContainerState, error) {
	m.inspectCalled = true
	return m.inspectResult, m.inspectErr
}

type mockWorkspaceStore struct {
	mu            sync.Mutex
	created       []domain.Workspace
	createErr     error
	getResult     domain.Workspace
	getErr        error
	updatedStatus domain.WorkspaceStatus
	updateErr     error
	updateWg      *sync.WaitGroup
}

func (m *mockWorkspaceStore) CreateWorkspace(_ context.Context, ws domain.Workspace) error {
	m.mu.Lock()
	m.created = append(m.created, ws)
	m.mu.Unlock()
	return m.createErr
}

func (m *mockWorkspaceStore) GetWorkspace(_ context.Context, _ string, _ string) (domain.Workspace, error) {
	return m.getResult, m.getErr
}

func (m *mockWorkspaceStore) UpdateWorkspaceStatus(_ context.Context, ws domain.Workspace, status domain.WorkspaceStatus) error {
	m.mu.Lock()
	m.updatedStatus = status
	m.mu.Unlock()

	if m.updateWg != nil {
		m.updateWg.Done()
	}

	return m.updateErr
}

type mockOperationStore struct {
	mu        sync.Mutex
	added     []domain.Operation
	updated   []domain.Operation
	addErr    error
	getResult domain.Operation
	getErr    error
	updateErr error
	updateWg  *sync.WaitGroup
}

func (m *mockOperationStore) AddOperation(_ context.Context, op domain.Operation) error {
	m.mu.Lock()
	m.added = append(m.added, op)
	m.mu.Unlock()
	return m.addErr
}

func (m *mockOperationStore) GetOperation(_ context.Context, _ string, _ string) (domain.Operation, error) {
	return m.getResult, m.getErr
}

func (m *mockOperationStore) UpdateOperation(_ context.Context, _ string, op domain.Operation) error {
	m.mu.Lock()
	m.updated = append(m.updated, op)
	m.mu.Unlock()

	if m.updateWg != nil {
		m.updateWg.Done()
	}

	return m.updateErr
}

func newRequest(method, target, accountID string, body io.Reader) *http.Request {
	r := httptest.NewRequest(method, target, body)
	return r.WithContext(httputil.WithAccountID(r.Context(), accountID))
}
