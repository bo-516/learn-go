import { useEffect, useState } from "react";
import type { RunResult } from "../types";

export class RunnerOfflineError extends Error {}

// 部署到 GitHub Pages 这类静态托管时没有运行器：不再探测 /api，界面改成“在线阅读版”的提示。
// 运行器只监听本机回环地址，所以页面不在本机打开就一定是托管的静态版本。
// 本地预览在线版的效果：地址后面加 ?hosted。
export const HOSTED =
  new URLSearchParams(location.search).has("hosted") ||
  !/^(localhost|127(\.\d+){3}|\[::1\])$|\.localhost$/.test(location.hostname);
export const REPO_URL = "https://github.com/bo-516/learn-go";

export async function runGoTest(code: string, test: string, race: boolean): Promise<RunResult> {
  if (HOSTED) throw new RunnerOfflineError("在线版没有运行器");
  let res: Response;
  try {
    res = await fetch("/api/run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code, test, race }),
    });
  } catch {
    throw new RunnerOfflineError("无法连接本地运行器");
  }
  // Vite 代理在后端没启动时会返回 502/504
  if (res.status === 502 || res.status === 503 || res.status === 504 || res.status === 404) {
    throw new RunnerOfflineError("无法连接本地运行器");
  }
  if (!res.ok) throw new Error((await res.text()) || `HTTP ${res.status}`);
  return (await res.json()) as RunResult;
}

export type RunnerStatus =
  | { state: "checking" }
  | { state: "online"; go: string }
  | { state: "offline" }
  | { state: "hosted" };

type Listener = (s: RunnerStatus) => void;
let current: RunnerStatus = HOSTED ? { state: "hosted" } : { state: "checking" };
const listeners = new Set<Listener>();
let timer: number | undefined;

async function probe() {
  if (HOSTED) return;
  let next: RunnerStatus;
  try {
    const res = await fetch("/api/health", { cache: "no-store" });
    if (!res.ok) throw new Error();
    const body = (await res.json()) as { go: string };
    next = { state: "online", go: body.go };
  } catch {
    next = { state: "offline" };
  }
  current = next;
  listeners.forEach((l) => l(next));
  // 离线时更频繁地重试，方便用户启动运行器后自动恢复
  window.clearTimeout(timer);
  timer = window.setTimeout(probe, next.state === "online" ? 30000 : 5000);
}

export function recheckRunner() {
  probe();
}

export function useRunnerStatus(): RunnerStatus {
  const [s, setS] = useState(current);
  useEffect(() => {
    listeners.add(setS);
    if (listeners.size === 1 && current.state === "checking") probe();
    else setS(current);
    return () => {
      listeners.delete(setS);
    };
  }, []);
  return s;
}
