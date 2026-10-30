import { useSyncExternalStore } from "react";
import { KEYS, readString, writeString } from "./storage";

export type ThemePref = "auto" | "light" | "dark";
type Resolved = "light" | "dark";

// 首帧的 data-theme 由 index.html 里的内联脚本设置（避免深色模式下先闪一下浅色），
// 这里接管之后的切换，并在“跟随系统”时响应系统配色的变化。
const media = window.matchMedia("(prefers-color-scheme: dark)");
// 页面底色（--bg，顶栏是透明的），同步给手机浏览器的地址栏
const BAR_COLOR: Record<Resolved, string> = { light: "#F4F6F8", dark: "#000000" };
const ORDER: ThemePref[] = ["auto", "light", "dark"];

let pref: ThemePref = parse(readString(KEYS.theme));
const listeners = new Set<() => void>();

function parse(v: string | null): ThemePref {
  return v === "light" || v === "dark" ? v : "auto";
}

function resolved(): Resolved {
  return pref === "auto" ? (media.matches ? "dark" : "light") : pref;
}

function apply() {
  const t = resolved();
  document.documentElement.dataset.theme = t;
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", BAR_COLOR[t]);
  listeners.forEach((l) => l());
}

media.addEventListener("change", () => {
  if (pref === "auto") apply();
});
apply();

/** 跟随系统 → 浅色 → 深色 循环切换。 */
export function cycleTheme() {
  pref = ORDER[(ORDER.indexOf(pref) + 1) % ORDER.length];
  writeString(KEYS.theme, pref === "auto" ? null : pref);
  apply();
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

export function useTheme(): { pref: ThemePref; resolved: Resolved } {
  return {
    pref: useSyncExternalStore(subscribe, () => pref),
    resolved: useSyncExternalStore(subscribe, resolved),
  };
}
