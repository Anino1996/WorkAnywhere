//go:build !linux

package xattr

import "errors"

var errNotSupported = errors.New("xattr not supported on this platform")

func Get(path, name string) (string, error) {
	return "", errNotSupported
}

func Set(path, name, value string) error {
	return errNotSupported
}
