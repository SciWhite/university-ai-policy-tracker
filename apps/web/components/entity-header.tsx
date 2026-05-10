import type { ReactNode } from "react";

interface EntityHeaderProps {
  actions?: ReactNode;
  eyebrow?: ReactNode;
  metadata?: ReactNode;
  summary?: ReactNode;
  title: ReactNode;
}

export function EntityHeader({
  actions,
  eyebrow,
  metadata,
  summary,
  title
}: EntityHeaderProps) {
  return (
    <section className="entity-header">
      <div className="entity-header__main">
        {eyebrow ? <p className="entity-header__eyebrow">{eyebrow}</p> : null}
        <h1>{title}</h1>
        {summary ? <p className="entity-header__summary">{summary}</p> : null}
        {metadata ? <div className="entity-header__metadata">{metadata}</div> : null}
      </div>
      {actions ? <div className="entity-header__actions">{actions}</div> : null}
    </section>
  );
}
