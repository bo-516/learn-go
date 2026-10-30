import { useEffect, useState } from "react";
import type { SyntaxCard } from "../types";

// 语法卡片单独打包，第一次展开「用到的 Go 语法」时才加载
let cache: Map<string, SyntaxCard> | null = null;
let pending: Promise<Map<string, SyntaxCard>> | null = null;

export function loadSyntaxCards(): Promise<Map<string, SyntaxCard>> {
  pending ??= import("../data/syntax.json").then((m) => {
    cache = new Map((m.default as { items: SyntaxCard[] }).items.map((c) => [c.id, c]));
    return cache;
  });
  return pending;
}

export function useSyntaxCards(): Map<string, SyntaxCard> | null {
  const [cards, setCards] = useState(cache);
  useEffect(() => {
    if (cards) return;
    let alive = true;
    loadSyntaxCards().then((m) => alive && setCards(m));
    return () => {
      alive = false;
    };
  }, [cards]);
  return cards;
}

/** 语法手册里各分组的简称（目录和分区标题用） */
export const SYNTAX_GROUP_CODE: Record<string, string> = {
  基础与变量: "BASE",
  流程控制: "FLOW",
  "range 遍历": "RANGE",
  函数: "FUNC",
  "数组、切片与字符串": "SLICE",
  map: "MAP",
  结构体与方法: "TYPE",
  接口与泛型: "IFACE",
  错误处理: "ERR",
  并发: "CONC",
  标准库: "STD",
};
