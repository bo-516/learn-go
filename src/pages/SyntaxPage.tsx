import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import syntaxData from "../data/syntax.json";
import usageData from "../data/syntax-usage.json";
import type { SyntaxCard, SyntaxUsage } from "../types";
import { Markdown, markdownToText } from "../components/Markdown";
import { SectionToc } from "../components/Shell";
import { IconChevron, IconCode, IconSearch } from "../components/Icons";
import { SYNTAX_GROUP_CODE } from "../lib/syntax";
import { useDebounced, useSlashFocus, useToolbarHeight } from "../lib/hooks";

const cards = (syntaxData as { items: SyntaxCard[] }).items;
const { refs, usage } = usageData as unknown as SyntaxUsage;
const groups = [...new Set(cards.map((c) => c.group))];
const practiceCount = Object.keys(refs).length;

const searchIndex = new Map(cards.map((c) => [c.id, [c.id, c.name, c.group, c.body].map(markdownToText).join(" ")]));

export function SyntaxPage({ hash }: { hash: string }) {
  const [text, setText] = useState("");
  const [open, setOpen] = useState<Set<string>>(() => new Set());
  const query = useDebounced(text, 90);

  const searchRef = useRef<HTMLInputElement>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);
  useSlashFocus(searchRef);
  useToolbarHeight(toolbarRef);

  const visible = useMemo(() => {
    const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
    return cards.filter((c) => terms.every((t) => searchIndex.get(c.id)!.includes(t)));
  }, [query]);

  const perGroup = useMemo(() => {
    const m: Record<string, number> = {};
    visible.forEach((c) => (m[c.group] = (m[c.group] ?? 0) + 1));
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

  // #syntax/defer 打开对应语法点
  useEffect(() => {
    const id = hash.split("/")[1];
    if (!id || !searchIndex.has(id)) return;
    setText("");
    setOpen((prev) => new Set(prev).add(id));
    requestAnimationFrame(() => document.getElementById("syntax-" + id)?.scrollIntoView({ block: "start" }));
  }, [hash]);

  const filtered = visible.length !== cards.length;

  return (
    <div className="page">
      <header className="masthead">
        <div>
          <p className="eyebrow">Go · Syntax</p>
          <h1>Go 语法手册</h1>
          <p className="lede">
            题库和 LeetCode 参考答案里用到的 {cards.length} 个语法点，按主题分成 {groups.length}{" "}
            组。每个语法点都有讲解、写法、小例子和易错点，并列出用到它的练习，看完可以直接去练。
          </p>
        </div>
        <dl className="stats stats-lc">
          <div>
            <dt>语法点</dt>
            <dd>{cards.length}</dd>
          </div>
          <div>
            <dt>分组</dt>
            <dd>{groups.length}</dd>
          </div>
          <div>
            <dt>关联练习</dt>
            <dd>{practiceCount}</dd>
          </div>
        </dl>
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
              placeholder="搜索语法，例如 defer、闭包、切片扩容、select"
              autoComplete="off"
              spellCheck={false}
              aria-label="搜索"
            />
            <kbd>/</kbd>
          </label>
          <div className="tb-filters">
            <div className="tb-actions">
              <button type="button" className="btn" onClick={() => setOpen(new Set(visible.map((c) => c.id)))}>
                展开全部
              </button>
              <button type="button" className="btn" onClick={() => setOpen(new Set())}>
                折叠全部
              </button>
            </div>
          </div>
        </div>
        <p className="tb-status" aria-live="polite">
          <span>{filtered ? `显示 ${visible.length} / ${cards.length} 个语法点` : `共 ${cards.length} 个语法点`}</span>
          {filtered && (
            <button type="button" className="link" onClick={() => setText("")}>
              清除搜索
            </button>
          )}
        </p>
      </div>

      <div className="layout">
        <SectionToc
          label="语法分组"
          title={`${groups.length} 个分组`}
          prefix="syntax-sec-"
          href={(id) => `#syntax/sec-${id}`}
          items={groups.map((g, i) => ({ id: String(i), code: SYNTAX_GROUP_CODE[g] ?? "GO", name: g, count: perGroup[g] ?? 0 }))}
          note="练习的参考答案下方有「用到的 Go 语法」，会链接到这里；这里每个语法点也列出了用到它的练习。"
        />

        <main>
          {groups.map((g, i) => {
            const cs = visible.filter((c) => c.group === g);
            if (cs.length === 0) return null;
            return (
              <section key={g} className="cat" id={`syntax-sec-${i}`} data-sec={String(i)}>
                <header className="cat-head">
                  <span className="cat-code">{SYNTAX_GROUP_CODE[g] ?? "GO"}</span>
                  <h2>{g}</h2>
                  <p className="cat-meta">{cards.filter((c) => c.group === g).length} 个语法点</p>
                </header>
                <div className="group">
                  {cs.map((c) => (
                    <SyntaxItem key={c.id} card={c} isOpen={open.has(c.id)} onToggle={toggleOpen} />
                  ))}
                </div>
              </section>
            );
          })}
          {visible.length === 0 && (
            <div className="empty">
              <b>没有找到相关的语法点</b>
              换个关键词试试，比如英文关键字 <code>range</code>、<code>chan</code>。
              <div>
                <button type="button" className="btn" onClick={() => setText("")}>
                  清除搜索
                </button>
              </div>
            </div>
          )}
        </main>
      </div>

      <footer className="foot">语法点由工具分析参考答案的语法树和类型信息自动识别，讲解卡片手写。</footer>
    </div>
  );
}

const SyntaxItem = memo(function SyntaxItem({
  card,
  isOpen,
  onToggle,
}: {
  card: SyntaxCard;
  isOpen: boolean;
  onToggle: (id: string, open: boolean) => void;
}) {
  const used = usage[card.id] ?? [];
  return (
    <details
      className="q syntax-item"
      id={"syntax-" + card.id}
      open={isOpen}
      onToggle={(e) => onToggle(card.id, e.currentTarget.open)}
    >
      <summary>
        <span className="qt">{card.name}</span>
        <span className="qside">
          {used.length > 0 && (
            <span className="task-badge" title={`${used.length} 个练习的参考答案用到了它`}>
              <IconCode />
              {used.length}
            </span>
          )}
          <IconChevron />
        </span>
      </summary>
      {isOpen && (
        <div className="q-body">
          <Markdown text={card.body} className="md ans syntax-body" />
          {used.length > 0 && <UsedBy ids={used} />}
        </div>
      )}
    </details>
  );
});

const PREVIEW = 8;

function UsedBy({ ids }: { ids: string[] }) {
  const [all, setAll] = useState(false);
  const bank = ids.filter((id) => !id.startsWith("lc-"));
  const lc = ids.filter((id) => id.startsWith("lc-"));
  const list = (title: string, xs: string[]) =>
    xs.length > 0 && (
      <div className="used-col">
        <h4>
          {title}
          <span>{xs.length}</span>
        </h4>
        <ul>
          {(all ? xs : xs.slice(0, PREVIEW)).map((id) => {
            const [label, href] = refs[id];
            return (
              <li key={id}>
                <a href={href}>{label}</a>
              </li>
            );
          })}
        </ul>
      </div>
    );
  const more = bank.length > PREVIEW || lc.length > PREVIEW;
  return (
    <section className="used-by" aria-label="用到它的练习">
      <h3 className="tasks-title">
        用到它的练习
        <span>{ids.length} 个</span>
      </h3>
      <div className="used-cols">
        {list("面试题库", bank)}
        {list("LeetCode", lc)}
      </div>
      {more && (
        <button type="button" className="link" onClick={() => setAll(!all)}>
          {all ? "收起" : `显示全部 ${ids.length} 个`}
        </button>
      )}
    </section>
  );
}
