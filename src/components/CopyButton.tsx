import { useEffect, useRef, useState } from "react";
import { copyText } from "../lib/clipboard";
import { IconCheck, IconCopy } from "./Icons";

/**
 * 复制按钮。text 用函数形式，点击时才生成，能拿到编辑器里最新的代码。
 * compact 为圆形图标按钮（用在折叠行里），否则带文字。
 * 放在 <summary> 里时，阻止点击冒泡，避免展开/折叠题目。
 */
export function CopyButton({
  text,
  title,
  label = "复制",
  compact = false,
}: {
  text: () => string;
  title: string;
  label?: string;
  compact?: boolean;
}) {
  const [state, setState] = useState<"idle" | "ok" | "fail">("idle");
  const timer = useRef<number>();
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const onClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const ok = await copyText(text());
    setState(ok ? "ok" : "fail");
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setState("idle"), 1600);
  };

  const status = state === "ok" ? "已复制" : state === "fail" ? "复制失败" : "";
  return (
    <button
      type="button"
      className={"copy-btn" + (compact ? " compact" : "") + (state !== "idle" ? ` is-${state}` : "")}
      title={title}
      aria-label={title}
      data-tip={status}
      onClick={onClick}
    >
      {state === "ok" ? <IconCheck /> : <IconCopy />}
      {!compact && <span>{status || label}</span>}
      <span className="sr-only" aria-live="polite">
        {status}
      </span>
    </button>
  );
}
