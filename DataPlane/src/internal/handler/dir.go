package handler

import (
	"encoding/json"
	"errors"
	"net/http"
	"os"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/workanywhere/dataplane/internal/pathutil"
)

type DirHandler struct {
	root string
}

func NewDir(root string) *DirHandler {
	return &DirHandler{root: root}
}

type dirEntry struct {
	Name       string    `json:"name"`
	Type       string    `json:"type"`
	Size       int64     `json:"size"`
	ModifiedAt time.Time `json:"modified_at"`
}

type dirResponse struct {
	Path    string     `json:"path"`
	Entries []dirEntry `json:"entries"`
}

func (h *DirHandler) List(w http.ResponseWriter, r *http.Request) {
	relativePath := chi.URLParam(r, "*")
	absolutePath, err := pathutil.SafeJoin(h.root, relativePath)
	if err != nil {
		writeError(w, r, http.StatusForbidden, "PATH_TRAVERSAL", "path traversal detected")
		return
	}

	entries, err := os.ReadDir(absolutePath)
	if err != nil {
		if errors.Is(err, os.ErrNotExist) {
			writeError(w, r, http.StatusNotFound, "DIR_NOT_FOUND", "directory not found")
			return
		}
		writeError(w, r, http.StatusInternalServerError, "READ_ERROR", "failed to read directory")
		return
	}

	items := make([]dirEntry, 0, len(entries))
	for _, e := range entries {
		info, err := e.Info()
		if err != nil {
			continue
		}
		entry := dirEntry{
			Name:       e.Name(),
			ModifiedAt: info.ModTime().UTC(),
		}
		if e.IsDir() {
			entry.Type = "dir"
		} else {
			entry.Type = "file"
			entry.Size = info.Size()
		}
		items = append(items, entry)
	}

	resp := dirResponse{
		Path:    "/" + relativePath,
		Entries: items,
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(resp)
}
