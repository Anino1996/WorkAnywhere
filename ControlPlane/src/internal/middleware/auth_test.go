package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/workanywhere/controlplane/internal/httputil"
)

func TestBearerAuth(t *testing.T) {
	cases := []struct {
		name           string
		header         string
		wantStatus     int
		wantNextCalled bool
	}{
		{"valid token", "Bearer abc123", http.StatusOK, true},
		{"missing header", "", http.StatusUnauthorized, false},
		{"wrong scheme", "Basic abc123", http.StatusUnauthorized, false},
		{"scheme only no token", "Bearer ", http.StatusUnauthorized, false},
		{"no space malformed", "Bearertoken", http.StatusUnauthorized, false},
		{"case insensitive scheme", "bearer abc123", http.StatusOK, true},
		{"token with spaces", "Bearer tok en", http.StatusOK, true},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			nextCalled := false
			next := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				nextCalled = true
				w.WriteHeader(http.StatusOK)
			})

			r := httptest.NewRequest(http.MethodGet, "/", nil)

			if tc.header != "" {
				r.Header.Set("Authorization", tc.header)
			}

			w := httptest.NewRecorder()

			BearerAuth(next).ServeHTTP(w, r)

			if w.Code != tc.wantStatus {
				t.Errorf("status: got %d, want %d", w.Code, tc.wantStatus)
			}

			if nextCalled != tc.wantNextCalled {
				t.Errorf("nextCalled: got %v, want %v", nextCalled, tc.wantNextCalled)
			}
		})
	}

	t.Run("token propagated into context", func(t *testing.T) {
		var gotAccountID string
		next := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			gotAccountID = httputil.AccountID(r)
			w.WriteHeader(http.StatusOK)
		})

		r := httptest.NewRequest(http.MethodGet, "/", nil)
		r.Header.Set("Authorization", "Bearer my-token")
		w := httptest.NewRecorder()

		BearerAuth(next).ServeHTTP(w, r)

		if gotAccountID != "my-token" {
			t.Errorf("accountID: got %q, want %q", gotAccountID, "my-token")
		}
	})
}
