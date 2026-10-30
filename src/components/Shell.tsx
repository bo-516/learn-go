import { useRef, useState } from "react";
import { recheckRunner, REPO_URL, useRunnerStatus } from "../lib/runner";
import { useActiveSection, useScrolledPast } from "../lib/hooks";
import { cycleTheme, useTheme } from "../lib/theme";
import { KEYS, readString, writeString } from "../lib/storage";
import { IconArrowUp, IconAuto, IconClose, IconCode, IconList, IconMoon, IconSun } from "./Icons";

export type PageId = "bank" | "leetcode" | "syntax";

export function TopNav({ page }: { page: PageId }) {
  return (
    <header className="topnav">
      <div className="topnav-inner">
        <a className="brand" href="#">
          <span className="brand-mark" aria-hidden="true">
            Go
          </span>
          学习手册
        </a>
        <nav className="tabs" aria-label="页面">
          <a href="#" aria-current={page === "bank" ? "page" : undefined}>
            面试题库
          </a>
          <a href="#leetcode" aria-current={page === "leetcode" ? "page" : undefined}>
            LeetCode
          </a>
          <a href="#syntax" aria-current={page === "syntax" ? "page" : undefined}>
            Go 语法
          </a>
        </nav>
        <div className="nav-side">
          <RunnerBadge />
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}

const THEME_LABEL = { auto: "跟随系统", light: "浅色", dark: "深色" } as const;

function ThemeToggle() {
  const { pref } = useTheme();
  const label = `配色：${THEME_LABEL[pref]}（点击切换）`;
  return (
    <button type="button" className="icon-btn" title={label} aria-label={label} onClick={cycleTheme}>
      {pref === "light" ? <IconSun /> : pref === "dark" ? <IconMoon /> : <IconAuto />}
    </button>
  );
}

function RunnerBadge() {
  const s = useRunnerStatus();
  if (s.state === "hosted") {
    return (
      <a
        className="runner-badge rb-hosted"
        href={REPO_URL}
        target="_blank"
        rel="noreferrer"
        title="在线版不能运行测试：克隆仓库后在本地执行 go run ./runner"
      >
        <IconCode />
        <span>在线阅读版</span>
      </a>
    );
  }
  const label =
    s.state === "online" ? `运行器在线 · ${s.go}` : s.state === "offline" ? "运行器未启动" : "正在检查运行器…";
  const title =
    s.state === "offline"
      ? "在项目根目录执行 go run ./runner 启动本地运行器，才能在页面里运行测试"
      : "代码会提交给本机的 go run ./runner 执行 go test";
  return (
    <button type="button" className={`runner-badge rb-${s.state}`} title={title} onClick={recheckRunner}>
      <i aria-hidden="true" />
      <span>{label}</span>
    </button>
  );
}

export function OfflineBanner() {
  const s = useRunnerStatus();
  const [dismissed, setDismissed] = useState(() => readString(KEYS.hostedNote) === "1");
  if (s.state === "hosted") {
    if (dismissed) return null;
    return (
      <div className="offline-banner is-info" role="note">
        <span>
          <b>在线阅读版</b>：题目、答案、讲解和语法卡片都能看，改过的代码会保存在浏览器里。运行测试需要把
          <a href={REPO_URL} target="_blank" rel="noreferrer">
            仓库
          </a>
          克隆到本地，执行 <code>go run ./runner</code>。
        </span>
        <button
          type="button"
          className="banner-close"
          aria-label="不再显示"
          title="不再显示"
          onClick={() => {
            writeString(KEYS.hostedNote, "1");
            setDismissed(true);
          }}
        >
          <IconClose />
        </button>
      </div>
    );
  }
  if (s.state !== "offline") return null;
  return (
    <div className="offline-banner" role="note">
      <b>本地 Go 运行器未启动</b>，编程任务暂时不能运行。在项目根目录执行
      <code>go run ./runner</code>
      ，页面会自动重新连接。
    </div>
  );
}

export function Chip({
  pressed,
  onClick,
  className = "",
  children,
  count,
}: {
  pressed: boolean;
  onClick: () => void;
  className?: string;
  children: React.ReactNode;
  count?: number;
}) {
  return (
    <button type="button" className={"chip " + className} aria-pressed={pressed} onClick={onClick}>
      {children}
      {count != null && <span>{count}</span>}
    </button>
  );
}

export function ProgressBar({ label, done, total }: { label: string; done: number; total: number }) {
  return (
    <div className="progress">
      {label} <b>{done}</b> / {total}
      <div className="bar">
        <i style={{ width: total ? `${(done / total) * 100}%` : 0 }} />
      </div>
    </div>
  );
}

export interface TocItem {
  id: string; // 对应分区元素的 id 为 prefix + id
  code: string;
  name: string;
  count: number;
}

/**
 * 左侧目录。当前分区的高亮状态放在这个组件内部：滚动跨过分区边界时，
 * 只有目录重新渲染，不会牵动整个题目列表。
 * 窄屏上目录是一条横向滚动条，滚出屏幕后右下角出现悬浮按钮，点开是底部弹出的目录面板。
 */
export function SectionToc({
  label,
  title,
  items,
  prefix,
  href,
  note,
}: {
  label: string;
  title: string;
  items: TocItem[];
  prefix: string;
  href: (id: string) => string;
  note: React.ReactNode;
}) {
  const active = useActiveSection(
    items.map((it) => it.id),
    prefix,
  );
  const navRef = useRef<HTMLElement>(null);
  const sheetRef = useRef<HTMLDialogElement>(null);
  const past = useScrolledPast(navRef);
  const current = items.find((it) => it.id === active);
  const jump = (id: string) => document.getElementById(prefix + id)?.scrollIntoView({ block: "start" });

  return (
    <>
      <nav className="toc" aria-label={label} ref={navRef}>
        <p className="toc-title">{title}</p>
        {items.map((it) => (
          <a
            key={it.id}
            className={"toc-link" + (it.count ? "" : " is-empty")}
            href={href(it.id)}
            onClick={(e) => {
              e.preventDefault();
              jump(it.id);
            }}
            aria-current={active === it.id ? "true" : undefined}
          >
            <span className="toc-code">{it.code}</span>
            <span className="toc-name">{it.name}</span>
            <span className="toc-count">{it.count}</span>
          </a>
        ))}
        <p className="toc-note">{note}</p>
      </nav>

      <button
        type="button"
        className="toc-fab"
        hidden={!past}
        aria-haspopup="dialog"
        onClick={() => sheetRef.current?.showModal()}
      >
        <IconList />
        <span>{current ? current.name : "目录"}</span>
      </button>
      <dialog
        ref={sheetRef}
        className="toc-sheet"
        aria-label={label}
        // 点到面板外的遮罩时关闭（遮罩上的点击落在 dialog 元素本身）
        onClick={(e) => e.target === e.currentTarget && e.currentTarget.close()}
      >
        <div className="sheet-head">
          <b>{title}</b>
          <button
            type="button"
            className="btn"
            onClick={() => {
              sheetRef.current?.close();
              window.scrollTo({ top: 0 });
            }}
          >
            <IconArrowUp /> 回到顶部
          </button>
        </div>
        <div className="sheet-list">
          {items.map((it) => (
            <button
              type="button"
              key={it.id}
              className={"toc-link" + (it.count ? "" : " is-empty")}
              aria-current={active === it.id ? "true" : undefined}
              disabled={!it.count}
              onClick={() => {
                sheetRef.current?.close();
                jump(it.id);
              }}
            >
              <span className="toc-code">{it.code}</span>
              <span className="toc-name">{it.name}</span>
              <span className="toc-count">{it.count}</span>
            </button>
          ))}
        </div>
      </dialog>
    </>
  );
}
