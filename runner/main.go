// Command runner 是本地的 Go 代码运行器。
//
// 它做两件事：
//   - POST /api/run：把页面提交的代码和测试写进临时模块，执行 go test 并返回结果；
//   - 其他路径：托管 vite build 产出的 dist/ 目录。
//
// 运行器会执行任意代码，所以只监听 127.0.0.1，并校验 Host / Origin / Content-Type，
// 防止其他网站通过浏览器向本机发请求（跨站请求、DNS rebinding）。
package main

import (
	"context"
	"encoding/json"
	"errors"
	"flag"
	"fmt"
	"log"
	"net"
	"net/http"
	"net/url"
	"os"
	"os/signal"
	"path/filepath"
	"runtime"
	"strings"
	"syscall"
	"time"

	"learngo/internal/gotest"
)

type runRequest struct {
	Code string `json:"code"`
	Test string `json:"test"`
	Race bool   `json:"race"`
}

func main() {
	addr := flag.String("addr", "127.0.0.1:8080", "监听地址（只建议本机回环地址）")
	dir := flag.String("dir", "dist", "前端构建产物目录，不存在时只提供 API")
	flag.Parse()

	goVersion, err := gotest.GoVersion(context.Background())
	if err != nil {
		log.Fatalf("找不到 go 命令，请先安装 Go 并加入 PATH：%v", err)
	}

	slots := make(chan struct{}, max(2, runtime.NumCPU()/2))

	mux := http.NewServeMux()
	mux.HandleFunc("GET /api/health", func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, http.StatusOK, map[string]any{"ok": true, "go": goVersion})
	})
	mux.HandleFunc("POST /api/run", func(w http.ResponseWriter, r *http.Request) {
		if !strings.HasPrefix(r.Header.Get("Content-Type"), "application/json") {
			http.Error(w, "Content-Type 必须是 application/json", http.StatusUnsupportedMediaType)
			return
		}
		var req runRequest
		if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 1<<20)).Decode(&req); err != nil {
			http.Error(w, "请求体格式错误："+err.Error(), http.StatusBadRequest)
			return
		}
		if strings.TrimSpace(req.Code) == "" || strings.TrimSpace(req.Test) == "" {
			http.Error(w, "code 和 test 不能为空", http.StatusBadRequest)
			return
		}

		select {
		case slots <- struct{}{}:
			defer func() { <-slots }()
		case <-r.Context().Done():
			return
		}

		res, err := gotest.Run(r.Context(), req.Code, req.Test, gotest.Options{Race: req.Race, Timeout: 10 * time.Second})
		if err != nil {
			http.Error(w, "执行失败："+err.Error(), http.StatusInternalServerError)
			return
		}
		writeJSON(w, http.StatusOK, res)
	})

	var static http.Handler = http.NotFoundHandler()
	if st, err := os.Stat(*dir); err == nil && st.IsDir() {
		static = http.FileServer(http.Dir(*dir))
		abs, _ := filepath.Abs(*dir)
		log.Printf("托管前端页面：%s", abs)
	} else {
		log.Printf("没有找到 %s 目录，只提供 /api（开发时用 pnpm dev 打开页面）", *dir)
	}
	mux.Handle("/", static)

	srv := &http.Server{
		Addr:              *addr,
		Handler:           localOnly(mux),
		ReadHeaderTimeout: 5 * time.Second,
		IdleTimeout:       60 * time.Second,
	}

	ln, err := net.Listen("tcp", *addr)
	if err != nil {
		log.Fatal(err)
	}
	log.Printf("Go 运行器已启动（%s）：http://%s", goVersion, displayAddr(ln.Addr().String()))

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()
	go func() {
		<-ctx.Done()
		shutdownCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		srv.Shutdown(shutdownCtx)
	}()
	if err := srv.Serve(ln); err != nil && !errors.Is(err, http.ErrServerClosed) {
		log.Fatal(err)
	}
}

// localOnly 拒绝 Host 或 Origin 不是本机的请求。
func localOnly(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if !isLoopbackHost(r.Host) {
			http.Error(w, "只接受本机访问", http.StatusForbidden)
			return
		}
		if origin := r.Header.Get("Origin"); origin != "" {
			u, err := url.Parse(origin)
			if err != nil || !isLoopbackHost(u.Host) {
				http.Error(w, "不允许跨站请求", http.StatusForbidden)
				return
			}
		}
		next.ServeHTTP(w, r)
	})
}

func isLoopbackHost(hostport string) bool {
	host := hostport
	if h, _, err := net.SplitHostPort(hostport); err == nil {
		host = h
	}
	host = strings.Trim(host, "[]")
	if host == "localhost" {
		return true
	}
	ip := net.ParseIP(host)
	return ip != nil && ip.IsLoopback()
}

func displayAddr(a string) string {
	host, port, err := net.SplitHostPort(a)
	if err != nil {
		return a
	}
	if host == "127.0.0.1" || host == "::1" {
		host = "localhost"
	}
	return net.JoinHostPort(host, port)
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	if err := json.NewEncoder(w).Encode(v); err != nil {
		fmt.Fprintln(os.Stderr, "write response:", err)
	}
}
