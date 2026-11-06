package httputil

import (
	"context"
	"net/http"
)

type contextKey string

const contextKeyAccountID contextKey = "account_id"

func ReqID(r *http.Request) string {
	if id := r.Header.Get("X-Request-Id"); id != "" {
		return id
	}
	return "unknown"
}

func WithAccountID(ctx context.Context, accountID string) context.Context {
	return context.WithValue(ctx, contextKeyAccountID, accountID)
}

func AccountID(r *http.Request) string {
	if id, ok := r.Context().Value(contextKeyAccountID).(string); ok {
		return id
	}
	return ""
}
