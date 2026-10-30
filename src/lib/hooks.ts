import { useEffect, useState } from "react";

export function useHash(): string {
  const [hash, setHash] = useState(() => decodeURIComponent(location.hash.slice(1)));
  useEffect(() => {
    const on = () => setHash(decodeURIComponent(location.hash.slice(1)));
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);
  return hash;
}

export function useDebounced<T>(value: T, ms: number): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

/** 按 / 聚焦搜索框（输入框内不触发）。 */
export function useSlashFocus(ref: React.RefObject<HTMLInputElement>) {
  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      const tag = el.tagName.toLowerCase();
      if (e.key !== "/" || e.metaKey || e.ctrlKey) return;
      if (tag === "input" || tag === "textarea" || el.isContentEditable) return;
      e.preventDefault();
      ref.current?.focus();
      ref.current?.select();
    };
    document.addEventListener("keydown", on);
    return () => document.removeEventListener("keydown", on);
  }, [ref]);
}

/** 把吸顶工具栏的高度同步到 CSS 变量 --tb-h，用于目录和锚点偏移。 */
export function useToolbarHeight(ref: React.RefObject<HTMLElement>) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const sync = () => document.documentElement.style.setProperty("--tb-h", el.offsetHeight + "px");
    sync();
    if (!("ResizeObserver" in window)) return;
    const ro = new ResizeObserver(sync);
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
}

/** 元素是否已经向上滚出视口（被吸顶工具栏挡住也算）。 */
export function useScrolledPast(ref: React.RefObject<HTMLElement>) {
  const [past, setPast] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || !("IntersectionObserver" in window)) return;
    const io = new IntersectionObserver(
      ([en]) => setPast(!en.isIntersecting && en.boundingClientRect.top < window.innerHeight / 2),
      { rootMargin: "-120px 0px 0px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [ref]);
  return past;
}

/** 返回当前处于视口上部的分区 id，用于高亮目录。 */
export function useActiveSection(ids: string[], prefix: string) {
  const [active, setActive] = useState<string | null>(null);
  const key = ids.join(",");
  useEffect(() => {
    if (!("IntersectionObserver" in window)) return;
    const visible = new Map<string, boolean>();
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((en) => visible.set((en.target as HTMLElement).dataset.sec!, en.isIntersecting));
        setActive(ids.find((id) => visible.get(id)) ?? null);
      },
      { rootMargin: "-140px 0px -55% 0px" },
    );
    ids.forEach((id) => {
      const el = document.getElementById(prefix + id);
      if (el) io.observe(el);
    });
    return () => io.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, prefix]);
  return active;
}
