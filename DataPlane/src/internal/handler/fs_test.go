package handler

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/go-chi/chi/v5"
)

func withWildcard(r *http.Request, path string) *http.Request {
	rctx := chi.NewRouteContext()
	rctx.URLParams.Add("*", path)
	return r.WithContext(context.WithValue(r.Context(), chi.RouteCtxKey, rctx))
}

func TestFSHandler_Get(t *testing.T) {
	t.Run("existing file returns 200 with body", func(t *testing.T) {
		root := t.TempDir()
		content := []byte("hello world")
		if err := os.WriteFile(filepath.Join(root, "file.txt"), content, 0o644); err != nil {
			t.Fatal(err)
		}

		h := NewFS(root)
		r := withWildcard(httptest.NewRequest(http.MethodGet, "/", nil), "file.txt")
		w := httptest.NewRecorder()
		h.Get(w, r)

		if w.Code != http.StatusOK {
			t.Fatalf("status: got %d, want %d", w.Code, http.StatusOK)
		}
		if w.Body.String() != string(content) {
			t.Errorf("body: got %q, want %q", w.Body.String(), string(content))
		}
		if ct := w.Header().Get("Content-Type"); ct != "application/octet-stream" {
			t.Errorf("content-type: got %q, want %q", ct, "application/octet-stream")
		}
	})

	t.Run("missing file returns 404", func(t *testing.T) {
		h := NewFS(t.TempDir())
		r := withWildcard(httptest.NewRequest(http.MethodGet, "/", nil), "missing.txt")
		w := httptest.NewRecorder()
		h.Get(w, r)

		if w.Code != http.StatusNotFound {
			t.Fatalf("status: got %d, want %d", w.Code, http.StatusNotFound)
		}
		assertErrorCode(t, w, "FILE_NOT_FOUND")
	})

	t.Run("path traversal returns 403", func(t *testing.T) {
		h := NewFS(t.TempDir())
		r := withWildcard(httptest.NewRequest(http.MethodGet, "/", nil), "../outside.txt")
		w := httptest.NewRecorder()
		h.Get(w, r)

		if w.Code != http.StatusForbidden {
			t.Fatalf("status: got %d, want %d", w.Code, http.StatusForbidden)
		}
		assertErrorCode(t, w, "PATH_TRAVERSAL")
	})
}

func TestFSHandler_Put(t *testing.T) {
	t.Run("new file returns 201", func(t *testing.T) {
		root := t.TempDir()
		h := NewFS(root)
		r := withWildcard(httptest.NewRequest(http.MethodPut, "/", strings.NewReader("content")), "new.txt")
		w := httptest.NewRecorder()
		h.Put(w, r)

		if w.Code != http.StatusCreated {
			t.Fatalf("status: got %d, want %d", w.Code, http.StatusCreated)
		}
		got, err := os.ReadFile(filepath.Join(root, "new.txt"))
		if err != nil {
			t.Fatalf("reading written file: %v", err)
		}
		if string(got) != "content" {
			t.Errorf("file content: got %q, want %q", string(got), "content")
		}
	})

	t.Run("overwrite existing file returns 200", func(t *testing.T) {
		root := t.TempDir()
		if err := os.WriteFile(filepath.Join(root, "existing.txt"), []byte("old"), 0o644); err != nil {
			t.Fatal(err)
		}

		h := NewFS(root)
		r := withWildcard(httptest.NewRequest(http.MethodPut, "/", strings.NewReader("new content")), "existing.txt")
		w := httptest.NewRecorder()
		h.Put(w, r)

		if w.Code != http.StatusOK {
			t.Fatalf("status: got %d, want %d", w.Code, http.StatusOK)
		}
		got, _ := os.ReadFile(filepath.Join(root, "existing.txt"))
		if string(got) != "new content" {
			t.Errorf("file content: got %q, want %q", string(got), "new content")
		}
	})

	t.Run("creates intermediate directories", func(t *testing.T) {
		root := t.TempDir()
		h := NewFS(root)
		r := withWildcard(httptest.NewRequest(http.MethodPut, "/", strings.NewReader("deep")), "a/b/c/file.txt")
		w := httptest.NewRecorder()
		h.Put(w, r)

		if w.Code != http.StatusCreated {
			t.Fatalf("status: got %d, want %d", w.Code, http.StatusCreated)
		}
		got, err := os.ReadFile(filepath.Join(root, "a/b/c/file.txt"))
		if err != nil {
			t.Fatalf("reading written file: %v", err)
		}
		if string(got) != "deep" {
			t.Errorf("file content: got %q, want %q", string(got), "deep")
		}
	})

	t.Run("path traversal returns 403", func(t *testing.T) {
		h := NewFS(t.TempDir())
		r := withWildcard(httptest.NewRequest(http.MethodPut, "/", strings.NewReader("x")), "../outside.txt")
		w := httptest.NewRecorder()
		h.Put(w, r)

		if w.Code != http.StatusForbidden {
			t.Fatalf("status: got %d, want %d", w.Code, http.StatusForbidden)
		}
		assertErrorCode(t, w, "PATH_TRAVERSAL")
	})

	t.Run("if-match mismatch returns 412", func(t *testing.T) {
		root := t.TempDir()
		if err := os.WriteFile(filepath.Join(root, "file.txt"), []byte("content"), 0o644); err != nil {
			t.Fatal(err)
		}

		h := NewFS(root)
		req := withWildcard(httptest.NewRequest(http.MethodPut, "/", strings.NewReader("new")), "file.txt")
		req.Header.Set("If-Match", `"definitely-wrong-etag"`)
		w := httptest.NewRecorder()
		h.Put(w, req)

		if w.Code != http.StatusPreconditionFailed {
			t.Fatalf("status: got %d, want %d", w.Code, http.StatusPreconditionFailed)
		}
		assertErrorCode(t, w, "PRECONDITION_FAILED")
	})
}

func TestFSHandler_Delete(t *testing.T) {
	t.Run("existing file returns 204", func(t *testing.T) {
		root := t.TempDir()
		target := filepath.Join(root, "file.txt")
		if err := os.WriteFile(target, []byte("x"), 0o644); err != nil {
			t.Fatal(err)
		}

		h := NewFS(root)
		r := withWildcard(httptest.NewRequest(http.MethodDelete, "/", nil), "file.txt")
		w := httptest.NewRecorder()
		h.Delete(w, r)

		if w.Code != http.StatusNoContent {
			t.Fatalf("status: got %d, want %d", w.Code, http.StatusNoContent)
		}
		if _, err := os.Stat(target); !os.IsNotExist(err) {
			t.Error("file should have been deleted")
		}
	})

	t.Run("missing file returns 404", func(t *testing.T) {
		h := NewFS(t.TempDir())
		r := withWildcard(httptest.NewRequest(http.MethodDelete, "/", nil), "missing.txt")
		w := httptest.NewRecorder()
		h.Delete(w, r)

		if w.Code != http.StatusNotFound {
			t.Fatalf("status: got %d, want %d", w.Code, http.StatusNotFound)
		}
		assertErrorCode(t, w, "FILE_NOT_FOUND")
	})

	t.Run("path traversal returns 403", func(t *testing.T) {
		h := NewFS(t.TempDir())
		r := withWildcard(httptest.NewRequest(http.MethodDelete, "/", nil), "../outside.txt")
		w := httptest.NewRecorder()
		h.Delete(w, r)

		if w.Code != http.StatusForbidden {
			t.Fatalf("status: got %d, want %d", w.Code, http.StatusForbidden)
		}
		assertErrorCode(t, w, "PATH_TRAVERSAL")
	})
}

func assertErrorCode(t *testing.T, w *httptest.ResponseRecorder, code string) {
	t.Helper()
	var body errorBody
	if err := json.NewDecoder(w.Body).Decode(&body); err != nil {
		t.Fatalf("decode error response: %v", err)
	}
	if body.Error.Code != code {
		t.Errorf("error code: got %q, want %q", body.Error.Code, code)
	}
}
