import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import lcData from "../data/leetcode.json";
import type { LeetCodeProblem } from "../types";
import { Markdown, markdownToText } from "../components/Markdown";
import { CodeTask } from "../components/CodeTask";
import { Chip, OfflineBanner, ProgressBar, SectionToc } from "../components/Shell";
import { IconCheck, IconChevron, IconExternal, IconSearch } from "../components/Icons";
import { KEYS, useStoredSet } from "../lib/storage";
import { CopyButton } from "../components/CopyButton";
import { problemCopyText } from "../lib/copyText";
import { useDebounced, useSlashFocus, useToolbarHeight } from "../lib/hooks";

const problems = (lcData as { problems: LeetCodeProblem[] }).problems;

// 分类顺序大致按「先熟悉 Go 基础，再练常见题型」排列；没列出的分类排在最后
const CATEGORY_CODE: Record<string, string> = {
  数组与切片: "ARR",
  字符串: "STR",
  双指针与滑动窗口: "WIN",
  哈希表与前缀和: "HASH",
  数学与位运算: "MATH",
  链表: "LIST",
  栈与单调栈: "STK",
  二分查找: "BIN",
  二叉树: "TREE",
  图与搜索: "GRAPH",
  回溯: "BT",
  动态规划: "DP",
  贪心与区间: "GRDY",
  "堆与 Top K": "HEAP",
  "栈、队列与设计": "DSGN",
  并发: "CONC",
};
const CATEGORY_ORDER = Object.keys(CATEGORY_CODE);
const categories = [...new Set(problems.map((p) => p.category))].sort(
  (a, b) => (CATEGORY_ORDER.indexOf(a) + 1 || 99) - (CATEGORY_ORDER.indexOf(b) + 1 || 99),
);
const easyCount = problems.filter((p) => p.difficulty === "简单").length;

// Go 知识点按出现次数排序，作为筛选项
const goPointCounts = new Map<string, number>();
problems.forEach((p) => p.goPoints.forEach((g) => goPointCounts.set(g, (goPointCounts.get(g) ?? 0) + 1)));
const goPoints = [...goPointCounts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "zh"));

const searchIndex = new Map(
  problems.map((p) => [
    p.id,
    [String(p.no), p.title, p.slug, p.desc, ...p.topics, ...p.goPoints].map(markdownToText).join(" "),
  ]),
);

export function LeetCodePage({ hash }: { hash: string }) {
  const [text, setText] = useState("");
  const [cat, setCat] = useState<string>("all");
  const [point, setPoint] = useState<string>("");
  const [hidePassed, setHidePassed] = useState(false);
  const [open, setOpen] = useState<Set<string>>(() => new Set());
  const passed = useStoredSet(KEYS.lcPassed);
  const query = useDebounced(text, 90);

  const searchRef = useRef<HTMLInputElement>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);
  useSlashFocus(searchRef);
  useToolbarHeight(toolbarRef);

  const visible = useMemo(() => {
    const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
    return problems.filter((p) => {
      if (cat !== "all" && p.category !== cat) return false;
      if (point && !p.goPoints.includes(point)) return false;
      if (hidePassed && passed.set.has(p.id)) return false;
      const idx = searchIndex.get(p.id)!;
      return terms.every((t) => idx.includes(t));
    });
  }, [query, cat, point, hidePassed, passed.set]);

  const perCat = useMemo(() => {
    const m: Record<string, number> = {};
    visible.forEach((p) => (m[p.category] = (m[p.category] ?? 0) + 1));
    return m;
  }, [visible]);

  const toggleOpen = useCallback((id: string, isOpen: boolean) => {
    setOpen((prev) => {
      if (prev.has(id) === isOpen) return prev;
      const next = new Set(prev);
      if (isOpen) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);

  // #leetcode/lc-1 打开对应题目
  useEffect(() => {
    const id = hash.split("/")[1];
    if (!id || !searchIndex.has(id)) return;
    setOpen((prev) => new Set(prev).add(id));
    requestAnimationFrame(() => document.getElementById(id)?.scrollIntoView({ block: "start" }));
  }, [hash]);

  const filtered = visible.length !== problems.length;
  const clearAll = () => {
    setText("");
    setCat("all");
    setPoint("");
    setHidePassed(false);
  };
  const passedCount = problems.filter((p) => passed.set.has(p.id)).length;

  return (
    <div className="page">
      <header className="masthead">
        <div>
          <p className="eyebrow">LeetCode · Go</p>
          <h1>LeetCode {problems.length} 道精选题</h1>
          <p className="lede">
            {problems.length} 道题全部用 Go 实现（简单 {easyCount} 道，中等 {problems.length - easyCount}{" "}
            道），从数组、字符串这些练 Go 基础的题开始，逐步覆盖双指针、哈希、栈、二分、树、图、回溯、动态规划等常见题型。
            每道题都有思路和逐段代码讲解，参考答案下方列出用到的 Go 语法。写完直接运行测试，答案默认折叠。
          </p>
        </div>
        <dl className="stats stats-lc">
          <div>
            <dt>题目</dt>
            <dd>{problems.length}</dd>
          </div>
          <div>
            <dt>分类</dt>
            <dd>{categories.length}</dd>
          </div>
          <div>
            <dt>Go 知识点</dt>
            <dd>{goPoints.length}</dd>
          </div>
        </dl>
        <div className="progress-stack">
          <ProgressBar label="已通过" done={passedCount} total={problems.length} />
        </div>
      </header>

      <div className="toolbar" ref={toolbarRef}>
        <div className="tb-row">
          <label className="search">
            <IconSearch />
            <input
              ref={searchRef}
              type="search"
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  setText("");
                  e.currentTarget.blur();
                }
              }}
              placeholder="搜索题号、题名或知识点，例如 1、回文、双指针、map"
              autoComplete="off"
              spellCheck={false}
              aria-label="搜索"
            />
            <kbd>/</kbd>
          </label>
          <div className="tb-filters">
            <div className="chips" role="group" aria-label="按分类筛选">
              <Chip pressed={cat === "all"} onClick={() => setCat("all")}>
                全部
              </Chip>
              {categories.map((c) => (
                <Chip
                  key={c}
                  pressed={cat === c}
                  onClick={() => setCat(c)}
                  count={problems.filter((p) => p.category === c).length}
                >
                  {c}
                </Chip>
              ))}
            </div>
          </div>
        </div>
        <div className="tb-row tb-row-2">
          <label className="select">
            <span>Go 知识点</span>
            <select value={point} onChange={(e) => setPoint(e.target.value)}>
              <option value="">全部</option>
              {goPoints.map(([g, n]) => (
                <option key={g} value={g}>
                  {g}（{n}）
                </option>
              ))}
            </select>
          </label>
          <Chip pressed={hidePassed} onClick={() => setHidePassed(!hidePassed)} className="toggle">
            隐藏已通过
          </Chip>
          <div className="tb-actions">
            <button type="button" className="btn" onClick={() => setOpen(new Set(visible.map((p) => p.id)))}>
              展开全部
            </button>
            <button type="button" className="btn" onClick={() => setOpen(new Set())}>
              折叠全部
            </button>
          </div>
        </div>
        <p className="tb-status" aria-live="polite">
          <span>{filtered ? `显示 ${visible.length} / ${problems.length} 题` : `共 ${problems.length} 题`}</span>
          {filtered && (
            <button type="button" className="link" onClick={clearAll}>
              清除筛选
            </button>
          )}
        </p>
      </div>

      <OfflineBanner />

      <div className="layout">
        <SectionToc
          label="分类目录"
          title={`${categories.length} 个分类`}
          prefix="lc-sec-"
          href={(id) => `#leetcode/sec-${id}`}
          items={categories.map((c, i) => ({ id: String(i), code: CATEGORY_CODE[c] ?? "LC", name: c, count: perCat[c] ?? 0 }))}
          note="题面是意译的简化版，点击题目里的「力扣原题」可以查看完整描述。函数签名与力扣保持一致，写好的代码可以直接提交。"
        />

        <main>
          {categories.map((c, i) => {
            const ps = visible.filter((p) => p.category === c);
            if (ps.length === 0) return null;
            return (
              <section key={c} className="cat" id={`lc-sec-${i}`} data-sec={String(i)}>
                <header className="cat-head">
                  <span className="cat-code">{CATEGORY_CODE[c] ?? "LC"}</span>
                  <h2>{c}</h2>
                  <p className="cat-meta">{problems.filter((p) => p.category === c).length} 题</p>
                </header>
                <div className="group">
                  {ps.map((p) => (
                    <ProblemItem
                      key={p.id}
                      p={p}
                      isOpen={open.has(p.id)}
                      onToggle={toggleOpen}
                      passed={passed.set.has(p.id)}
                      onPassed={passed.add}
                      onPickPoint={setPoint}
                    />
                  ))}
                </div>
              </section>
            );
          })}
          {visible.length === 0 && (
            <div className="empty">
              <b>没有符合条件的题目</b>
              换个关键词，或者放宽筛选条件。
              <div>
                <button type="button" className="btn" onClick={clearAll}>
                  清除全部筛选
                </button>
              </div>
            </div>
          )}
        </main>
      </div>

      <footer className="foot">
        题目来自力扣（leetcode.cn）题库，题面为意译。测试在本机通过 <code>go test</code> 运行。
      </footer>
    </div>
  );
}

const ProblemItem = memo(function ProblemItem({
  p,
  isOpen,
  onToggle,
  passed,
  onPassed,
  onPickPoint,
}: {
  p: LeetCodeProblem;
  isOpen: boolean;
  onToggle: (id: string, open: boolean) => void;
  passed: boolean;
  onPassed: (id: string) => void;
  onPickPoint: (g: string) => void;
}) {
  return (
    <details
      className={"q lc" + (passed ? " done" : "")}
      id={p.id}
      open={isOpen}
      onToggle={(e) => onToggle(p.id, e.currentTarget.open)}
    >
      <summary>
        <span className="qid">#{p.no}</span>
        <span className={"lv " + (p.difficulty === "简单" ? "lv1" : "lv2")}>{p.difficulty}</span>
        <span className="qt">
          {p.title}
          <span className="topics">
            {p.topics.map((t) => (
              <span key={t}>{t}</span>
            ))}
          </span>
        </span>
        <span className="qside">
          <CopyButton compact title="复制题目、示例和代码，方便发给 AI 讨论" text={() => problemCopyText(p)} />
          {passed && (
            <span className="task-badge all" title="已通过测试">
              <IconCheck />
              已通过
            </span>
          )}
          <IconChevron />
        </span>
      </summary>
      {isOpen && (
        <div className="q-body">
          <div className="lc-meta">
            <div className="go-points">
              <span className="go-points-label">Go 知识点</span>
              {p.goPoints.map((g) => (
                <button type="button" key={g} className="go-point" onClick={() => onPickPoint(g)} title="按这个知识点筛选">
                  {g}
                </button>
              ))}
            </div>
            <a className="lc-link" href={`https://leetcode.cn/problems/${p.slug}/`} target="_blank" rel="noreferrer">
              力扣原题 <IconExternal />
            </a>
          </div>
          <Markdown text={p.desc} className="md ans lc-desc" />
          <section className="tasks">
            <CodeTask task={p} passed={passed} onPassed={onPassed} showDesc={false} />
          </section>
        </div>
      )}
    </details>
  );
});
