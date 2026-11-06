package middleware

import (
	"net/http"
	"strings"

	"github.com/workanywhere/controlplane/internal/httputil"
	"github.com/workanywhere/controlplane/internal/models"
)

func BearerAuth(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		header := r.Header.Get("Authorization")
		headerParts := strings.SplitN(header, " ", 2)
		if len(headerParts) != 2 || !strings.EqualFold(headerParts[0], "Bearer") || headerParts[1] == "" {
			models.WriteError(w, http.StatusUnauthorized, "UNAUTHORIZED", "valid Bearer token required", httputil.ReqID(r))
			return
		}
		ctx := httputil.WithAccountID(r.Context(), headerParts[1])
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}
