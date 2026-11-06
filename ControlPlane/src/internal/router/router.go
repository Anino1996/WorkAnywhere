package router

import (
	"net/http"

	"github.com/go-chi/chi/v5"
	chimiddleware "github.com/go-chi/chi/v5/middleware"

	"github.com/workanywhere/controlplane/internal/handlers"
	"github.com/workanywhere/controlplane/internal/middleware"
)

func New(wh *handlers.WorkspaceHandler, oh *handlers.OperationHandler) http.Handler {
	r := chi.NewRouter()
	r.Use(chimiddleware.RequestID)
	r.Use(chimiddleware.Logger)
	r.Use(chimiddleware.Recoverer)

	r.Route("/api/v1", func(r chi.Router) {
		r.Use(middleware.BearerAuth)

		r.Post("/workspaces", wh.CreateWorkspace)

		r.Get("/operations/{operation_id}", oh.GetOperation)
	})

	return r
}
