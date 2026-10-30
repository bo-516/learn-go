//go:build !unix

package gotest

import "os/exec"

func setProcessGroup(cmd *exec.Cmd) {}
