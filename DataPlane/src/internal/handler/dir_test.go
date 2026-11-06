package handler

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"
)

func TestDirHandler_List(t *testing.T) {
	t.Run("returns entries for existing directory", func(t *testing.T) {
		root := t.TempDir()

		if err := os.WriteFile(filepath.Join(root, "file.txt"), []byte("hello"), 0o644); err != nil {
			t.Fatal(err)
		}

		if err := os.Mkdir(filepath.Join(root, "subdir"), 0o755); err != nil {
			t.Fatal(err)
		}

		h := NewDir(root)
		r := withWildcard(httptest.NewRequest(http.MethodGet, "/", nil), "")
		w := httptest.NewRecorder()
		h.List(w, r)

		if w.Code != http.StatusOK {
			t.Fatalf("status: got %d, want %d", w.Code, http.StatusOK)
		}

		var resp dirResponse

		if err := json.NewDecoder(w.Body).Decode(&resp); err != nil {
			t.Fatalf("decode: %v", err)
		}

		if len(resp.Entries) != 2 {
			t.Fatalf("entries: got %d, want 2", len(resp.Entries))
		}

		byName := make(map[string]dirEntry, len(resp.Entries))

		for _, e := range resp.Entries {
			byName[e.Name] = e
		}

		file, ok := byName["file.txt"]

		if !ok {
			t.Fatal("file.txt not in response")
		}

		if file.Type != "file" {
			t.Errorf("file.txt type: got %q, want %q", file.Type, "file")
		}

		if file.Size != 5 {
			t.Errorf("file.txt size: got %d, want 5", file.Size)
		}

		dir, ok := byName["subdir"]

		if !ok {
			t.Fatal("subdir not in response")
		}

		if dir.Type != "dir" {
			t.Errorf("subdir type: got %q, want %q", dir.Type, "dir")
		}
	})

	t.Run("empty directory returns empty entries", func(t *testing.T) {
		h := NewDir(t.TempDir())
		r := withWildcard(httptest.NewRequest(http.MethodGet, "/", nil), "")
		w := httptest.NewRecorder()
		h.List(w, r)

		if w.Code != http.StatusOK {
			t.Fatalf("status: got %d, want %d", w.Code, http.StatusOK)
		}

		var resp dirResponse

		if err := json.NewDecoder(w.Body).Decode(&resp); err != nil {
			t.Fatalf("decode: %v", err)
		}

		if len(resp.Entries) != 0 {
			t.Errorf("entries: got %d, want 0", len(resp.Entries))
		}
	})

	t.Run("missing directory returns 404", func(t *testing.T) {
		h := NewDir(t.TempDir())
		r := withWildcard(httptest.NewRequest(http.MethodGet, "/", nil), "nonexistent")
		w := httptest.NewRecorder()
		h.List(w, r)

		if w.Code != http.StatusNotFound {
			t.Fatalf("status: got %d, want %d", w.Code, http.StatusNotFound)
		}

		assertErrorCode(t, w, "DIR_NOT_FOUND")
	})

	t.Run("path traversal returns 403", func(t *testing.T) {
		h := NewDir(t.TempDir())
		r := withWildcard(httptest.NewRequest(http.MethodGet, "/", nil), "../outside")
		w := httptest.NewRecorder()
		h.List(w, r)

		if w.Code != http.StatusForbidden {
			t.Fatalf("status: got %d, want %d", w.Code, http.StatusForbidden)
		}

		assertErrorCode(t, w, "PATH_TRAVERSAL")
	})

	t.Run("subdirectory is listable", func(t *testing.T) {
		root := t.TempDir()

		if err := os.MkdirAll(filepath.Join(root, "src/internal"), 0o755); err != nil {
			t.Fatal(err)
		}

		if err := os.WriteFile(filepath.Join(root, "src/main.go"), []byte("package main"), 0o644); err != nil {
			t.Fatal(err)
		}

		h := NewDir(root)
		r := withWildcard(httptest.NewRequest(http.MethodGet, "/", nil), "src")
		w := httptest.NewRecorder()
		h.List(w, r)

		if w.Code != http.StatusOK {
			t.Fatalf("status: got %d, want %d", w.Code, http.StatusOK)
		}

		var resp dirResponse

		if err := json.NewDecoder(w.Body).Decode(&resp); err != nil {
			t.Fatalf("decode: %v", err)
		}

		if len(resp.Entries) != 2 {
			t.Fatalf("entries: got %d, want 2", len(resp.Entries))
		}

		if resp.Path != "/src" {
			t.Errorf("path: got %q, want %q", resp.Path, "/src")
		}
	})
}
