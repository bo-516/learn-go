import { lazy, Suspense, useEffect } from "react";
import { TopNav } from "./components/Shell";
import { useHash } from "./lib/hooks";

// 两个页面各自带着自己的 JSON 数据，按需加载
const BankPage = lazy(() => import("./pages/BankPage").then((m) => ({ default: m.BankPage })));
const LeetCodePage = lazy(() => import("./pages/LeetCodePage").then((m) => ({ default: m.LeetCodePage })));
const SyntaxPage = lazy(() => import("./pages/SyntaxPage").then((m) => ({ default: m.SyntaxPage })));

const TITLES = {
  bank: "Go 后端实战题库 · Go 学习手册",
  leetcode: "LeetCode · Go 学习手册",
  syntax: "Go 语法手册 · Go 学习手册",
} as const;

// 页面用 hash 区分：#leetcode 开头是 LeetCode 页，#syntax 开头是语法手册，
// 其余（包括 #go-01 这类题目锚点）是题库页。
export default function App() {
  const hash = useHash();
  const page = hash.startsWith("leetcode") ? "leetcode" : hash.startsWith("syntax") ? "syntax" : "bank";

  useEffect(() => {
    document.title = TITLES[page];
  }, [page]);

  // 切换页面时回到顶部（同页内的锚点跳转不受影响）
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [page]);

  return (
    <>
      <TopNav page={page} />
      <Suspense fallback={<div className="page-loading">加载中…</div>}>
        {page === "leetcode" ? (
          <LeetCodePage hash={hash} />
        ) : page === "syntax" ? (
          <SyntaxPage hash={hash} />
        ) : (
          <BankPage hash={hash} />
        )}
      </Suspense>
    </>
  );
}
