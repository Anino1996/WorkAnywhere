package handler

import (
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"

	"github.com/cespare/xxhash/v2"
	"github.com/go-chi/chi/v5"
	chimiddleware "github.com/go-chi/chi/v5/middleware"
	"github.com/workanywhere/dataplane/internal/pathutil"
	"github.com/workanywhere/dataplane/internal/xattr"
)

const etagAttr = "user.etag"

type FSHandler struct {
	root string
}

func NewFS(root string) *FSHandler {
	return &FSHandler{root: root}
}

func (h *FSHandler) Get(w http.ResponseWriter, r *http.Request) {
	absolutePath, err := h.resolve(r)
	if err != nil {
		writeError(w, r, http.StatusForbidden, "PATH_TRAVERSAL", "path traversal detected")
		return
	}

	if etag, err := xattr.Get(absolutePath, etagAttr); err == nil {
		w.Header().Set("ETag", etag)
	}

	f, err := os.Open(absolutePath)
	if err != nil {
		if errors.Is(err, os.ErrNotExist) {
			writeError(w, r, http.StatusNotFound, "FILE_NOT_FOUND", "file not found")
			return
		}
		writeError(w, r, http.StatusInternalServerError, "READ_ERROR", "failed to read file")
		return
	}
	defer f.Close()

	w.Header().Set("Content-Type", "application/octet-stream")
	w.WriteHeader(http.StatusOK)
	io.Copy(w, f)
}

func (h *FSHandler) Put(w http.ResponseWriter, r *http.Request) {
	absolutePath, err := h.resolve(r)
	if err != nil {
		writeError(w, r, http.StatusForbidden, "PATH_TRAVERSAL", "path traversal detected")
		return
	}

	ifMatch := r.Header.Get("If-Match")
	if ifMatch != "" {
		currentEtag, xattrErr := xattr.Get(absolutePath, etagAttr)
		if xattrErr != nil {
			currentEtag = ""
		}
		if ifMatch != currentEtag {
			writeError(w, r, http.StatusPreconditionFailed, "PRECONDITION_FAILED", "ETag mismatch")
			return
		}
	}

	_, statErr := os.Stat(absolutePath)
	isNew := errors.Is(statErr, os.ErrNotExist)

	if err := os.MkdirAll(filepath.Dir(absolutePath), 0o755); err != nil {
		writeError(w, r, http.StatusInternalServerError, "WRITE_ERROR", "failed to create directories")
		return
	}

	tempFile, err := os.CreateTemp(filepath.Dir(absolutePath), ".tmp-*")
	if err != nil {
		writeError(w, r, http.StatusInternalServerError, "WRITE_ERROR", "failed to create temp file")
		return
	}
	tempFilePath := tempFile.Name()
	defer os.Remove(tempFilePath)

	hasher := xxhash.New()
	if _, err := io.Copy(tempFile, io.TeeReader(r.Body, hasher)); err != nil {
		tempFile.Close()
		writeError(w, r, http.StatusInternalServerError, "WRITE_ERROR", "failed to write file")
		return
	}
	tempFile.Close()

	if err := os.Rename(tempFilePath, absolutePath); err != nil {
		writeError(w, r, http.StatusInternalServerError, "WRITE_ERROR", "failed to commit file")
		return
	}

	info, err := os.Stat(absolutePath)
	if err != nil {
		writeError(w, r, http.StatusInternalServerError, "WRITE_ERROR", "failed to stat written file")
		return
	}

	etag := fmt.Sprintf(`"%016x"`, hasher.Sum64())
	xattr.Set(absolutePath, etagAttr, etag)

	w.Header().Set("ETag", etag)
	w.Header().Set("X-File-Size", fmt.Sprintf("%d", info.Size()))
	if isNew {
		w.WriteHeader(http.StatusCreated)
	} else {
		w.WriteHeader(http.StatusOK)
	}
}

func (h *FSHandler) Delete(w http.ResponseWriter, r *http.Request) {
	absolutePath, err := h.resolve(r)
	if err != nil {
		writeError(w, r, http.StatusForbidden, "PATH_TRAVERSAL", "path traversal detected")
		return
	}

	if err := os.Remove(absolutePath); err != nil {
		if errors.Is(err, os.ErrNotExist) {
			writeError(w, r, http.StatusNotFound, "FILE_NOT_FOUND", "file not found")
			return
		}
		writeError(w, r, http.StatusInternalServerError, "DELETE_ERROR", "failed to delete file")
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

func (h *FSHandler) resolve(r *http.Request) (string, error) {
	relativePath := chi.URLParam(r, "*")
	return pathutil.SafeJoin(h.root, relativePath)
}

type errorBody struct {
	Error struct {
		Code      string `json:"code"`
		Message   string `json:"message"`
		RequestID string `json:"request_id"`
	} `json:"error"`
}

func writeError(w http.ResponseWriter, r *http.Request, status int, code, message string) {
	var body errorBody
	body.Error.Code = code
	body.Error.Message = message
	body.Error.RequestID = chimiddleware.GetReqID(r.Context())
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(body)
}
