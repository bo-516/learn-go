// Command content 把 content/ 下的题目源文件编译成前端使用的 JSON，并可选地逐题校验。
//
// 源文件格式（一个文件可以放多道题）：
//
//	=== go-01-1                 题目 id；题库任务以所属题目 id 开头，LeetCode 题以 lc- 开头
//	title: 标题                  头部是 key: value
//	race: true                  可选，用 -race 运行
//	starter: build-error        可选，起始代码有意编译失败（编译器报错就是提示）
//	--- desc                    Markdown 题面
//	--- solution                参考答案（Go 源码），可以用标记区分答案专有和起始代码专有的行
//	--- starter                 可选，显式给出起始代码（找 bug 类题目用）
//	--- test                    测试文件
//	--- explain                 可选，答案解析（Markdown）
//
// 其他内容目录：
//
//	content/syntax.txt          Go 语法卡片（=== id / name: / group: / --- body），参考答案用到的语法自动识别
//	content/explain/*.txt       讲解（=== 任务或 LeetCode id / --- explain），覆盖题目文件里的 explain
//	content/deep/*.txt          面试题的深入讲解（=== 题目 id / --- deep）
//	content/questions/*.txt     新增面试题（=== id / group: level: hot: title: / --- answer / --- deep）
//
// solution 里的标记：
//
//	// @solution   之后的行只出现在参考答案里
//	// @starter    之后的行只出现在起始代码里，且去掉一层 "// " 注释
//	// @end        恢复为两边共有
//
// 校验（-verify）：参考答案必须通过全部测试；起始代码必须能编译，且不应直接通过测试。
package main

import (
	"bufio"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"flag"
	"fmt"
	"go/ast"
	"go/format"
	"go/parser"
	"go/token"
	"os"
	"path/filepath"
	"runtime"
	"slices"
	"strconv"
	"strings"
	"sync"
	"time"

	"learngo/internal/gotest"
)

type item struct {
	ID       string
	File     string
	Line     int
	Meta     map[string]string
	Sections map[string]string

	Starter  string
	Solution string
	Race     bool
}

type Task struct {
	ID       string   `json:"id"`
	Title    string   `json:"title"`
	Desc     string   `json:"desc"`
	Starter  string   `json:"starter"`
	Solution string   `json:"solution"`
	Test     string   `json:"test"`
	Explain  string   `json:"explain,omitempty"`
	Race     bool     `json:"race,omitempty"`
	Syntax   []string `json:"syntax"`
}

type Problem struct {
	ID         string   `json:"id"`
	No         int      `json:"no"`
	Title      string   `json:"title"`
	Slug       string   `json:"slug"`
	Difficulty string   `json:"difficulty"`
	Category   string   `json:"category"`
	Topics     []string `json:"topics"`
	GoPoints   []string `json:"goPoints"`
	Desc       string   `json:"desc"`
	Starter    string   `json:"starter"`
	Solution   string   `json:"solution"`
	Test       string   `json:"test"`
	Explain    string   `json:"explain,omitempty"`
	Race       bool     `json:"race,omitempty"`
	Syntax     []string `json:"syntax"`
}

func main() {
	contentDir := flag.String("content", "content", "题目源文件目录")
	outDir := flag.String("out", "src/data", "JSON 输出目录")
	verify := flag.Bool("verify", false, "逐题运行 go test 校验")
	only := flag.String("only", "", "只校验 id 以这些前缀开头的题（逗号分隔）")
	jobs := flag.Int("j", max(2, runtime.NumCPU()-2), "并行校验数")
	noCache := flag.Bool("nocache", false, "忽略校验缓存")
	flag.Parse()

	bankDoc, problems, err := loadBank(filepath.Join(*outDir, "questions.json"), *contentDir)
	check(err)
	known := map[string]bool{}
	qcode := map[string]string{}
	for _, q := range bankDoc.Questions {
		known[q.ID] = true
		qcode[q.ID] = q.Code
	}

	bank, err := loadDir(filepath.Join(*contentDir, "bank"))
	check(err)
	lc, err := loadDir(filepath.Join(*contentDir, "leetcode"))
	check(err)

	seen := map[string]string{}
	all := append(slices.Clone(bank), lc...)
	for _, it := range all {
		where := fmt.Sprintf("%s:%d", it.File, it.Line)
		if prev, dup := seen[it.ID]; dup {
			problems = append(problems, fmt.Sprintf("%s: id %s 与 %s 重复", where, it.ID, prev))
		}
		seen[it.ID] = where
		if err := prepare(it); err != nil {
			problems = append(problems, fmt.Sprintf("%s [%s]: %v", where, it.ID, err))
		}
	}

	tasks := map[string][]Task{}
	taskCount := 0
	for _, it := range bank {
		qid := questionOf(it.ID)
		if !known[qid] {
			problems = append(problems, fmt.Sprintf("%s:%d: 找不到题目 %s", it.File, it.Line, qid))
			continue
		}
		tasks[qid] = append(tasks[qid], Task{
			ID:       it.ID,
			Title:    it.Meta["title"],
			Desc:     it.Sections["desc"],
			Starter:  it.Starter,
			Solution: it.Solution,
			Test:     it.Sections["test"],
			Explain:  it.Sections["explain"],
			Race:     it.Race,
		})
		taskCount++
	}

	lcOut := []Problem{}
	for _, it := range lc {
		no, _ := strconv.Atoi(it.Meta["no"])
		lcOut = append(lcOut, Problem{
			ID:         it.ID,
			No:         no,
			Title:      it.Meta["title"],
			Slug:       it.Meta["slug"],
			Difficulty: it.Meta["difficulty"],
			Category:   it.Meta["category"],
			Topics:     splitList(it.Meta["topics"]),
			GoPoints:   splitList(it.Meta["go"]),
			Desc:       it.Sections["desc"],
			Starter:    it.Starter,
			Solution:   it.Solution,
			Test:       it.Sections["test"],
			Explain:    it.Sections["explain"],
			Race:       it.Race,
		})
	}

	// 讲解覆盖
	explains, more, err := loadOverrides(filepath.Join(*contentDir, "explain"), "explain")
	check(err)
	problems = append(problems, more...)
	used := map[string]bool{}
	for qid := range tasks {
		for i := range tasks[qid] {
			if e, ok := explains[tasks[qid][i].ID]; ok {
				tasks[qid][i].Explain = e
				used[tasks[qid][i].ID] = true
			}
		}
	}
	for i := range lcOut {
		if e, ok := explains[lcOut[i].ID]; ok {
			lcOut[i].Explain = e
			used[lcOut[i].ID] = true
		}
	}
	for id := range explains {
		if !used[id] {
			problems = append(problems, fmt.Sprintf("content/explain: 找不到 %s 对应的任务或题目", id))
		}
	}

	// 语法识别
	glossary, missing, more := buildSyntax(filepath.Join(*contentDir, "syntax"), bankDoc, tasks, qcode, lcOut)
	problems = append(problems, more...)

	if len(problems) > 0 {
		for _, p := range problems {
			fmt.Fprintln(os.Stderr, "✗", p)
		}
		os.Exit(1)
	}
	for _, m := range missing {
		fmt.Fprintln(os.Stderr, "⚠", m)
	}

	check(writeJSON(filepath.Join(*outDir, "bank.json"), bankDoc))
	check(writeJSON(filepath.Join(*outDir, "tasks.json"), tasks))
	check(writeJSON(filepath.Join(*outDir, "leetcode.json"), map[string]any{"problems": lcOut}))
	// 语法卡片正文（任务里用）和反向引用（语法手册页用）分开，避免任务页多加载一大块数据
	// 每个练习的标题只写一次，卡片里只存练习 id
	refs := map[string][2]string{}
	usage := map[string][]string{}
	for _, e := range glossary {
		ids := []string{}
		for _, r := range e.UsedBy {
			refs[r.ID] = [2]string{r.Label, r.Href}
			ids = append(ids, r.ID)
		}
		usage[e.ID] = ids
	}
	check(writeJSON(filepath.Join(*outDir, "syntax.json"), map[string]any{"items": glossary}))
	check(writeJSON(filepath.Join(*outDir, "syntax-usage.json"), map[string]any{"refs": refs, "usage": usage}))
	deep := 0
	for _, q := range bankDoc.Questions {
		if q.Deep != "" {
			deep++
		}
	}
	withExplain := 0
	for _, ts := range tasks {
		for _, t := range ts {
			if t.Explain != "" {
				withExplain++
			}
		}
	}
	fmt.Printf("已生成：%d 道面试题（%d 道有深入讲解），%d 个题库任务（%d 个有讲解），%d 道 LeetCode，%d 张语法卡片\n",
		len(bankDoc.Questions), deep, taskCount, withExplain, len(lcOut), len(glossary))

	if *verify {
		var targets []*item
		prefixes := splitList(*only)
		for _, it := range all {
			if len(prefixes) == 0 || slices.ContainsFunc(prefixes, func(p string) bool { return strings.HasPrefix(it.ID, p) }) {
				targets = append(targets, it)
			}
		}
		if !runVerify(targets, *jobs, *noCache) {
			os.Exit(1)
		}
	}
}

func questionOf(id string) string {
	i := strings.LastIndex(id, "-")
	if i < 0 {
		return id
	}
	return id[:i]
}

func splitList(s string) []string {
	var out []string
	for _, p := range strings.FieldsFunc(s, func(r rune) bool { return r == ',' || r == '，' }) {
		if p = strings.TrimSpace(p); p != "" {
			out = append(out, p)
		}
	}
	return out
}

// ---------- 解析 ----------

func loadDir(dir string) ([]*item, error) {
	files, err := filepath.Glob(filepath.Join(dir, "*.txt"))
	if err != nil {
		return nil, err
	}
	slices.Sort(files)
	var items []*item
	for _, f := range files {
		its, err := parseFile(f)
		if err != nil {
			return nil, err
		}
		items = append(items, its...)
	}
	return items, nil
}

func parseFile(path string) ([]*item, error) {
	f, err := os.Open(path)
	if err != nil {
		return nil, err
	}
	defer f.Close()

	var (
		items   []*item
		cur     *item
		section string
		buf     []string
		lineNo  int
	)
	flush := func() {
		if cur != nil && section != "" {
			cur.Sections[section] = strings.Trim(strings.Join(buf, "\n"), "\n")
		}
		buf = nil
	}

	sc := bufio.NewScanner(f)
	sc.Buffer(make([]byte, 1<<20), 1<<20)
	for sc.Scan() {
		lineNo++
		line := sc.Text()
		switch {
		case strings.HasPrefix(line, "=== "):
			flush()
			cur = &item{
				ID:       strings.TrimSpace(line[4:]),
				File:     path,
				Line:     lineNo,
				Meta:     map[string]string{},
				Sections: map[string]string{},
			}
			section = ""
			items = append(items, cur)
		case cur == nil:
			// 文件开头的说明文字，忽略
		case strings.HasPrefix(line, "--- ") && !strings.Contains(strings.TrimSpace(line[4:]), " "):
			flush()
			section = strings.TrimSpace(line[4:])
		case section == "":
			if k, v, ok := strings.Cut(line, ":"); ok {
				cur.Meta[strings.TrimSpace(k)] = strings.TrimSpace(v)
			}
		default:
			buf = append(buf, line)
		}
	}
	flush()
	return items, sc.Err()
}

// ---------- 语法卡片 ----------

// buildSyntax 识别每个参考答案用到的语法，返回带反向引用的语法卡片列表。
// missing 是识别出来但还没有卡片的语法（只警告）。
func buildSyntax(dir string, bankDoc *Bank, tasks map[string][]Task, qcode map[string]string, lc []Problem) (
	glossary []*SyntaxEntry, missing []string, problems []string) {
	glossary, err := loadSyntax(dir)
	if err != nil {
		return nil, nil, []string{err.Error()}
	}
	order := map[string]int{}
	for i, e := range glossary {
		order[e.ID] = i
	}

	var sources []string
	for _, ts := range tasks {
		for _, t := range ts {
			sources = append(sources, t.Solution)
		}
	}
	for _, p := range lc {
		sources = append(sources, p.Solution)
	}
	det, err := newDetector(sources)
	if err != nil {
		return nil, nil, []string{err.Error()}
	}

	unknown := map[string][]string{}
	detect := func(id, src string, ref UsedRef) []string {
		found, err := det.detect(src)
		if err != nil {
			problems = append(problems, fmt.Sprintf("%s: 语法识别失败：%v", id, err))
			return []string{}
		}
		ids := []string{}
		for s := range found {
			if _, ok := order[s]; ok {
				ids = append(ids, s)
			} else {
				unknown[s] = append(unknown[s], id)
			}
		}
		slices.SortFunc(ids, func(a, b string) int { return order[a] - order[b] })
		for _, s := range ids {
			glossary[order[s]].UsedBy = append(glossary[order[s]].UsedBy, ref)
		}
		return ids
	}

	// 按题库顺序遍历，反向引用的顺序和页面一致
	for _, q := range bankDoc.Questions {
		for i := range tasks[q.ID] {
			t := &tasks[q.ID][i]
			t.Syntax = detect(t.ID, t.Solution, UsedRef{
				ID:    t.ID,
				Label: fmt.Sprintf("%s 任务 %d · %s", qcode[q.ID], i+1, t.Title),
				Href:  "#" + q.ID,
			})
		}
	}
	for i := range lc {
		p := &lc[i]
		p.Syntax = detect(p.ID, p.Solution, UsedRef{
			ID:    p.ID,
			Label: fmt.Sprintf("LeetCode %d · %s", p.No, p.Title),
			Href:  "#leetcode/" + p.ID,
		})
	}
	for _, s := range sortedKeys(func() map[string]bool {
		m := map[string]bool{}
		for k := range unknown {
			m[k] = true
		}
		return m
	}()) {
		missing = append(missing, fmt.Sprintf("语法 %s 还没有卡片（用于 %d 处，例如 %s）", s, len(unknown[s]), unknown[s][0]))
	}
	return glossary, missing, problems
}

// ---------- 生成起始代码与参考答案 ----------

func prepare(it *item) error {
	for _, s := range []string{"desc", "solution", "test"} {
		if strings.TrimSpace(it.Sections[s]) == "" {
			return fmt.Errorf("缺少 --- %s", s)
		}
	}
	if it.Meta["title"] == "" {
		return fmt.Errorf("缺少 title")
	}
	it.Race = it.Meta["race"] == "true"

	sol, st, err := splitMarkers(it.Sections["solution"])
	if err != nil {
		return err
	}
	if explicit, ok := it.Sections["starter"]; ok {
		st = explicit
	}

	if it.Solution, err = gofmt(sol, false); err != nil {
		return fmt.Errorf("参考答案格式化失败：%w", err)
	}
	if it.Starter, err = gofmt(st, true); err != nil {
		return fmt.Errorf("起始代码格式化失败：%w", err)
	}
	test, err := gofmt(it.Sections["test"], false)
	if err != nil {
		return fmt.Errorf("测试代码格式化失败：%w", err)
	}
	it.Sections["test"] = test
	return nil
}

func splitMarkers(src string) (solution, starter string, err error) {
	const (
		both = iota
		solOnly
		starterOnly
	)
	mode := both
	var sol, st []string
	for i, line := range strings.Split(src, "\n") {
		switch strings.TrimSpace(line) {
		case "// @solution":
			mode = solOnly
			continue
		case "// @starter":
			mode = starterOnly
			continue
		case "// @end":
			if mode == both {
				return "", "", fmt.Errorf("solution 第 %d 行：多余的 // @end", i+1)
			}
			mode = both
			continue
		}
		switch mode {
		case both:
			sol = append(sol, line)
			st = append(st, line)
		case solOnly:
			sol = append(sol, line)
		case starterOnly:
			st = append(st, uncomment(line))
		}
	}
	if mode != both {
		return "", "", fmt.Errorf("solution 里的标记没有用 // @end 结束")
	}
	return strings.Join(sol, "\n"), strings.Join(st, "\n"), nil
}

func uncomment(line string) string {
	trimmed := strings.TrimLeft(line, " \t")
	indent := line[:len(line)-len(trimmed)]
	switch {
	case strings.HasPrefix(trimmed, "// "):
		return indent + trimmed[3:]
	case strings.HasPrefix(trimmed, "//"):
		return indent + trimmed[2:]
	}
	return line
}

// gofmt 格式化源码；pruneImports 为 true 时先删掉没有用到的 import（起始代码常见）。
func gofmt(src string, pruneImports bool) (string, error) {
	fset := token.NewFileSet()
	file, err := parser.ParseFile(fset, "main.go", src, parser.ParseComments)
	if err != nil {
		return "", err
	}
	if pruneImports {
		removeUnusedImports(file)
	}
	var sb strings.Builder
	if err := format.Node(&sb, fset, file); err != nil {
		return "", err
	}
	return sb.String(), nil
}

func removeUnusedImports(file *ast.File) {
	used := map[string]bool{}
	ast.Inspect(file, func(n ast.Node) bool {
		if sel, ok := n.(*ast.SelectorExpr); ok {
			if id, ok := sel.X.(*ast.Ident); ok {
				used[id.Name] = true
			}
		}
		return true
	})
	nameOf := func(spec *ast.ImportSpec) string {
		if spec.Name != nil {
			return spec.Name.Name
		}
		p, _ := strconv.Unquote(spec.Path.Value)
		return p[strings.LastIndex(p, "/")+1:]
	}

	var decls []ast.Decl
	for _, d := range file.Decls {
		gd, ok := d.(*ast.GenDecl)
		if !ok || gd.Tok != token.IMPORT {
			decls = append(decls, d)
			continue
		}
		var specs []ast.Spec
		for _, s := range gd.Specs {
			spec := s.(*ast.ImportSpec)
			name := nameOf(spec)
			if name == "_" || name == "." || used[name] {
				specs = append(specs, s)
			}
		}
		if len(specs) == 0 {
			continue
		}
		if len(specs) == 1 {
			gd.Lparen, gd.Rparen = token.NoPos, token.NoPos
		}
		gd.Specs = specs
		decls = append(decls, gd)
	}
	file.Decls = decls
	var imports []*ast.ImportSpec
	for _, d := range decls {
		if gd, ok := d.(*ast.GenDecl); ok && gd.Tok == token.IMPORT {
			for _, s := range gd.Specs {
				imports = append(imports, s.(*ast.ImportSpec))
			}
		}
	}
	file.Imports = imports
}

// ---------- 校验 ----------

const cacheFile = ".content-cache.json"

func hashItem(it *item) string {
	h := sha256.New()
	fmt.Fprintf(h, "%s\x00%s\x00%s\x00%v\x00%s", it.Solution, it.Starter, it.Sections["test"], it.Race, gotest.GoModVersion)
	return hex.EncodeToString(h.Sum(nil))
}

func runVerify(items []*item, jobs int, noCache bool) bool {
	cache := map[string]string{}
	if !noCache {
		if data, err := os.ReadFile(cacheFile); err == nil {
			json.Unmarshal(data, &cache)
		}
	}

	type outcome struct {
		it       *item
		errs     []string
		warns    []string
		cached   bool
		duration time.Duration
	}

	var (
		mu      sync.Mutex
		results []outcome
		wg      sync.WaitGroup
		sem     = make(chan struct{}, jobs)
		done    int
	)
	start := time.Now()
	for _, it := range items {
		wg.Add(1)
		go func() {
			defer wg.Done()
			h := hashItem(it)
			mu.Lock()
			hit := cache[it.ID] == h
			mu.Unlock()
			o := outcome{it: it, cached: hit}
			if !hit {
				sem <- struct{}{}
				t0 := time.Now()
				o.errs, o.warns = verifyOne(it)
				o.duration = time.Since(t0)
				<-sem
			}
			mu.Lock()
			defer mu.Unlock()
			if len(o.errs) == 0 {
				cache[it.ID] = h
			} else {
				delete(cache, it.ID)
			}
			results = append(results, o)
			done++
			status := "✓"
			if len(o.errs) > 0 {
				status = "✗"
			} else if o.cached {
				status = "·"
			}
			if !o.cached || len(o.errs) > 0 {
				fmt.Printf("[%d/%d] %s %s (%.1fs)\n", done, len(items), status, it.ID, o.duration.Seconds())
			}
		}()
	}
	wg.Wait()

	data, _ := json.MarshalIndent(cache, "", "  ")
	os.WriteFile(cacheFile, data, 0o644)

	slices.SortFunc(results, func(a, b outcome) int { return strings.Compare(a.it.ID, b.it.ID) })
	failed, warned, cached := 0, 0, 0
	for _, o := range results {
		if o.cached {
			cached++
		}
		for _, w := range o.warns {
			warned++
			fmt.Printf("⚠ %s (%s:%d): %s\n", o.it.ID, o.it.File, o.it.Line, w)
		}
		if len(o.errs) > 0 {
			failed++
			fmt.Printf("\n✗ %s (%s:%d)\n", o.it.ID, o.it.File, o.it.Line)
			for _, e := range o.errs {
				fmt.Println(indent(e))
			}
		}
	}
	fmt.Printf("\n校验完成：%d 题，失败 %d，警告 %d，缓存命中 %d，用时 %s\n",
		len(results), failed, warned, cached, time.Since(start).Round(time.Second))
	return failed == 0
}

func verifyOne(it *item) (errs, warns []string) {
	ctx := context.Background()
	opt := gotest.Options{Race: it.Race, Timeout: 10 * time.Second}

	sol, err := gotest.Run(ctx, it.Solution, it.Sections["test"], opt)
	switch {
	case err != nil:
		errs = append(errs, "参考答案执行出错："+err.Error())
	case !sol.Passed:
		errs = append(errs, "参考答案没有通过测试：\n"+tail(sol.Output, 60))
	case len(sol.Tests) == 0:
		errs = append(errs, "测试里没有任何 Test 函数")
	}

	st, err := gotest.Run(ctx, it.Starter, it.Sections["test"], opt)
	switch {
	case err != nil:
		errs = append(errs, "起始代码执行出错："+err.Error())
	case st.BuildError && it.Meta["starter"] == "build-error":
		// 题目有意让起始代码编译失败（例如泛型约束缺少 ~），编译器报错本身就是提示
	case st.BuildError:
		errs = append(errs, "起始代码无法编译：\n"+tail(st.Output, 30))
	case st.Passed:
		warns = append(warns, "起始代码直接通过了测试")
	}
	return errs, warns
}

func tail(s string, n int) string {
	lines := strings.Split(strings.TrimRight(s, "\n"), "\n")
	if len(lines) > n {
		lines = append([]string{"…"}, lines[len(lines)-n:]...)
	}
	return strings.Join(lines, "\n")
}

func indent(s string) string {
	return "    " + strings.ReplaceAll(s, "\n", "\n    ")
}

func writeJSON(path string, v any) error {
	data, err := json.MarshalIndent(v, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(path, append(data, '\n'), 0o644)
}

func check(err error) {
	if err != nil {
		fmt.Fprintln(os.Stderr, "错误：", err)
		os.Exit(1)
	}
}
