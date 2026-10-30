// 「复制题目」按钮生成的文本：Markdown 格式，粘贴给 AI 时自带足够的上下文。
import type { CodeTaskData, LeetCodeProblem, Question } from "../types";
import { KEYS, readString } from "./storage";

const LEVEL_NAME = { 1: "基础", 2: "进阶", 3: "深入" } as const;

/** 去掉 Markdown 的反斜杠转义，例如 TIME\_WAIT → TIME_WAIT */
export function unescapeMarkdown(s: string): string {
  return s.replace(/\\([\\`*_{}[\]()#+\-.!|<>~])/g, "$1");
}

function fence(code: string, lang = "go"): string {
  return "```" + lang + "\n" + code.replace(/\n+$/, "") + "\n```";
}

/** 「下面代码输出什么」这类题，题目里的代码就是答案开头的第一个代码块。 */
function questionCode(q: Question): string | null {
  if (!/下面|以下|这段|如下/.test(q.title)) return null;
  const m = /^```(\w*)\n([\s\S]*?)\n?```/.exec(q.answer.trimStart());
  return m ? fence(m[2], m[1] || "go") : null;
}

export function questionCopyText(q: Question, categoryName: string): string {
  const meta = [categoryName, q.group, LEVEL_NAME[q.level], q.hot ? "高频" : null].filter(Boolean).join(" · ");
  const parts = [`Go 后端面试题 ${q.code}（${meta}）`, unescapeMarkdown(q.title)];
  const code = questionCode(q);
  if (code) parts.push(code);
  return parts.join("\n\n") + "\n";
}

export interface TaskCopyContext {
  heading: string; // 例如 "GO-01 任务 1"
  question?: string; // 所属面试题（Markdown）
}

export function taskCopyText(task: CodeTaskData, code: string, ctx: TaskCopyContext): string {
  let head = `Go 编程练习 ${ctx.heading}：${task.title}`;
  if (ctx.question) head += `\n对应的面试题：${unescapeMarkdown(ctx.question)}`;
  const mine = code !== task.starter;
  return (
    [
      head,
      task.desc.trim(),
      `${mine ? "我目前的代码" : "起始代码"}：\n\n${fence(code)}`,
      `测试代码（go test${task.race ? " -race" : ""}）：\n\n${fence(task.test)}`,
    ].join("\n\n") + "\n"
  );
}

export function problemCopyText(p: LeetCodeProblem): string {
  const saved = readString(KEYS.code(p.id));
  const mine = saved != null && saved !== p.starter ? saved : null;
  return (
    [
      `LeetCode ${p.no}. ${p.title}（${p.difficulty} · ${p.topics.join("、")}）\n原题：https://leetcode.cn/problems/${p.slug}/`,
      p.desc.trim(),
      `${mine != null ? "我目前的代码" : "代码模板"}（Go）：\n\n${fence(mine ?? p.starter)}`,
    ].join("\n\n") + "\n"
  );
}
