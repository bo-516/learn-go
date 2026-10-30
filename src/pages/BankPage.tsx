import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import bankData from "../data/bank.json";
import taskData from "../data/tasks.json";
import type { Question, QuestionBank, TaskMap } from "../types";
import { InlineMarkdown, Markdown, markdownToText } from "../components/Markdown";
import { CodeTask } from "../components/CodeTask";
import { Chip, OfflineBanner, ProgressBar, SectionToc } from "../components/Shell";
import { IconCheck, IconChevron, IconCode, IconSearch } from "../components/Icons";
import { KEYS, useStoredSet } from "../lib/storage";
import { CopyButton } from "../components/CopyButton";
import { questionCopyText } from "../lib/copyText";
import { useDebounced, useSlashFocus, useToolbarHeight } from "../lib/hooks";

const bank = bankData as QuestionBank;
const tasks = taskData as TaskMap;
const LEVEL_NAME = { 1: "基础", 2: "进阶", 3: "深入" } as const;
const allTaskIds = Object.values(tasks).flatMap((ts) => ts.map((t) => t.id));
const categoryName = new Map(bank.categories.map((c) => [c.id, c.name]));

// 搜索索引：编号、题目、答案、深入讲解、任务标题和描述
const searchIndex = new Map(
  bank.questions.map((q) => [
    q.id,
    [q.code, q.title, q.answer, q.deep ?? "", ...(tasks[q.id] ?? []).flatMap((t) => [t.title, t.desc])]
      .map(markdownToText)
      .join(" "),
  ]),
);

type Level = "all" | 1 | 2 | 3;

export function BankPage({ hash }: { hash: string }) {
  const [text, setText] = useState("");
  const [level, setLevel] = useState<Level>("all");
  const [hot, setHot] = useState(false);
  const [hideDone, setHideDone] = useState(false);
  const [todoTasks, setTodoTasks] = useState(false);
  const [open, setOpen] = useState<Set<string>>(() => new Set());
  const mastered = useStoredSet(KEYS.mastered);
  const passed = useStoredSet(KEYS.passed);
  const query = useDebounced(text, 90);

  const searchRef = useRef<HTMLInputElement>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);
  useSlashFocus(searchRef);
  useToolbarHeight(toolbarRef);

  const counts = useMemo(() => {
    const qs = bank.questions;
    return {
      total: qs.length,
      l1: qs.filter((q) => q.level === 1).length,
      l2: qs.filter((q) => q.level === 2).length,
      l3: qs.filter((q) => q.level === 3).length,
      hot: qs.filter((q) => q.hot).length,
    };
  }, []);

  const visible = useMemo(() => {
    const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
    return bank.questions.filter((q) => {
      if (level !== "all" && q.level !== level) return false;
      if (hot && !q.hot) return false;
      if (hideDone && mastered.set.has(q.id)) return false;
      if (todoTasks) {
        const ts = tasks[q.id] ?? [];
        if (ts.length === 0 || ts.every((t) => passed.set.has(t.id))) return false;
      }
      const idx = searchIndex.get(q.id)!;
      return terms.every((t) => idx.includes(t));
    });
  }, [query, level, hot, hideDone, todoTasks, mastered.set, passed.set]);

  const visibleIds = useMemo(() => new Set(visible.map((q) => q.id)), [visible]);
  const perCat = useMemo(() => {
    const m: Record<string, number> = {};
    visible.forEach((q) => (m[q.cat] = (m[q.cat] ?? 0) + 1));
    return m;
  }, [visible]);

  const filtered = visible.length !== bank.questions.length;
  const clearAll = () => {
    setText("");
    setLevel("all");
    setHot(false);
    setHideDone(false);
    setTodoTasks(false);
  };

  const toggleOpen = useCallback((id: string, isOpen: boolean) => {
    setOpen((prev) => {
      if (prev.has(id) === isOpen) return prev;
      const next = new Set(prev);
      if (isOpen) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);

  // #go-01 这样的锚点：打开并滚动到对应题目
  useEffect(() => {
    if (!hash || !searchIndex.has(hash)) return;
    setOpen((prev) => new Set(prev).add(hash));
    requestAnimationFrame(() => document.getElementById(hash)?.scrollIntoView({ block: "start" }));
  }, [hash]);

  const masteredCount = bank.questions.filter((q) => mastered.set.has(q.id)).length;
  const passedCount = allTaskIds.filter((id) => passed.set.has(id)).length;

  return (
    <div className="page">
      <header className="masthead">
        <div>
          <p className="eyebrow">Interview · Go Backend</p>
          <h1>{bank.title}</h1>
          <p className="lede">
            {counts.total} 道题覆盖语言、并发、运行时、数据库、Web、通信、架构和性能排查。每道题配有 1～3
            个可以直接运行测试的 Go 小任务，参考答案默认折叠。
          </p>
        </div>
        <dl className="stats">
          <div>
            <dt>题目</dt>
            <dd>{counts.total}</dd>
          </div>
          <div className="s-l1">
            <dt>基础</dt>
            <dd>{counts.l1}</dd>
          </div>
          <div className="s-l2">
            <dt>进阶</dt>
            <dd>{counts.l2}</dd>
          </div>
          <div className="s-l3">
            <dt>深入</dt>
            <dd>{counts.l3}</dd>
          </div>
          <div>
            <dt>高频</dt>
            <dd>{counts.hot}</dd>
          </div>
        </dl>
        <div className="progress-stack">
          <ProgressBar label="已掌握" done={masteredCount} total={counts.total} />
          <ProgressBar label="任务通过" done={passedCount} total={allTaskIds.length} />
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
              placeholder="搜索题目、答案或任务，例如 GMP、慢查询、TIME_WAIT"
              autoComplete="off"
              spellCheck={false}
              aria-label="搜索"
            />
            <kbd>/</kbd>
          </label>
          <div className="tb-filters">
            <div className="chips" role="group" aria-label="按难度筛选">
              <Chip pressed={level === "all"} onClick={() => setLevel("all")}>
                全部
              </Chip>
              <Chip pressed={level === 1} onClick={() => setLevel(1)} className="c1" count={counts.l1}>
                基础
              </Chip>
              <Chip pressed={level === 2} onClick={() => setLevel(2)} className="c2" count={counts.l2}>
                进阶
              </Chip>
              <Chip pressed={level === 3} onClick={() => setLevel(3)} className="c3" count={counts.l3}>
                深入
              </Chip>
            </div>
            <span className="sep" aria-hidden="true" />
            <div className="chips">
              <Chip pressed={hot} onClick={() => setHot(!hot)} className="toggle">
                只看高频
              </Chip>
              <Chip pressed={hideDone} onClick={() => setHideDone(!hideDone)} className="toggle">
                隐藏已掌握
              </Chip>
              <Chip pressed={todoTasks} onClick={() => setTodoTasks(!todoTasks)} className="toggle">
                任务未完成
              </Chip>
            </div>
            <div className="tb-actions">
              <button type="button" className="btn" onClick={() => setOpen(new Set(visible.map((q) => q.id)))}>
                展开全部
              </button>
              <button type="button" className="btn" onClick={() => setOpen(new Set())}>
                折叠全部
              </button>
            </div>
          </div>
        </div>
        <p className="tb-status" aria-live="polite">
          <span>{filtered ? `显示 ${visible.length} / ${counts.total} 题` : `共 ${counts.total} 题`}</span>
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
          label="领域目录"
          title={`${bank.categories.length} 个领域`}
          prefix="sec-"
          href={(id) => `#sec-${id}`}
          items={bank.categories.map((c) => ({ id: c.id, code: c.code, name: c.name, count: perCat[c.id] ?? 0 }))}
          note={
            <>
              按 <kbd>/</kbd> 搜索。点击题目右侧的圆形按钮标记已掌握；在编辑器里按 <kbd>⌘/Ctrl</kbd> + <kbd>Enter</kbd>{" "}
              运行测试。进度只保存在当前浏览器。
            </>
          }
        />

        <main>
          {bank.categories.map((c) => {
            const qs = bank.questions.filter((q) => q.cat === c.id);
            const shown = qs.filter((q) => visibleIds.has(q.id));
            if (shown.length === 0) return null;
            const groups = groupBy(qs);
            const l = (n: number) => qs.filter((q) => q.level === n).length;
            const catTasks = qs.reduce((n, q) => n + (tasks[q.id]?.length ?? 0), 0);
            return (
              <section key={c.id} className="cat" id={`sec-${c.id}`} data-sec={c.id}>
                <header className="cat-head">
                  <span className="cat-code">{c.code}</span>
                  <h2>{c.name}</h2>
                  <p className="cat-desc">{c.desc}</p>
                  <p className="cat-meta">
                    {qs.length} 题 · 基础 {l(1)} · 进阶 {l(2)} · 深入 {l(3)} · 编程任务 {catTasks}
                  </p>
                </header>
                {groups.map(([group, items]) => {
                  const vis = items.filter((q) => visibleIds.has(q.id));
                  if (vis.length === 0) return null;
                  return (
                    <div className="group" key={group ?? "_"}>
                      {group && (
                        <h3 className="group-title">
                          {group}
                          <span className="group-count">{items.length} 题</span>
                        </h3>
                      )}
                      {vis.map((q) => (
                        <QuestionItem
                          key={q.id}
                          q={q}
                          isOpen={open.has(q.id)}
                          onToggle={toggleOpen}
                          done={mastered.set.has(q.id)}
                          onMark={mastered.toggle}
                          passed={passed.set}
                          onPassed={passed.add}
                        />
                      ))}
                    </div>
                  );
                })}
              </section>
            );
          })}
          {visible.length === 0 && (
            <div className="empty">
              <b>没有符合条件的题目</b>
              换个关键词，或者放宽难度和高频筛选。
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
        {bank.footer}
        <br />
        编程任务在本机通过 <code>go test</code> 校验，模块的 go 指令版本为 1.24。
      </footer>
    </div>
  );
}

function groupBy(qs: Question[]): [string | null, Question[]][] {
  const out: [string | null, Question[]][] = [];
  for (const q of qs) {
    const last = out[out.length - 1];
    if (last && last[0] === q.group) last[1].push(q);
    else out.push([q.group, [q]]);
  }
  return out;
}

const QuestionItem = memo(function QuestionItem({
  q,
  isOpen,
  onToggle,
  done,
  onMark,
  passed,
  onPassed,
}: {
  q: Question;
  isOpen: boolean;
  onToggle: (id: string, open: boolean) => void;
  done: boolean;
  onMark: (id: string) => void;
  passed: Set<string>;
  onPassed: (id: string) => void;
}) {
  const ts = tasks[q.id] ?? [];
  const passedHere = ts.filter((t) => passed.has(t.id)).length;
  const markLabel = done ? "取消已掌握" : "标记为已掌握";
  return (
    <details
      className={"q" + (done ? " done" : "")}
      id={q.id}
      open={isOpen}
      onToggle={(e) => onToggle(q.id, e.currentTarget.open)}
    >
      <summary>
        <span className="qid">{q.code}</span>
        <span className={`lv lv${q.level}`}>{LEVEL_NAME[q.level]}</span>
        <span className="qt">
          <InlineMarkdown text={q.title} />
        </span>
        {/* 标签和操作按钮分开：窄屏上标签可以换行，按钮始终留在行尾 */}
        <span className="qtags">
          {q.new && (
            <span className="new-tag" title="新增的题目，不在原题库里">
              新题
            </span>
          )}
          {q.hot && <span className="hot">高频</span>}
          {ts.length > 0 && (
            <span
              className={"task-badge" + (passedHere === ts.length ? " all" : "")}
              title={`编程任务：已通过 ${passedHere} / ${ts.length}`}
            >
              <IconCode />
              {passedHere}/{ts.length}
            </span>
          )}
        </span>
        <span className="qside">
          <CopyButton
            compact
            title="复制题目和例子，方便发给 AI 讨论"
            text={() => questionCopyText(q, categoryName.get(q.cat) ?? q.cat)}
          />
          <button
            type="button"
            className="mark"
            aria-pressed={done}
            title={markLabel}
            aria-label={markLabel}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onMark(q.id);
            }}
          >
            <IconCheck />
          </button>
          <IconChevron />
        </span>
      </summary>
      {isOpen && (
        <div className="q-body">
          <Markdown text={q.answer} className="md ans" />
          {q.deep && (
            <section className="deep" aria-label="深入讲解">
              <h3 className="deep-title">深入讲解</h3>
              <Markdown text={q.deep} className="md ans" />
            </section>
          )}
          {ts.length > 0 && (
            <section className="tasks" aria-label="编程小任务">
              <h3 className="tasks-title">
                编程小任务
                <span>
                  已通过 {passedHere} / {ts.length}
                </span>
              </h3>
              {ts.map((t, i) => (
                <CodeTask
                  key={t.id}
                  task={t}
                  label={`任务 ${i + 1}`}
                  passed={passed.has(t.id)}
                  onPassed={onPassed}
                  copyContext={{ heading: `${q.code} 任务 ${i + 1}`, question: q.title }}
                />
              ))}
            </section>
          )}
        </div>
      )}
    </details>
  );
});
