package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestBearerAuth(t *testing.T) {
	const token = "secret-token"

	cases := []struct {
		name       string
		header     string
		wantStatus int
		wantCalled bool
	}{
		{"valid token", "Bearer secret-token", http.StatusOK, true},
		{"missing header", "", http.StatusUnauthorized, false},
		{"wrong scheme", "Basic secret-token", http.StatusUnauthorized, false},
		{"scheme only no token", "Bearer ", http.StatusUnauthorized, false},
		{"no space malformed", "Bearersecret-token", http.StatusUnauthorized, false},
		{"case insensitive scheme", "bearer secret-token", http.StatusOK, true},
		{"wrong token", "Bearer wrong-token", http.StatusForbidden, false},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			called := false
			next := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				called = true
				w.WriteHeader(http.StatusOK)
			})

			r := httptest.NewRequest(http.MethodGet, "/", nil)
			if tc.header != "" {
				r.Header.Set("Authorization", tc.header)
			}
			w := httptest.NewRecorder()

			BearerAuth(token)(next).ServeHTTP(w, r)

			if w.Code != tc.wantStatus {
				t.Errorf("status: got %d, want %d", w.Code, tc.wantStatus)
			}
			if called != tc.wantCalled {
				t.Errorf("next called: got %v, want %v", called, tc.wantCalled)
			}
		})
	}
}
