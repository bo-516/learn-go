//go:build unix

package gotest

import (
	"os/exec"
	"syscall"
)

// setProcessGroup 让 go test 及其编译出的测试二进制处在同一个进程组，
// 超时取消时整组杀掉，避免死循环的测试进程残留。
func setProcessGroup(cmd *exec.Cmd) {
	cmd.SysProcAttr = &syscall.SysProcAttr{Setpgid: true}
	cmd.Cancel = func() error {
		return syscall.Kill(-cmd.Process.Pid, syscall.SIGKILL)
	}
}
