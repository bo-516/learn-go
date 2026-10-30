// 一次性脚本：把原始 Go.html 里的 210 道题抽取成 src/data/questions.json。
// 答案 HTML 转成 Markdown（代码块去掉 Pygments 的 span，保留语言标记）。
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import * as cheerio from "cheerio";
import TurndownService from "turndown";
import { gfm } from "turndown-plugin-gfm";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const html = readFileSync(resolve(root, "Go.html"), "utf8");
const $ = cheerio.load(html);

const td = new TurndownService({
  headingStyle: "atx",
  codeBlockStyle: "fenced",
  bulletListMarker: "-",
  emDelimiter: "*",
});
td.use(gfm);
// 默认的 fenced 规则读 textContent，Pygments 的 span 会被自然丢掉；这里只补上语言名。
td.addRule("fencedWithLang", {
  filter: (node) => node.nodeName === "PRE" && node.firstChild && node.firstChild.nodeName === "CODE",
  replacement: (_content, node) => {
    const code = node.firstChild;
    const m = /language-(\S+)/.exec(code.getAttribute("class") || "");
    const lang = m ? m[1] : "";
    const text = code.textContent.replace(/\n$/, "");
    return "\n\n```" + lang + "\n" + text + "\n```\n\n";
  },
});

const md = (frag) => td.turndown(frag || "").trim();

const categories = [];
const questions = [];

$("section.cat").each((_, sec) => {
  const s = $(sec);
  const cat = s.attr("data-cat");
  categories.push({
    id: cat,
    code: s.find(".cat-code").first().text().trim(),
    name: s.find(".cat-head h2").first().text().trim(),
    desc: s.find(".cat-desc").first().text().trim(),
  });
  s.find("details.q").each((_, d) => {
    const q = $(d);
    const groupEl = q.closest(".group");
    const group = groupEl.length
      ? groupEl.find(".group-title").first().clone().children(".group-count").remove().end().text().trim()
      : null;
    questions.push({
      id: q.attr("id"),
      code: q.find(".qid").first().text().trim(),
      cat,
      group,
      level: Number(q.attr("data-level")),
      hot: q.attr("data-hot") === "1",
      title: md(q.find(".qt").first().html()),
      answer: md(q.find(".ans").first().html()),
    });
  });
});

const out = {
  title: $("h1").first().text().trim(),
  footer: $("footer.foot").text().replace(/\s+/g, " ").trim(),
  categories,
  questions,
};

mkdirSync(resolve(root, "src/data"), { recursive: true });
writeFileSync(resolve(root, "src/data/questions.json"), JSON.stringify(out, null, 2) + "\n");
console.log(`categories: ${categories.length}, questions: ${questions.length}`);
