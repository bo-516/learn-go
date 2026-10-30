export type Level = 1 | 2 | 3;

export interface Category {
  id: string;
  code: string;
  name: string;
  desc: string;
}

export interface Question {
  id: string;
  code: string;
  cat: string;
  group: string | null;
  level: Level;
  hot: boolean;
  title: string; // Markdown（行内）
  answer: string; // Markdown
  deep?: string; // 深入讲解（Markdown）
  new?: boolean; // 新增的题目（不在原 Go.html 里）
}

export interface QuestionBank {
  title: string;
  footer: string;
  categories: Category[];
  questions: Question[];
}

/** 可运行的编程任务：题库小任务和 LeetCode 题共用这个形状。 */
export interface CodeTaskData {
  id: string;
  title: string;
  desc: string;
  starter: string;
  solution: string;
  test: string;
  explain?: string;
  race?: boolean;
  /** 参考答案用到的语法点 id（对应 syntax.json），按语法手册顺序排列 */
  syntax?: string[];
}

export type TaskMap = Record<string, CodeTaskData[]>;

export interface LeetCodeProblem extends CodeTaskData {
  no: number;
  slug: string;
  difficulty: string;
  category: string;
  topics: string[];
  goPoints: string[];
}

export interface SyntaxCard {
  id: string;
  name: string;
  group: string;
  body: string; // Markdown
}

/** 语法点 → 用到它的练习。refs 里每个练习只存一次标题和链接。 */
export interface SyntaxUsage {
  refs: Record<string, [label: string, href: string]>;
  usage: Record<string, string[]>;
}

export interface RunResult {
  passed: boolean;
  buildError: boolean;
  timedOut: boolean;
  race: boolean;
  output: string;
  tests: { name: string; passed: boolean; elapsed: number }[] | null;
  durationMs: number;
}
