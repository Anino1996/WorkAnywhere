package router

import (
	"net/http"

	"github.com/go-chi/chi/v5"
	chimiddleware "github.com/go-chi/chi/v5/middleware"
	"github.com/workanywhere/dataplane/internal/handler"
	"github.com/workanywhere/dataplane/internal/middleware"
)

func New(root string, token string) http.Handler {
	r := chi.NewRouter()
	r.Use(chimiddleware.RequestID)
	r.Use(chimiddleware.Logger)
	r.Use(chimiddleware.Recoverer)

	hh := handler.NewHealth()
	r.Get("/healthz", hh.Liveness)

	fh := handler.NewFS(root)
	dh := handler.NewDir(root)

	r.Group(func(r chi.Router) {
		r.Use(middleware.BearerAuth(token))
		r.Get("/readyz", hh.Readiness)
		r.Get("/v1/fs/*", fh.Get)
		r.Put("/v1/fs/*", fh.Put)
		r.Delete("/v1/fs/*", fh.Delete)
		r.Get("/v1/dirs/*", dh.List)
	})

	return r
}
