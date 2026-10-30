import { readFileSync } from "node:fs";
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";

// 标题用的衬线中文字体只请求实际出现的字符（Google Fonts 的 text= 参数），
// 得到一个很小的子集文件；正文用系统中文字体，滚动时不会再按需下载字体切片。
function headingFontSubset(): Plugin {
  return {
    name: "heading-font-subset",
    transformIndexHtml(html) {
      const read = (f: string) => JSON.parse(readFileSync(`src/data/${f}`, "utf8"));
      const bank = read("bank.json");
      const lc = read("leetcode.json");
      const syntax = read("syntax.json");
      const headings: string[] = [
        bank.title,
        ...bank.categories.map((c: { name: string }) => c.name),
        "LeetCode 道精选题", // LeetCodePage 的 h1（数字和英文用的是后备字体）
        ...lc.problems.map((p: { category: string }) => p.category),
        "Go 语法手册",
        ...syntax.items.map((s: { group: string }) => s.group),
      ];
      const text = encodeURIComponent([...new Set(headings.join(""))].sort().join(""));
      const link = `<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Noto+Serif+SC:wght@700&text=${text}&display=swap" />`;
      return html.replace("<!-- heading-font -->", link);
    },
  };
}

// 开发时把 /api 转发给本地 Go 运行器（go run ./runner）。
export default defineConfig({
  plugins: [react(), headingFontSubset()],
  base: "./",
  server: {
    port: 5173,
    proxy: {
      "/api": { target: "http://127.0.0.1:8080", changeOrigin: true },
    },
  },
  build: {
    chunkSizeWarningLimit: 1500,
  },
});
