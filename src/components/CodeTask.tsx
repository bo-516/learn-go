import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CodeTaskData, RunResult } from "../types";
import { CodeBlock, highlight, Markdown } from "./Markdown";
import { KEYS, readString, writeString } from "../lib/storage";
import { recheckRunner, REPO_URL, RunnerOfflineError, runGoTest, useRunnerStatus } from "../lib/runner";
import { IconCheck, IconPlay, IconReset } from "./Icons";
import { CopyButton } from "./CopyButton";
import { taskCopyText, type TaskCopyContext } from "../lib/copyText";
import { Fold } from "./Fold";
import { SyntaxFold } from "./SyntaxFold";

const loadEditor = () => import("./CodeEditor");
const CodeEditor = lazy(() => loadEditor().then((m) => ({ default: m.CodeEditor })));

const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);

export function CodeTask({
  task,
  label,
  passed,
  onPassed,
  showDesc = true,
  copyContext,
}: {
  task: CodeTaskData;
  label?: string;
  passed: boolean;
  onPassed: (id: string) => void;
  showDesc?: boolean;
  /** 提供时在任务标题右侧显示复制按钮 */
  copyContext?: TaskCopyContext;
}) {
  const storageKey = KEYS.code(task.id);
  const [code, setCode] = useState(() => readString(storageKey) ?? task.starter);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<RunResult | null>(null);
  const [error, setError] = useState<{ offline: boolean; message: string } | null>(null);
  // 编辑器只在用户点击或用 Tab 聚焦代码区时才创建：
  // 滚动经过时不做任何重活，展示的是一份尺寸相同的静态高亮代码。
  const [editing, setEditing] = useState(false);
  const clickPos = useRef<number | null>(null);
  const saveTimer = useRef<number>();

  const onChange = useCallback(
    (v: string) => {
      setCode(v);
      window.clearTimeout(saveTimer.current);
      saveTimer.current = window.setTimeout(() => writeString(storageKey, v === task.starter ? null : v), 300);
    },
    [storageKey, task.starter],
  );
  useEffect(() => () => window.clearTimeout(saveTimer.current), []);

  const codeRef = useRef(code);
  codeRef.current = code;

  const run = useCallback(async () => {
    if (running) return;
    setRunning(true);
    setError(null);
    try {
      const res = await runGoTest(codeRef.current, task.test, !!task.race);
      setResult(res);
      if (res.passed) onPassed(task.id);
    } catch (e) {
      setResult(null);
      if (e instanceof RunnerOfflineError) {
        setError({ offline: true, message: e.message });
        recheckRunner();
      } else {
        setError({ offline: false, message: (e as Error).message });
      }
    } finally {
      setRunning(false);
    }
  }, [running, task, onPassed]);

  const reset = () => {
    if (code !== task.starter && !window.confirm("恢复成起始代码？你写的代码会被清空。")) return;
    setCode(task.starter);
    writeString(storageKey, null);
    setResult(null);
    setError(null);
  };

  const fillSolution = () => {
    if (code !== task.starter && code !== task.solution && !window.confirm("用参考答案替换编辑器里的代码？")) return;
    onChange(task.solution);
  };

  return (
    <div className={"task" + (passed ? " is-passed" : "")}>
      {(label || showDesc) && (
        <div className="task-head">
          {label && <span className="task-no">{label}</span>}
          <h4 className="task-title">{task.title}</h4>
          {task.race && (
            <span className="tag" title="测试会以 go test -race 运行，检测数据竞争">
              -race
            </span>
          )}
          <div className="task-head-side">
            {passed && (
              <span className="task-pass">
                <IconCheck /> 已通过
              </span>
            )}
            {copyContext && (
              <CopyButton
                title="复制这道练习（题面、代码和测试），方便发给 AI 讨论"
                text={() => taskCopyText(task, codeRef.current, copyContext)}
              />
            )}
          </div>
        </div>
      )}
      {showDesc && <Markdown text={task.desc} className="md task-desc" />}

      <div className="editor">
        {editing ? (
          <Suspense fallback={<StaticCode code={code} />}>
            <CodeEditor
              value={code}
              onChange={onChange}
              onRun={run}
              ariaLabel={`${task.title} 代码编辑器`}
              initialPos={clickPos.current}
            />
          </Suspense>
        ) : (
          <StaticCode
            code={code}
            label={`${task.title} 代码编辑器，按回车开始编辑`}
            onActivate={(pos) => {
              clickPos.current = pos;
              setEditing(true);
            }}
          />
        )}
      </div>

      <div className="task-actions">
        <button type="button" className="btn-run" onClick={run} disabled={running}>
          {running ? <span className="spinner" aria-hidden="true" /> : <IconPlay />}
          {running ? "运行中…" : "运行测试"}
        </button>
        <kbd className="hint-kbd">{isMac ? "⌘" : "Ctrl"} Enter</kbd>
        <button type="button" className="btn" onClick={reset} title="恢复为起始代码">
          <IconReset /> 重置
        </button>
      </div>

      {error && <RunError {...error} />}
      {result && <RunOutput result={result} />}

      <Fold title="测试代码" note={task.race ? "go test -race" : "go test"}>
        <CodeBlock code={task.test} />
      </Fold>
      <Fold title={task.explain ? "参考答案与讲解" : "参考答案"} className="fold-solution">
        <div className="solution-tools">
          <button type="button" className="btn" onClick={fillSolution}>
            填入编辑器
          </button>
        </div>
        <CodeBlock code={task.solution} />
        {task.explain && <Markdown text={task.explain} className="md explain" />}
      </Fold>
      {task.syntax && task.syntax.length > 0 && <SyntaxFold ids={task.syntax} />}
    </div>
  );
}

/** 编辑器激活前的占位：带行号的高亮代码，布局与 CodeMirror 一致。 */
function StaticCode({
  code,
  label,
  onActivate,
}: {
  code: string;
  label?: string;
  onActivate?: (pos: number | null) => void;
}) {
  const html = useMemo(() => highlight(code), [code]);
  const lines = useMemo(() => code.split("\n").length, [code]);
  const interactive = !!onActivate;
  return (
    <div
      className="editor-static"
      tabIndex={interactive ? 0 : -1}
      role={interactive ? "button" : undefined}
      aria-label={label}
      onPointerEnter={interactive ? () => void loadEditor() : undefined}
      onMouseDown={
        interactive
          ? (e) => {
              if (e.button !== 0) return;
              e.preventDefault(); // 不让静态块获得焦点，焦点交给随后创建的编辑器
              onActivate(offsetAt(e.currentTarget.querySelector("code"), e.clientX, e.clientY));
            }
          : undefined
      }
      onKeyDown={
        interactive
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onActivate(null);
              }
            }
          : undefined
      }
    >
      <div className="es-gutter" aria-hidden="true">
        {Array.from({ length: lines }, (_, i) => (
          <div key={i}>{i + 1}</div>
        ))}
      </div>
      <pre className="es-code">
        <code className="hljs language-go" dangerouslySetInnerHTML={{ __html: html }} />
      </pre>
    </div>
  );
}

/** 点击位置对应代码里的第几个字符：高亮后的 HTML 拼起来的文本就是原始代码。 */
function offsetAt(root: Element | null, x: number, y: number): number | null {
  if (!root) return null;
  type CaretDoc = Document & {
    caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null;
  };
  const doc = document as CaretDoc;
  let node: Node | null = null;
  let offset = 0;
  if (doc.caretPositionFromPoint) {
    const p = doc.caretPositionFromPoint(x, y);
    if (p) [node, offset] = [p.offsetNode, p.offset];
  } else if (document.caretRangeFromPoint) {
    const r = document.caretRangeFromPoint(x, y);
    if (r) [node, offset] = [r.startContainer, r.startOffset];
  }
  if (!node || !root.contains(node) || node.nodeType !== Node.TEXT_NODE) return null;
  let pos = 0;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    if (n === node) return pos + offset;
    pos += n.textContent?.length ?? 0;
  }
  return null;
}

function RunError({ offline, message }: { offline: boolean; message: string }) {
  const status = useRunnerStatus();
  if (offline && status.state === "hosted") {
    return (
      <div className="run-box run-offline" role="alert">
        <b>在线版不能运行测试</b>
        <p>
          把
          <a href={REPO_URL} target="_blank" rel="noreferrer">
            仓库
          </a>
          克隆到本地，执行 <code>pnpm install</code>、<code>pnpm build</code> 后运行 <code>go run ./runner</code>，打开
          localhost:8080 就能运行。也可以用「复制」按钮把题面和你的代码发给 AI 检查。
        </p>
      </div>
    );
  }
  if (offline) {
    return (
      <div className="run-box run-offline" role="alert">
        <b>没有连接到本地 Go 运行器</b>
        <p>
          在项目根目录执行 <code>go run ./runner</code>，再点一次「运行测试」。
          {status.state === "online" && " 运行器现在已经在线了。"}
        </p>
      </div>
    );
  }
  return (
    <div className="run-box run-fail" role="alert">
      <b>请求失败</b>
      <pre className="run-log">{message}</pre>
    </div>
  );
}

function RunOutput({ result }: { result: RunResult }) {
  const tests = (result.tests ?? []).filter((t) => !t.name.includes("/"));
  const failed = tests.filter((t) => !t.passed).length;
  let headline: string;
  let kind: "pass" | "fail" | "warn";
  if (result.passed) {
    headline = `全部通过 · ${tests.length} 个测试`;
    kind = "pass";
  } else if (result.buildError) {
    headline = "编译失败";
    kind = "fail";
  } else if (result.timedOut) {
    headline = "运行超时（可能死锁或死循环）";
    kind = "warn";
  } else if (result.race) {
    headline = "检测到数据竞争";
    kind = "fail";
  } else if (failed > 0) {
    headline = `${failed} / ${tests.length} 个测试未通过`;
    kind = "fail";
  } else {
    headline = "测试未通过";
    kind = "fail";
  }

  return (
    <div className={`run-box run-${kind}`} role="status" aria-live="polite">
      <div className="run-head">
        <b>{headline}</b>
        <span className="run-time">{(result.durationMs / 1000).toFixed(1)}s</span>
      </div>
      {tests.length > 0 && (
        <ul className="run-tests">
          {tests.map((t) => (
            <li key={t.name} className={t.passed ? "ok" : "bad"}>
              <span aria-hidden="true">{t.passed ? "✓" : "✗"}</span>
              {t.name}
            </li>
          ))}
        </ul>
      )}
      <details className="run-detail" open={!result.passed}>
        <summary>完整输出</summary>
        <pre className="run-log">
          {result.output.split("\n").map((line, i) => (
            <span key={i} className={logClass(line)}>
              {line + "\n"}
            </span>
          ))}
        </pre>
      </details>
    </div>
  );
}

function logClass(line: string): string | undefined {
  const s = line.trimStart();
  if (s.startsWith("--- PASS") || s.startsWith("ok ") || s === "PASS") return "l-pass";
  if (s.startsWith("--- FAIL") || s.startsWith("FAIL") || s.startsWith("panic:") || s.startsWith("WARNING: DATA RACE"))
    return "l-fail";
  if (/^\.\/main(_test)?\.go:\d+/.test(s) || /\.go:\d+:\d+:/.test(s)) return "l-loc";
  if (s.startsWith("=== RUN")) return "l-dim";
  return undefined;
}
