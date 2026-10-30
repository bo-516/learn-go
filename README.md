# Go 学习手册

三个页面，帮助系统地学习 Go：

- **面试题库**（`#`）：270 道 Go 后端面试题（原 `Go.html` 的 210 道题 + 新增 60 道题），每道题均配有要点答案、深入讲解和 1～3 个可以直接运行测试的编程小任务（共 326 个，全部带答案解析）。
- **LeetCode 100**（`#leetcode`）：100 道经典算法题，全部用 Go 实现，标注了每题用到的 Go 知识点与详细题解，同样可以在页面里运行测试。
- **Go 语法速查**（`#syntax`）：95 张 Go 语法与标准库卡片，通过 AST/类型检查自动与全站所有编程任务和 LeetCode 题目双向联动。

代码在浏览器里编辑，提交给本机的 Go 运行器执行 `go test`（并发类任务带 `-race`），所以需要本地装有 Go（1.24+）。

**在线阅读版**：<https://bo-516.github.io/learn-go/>。题目、答案、讲解和语法卡片都能看，代码也能编辑，但没有运行器，不能运行测试。想运行测试就按下面的步骤在本地启动。

## 快速开始

```bash
pnpm install
pnpm build          # 生成题目 JSON + 构建前端到 dist/
go run ./runner     # 打开 http://localhost:8080
```

运行器同时托管 `dist/` 里的页面和 `/api/run` 接口，一个命令就够了。

## 开发

开两个终端：

```bash
go run ./runner     # 运行器，监听 127.0.0.1:8080
pnpm dev            # 前端，http://localhost:5173，/api 会代理到运行器
```

页面不是从本机地址（localhost、127.x.x.x）打开时，会自动切换成在线阅读版：不再探测运行器，「运行测试」改为提示克隆到本地。本地想预览在线版的效果，在地址后面加 `?hosted`，例如 `http://localhost:5173/?hosted`。

配色支持浅色和深色，默认跟随系统，顶栏右侧的按钮可以在「跟随系统 / 浅色 / 深色」之间切换，选择保存在浏览器里。

## 发布

推送到 `main` 后，`.github/workflows/pages.yml` 会构建 `dist/` 并发布到 GitHub Pages（仓库 Settings → Pages 的 Source 需要选 GitHub Actions）。前端用 hash 区分页面、资源路径是相对的（`base: "./"`），所以放在任意静态托管的任意子路径下都能用。

## 目录结构

```text
Go.html                    原始页面（保留作对照）
src/                       React 前端
  data/questions.json      原 210 道基础题（由 Go.html 抽取，不要手改）
  data/bank.json           完整面试题库（270 道题，含深入讲解，由 content/ 生成）
  data/tasks.json          题库编程任务（326 个，含答案解析，由 content/ 生成）
  data/leetcode.json       LeetCode 100 题目（由 content/ 生成）
  data/syntax.json         95 张 Go 语法速查卡片（由 content/ 生成）
  data/syntax-usage.json   题目与语法卡片的 AST 自动双向索引（由 content/ 生成）
content/questions/*.txt    新增面试题源文件（含答案与深入讲解）
content/deep/*.txt         原 210 道题的深入讲解源文件
content/bank/*.txt         题库编程任务的源文件
content/explain/*.txt      编程任务与 LeetCode 的独立题解源文件
content/leetcode/*.txt     LeetCode 题目的源文件
content/syntax/*.txt       Go 语法速查卡片的源文件
tools/content/             把 content/ 编译成 JSON，自动分析 AST 语法索引并逐题校验
runner/                    本地 Go 运行器（HTTP 服务）
internal/gotest/           运行器和校验工具共用的 go test 执行逻辑
scripts/extract-questions.mjs  一次性脚本：Go.html → questions.json
```

## 题目源文件格式

一个 `.txt` 文件可以放多道题，每道题以 `=== <id>` 开头：

```text
=== go-01-1                    题库任务 id = 所属题目 id + 序号；LeetCode 用 lc-<题号>
title: 安全地截取子切片
race: true                     可选：用 go test -race 运行
starter: build-error           可选：起始代码有意编译失败（编译器报错本身就是提示）
--- desc
Markdown 题面
--- solution
package main
...参考答案，用标记区分答案和起始代码...
--- starter                    可选：直接给出起始代码（找 bug 类题目）
--- test
package main
...测试文件...
--- explain                    可选：答案解析（Markdown）
```

LeetCode 题目的头部还有 `no`、`slug`、`difficulty`、`category`、`topics`、`go`（Go 知识点）。此外：
- `content/questions/*.txt` 定义新增面试题（头部含 `cat`、`group`、`level`、`title`、`tags`、`tasks`，正文含 `--- answer` 和 `--- deep`）；
- `content/deep/*.txt` 按题号补充面试题的 `--- deep` 深入讲解；
- `content/explain/*.txt` 按任务 ID 补充 `--- explain` 题解；
- `content/syntax/*.txt` 定义 Go 语法速查卡片（含 `group`、`title`、`summary` 和 `--- body`）。

**起始代码由参考答案自动生成**，在 solution 里用三种注释标记：

```go
func Window(s []int, i, j int) []int {
	// @solution
	out := make([]int, j-i)      // 只出现在参考答案里
	copy(out, s[i:j])
	return out
	// @starter
	// return s[i:j] // TODO       // 只出现在起始代码里（去掉一层 "// "）
	// @end
}
```

生成起始代码时会自动删除没用到的 import，并统一 gofmt。

## 校验

```bash
pnpm verify                       # 等价于 go run ./tools/content -verify
go run ./tools/content -verify -only conc-,lc-   # 只校验部分题目
```

对每道题检查两件事：**参考答案必须通过全部测试**；**起始代码必须能编译，并且不能直接通过测试**。结果按内容哈希缓存在 `.content-cache.json`，没改过的题不会重复运行。

## 复制题目给 AI

每道面试题、每个编程小任务和每道 LeetCode 题都有复制按钮，复制出来的是 Markdown，可以直接粘贴给 AI 继续讨论：

- 面试题（题目行右侧的图标）：编号、领域和难度、题目；「下面代码…」这类题会带上题目里的代码。不包含参考答案；
- 编程小任务（任务标题右侧）：题面、你当前的代码（没改过就是起始代码）、测试代码；
- LeetCode（题目行右侧的图标）：题号、难度、原题链接、题面和示例、你当前的代码（没改过就是代码模板）。

## 进度保存

都保存在浏览器的 localStorage 里：

- 「已掌握」的 key 和原页面一致（`go-iv-mastered-v1`），以前在 `Go.html` 里的标记可以直接沿用（同一个来源下）；
- 编辑器里的代码按任务分别保存，点「重置」恢复起始代码；
- 通过的任务和 LeetCode 题分别记录。

## 关于运行器的安全

运行器会执行页面提交的任意 Go 代码，所以：

- 只监听 `127.0.0.1`；
- 拒绝 Host 或 Origin 不是本机的请求（防止其他网站通过浏览器调用它，以及 DNS rebinding）；
- 只接受 `Content-Type: application/json` 的 POST（跨站请求无法在不经过预检的情况下发送）；
- 每次运行在独立的临时目录，`go test -timeout 10s`，超时后整个进程组会被杀掉。

不要把它暴露到局域网或公网。
