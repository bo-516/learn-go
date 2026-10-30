import { useMemo, useRef } from "react";
import CodeMirror from "@uiw/react-codemirror";
import { go } from "@codemirror/lang-go";
import { EditorView, keymap } from "@codemirror/view";
import { Prec } from "@codemirror/state";
import { HighlightStyle, indentUnit, syntaxHighlighting } from "@codemirror/language";
import { indentWithTab } from "@codemirror/commands";
import { tags as t } from "@lezer/highlight";
import { useTheme } from "../lib/theme";

// 配色和页面上的静态代码块保持一致，全部取 CSS 变量，深浅两套配色自动切换。
const highlightStyle = HighlightStyle.define([
  { tag: [t.keyword, t.controlKeyword, t.definitionKeyword, t.moduleKeyword, t.operatorKeyword], color: "var(--code-kw)" },
  { tag: [t.typeName, t.standard(t.variableName), t.bool, t.null], color: "var(--code-type)" },
  { tag: [t.string, t.special(t.string), t.character], color: "var(--code-str)" },
  { tag: [t.comment, t.lineComment, t.blockComment], color: "var(--code-com)", fontStyle: "italic" },
  { tag: [t.number, t.integer, t.float], color: "var(--code-num)" },
  { tag: [t.function(t.variableName), t.function(t.definition(t.variableName)), t.function(t.propertyName)], color: "var(--code-fn)" },
]);

const theme = EditorView.theme({
  "&": {
    fontSize: "13px",
    backgroundColor: "var(--sunk)",
    color: "var(--code-ink)",
  },
  "&.cm-focused": { outline: "none" },
  ".cm-scroller": { fontFamily: "var(--font-mono)", lineHeight: "1.65" },
  ".cm-content": { padding: "10px 0", caretColor: "var(--accent)" },
  ".cm-gutters": {
    backgroundColor: "var(--sunk)",
    color: "var(--faint)",
    border: "none",
    borderRight: "1px solid var(--line-soft)",
  },
  ".cm-activeLine": { backgroundColor: "color-mix(in srgb, var(--accent) 6%, transparent)" },
  ".cm-activeLineGutter": {
    backgroundColor: "color-mix(in srgb, var(--accent) 10%, transparent)",
    color: "var(--ink-2)",
  },
  ".cm-cursor, .cm-dropCursor": { borderLeftColor: "var(--accent)" },
  ".cm-selectionBackground, &.cm-focused .cm-selectionBackground, ::selection": {
    backgroundColor: "var(--selection) !important",
  },
  ".cm-matchingBracket": { backgroundColor: "color-mix(in srgb, var(--accent) 18%, transparent)", outline: "none" },
  ".cm-tooltip": {
    backgroundColor: "var(--surface)",
    color: "var(--ink)",
    border: "1px solid var(--line)",
    borderRadius: "6px",
  },
  ".cm-tooltip-autocomplete ul li[aria-selected]": { backgroundColor: "var(--accent-soft)", color: "var(--accent-ink)" },
});

export function CodeEditor({
  value,
  onChange,
  onRun,
  ariaLabel,
  initialPos,
}: {
  value: string;
  onChange: (v: string) => void;
  onRun: () => void;
  ariaLabel: string;
  /** 创建后光标所在的位置（字符偏移），对应用户在静态代码上点击的位置 */
  initialPos?: number | null;
}) {
  const runRef = useRef(onRun);
  runRef.current = onRun;
  // 告诉 CodeMirror 当前是深色还是浅色，它自带的光标、补全浮层等默认样式会跟着切换
  const dark = useTheme().resolved === "dark";

  const extensions = useMemo(
    () => [
      go(),
      theme,
      EditorView.darkTheme.of(dark),
      syntaxHighlighting(highlightStyle),
      indentUnit.of("\t"),
      EditorView.contentAttributes.of({ "aria-label": ariaLabel }),
      Prec.highest(
        keymap.of([
          {
            key: "Mod-Enter",
            run: () => {
              runRef.current();
              return true;
            },
          },
          indentWithTab,
        ]),
      ),
    ],
    [ariaLabel, dark],
  );

  const onCreateEditor = (view: EditorView) => {
    if (initialPos != null) {
      view.dispatch({ selection: { anchor: Math.min(initialPos, view.state.doc.length) } });
    }
    view.focus();
  };

  return (
    <CodeMirror
      value={value}
      onChange={onChange}
      onCreateEditor={onCreateEditor}
      extensions={extensions}
      theme="none"
      minHeight="120px"
      maxHeight="560px"
      basicSetup={{
        foldGutter: false,
        highlightActiveLineGutter: true,
        autocompletion: true,
        tabSize: 4,
      }}
    />
  );
}
