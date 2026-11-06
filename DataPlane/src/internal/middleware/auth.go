package middleware

import (
	"net/http"
	"strings"
)

func BearerAuth(token string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			auth := r.Header.Get("Authorization")
			scheme, tok, ok := strings.Cut(auth, " ")
			if !ok || !strings.EqualFold(scheme, "bearer") || strings.TrimSpace(tok) == "" {
				http.Error(w, "unauthorized", http.StatusUnauthorized)
				return
			}
			if tok != token {
				http.Error(w, "forbidden", http.StatusForbidden)
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}
