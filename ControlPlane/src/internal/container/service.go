package container

import "context"

type ContainerState struct {
	Running  bool
	ExitCode int
}

type ContainerService interface {
	CreateContainer(ctx context.Context, name string) (resourceID string, err error)
	InspectContainer(ctx context.Context, resourceID string) (ContainerState, error)
}
