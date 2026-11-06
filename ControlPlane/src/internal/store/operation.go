package store

import (
	"context"

	"github.com/workanywhere/controlplane/internal/domain"
)

type OperationStore interface {
	AddOperation(ctx context.Context, op domain.Operation) error
	GetOperation(ctx context.Context, accountID string, operationID string) (domain.Operation, error)
	UpdateOperation(ctx context.Context, accountID string, op domain.Operation) error
}
