package main

// 语法识别：对每个参考答案做类型检查，找出它用到了哪些 Go 语法，
// 和 content/syntax.txt 里的语法卡片对应起来。

import (
	"bytes"
	"fmt"
	"go/ast"
	"go/importer"
	"go/parser"
	"go/token"
	"go/types"
	"io"
	"os"
	"os/exec"
	"slices"
	"strconv"
	"strings"
)

type SyntaxEntry struct {
	ID     string    `json:"id"`
	Name   string    `json:"name"`
	Group  string    `json:"group"`
	Body   string    `json:"body"`
	UsedBy []UsedRef `json:"-"`
}

// UsedRef 指向用到某个语法的题目
type UsedRef struct {
	ID    string `json:"id"`    // 任务或 LeetCode 题的 id
	Label string `json:"label"` // 显示文字
	Href  string `json:"href"`  // 页面锚点
}

func loadSyntax(dir string) ([]*SyntaxEntry, error) {
	items, err := loadDir(dir)
	if err != nil {
		return nil, err
	}
	out := []*SyntaxEntry{}
	seen := map[string]bool{}
	for _, it := range items {
		e := &SyntaxEntry{ID: it.ID, Name: it.Meta["name"], Group: it.Meta["group"], Body: it.Sections["body"]}
		if e.Name == "" || e.Group == "" || strings.TrimSpace(e.Body) == "" {
			return nil, fmt.Errorf("%s:%d: 语法卡片 %s 缺少 name / group / body", it.File, it.Line, it.ID)
		}
		if seen[e.ID] {
			return nil, fmt.Errorf("%s:%d: 语法卡片 %s 重复", it.File, it.Line, it.ID)
		}
		seen[e.ID] = true
		e.UsedBy = []UsedRef{}
		out = append(out, e)
	}
	return out, nil
}

type detector struct {
	fset *token.FileSet
	imp  types.Importer
}

// newDetector 用 go list -export 拿到所有依赖包的导出数据，供类型检查使用。
func newDetector(sources []string) (*detector, error) {
	fset := token.NewFileSet()
	need := map[string]bool{}
	for _, src := range sources {
		f, err := parser.ParseFile(fset, "", src, parser.ImportsOnly)
		if err != nil {
			continue
		}
		for _, im := range f.Imports {
			if p, err := strconv.Unquote(im.Path.Value); err == nil && p != "unsafe" {
				need[p] = true
			}
		}
	}
	exports := map[string]string{}
	if len(need) > 0 {
		args := append([]string{"list", "-export", "-deps", "-f", "{{.ImportPath}}\t{{.Export}}"}, sortedKeys(need)...)
		cmd := exec.Command("go", args...)
		cmd.Env = append(os.Environ(), "GOWORK=off", "GOFLAGS=")
		var stderr bytes.Buffer
		cmd.Stderr = &stderr
		out, err := cmd.Output()
		if err != nil {
			return nil, fmt.Errorf("go list -export 失败：%v\n%s", err, stderr.String())
		}
		for _, line := range strings.Split(string(out), "\n") {
			if path, file, ok := strings.Cut(line, "\t"); ok && file != "" {
				exports[path] = file
			}
		}
	}
	lookup := func(path string) (io.ReadCloser, error) {
		file, ok := exports[path]
		if !ok {
			return nil, fmt.Errorf("没有 %s 的导出数据", path)
		}
		return os.Open(file)
	}
	return &detector{fset: fset, imp: importer.ForCompiler(fset, "gc", lookup)}, nil
}

func sortedKeys(m map[string]bool) []string {
	keys := make([]string, 0, len(m))
	for k := range m {
		keys = append(keys, k)
	}
	slices.Sort(keys)
	return keys
}

// pkgFeatures：标准库包（以及其中的具体名字）对应的语法卡片
func pkgFeature(path, name string) string {
	switch path {
	case "sync":
		switch name {
		case "WaitGroup":
			return "waitgroup"
		case "Mutex", "RWMutex", "Locker":
			return "mutex"
		case "Once", "OnceValue", "OnceValues", "OnceFunc":
			return "once"
		case "Cond", "NewCond":
			return "cond"
		case "Map":
			return "sync-map"
		case "Pool":
			return "sync-pool"
		}
	case "sync/atomic":
		return "atomic"
	case "context":
		return "context"
	case "time":
		switch name {
		case "NewTimer", "NewTicker", "After", "AfterFunc", "Tick", "Timer", "Ticker":
			return "timer"
		}
		return "time"
	case "strings", "bytes", "unicode", "unicode/utf8":
		if name == "Builder" {
			return "strings-builder"
		}
		return "strings"
	case "strconv":
		return "strconv"
	case "fmt":
		return "fmt"
	case "errors":
		if name == "New" {
			return "error-basic"
		}
		return "error-wrap"
	case "sort", "slices", "maps", "cmp":
		return "sort-slices"
	case "container/heap":
		return "heap"
	case "container/list":
		return "list"
	case "encoding/json":
		return "json"
	case "net/http", "net/http/httptest", "net/url", "net/http/pprof":
		return "http"
	case "io", "bufio", "os", "testing/iotest":
		return "io"
	case "unsafe":
		return "unsafe"
	case "reflect":
		return "reflect"
	case "math/bits":
		return "bits"
	case "hash/fnv", "hash/crc32", "crypto/sha256", "crypto/sha1", "crypto/hmac", "crypto/rand",
		"crypto/aes", "crypto/cipher", "crypto/ecdh", "encoding/hex", "encoding/base64", "encoding/binary":
		return "encoding"
	case "regexp":
		return "regexp"
	case "runtime", "runtime/debug", "runtime/trace", "runtime/metrics":
		return "runtime"
	case "database/sql", "database/sql/driver":
		return "sql"
	case "log/slog":
		return "slog"
	case "net":
		return "net"
	case "iter":
		return "range-func"
	}
	return ""
}

// detect 返回 src 用到的语法卡片 id（无序）
func (d *detector) detect(src string) (map[string]bool, error) {
	f, err := parser.ParseFile(d.fset, "main.go", src, 0)
	if err != nil {
		return nil, err
	}
	info := &types.Info{
		Types: map[ast.Expr]types.TypeAndValue{},
		Defs:  map[*ast.Ident]types.Object{},
		Uses:  map[*ast.Ident]types.Object{},
	}
	var typeErrs []error
	conf := types.Config{Importer: d.imp, Error: func(err error) { typeErrs = append(typeErrs, err) }}
	conf.Check("play", d.fset, []*ast.File{f}, info)
	if len(typeErrs) > 0 {
		return nil, fmt.Errorf("类型检查失败：%v", typeErrs[0])
	}

	found := map[string]bool{}
	add := func(id string) {
		if id != "" {
			found[id] = true
		}
	}
	typeOf := func(e ast.Expr) types.Type {
		if tv, ok := info.Types[e]; ok && tv.Type != nil {
			return tv.Type.Underlying()
		}
		return nil
	}
	commaOK := func(rhs ast.Expr) {
		switch r := ast.Unparen(rhs).(type) {
		case *ast.IndexExpr:
			if _, ok := typeOf(r.X).(*types.Map); ok {
				add("map-commaok")
			}
		case *ast.UnaryExpr:
			if r.Op == token.ARROW {
				add("chan-commaok")
			}
		}
	}
	funcType := func(ft *ast.FuncType) {
		if ft.Results != nil {
			if ft.Results.NumFields() > 1 {
				add("multi-return")
			}
			for _, r := range ft.Results.List {
				if len(r.Names) > 0 {
					add("named-return")
				}
				if id, ok := r.Type.(*ast.Ident); ok && id.Name == "error" {
					add("error-basic")
				}
				if _, ok := r.Type.(*ast.FuncType); ok {
					add("func-value")
				}
			}
		}
		if ft.Params != nil {
			for _, p := range ft.Params.List {
				switch p.Type.(type) {
				case *ast.FuncType:
					add("func-value")
				case *ast.Ellipsis:
					add("variadic")
				}
			}
		}
	}
	hasMethods, hasInterface := false, false

	ast.Inspect(f, func(n ast.Node) bool {
		switch x := n.(type) {
		case *ast.GenDecl:
			switch x.Tok {
			case token.VAR:
				add("var-zero")
			case token.CONST:
				add("const-iota")
			}
		case *ast.AssignStmt:
			if x.Tok == token.DEFINE {
				add("short-var")
			}
			if len(x.Lhs) > 1 && len(x.Rhs) == len(x.Lhs) {
				add("multi-assign")
			}
			if len(x.Lhs) == 2 && len(x.Rhs) == 1 {
				commaOK(x.Rhs[0])
			}
			switch x.Tok {
			case token.AND_ASSIGN, token.OR_ASSIGN, token.XOR_ASSIGN, token.SHL_ASSIGN, token.SHR_ASSIGN, token.AND_NOT_ASSIGN:
				add("bits")
			}
			// var f func(...); f = func(...) { ... f(...) ... }
			if x.Tok == token.ASSIGN && len(x.Lhs) == 1 && len(x.Rhs) == 1 {
				if lit, ok := x.Rhs[0].(*ast.FuncLit); ok {
					if id, ok := x.Lhs[0].(*ast.Ident); ok {
						obj := info.Uses[id]
						ast.Inspect(lit.Body, func(m ast.Node) bool {
							if ref, ok := m.(*ast.Ident); ok && obj != nil && info.Uses[ref] == obj {
								add("recursive-closure")
							}
							return true
						})
					}
				}
			}
		case *ast.ValueSpec:
			if len(x.Names) == 2 && len(x.Values) == 1 {
				commaOK(x.Values[0])
			}
		case *ast.IfStmt:
			if x.Init != nil {
				add("if-init")
			}
		case *ast.ForStmt:
			switch {
			case x.Init != nil || x.Post != nil:
				add("for-classic")
			case x.Cond != nil:
				add("for-while")
			default:
				add("for-ever")
			}
		case *ast.RangeStmt:
			switch t := typeOf(x.X).(type) {
			case *types.Slice, *types.Array, *types.Pointer:
				add("range-slice")
			case *types.Map:
				add("range-map")
			case *types.Chan:
				add("range-chan")
			case *types.Signature:
				add("range-func")
			case *types.Basic:
				if t.Info()&types.IsString != 0 {
					add("range-string")
				} else if t.Info()&types.IsInteger != 0 {
					add("range-int")
				}
			}
		case *ast.SwitchStmt:
			if x.Tag == nil {
				add("switch-true")
			} else {
				add("switch-tag")
			}
		case *ast.TypeSwitchStmt:
			add("type-switch")
		case *ast.TypeAssertExpr:
			if x.Type != nil {
				add("type-assert")
			}
		case *ast.LabeledStmt:
			add("label")
		case *ast.FuncDecl:
			if x.Recv != nil && len(x.Recv.List) > 0 {
				hasMethods = true
				if _, ptr := x.Recv.List[0].Type.(*ast.StarExpr); ptr {
					add("method-ptr")
				} else {
					add("method-value")
				}
				switch x.Name.Name {
				case "Error":
					add("error-type")
					add("interface-impl")
				case "String", "ServeHTTP", "Less", "Read", "Write", "Close":
					add("interface-impl")
				}
			}
			if x.Type.TypeParams != nil {
				add("generics")
			}
			funcType(x.Type)
		case *ast.FuncLit:
			add("closure")
			funcType(x.Type)
		case *ast.TypeSpec:
			if x.TypeParams != nil {
				add("generics")
			}
			switch t := x.Type.(type) {
			case *ast.StructType:
				add("struct")
				for _, field := range t.Fields.List {
					if len(field.Names) == 0 {
						add("embed")
					}
					if field.Tag != nil {
						add("struct-tag")
					}
				}
			case *ast.InterfaceType:
				if isConstraint(t) {
					add("constraint")
				} else {
					add("interface-def")
					hasInterface = true
				}
			default:
				if !x.Assign.IsValid() {
					add("type-def")
				}
			}
		case *ast.InterfaceType:
			if t := x.Methods; t == nil || len(t.List) == 0 {
				add("any")
			}
		case *ast.Ident:
			if x.Name == "any" && info.Uses[x] == types.Universe.Lookup("any") {
				add("any")
			}
			if x.Name == "iota" {
				add("const-iota")
			}
		case *ast.GoStmt:
			add("goroutine")
		case *ast.DeferStmt:
			add("defer")
		case *ast.SelectStmt:
			add("select")
			for _, c := range x.Body.List {
				if cc, ok := c.(*ast.CommClause); ok && cc.Comm == nil {
					add("select-default")
				}
			}
		case *ast.SendStmt:
			add("chan")
		case *ast.UnaryExpr:
			switch x.Op {
			case token.ARROW:
				add("chan")
			case token.AND:
				add("pointer")
				// &p，p 本身是指针 → 得到 **T
				if t, ok := typeOf(x).(*types.Pointer); ok {
					if _, ok := t.Elem().Underlying().(*types.Pointer); ok {
						add("ptr-ptr")
					}
				}
			case token.XOR:
				add("bits")
			}
		case *ast.StarExpr:
			add("pointer")
			if _, ok := x.X.(*ast.StarExpr); ok {
				if tv, ok := info.Types[x]; ok && tv.IsType() {
					add("ptr-ptr")
				}
			}
			if t, ok := typeOf(x).(*types.Pointer); ok {
				if _, ok := t.Elem().Underlying().(*types.Pointer); ok {
					add("ptr-ptr")
				}
			}
		case *ast.ChanType:
			add("chan")
			if x.Dir != ast.SEND|ast.RECV {
				add("chan-dir")
			}
		case *ast.ArrayType:
			if x.Len != nil {
				add("array")
			} else if inner, ok := x.Elt.(*ast.ArrayType); ok && inner.Len == nil {
				add("slice2d")
			}
		case *ast.MapType:
			add("map")
			if st, ok := x.Value.(*ast.StructType); ok && st.Fields.NumFields() == 0 {
				add("set-struct")
			}
		case *ast.SliceExpr:
			add("slice-expr")
			if x.Slice3 {
				add("slice-full")
			}
		case *ast.BinaryExpr:
			switch x.Op {
			case token.AND, token.OR, token.XOR, token.SHL, token.SHR, token.AND_NOT:
				add("bits")
			}
		case *ast.CompositeLit:
			switch typeOf(x).(type) {
			case *types.Struct:
				add("struct-literal")
			case *types.Map:
				add("map")
			case *types.Slice:
				add("slice-make")
			case *types.Array:
				add("array")
			}
		case *ast.BasicLit:
			if x.Kind == token.CHAR {
				add("rune")
			}
		case *ast.CallExpr:
			if x.Ellipsis.IsValid() {
				add("variadic")
			}
			if tv, ok := info.Types[x.Fun]; ok && tv.IsType() && len(x.Args) == 1 {
				if isStringBytes(tv.Type.Underlying(), typeOf(x.Args[0])) {
					add("string-bytes")
				} else {
					add("type-conv")
				}
			}
			if id, ok := ast.Unparen(x.Fun).(*ast.Ident); ok {
				if b, ok := info.Uses[id].(*types.Builtin); ok {
					switch b.Name() {
					case "make":
						switch typeOf(x.Args[0]).(type) {
						case *types.Slice:
							add("slice-make")
						case *types.Map:
							add("map")
						case *types.Chan:
							add("chan")
							if len(x.Args) == 2 {
								add("chan-buffered")
							}
						}
					case "append":
						add("append")
					case "copy":
						add("copy")
					case "delete", "clear":
						add("map")
					case "close":
						add("chan-close")
					case "min", "max":
						add("builtin-minmax")
					case "panic", "recover":
						add("panic-recover")
					case "new":
						add("pointer")
					}
				}
			}
			if sel, ok := x.Fun.(*ast.SelectorExpr); ok && sel.Sel.Name == "Errorf" && len(x.Args) > 0 {
				if lit, ok := x.Args[0].(*ast.BasicLit); ok && strings.Contains(lit.Value, "%w") {
					add("error-wrap")
				}
			}
		case *ast.SelectorExpr:
			if id, ok := x.X.(*ast.Ident); ok {
				if pn, ok := info.Uses[id].(*types.PkgName); ok {
					add(pkgFeature(pn.Imported().Path(), x.Sel.Name))
					if pn.Imported().Path() == "fmt" && x.Sel.Name == "Errorf" {
						add("error-basic")
					}
				}
			}
		}
		return true
	})
	if hasMethods && hasInterface {
		add("interface-impl")
	}
	return found, nil
}

// 约束接口：包含类型集合（int | ~float64 这种）或 comparable
func isConstraint(t *ast.InterfaceType) bool {
	for _, m := range t.Methods.List {
		if len(m.Names) > 0 {
			continue
		}
		switch e := m.Type.(type) {
		case *ast.BinaryExpr, *ast.UnaryExpr:
			return true
		case *ast.Ident:
			if e.Name == "comparable" || e.Name == "int" || e.Name == "string" || e.Name == "float64" {
				return true
			}
		}
	}
	return false
}

func isStringBytes(to, from types.Type) bool {
	isStr := func(t types.Type) bool {
		b, ok := t.(*types.Basic)
		return ok && b.Info()&types.IsString != 0
	}
	isBytesOrRunes := func(t types.Type) bool {
		s, ok := t.(*types.Slice)
		if !ok {
			return false
		}
		b, ok := s.Elem().Underlying().(*types.Basic)
		return ok && (b.Kind() == types.Byte || b.Kind() == types.Rune || b.Kind() == types.Int32 || b.Kind() == types.Uint8)
	}
	return (isStr(to) && isBytesOrRunes(from)) || (isBytesOrRunes(to) && isStr(from))
}
