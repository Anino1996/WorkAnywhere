package main

import (
	"fmt"
	"log"
	"net/http"
	"os"

	"github.com/workanywhere/controlplane/internal/container"
	"github.com/workanywhere/controlplane/internal/handlers"
	"github.com/workanywhere/controlplane/internal/router"
	"github.com/workanywhere/controlplane/internal/store"
)

func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	dockerSvc, err := container.NewDockerContainerService()
	if err != nil {
		log.Fatalf("failed to initialise docker client: %v", err)
	}
	defer dockerSvc.Close()

	var ws store.WorkspaceStore
	var ops store.OperationStore

	if postgresURL := os.Getenv("DATABASE_URL"); postgresURL != "" {
		pg, err := store.NewPostgresStore(postgresURL)
		if err != nil {
			log.Fatalf("failed to initialise postgres store: %v", err)
		}
		defer pg.Close()
		ws = pg
		ops = pg
	} else {
		mem := store.NewMemoryStore()
		ws = mem
		ops = mem
	}

	wh := &handlers.WorkspaceHandler{
		Workspaces: ws,
		Operations: ops,
		Container:  dockerSvc,
	}

	oh := &handlers.OperationHandler{
		Operations: ops,
		Workspaces: ws,
		Container:  dockerSvc,
	}

	addr := fmt.Sprintf(":%s", port)
	log.Printf("control plane listening on %s", addr)
	if err := http.ListenAndServe(addr, router.New(wh, oh)); err != nil {
		log.Fatalf("server error: %v", err)
	}
}
