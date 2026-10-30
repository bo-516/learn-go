import { memo, useMemo } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import hljs from "highlight.js/lib/core";
import go from "highlight.js/lib/languages/go";
import bash from "highlight.js/lib/languages/bash";
import sql from "highlight.js/lib/languages/sql";
import lua from "highlight.js/lib/languages/lua";
import json from "highlight.js/lib/languages/json";
import { unescapeMarkdown } from "../lib/copyText";

hljs.registerLanguage("go", go);
hljs.registerLanguage("bash", bash);
hljs.registerLanguage("sql", sql);
hljs.registerLanguage("lua", lua);
hljs.registerLanguage("json", json);

export function highlight(code: string, lang = "go"): string {
  if (!hljs.getLanguage(lang)) return escapeHTML(code);
  try {
    return hljs.highlight(code, { language: lang, ignoreIllegals: true }).value;
  } catch {
    return escapeHTML(code);
  }
}

function escapeHTML(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

export const CodeBlock = memo(function CodeBlock({ code, lang = "go" }: { code: string; lang?: string }) {
  const html = useMemo(() => highlight(code.replace(/\n$/, ""), lang), [code, lang]);
  return (
    <pre className="code">
      <code className={`hljs language-${lang}`} dangerouslySetInnerHTML={{ __html: html }} />
    </pre>
  );
});

const components: Components = {
  pre: ({ children }) => <>{children}</>,
  code: ({ className, children }) => {
    const m = /language-(\w+)/.exec(className || "");
    const text = String(children ?? "");
    if (!m && !text.includes("\n")) return <code>{children}</code>;
    return <CodeBlock code={text} lang={m?.[1] ?? "text"} />;
  },
  table: ({ children }) => (
    <div className="tbl">
      <table>{children}</table>
    </div>
  ),
  // 站内锚点（#syntax/defer、#go-01）在当前页跳转，外部链接开新标签页
  a: ({ href, children }) =>
    href?.startsWith("#") ? (
      <a href={href}>{children}</a>
    ) : (
      <a href={href} target="_blank" rel="noreferrer">
        {children}
      </a>
    ),
};

const remarkPlugins = [remarkGfm];

export const Markdown = memo(function Markdown({ text, className = "md" }: { text: string; className?: string }) {
  return (
    <div className={className}>
      <ReactMarkdown remarkPlugins={remarkPlugins} components={components}>
        {text}
      </ReactMarkdown>
    </div>
  );
});

/**
 * 题目标题这类短文本：只处理反斜杠转义和 `行内代码`。
 * 列表里有数百个标题，不值得为每个都跑一遍完整的 Markdown 解析。
 */
export const InlineMarkdown = memo(function InlineMarkdown({ text }: { text: string }) {
  const parts = text.split("`");
  return (
    <>
      {parts.map((part, i) =>
        i % 2 === 1 ? <code key={i}>{part}</code> : unescapeMarkdown(part),
      )}
    </>
  );
});

/** 把 Markdown 粗略转成纯文本，用于搜索索引。 */
export function markdownToText(md: string): string {
  return md
    .replace(/```\w*\n?/g, " ")
    .replace(/\\([\\`*_{}[\]()#+\-.!|<>])/g, "$1")
    .replace(/[`*#|>]+/g, " ")
    .replace(/\s+/g, " ")
    .toLowerCase();
}
