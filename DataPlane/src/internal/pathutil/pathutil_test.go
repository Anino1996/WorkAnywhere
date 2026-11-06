package pathutil

import (
	"errors"
	"testing"
)

func TestSafeJoin(t *testing.T) {
	cases := []struct {
		name    string
		root    string
		rel     string
		want    string
		wantErr bool
	}{
		{"simple file", "/workspace", "src/main.go", "/workspace/src/main.go", false},
		{"nested path", "/workspace", "a/b/c/file.txt", "/workspace/a/b/c/file.txt", false},
		{"dot in path cleaned", "/workspace", "src/../main.go", "/workspace/main.go", false},
		{"empty rel returns root", "/workspace", "", "/workspace", false},
		{"dot rel returns root", "/workspace", ".", "/workspace", false},
		{"single traversal", "/workspace", "../etc/passwd", "", true},
		{"double traversal", "/workspace", "../../etc/passwd", "", true},
		{"traversal via subdirectory", "/workspace", "src/../../etc/passwd", "", true},
		{"absolute-looking rel cleaned", "/workspace", "/src/main.go", "/workspace/src/main.go", false},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got, err := SafeJoin(tc.root, tc.rel)

			if tc.wantErr {
				if !errors.Is(err, ErrPathTraversal) {
					t.Fatalf("expected ErrPathTraversal, got %v", err)
				}

				return
			}

			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}

			if got != tc.want {
				t.Errorf("got %q, want %q", got, tc.want)
			}
		})
	}
}
