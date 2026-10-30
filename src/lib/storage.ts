import { useCallback, useEffect, useState } from "react";

// localStorage 在隐私模式或被禁用时可能抛异常，所有读写都要兜底。
export function readJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw == null ? fallback : (JSON.parse(raw) as T);
  } catch {
    return fallback;
  }
}

export function writeJSON(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* 忽略 */
  }
}

export function readString(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function writeString(key: string, value: string | null) {
  try {
    if (value == null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    /* 忽略 */
  }
}

const setListeners = new Map<string, Set<(v: Set<string>) => void>>();

/**
 * 持久化的字符串集合（已掌握的题、已通过的任务）。
 * 同一个 key 的多个组件共享状态：一处修改，其他订阅者同步刷新。
 */
export function useStoredSet(key: string) {
  const [value, setValue] = useState<Set<string>>(() => new Set(readJSON<string[]>(key, [])));

  useEffect(() => {
    let subs = setListeners.get(key);
    if (!subs) setListeners.set(key, (subs = new Set()));
    subs.add(setValue);
    return () => {
      subs!.delete(setValue);
    };
  }, [key]);

  const update = useCallback(
    (fn: (prev: Set<string>) => Set<string>) => {
      const next = fn(new Set(readJSON<string[]>(key, [])));
      writeJSON(key, Array.from(next));
      setListeners.get(key)?.forEach((l) => l(next));
    },
    [key],
  );

  const toggle = useCallback(
    (id: string) =>
      update((s) => {
        if (s.has(id)) s.delete(id);
        else s.add(id);
        return s;
      }),
    [update],
  );

  const add = useCallback(
    (id: string) =>
      update((s) => {
        s.add(id);
        return s;
      }),
    [update],
  );

  return { set: value, toggle, add };
}

export const KEYS = {
  mastered: "go-iv-mastered-v1", // 与原页面保持一致，旧进度可以直接沿用
  passed: "learn-go:passed-v1",
  lcPassed: "learn-go:lc-passed-v1",
  code: (id: string) => `learn-go:code:${id}`,
  theme: "learn-go:theme", // index.html 的内联脚本也读这个 key
  hostedNote: "learn-go:hosted-note-v1",
};
