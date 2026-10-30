# 交接说明：Go 学习手册剩余工作

这个项目是一个用 React + Vite 写的 Go 学习站点，有三个页面：

- **面试题库**（`#`）：210 道 Go 后端面试题，每道题配 1～3 个可以在页面里运行测试的 Go 编程任务；
- **LeetCode**（`#leetcode`）：100 道题，全部用 Go 实现；
- **Go 语法**（`#syntax`）：95 张语法卡片，由工具自动识别每个参考答案用到的语法并互相链接。

用户的需求是：“题目太少、解释细节偏少、解释语法偏少”。大部分已经完成，**剩下三项工作（A、B、C）需要你来完成**。所有内容都用**简体中文**撰写，风格与已有内容保持一致。

先读 `README.md` 了解项目结构和命令。`src/data/*.json` 全部由 `go run ./tools/content` 从 `content/` 生成，**不要手改 JSON**。

## 已完成（不需要再做）

- `content/syntax/*.txt`：95 张语法卡片；`#syntax` 页面、任务下方的“用到的 Go 语法”折叠块；
- `content/explain/*.txt`：LeetCode 100 题和题库 265 个任务的讲解（格式：**思路** / **代码讲解** / **易错点** / **复杂度**或**延伸**）；
- `content/leetcode/05~09-*.txt`：新增的 50 道 LeetCode，全部校验通过；
- `content/deep/01~15-*.txt`：164 道面试题的“深入讲解”（go、conc、rt、db、web、net、arch 全部完成）。

## 内容文件格式（tools/content 解析）

一个 `.txt` 可以放多条内容，每条以 `=== <id>` 开头；接着是 `key: value` 形式的元数据；`--- <段名>` 开始一个段落，直到下一个 `--- ` 或 `=== `。

**注意**：正文（Markdown）里不能有以 `=== ` 或 `--- ` 开头的行（会被当成分隔符）；不要使用 `---` 水平分割线。

## A. 补完剩余 46 道题的“深入讲解”

缺少的题目：`perf-01` ～ `perf-28`、`code-01` ～ `code-18`。

- 写到新文件 `content/deep/16-perf-a.txt`（perf-01～14）、`content/deep/17-perf-b.txt`（perf-15～28）、`content/deep/18-code.txt`（code-01～18）；
- 每条格式：

~~~text
=== perf-01
--- deep
**原理展开**

……

**代码示例**

```go
……
```

**常见追问**

- 问题？→ 回答。
- ……

**实战建议**

- ……
~~~

- 用 `python3 .handoff/dumpq.py perf 0 14` 查看题目和**已有答案**。深入讲解是对答案的**补充**：讲清楚底层原理、给出能说明问题的 Go 代码（或命令行示例）、列出 2～3 个面试常见追问并简要回答、给出实践建议。**不要重复答案里已经写过的内容**。
- 每条大约 600～1200 字（含代码）。参考已有文件 `content/deep/06-rt.txt`、`content/deep/14-arch-a.txt` 的写法和篇幅。
- 代码示例必须是正确的 Go（可以是片段，但语法和 API 要准确）；涉及 Go 版本特性时写明版本（项目以 Go 1.24 为基准，1.25/1.26 的新特性可以提及并注明）。
- 写完运行 `go run ./tools/content`，输出里“N 道有深入讲解”应达到 210（加上 B 部分新增的题目）。

## B. 新增约 60 道面试题（含答案、深入讲解和编程任务）

### 题目文件

写到 `content/questions/*.txt`（目录需要新建，建议按领域分文件，如 `01-go.txt`、`02-conc.txt` ……）。格式：

```text
=== go-30
level: 2
hot: false
title: Go 1.23 的 range 迭代器是怎么工作的？slices、maps 包新增了哪些迭代器函数？
--- answer
面试时的回答（Markdown，要点清晰，300～800 字，可以带代码块）。
--- deep
深入讲解，格式同 A 部分。
```

- **编号接着已有的往后排**，当前最大编号：`go-29`、`conc-23`、`rt-18`、`db-31`、`web-22`、`net-21`、`arch-20`、`perf-28`、`code-18`。
- `level`：1 基础、2 进阶、3 深入；`hot: true` 表示高频题（少量即可）。
- `group`：以下领域**必须**写 `group:`，并且只能用已有的分组名，题目会被插到同组的最后：
  - `db`：`MySQL`、`Go`、`Redis`
  - `net`：`网络`、`RPC`、`长连接`、`MQ`
  - `arch`：`基础`、`治理`、`设计题`
  - `perf`：`Linux`、`Go`、`综合`
  - `code`：`找 bug`、`并发`、`数据结构`、`工程`
  - `go`、`conc`、`rt`、`web` 没有分组，不写 `group:`。
- 新增前用 `python3 .handoff/titles.py <领域>` 查看已有题目，**不要重复**已有题目的考点。
- 建议数量：go 6、conc 6、rt 6、db 8、web 7、net 7、arch 7、perf 7、code 6（共约 60 道）。可参考的方向（自行判断，避免与已有题目重复）：
  - go：range 迭代器（iter.Seq）与 slices/maps 新函数；类型别名与类型定义（含 1.24 泛型类型别名）；函数类型实现接口（http.HandlerFunc）；go.mod / go work / tool 指令；byte 与 rune 的遍历差异；常量与 iota 的高级用法。
  - conc：sync.Cond 的使用场景；semaphore.Weighted；context.AfterFunc 与 WithoutCancel；testing/synctest 测试并发代码；goroutine 池是否有必要；channel 的关闭与 select 优先级技巧。
  - rt：weak 指针与 unique 包（Go 1.24）；runtime/metrics 的关键指标；PGO 的原理与使用；GODEBUG 与兼容性设置；内存碎片与 span；goroutine 的状态与调度时机细节。
  - db：索引下推与 MRR；自增主键 vs UUID；binlog 时间点恢复；sqlc 与 ORM 的取舍；Go 中实现读写分离；Redis Stream 做消息队列；Redis 内存优化；集群扩缩容与槽迁移的影响。
  - web：Range 断点续传下载；SSE 服务端推送；OAuth2 / OIDC 登录流程；CSRF 防护；零停机发布（SO_REUSEPORT、滚动发布）；API 网关的职责；日志规范与采样。
  - net：DNS 解析过程与 Go 的解析器；HTTP 缓存（ETag / Cache-Control）；mTLS；gRPC 流控与大消息；MQ 事务消息；死信队列与重试设计；QUIC 的连接迁移。
  - arch：配置中心设计；分布式定时任务调度；ES 数据同步；计数系统设计；消息推送系统设计；全局限流系统设计；冷热数据归档。
  - perf：磁盘写满排查；DNS 解析慢；容器 OOMKilled 排查；火焰图怎么读；服务冷启动慢；网络抖动排查；日志打满 IO。
  - code：带过期时间的 map；并发统计 / MapReduce 风格的处理；简易 HTTP 反向代理；Trie 路由；优先级任务调度器；errgroup 的错误用法审查。

### 每道新题配 1～2 个编程任务

写到 `content/bank/` 下的新文件（如 `20-new-go.txt`、`21-new-conc.txt` ……），任务编号是“题目编号-序号”，如 `go-30-1`。格式参考 `content/bank/03-conc.txt`：

```text
=== go-30-1
title: 任务标题
race: true                     可选：并发任务用 go test -race 运行
starter: build-error           可选：起始代码有意编译失败（极少用）
--- desc
Markdown 题面：要实现什么函数、规则、示例。
--- solution
package main

func Foo(x int) int {
	// @solution
	参考答案代码
	// @starter
	// return 0
	// @end
}
--- test
package main

import "testing"

func TestFoo(t *testing.T) { ... }
--- explain
**思路**

……

**代码讲解**

1. ……

**易错点**

- ……
```

要点：

- `solution` 里用 `// @solution`、`// @starter`、`// @end` 标记：标记之间的参考答案只出现在答案里；`@starter` 后面每行去掉一层 `// ` 后作为起始代码。工具会自动删除起始代码中没用到的 import 并 gofmt。
- **要求**：参考答案必须通过全部测试；起始代码必须能编译，并且**不能**通过测试。
- 测试要确定、快速（`go test -timeout=10s`），不能访问外网；时间相关的逻辑通过注入 `now func() time.Time` 来测试，不要用长时间的 sleep。
- 只能使用标准库（模块是 `learngo`，`go 1.24`，没有第三方依赖）。
- 任务要贴合题目的考点，练到 Go 的语法和标准库；题面写清楚函数签名、规则和示例。
- `explain` 用 **思路** / **代码讲解**（按代码顺序逐段讲解，解释用到的 Go 语法）/ **易错点** / 可选 **延伸**，风格参考 `content/explain/bank-*.txt`。

### 校验

每写完一批就校验，只校验新内容：

```bash
go run ./tools/content -verify -only go-30,go-31
```

失败时根据输出修正答案、测试或起始代码，直到全部通过。工具还会对新题目做格式检查（缺少 title / answer、level 不合法、group 不存在等），按提示修正。

## C. 收尾

1. 全量校验和构建（全部必须通过）：

```bash
go run ./tools/content -verify   # 有缓存，没改过的题目不会重复运行
npx tsc --noEmit
pnpm build
```

2. 更新文案中写死的数量：
   - `README.md`：第 5、6 行的“210 道”“265 个”“LeetCode 50”改成新的数量和描述（LeetCode 现在是 100 道精选题），并补充 `#syntax` 页面；“目录结构”和“题目源文件格式”两节补充 `content/syntax/`、`content/explain/`、`content/deep/`、`content/questions/`，说明 `src/data/bank.json`、`syntax.json`、`syntax-usage.json` 是生成的；
   - `src/components/Markdown.tsx` 第 78 行注释里的“210 个标题”改成不写具体数字。
3. 浏览器检查：`pnpm dev`（http://localhost:5173），确认：
   - 题库页能看到新题（带“新题”标签），展开后有“深入讲解”区块，编程任务正常显示；
   - perf、code 领域的题目有“深入讲解”；
   - `#syntax` 页面正常；控制台没有报错（`/api` 的 500 是因为没有启动 Go 运行器，可以忽略；启动方式是 `go run ./runner`）。
4. 删除 `.handoff/` 目录；在本文件末尾追加“完成情况”一节，写明新增了哪些题目、校验结果。

## 不要做的事

- 不要手改 `src/data/*.json`、`questions.json`；不要运行 `pnpm extract`；
- 不要改动已有题目的编号、已有内容文件的格式和 `tools/content`、`runner`、`internal` 下的代码（除非发现 bug，并在完成情况里说明）；
- 不要引入新的 npm 或 Go 依赖；
- 不要执行 git push 等对外操作。

## 完成情况

### A. 补全原 210 道题的深入讲解（46 道）
已完成并校验通过：
- `content/deep/16-perf-a.txt`：补全 `perf-01` ～ `perf-14` 共 14 道题的深入讲解。
- `content/deep/17-perf-b.txt`：补全 `perf-15` ～ `perf-28` 共 14 道题的深入讲解。
- `content/deep/18-code.txt`：补全 `code-01` ～ `code-18` 共 18 道题的深入讲解。

### B. 新增 60 道面试题与 61 个可运行编程任务
按 9 大领域全量新增 60 道面试题（均含要点答案 `--- answer` 与深入讲解 `--- deep`）以及配套的 61 个编程任务（均含题面 `--- desc`、参考答案与起始代码 `--- solution`、单元测试 `--- test` 及解析 `--- explain`）：
1. **Go 语言基础（6 题 / 7 任务）**：`content/questions/01-go.txt`、`content/bank/20-new-go.txt`
   - `go-30`（Go 1.23 `range` 函数迭代器 `iter.Seq` / `iter.Seq2` 与 `slices`、`maps` 联动，`go-30-1`, `go-30-2`）
   - `go-31`（类型定义 `type T U` 与类型别名 `type T = U` 区别及 Go 1.24 泛型类型别名，`go-31-1`）
   - `go-32`（函数类型实现接口原理与 `http.HandlerFunc` 中间件装饰器链，`go-32-1`）
   - `go-33`（`go.mod`、`go.sum`、`go.work` 职责与 Go 1.24 `tool` 指令及主版本路径校验，`go-33-1`）
   - `go-34`（`byte` 与 `rune` 区别、下标遍历与 `for range` 遍历 UTF-8 字符串及按字符安全截断，`go-34-1`）
   - `go-35`（无类型常量 `untyped constant` 与 `iota` 位掩码权限集合运算，`go-35-1`）
2. **并发编程（6 题 / 6 任务）**：`content/questions/02-conc.txt`、`content/bank/21-new-conc.txt`
   - `conc-24`（`sync.Cond` 条件变量原理、虚假唤醒防范与支持重复广播的状态栅栏实现，`conc-24-1`）
   - `conc-25`（带权重的信号量 `semaphore.Weighted` 原理与严格 FIFO 防大任务饥饿实现，`conc-25-1`）
   - `conc-26`（Go 1.21 `context.AfterFunc` 与 `context.WithoutCancel` 原理及实战用法，`conc-26-1`）
   - `conc-27`（并发与时间依赖代码的可靠测试：虚拟时钟注入与 `testing/synctest` 气泡机制，`conc-27-1`）
   - `conc-28`（运行时 `gFree` 复用与常驻 `goroutine` 池的权衡及空闲自动缩容池实现，`conc-28-1`）
   - `conc-29`（`select` 多路就绪随机伪打乱原理与双层 `select` 高低优先级通道消费，`conc-29-1`）
3. **Runtime 与内存（6 题 / 6 任务）**：`content/questions/03-rt.txt`、`content/bank/22-new-rt.txt`
   - `rt-19`（Go 1.24 `weak.Pointer` 弱指针与 `unique` 包值驻留原理及适用场景，`rt-19-1`）
   - `rt-20`（`runtime/metrics` 零 STW 监控采集与 `runtime.ReadMemStats` 区别，`rt-20-1`）
   - `rt-21`（PGO 反馈导向优化原理：热路径函数内联与接口调用去虚拟化，`rt-21-1`）
   - `rt-22`（`GODEBUG` 环境变量与 Go 1.21+ 向后兼容及 `godebug` 行为控制策略，`rt-22-1`）
   - `rt-23`（内存分配器内部碎片与 `mspan` 页尾碎片成因及结构体字段对齐优化，`rt-23-1`）
   - `rt-24`（`goroutine` 状态机流转与 P 的 `gopark` / `goready`（含 `runnext` 槽位）调度流转模拟，`rt-24-1`）
4. **MySQL 与 Redis（8 题 / 8 任务）**：`content/questions/04-db.txt`、`content/bank/23-new-db.txt`
   - `db-32`（索引下推 ICP 与 Multi-Range Read (MRR) 减少回表与随机 I/O 原理，`db-32-1`）
   - `db-33`（InnoDB 自增整型/时间有序主键 `UUIDv7` 对比随机 UUID 的 B+ 树页分裂影响，`db-33-1`）
   - `db-34`（误删数据利用全量备份与 `ROW` 格式 `binlog` 时间点恢复 PITR 及闪回，`db-34-1`）
   - `db-35`（`database/sql`、`sqlx`、`sqlc` 与 `GORM` 选型权衡及泛型 `sql.Null[T]` 处理，`db-35-1`）
   - `db-36`（数据库读写分离实现、Context 路由标记、事务感知与从库延迟水位熔断路由，`db-36-1`）
   - `db-37`（Redis Stream 消费者组 PEL、`XACK` 与 `XAUTOCLAIM` 超时认领可靠队列实现，`db-37-1`）
   - `db-38`（Redis 内存占用优化手段与小 Hash 分桶 `listpack` 紧凑编码，`db-38-1`）
   - `db-39`（Redis Cluster 扩缩容哈希槽 Slot 迁移与支持 `MOVED` / `ASK` 重定向的客户端请求路由，`db-39-1`）
5. **Web 开发（7 题 / 7 任务）**：`content/questions/05-web.txt`、`content/bank/24-new-web.txt`
   - `web-23`（HTTP `Range` 断点续传与分片下载协议、`206 Partial Content` 及零拷贝传输，`web-23-1`）
   - `web-24`（SSE 服务端流式推送协议、`http.ResponseController` 刷新续期与 WebSocket 选型，`web-24-1`）
   - `web-25`（OAuth 2.0 授权码 + PKCE (`S256`) 流程与 OIDC 身份认证原理，`web-25-1`）
   - `web-26`（CSRF 跨站请求伪造原理与 `SameSite`、CSRF Token 及 `Sec-Fetch-Site` 无状态防护，`web-26-1`）
   - `web-27`（零停机发布：`SO_REUSEPORT` 进程热重启与 K8s 滚动更新就绪探针摘流及在途排空，`web-27-1`）
   - `web-28`（API 网关核心职责、`httputil.ReverseProxy.Rewrite` 防伪造内部头与安全提取真实 IP，`web-28-1`）
   - `web-29`（高并发日志规范、`log/slog` 零装箱设计与 `LogValuer` 脱敏及高频日志采样，`web-29-1`）
6. **网络、RPC 与消息队列（7 题 / 7 任务）**：`content/questions/06-net.txt`、`content/bank/25-new-net.txt`
   - `net-22`（DNS 完整解析过程、Go 纯 Go 解析器 `netgo` 与 `cgo` 差异及 K8s `ndots` 搜索域展开，`net-22-1`）
   - `net-23`（HTTP 强缓存与协商缓存 `ETag` / `If-None-Match` 304 及 `If-Match` 412 并发防覆盖，`net-23-1`）
   - `net-24`（mTLS 双向认证、SAN 域名白名单校验与 `GetCertificate` 零停机证书热加载，`net-24-1`）
   - `net-25`（gRPC / HTTP/2 连接级与流级两级流控窗口原理及超大消息传输问题，`net-25-1`）
   - `net-26`（分布式事务消息、本地消息表与 RocketMQ 风格两阶段事务消息 Half Message 回查协调，`net-26-1`）
   - `net-27`（消息队列消费失败的阶梯延迟重试队列与死信队列 DLQ 设计，`net-27-1`）
   - `net-28`（QUIC 协议 0-RTT 建连、流级无队头阻塞与基于 Connection ID 及 `PATH_CHALLENGE` 的连接迁移，`net-28-1`）
7. **分布式与系统设计（7 题 / 7 任务）**：`content/questions/07-arch.txt`、`content/bank/26-new-arch.txt`
   - `arch-21`（高可用配置中心设计与基于 `close(chan)` 广播的长轮询实时推送，`arch-21-1`）
   - `arch-22`（分布式定时任务调度系统、时间槽抢占幂等与分片广播执行，`arch-22-1`）
   - `arch-23`（MySQL 到 Elasticsearch Binlog 实时同步与 `external version` 乱序墓碑防御，`arch-23-1`）
   - `arch-24`（亿级并发读写计数系统与内存 Write-Behind 微批写聚合器，`arch-24-1`）
   - `arch-25`（全平台消息通知系统与站内信“写扩散 + 读扩散”混合未读数模型，`arch-25-1`）
   - `arch-26`（集群级分布式全局限流、本地批量预取 Token Batch Lease 与故障降级，`arch-26-1`）
   - `arch-27`（百亿级历史订单表冷热分离归档判定与跨冷热库无缝游标分页，`arch-27-1`）
8. **线上排查与性能优化（7 题 / 7 任务）**：`content/questions/08-perf.txt`、`content/bank/27-new-perf.txt`
   - `perf-29`（磁盘空间满 `df` vs `du` 不一致、`lsof +L1` 幽灵文件与 `Truncate(0)` 原地截断，`perf-29-1`）
   - `perf-30`（Linux `nf_conntrack` 连接跟踪表满、并发源端口冲突 `insert_failed` 与 Early-Drop 驱逐模拟，`perf-30-1`）
   - `perf-31`（容器 OOMKilled 137 内存账本拆解：PageCache、Cgo/Mmap、StackInuse 与 HeapIdle，`perf-31-1`）
   - `perf-32`（CPU/内存/差分火焰图阅读法则与 Collapsed Stacks 的 `Flat` / `Cum` 计算，`perf-32-1`）
   - `perf-33`（滚动发布冷启动毛刺、连接池/缓存预热与线性慢启动 Slow-Start 权重，`perf-33-1`）
   - `perf-34`（日志打满磁盘 I/O 阻塞业务协程排查与 `zap` 窗口采样器 `first+thereafter` 算法，`perf-34-1`）
   - `perf-35`（跨可用区调用偶发网络抖动排查与 Zone-Aware 同机房亲和路由安全水位降级，`perf-35-1`）
9. **代码题与手写组件（6 题 / 6 任务）**：`content/questions/09-code.txt`、`content/bank/28-new-code.txt`
   - `code-19`（修复并发批量拉取中的切片 `append` 数据竞争、无缓冲 `errCh` 协程泄漏，`code-19-1`）
   - `code-20`（无锁局部 Map 与 Reduce 归并的并发词频统计器，`code-20-1`）
   - `code-21`（基于最小堆 `container/heap` 与版本号影子跳过的并发安全 TTL Map，`code-21-1`）
   - `code-22`（支持静态段、`:param` 参数与 `*wildcard` 通配符回溯匹配的 HTTP Trie 路由器，`code-22-1`）
   - `code-23`（基于最大堆与 `sync.Cond` 的优先级并发任务调度器，同优先级保持 FIFO，`code-23-1`）
   - `code-24`（支持轮询负载均衡、被动连续失败熔断剔除与冷却期自动恢复的网关后端池，`code-24-1`）

### C. 校验与构建结果
- **内容生成统计**：`270 道面试题（270 道有深入讲解），326 个题库任务（326 个有讲解），100 道 LeetCode，95 张语法卡片`，0 道缺失讲解或编程任务。
- **全量测试校验（`go run ./tools/content -verify`）**：426 题全部通过（失败 0，警告 0）。
- **类型检查与前端构建（`npx tsc --noEmit && pnpm build`）**：全部零错误通过，产物已生成至 `dist/`。
- **清理与文档更新**：已更新 `README.md` 与 `src/components/Markdown.tsx` 中的数量及目录说明，并已删除 `.handoff/` 临时目录。

