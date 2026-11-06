//go:build linux

package xattr

import "syscall"

func Get(path, name string) (string, error) {
	buf := make([]byte, 256)
	n, err := syscall.Getxattr(path, name, buf)
	if err != nil {
		return "", err
	}
	return string(buf[:n]), nil
}

func Set(path, name, value string) error {
	return syscall.Setxattr(path, name, []byte(value), 0)
}
