import { useState } from "react";

/** 折叠块：内容只在第一次展开后才渲染。 */
export function Fold({
  title,
  note,
  className = "",
  children,
}: {
  title: string;
  note?: string;
  className?: string;
  children: React.ReactNode;
}) {
  const [opened, setOpened] = useState(false);
  return (
    <details className={"fold " + className} onToggle={(e) => (e.currentTarget.open ? setOpened(true) : undefined)}>
      <summary>
        <svg className="fold-chev" viewBox="0 0 16 16" aria-hidden="true">
          <path d="M6 4l4 4-4 4" />
        </svg>
        {title}
        {note && <span className="fold-note">{note}</span>}
      </summary>
      {opened && <div className="fold-body">{children}</div>}
    </details>
  );
}
