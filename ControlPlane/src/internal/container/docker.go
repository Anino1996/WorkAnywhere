package container

import (
	"context"
	"fmt"

	mobycontainer "github.com/moby/moby/api/types/container"
	mobyclient "github.com/moby/moby/client"
)

const defaultImage = "ubuntu:24.04"

type DockerContainerService struct {
	client *mobyclient.Client
}

func NewDockerContainerService() (*DockerContainerService, error) {
	c, err := mobyclient.New(mobyclient.FromEnv)
	if err != nil {
		return nil, fmt.Errorf("creating docker client: %w", err)
	}
	return &DockerContainerService{client: c}, nil
}

func (s *DockerContainerService) Close() error {
	return s.client.Close()
}

func (s *DockerContainerService) CreateContainer(ctx context.Context, name string) (string, error) {
	resp, err := s.client.ContainerCreate(ctx, mobyclient.ContainerCreateOptions{
		Name:   name,
		Config: &mobycontainer.Config{Image: defaultImage},
	})
	if err != nil {
		return "", fmt.Errorf("creating container %q: %w", name, err)
	}

	if _, err := s.client.ContainerStart(ctx, resp.ID, mobyclient.ContainerStartOptions{}); err != nil {
		return "", fmt.Errorf("starting container %q: %w", resp.ID, err)
	}

	return resp.ID, nil
}

func (s *DockerContainerService) InspectContainer(ctx context.Context, resourceID string) (ContainerState, error) {
	result, err := s.client.ContainerInspect(ctx, resourceID, mobyclient.ContainerInspectOptions{})
	if err != nil {
		return ContainerState{}, fmt.Errorf("inspecting container %q: %w", resourceID, err)
	}
	return ContainerState{
		Running:  result.Container.State.Running,
		ExitCode: result.Container.State.ExitCode,
	}, nil
}
