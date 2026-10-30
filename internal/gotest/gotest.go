// Package gotest 在临时模块里执行 go test，并把输出整理成结构化结果。
// 本地运行器（runner）和题目校验工具（tools/content）共用这一份逻辑，保证两边行为一致。
package gotest

import (
	"bytes"
	"context"
	"errors"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
	"time"
)

// GoModVersion 是临时模块 go.mod 里的 go 指令版本。题目会用到 min/max、
// 1.22 的循环变量语义和 ServeMux 路由模式、1.24 的 runtime.AddCleanup。
const GoModVersion = "1.24"

const maxOutput = 256 << 10

type Options struct {
	Race    bool
	Timeout time.Duration // 传给 go test -timeout，只约束测试执行阶段
}

type TestCase struct {
	Name    string  `json:"name"`
	Passed  bool    `json:"passed"`
	Elapsed float64 `json:"elapsed"`
}

type Result struct {
	Passed     bool       `json:"passed"`
	BuildError bool       `json:"buildError"`
	TimedOut   bool       `json:"timedOut"`
	Race       bool       `json:"race"`
	Output     string     `json:"output"`
	Tests      []TestCase `json:"tests"`
	DurationMs int64      `json:"durationMs"`
}

var (
	testLine   = regexp.MustCompile(`^\s*--- (PASS|FAIL|SKIP): (\S+) \(([\d.]+)s\)`)
	buildFail  = regexp.MustCompile(`\[(build|setup) failed\]`)
	timeoutMsg = "panic: test timed out after"
)

// Run 把 code 写成 main.go、test 写成 main_test.go，执行 go test -v。
func Run(ctx context.Context, code, test string, opt Options) (*Result, error) {
	if opt.Timeout <= 0 {
		opt.Timeout = 10 * time.Second
	}
	dir, err := os.MkdirTemp("", "learngo-*")
	if err != nil {
		return nil, err
	}
	defer os.RemoveAll(dir)

	files := map[string]string{
		"go.mod":       "module play\n\ngo " + GoModVersion + "\n",
		"main.go":      code,
		"main_test.go": test,
	}
	for name, body := range files {
		if err := os.WriteFile(filepath.Join(dir, name), []byte(body), 0o644); err != nil {
			return nil, err
		}
	}

	// 编译（尤其是第一次 -race）比测试本身慢得多，所以整体期限要比 -timeout 宽松。
	ctx, cancel := context.WithTimeout(ctx, opt.Timeout+90*time.Second)
	defer cancel()

	args := []string{"test", "-count=1", "-v", "-timeout=" + opt.Timeout.String()}
	if opt.Race {
		args = append(args, "-race")
	}
	args = append(args, ".")

	cmd := exec.CommandContext(ctx, "go", args...)
	cmd.Dir = dir
	cmd.Env = append(os.Environ(), "GOWORK=off", "GOFLAGS=", "GO111MODULE=on")
	setProcessGroup(cmd)
	cmd.WaitDelay = 2 * time.Second

	var out limitedBuffer
	cmd.Stdout = &out
	cmd.Stderr = &out

	start := time.Now()
	runErr := cmd.Run()
	res := &Result{DurationMs: time.Since(start).Milliseconds()}

	text := out.String()
	// 栈信息里会出现临时目录的绝对路径，换成相对路径更好读。
	text = strings.ReplaceAll(text, dir+string(filepath.Separator), "./")
	text = strings.ReplaceAll(text, dir, ".")
	res.Output = text

	var exitErr *exec.ExitError
	switch {
	case runErr == nil:
		res.Passed = true
	case errors.As(runErr, &exitErr):
		// 测试失败、编译失败都走这里，下面根据输出细分。
	case ctx.Err() != nil:
		res.TimedOut = true
	default:
		return nil, runErr
	}

	res.BuildError = buildFail.MatchString(text)
	if strings.Contains(text, timeoutMsg) {
		res.TimedOut = true
	}
	res.Race = strings.Contains(text, "WARNING: DATA RACE")
	res.Tests = parseTests(text)
	if out.truncated {
		res.Output += "\n…（输出过长，已截断）"
	}
	return res, nil
}

func parseTests(text string) []TestCase {
	var cases []TestCase
	for _, line := range strings.Split(text, "\n") {
		m := testLine.FindStringSubmatch(line)
		if m == nil || m[1] == "SKIP" {
			continue
		}
		elapsed, _ := strconv.ParseFloat(m[3], 64)
		cases = append(cases, TestCase{Name: m[2], Passed: m[1] == "PASS", Elapsed: elapsed})
	}
	return cases
}

// limitedBuffer 只保留前 maxOutput 字节，防止死循环打印把内存撑爆。
type limitedBuffer struct {
	buf       bytes.Buffer
	truncated bool
}

func (b *limitedBuffer) Write(p []byte) (int, error) {
	if room := maxOutput - b.buf.Len(); room < len(p) {
		if room > 0 {
			b.buf.Write(p[:room])
		}
		b.truncated = true
		return len(p), nil
	}
	return b.buf.Write(p)
}

func (b *limitedBuffer) String() string { return b.buf.String() }

// GoVersion 返回本机 go 工具链版本，例如 go1.25.3。
func GoVersion(ctx context.Context) (string, error) {
	out, err := exec.CommandContext(ctx, "go", "env", "GOVERSION").Output()
	if err != nil {
		return "", err
	}
	return strings.TrimSpace(string(out)), nil
}
