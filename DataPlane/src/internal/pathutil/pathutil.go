package pathutil

import (
	"errors"
	"path/filepath"
	"strings"
)

var ErrPathTraversal = errors.New("path traversal detected")

func SafeJoin(root, relativePath string) (string, error) {
	absolutePath := filepath.Clean(filepath.Join(root, relativePath))
	rootWithSep := root + string(filepath.Separator)
	if absolutePath != root && !strings.HasPrefix(absolutePath, rootWithSep) {
		return "", ErrPathTraversal
	}
	return absolutePath, nil
}
