import { useState } from "react";
import type { SyntaxCard } from "../types";
import { Fold } from "./Fold";
import { Markdown } from "./Markdown";
import { useSyntaxCards } from "../lib/syntax";

/** 练习下方的「用到的 Go 语法」：语法点列表，点一个就在下面展开它的讲解卡片。 */
export function SyntaxFold({ ids }: { ids: string[] }) {
  return (
    <Fold title="用到的 Go 语法" note={`${ids.length} 个语法点`} className="fold-syntax">
      <SyntaxPicker ids={ids} />
    </Fold>
  );
}

function SyntaxPicker({ ids }: { ids: string[] }) {
  const cards = useSyntaxCards();
  const [active, setActive] = useState<string | null>(null);
  if (!cards) return <p className="syntax-hint">正在加载语法卡片…</p>;
  const card = active ? cards.get(active) : undefined;
  return (
    <>
      <p className="syntax-hint">参考答案里用到了这些语法，点一个查看讲解、写法和易错点。</p>
      <div className="syntax-chips">
        {ids.map((id) => {
          const c = cards.get(id);
          if (!c) return null;
          return (
            <button
              type="button"
              key={id}
              className="syntax-chip"
              aria-pressed={active === id}
              onClick={() => setActive(active === id ? null : id)}
            >
              {c.name}
            </button>
          );
        })}
      </div>
      {card && <SyntaxCardView card={card} />}
    </>
  );
}

export function SyntaxCardView({ card }: { card: SyntaxCard }) {
  return (
    <article className="syntax-card">
      <header className="syntax-card-head">
        <span className="syntax-group">{card.group}</span>
        <h5>{card.name}</h5>
        <a className="link" href={`#syntax/${card.id}`}>
          在语法手册中打开 →
        </a>
      </header>
      <Markdown text={card.body} className="md syntax-body" />
    </article>
  );
}
