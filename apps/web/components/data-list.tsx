import type { ReactNode } from "react";

interface DataListProps {
  children: ReactNode;
  className?: string;
}

interface DataListRowProps {
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  metadata?: ReactNode;
}

export function DataList({ children, className }: DataListProps) {
  const classes = ["data-list", className].filter(Boolean).join(" ");

  return <div className={classes}>{children}</div>;
}

export function DataListRow({
  actions,
  children,
  className,
  metadata
}: DataListRowProps) {
  const classes = ["data-list-row", className].filter(Boolean).join(" ");

  return (
    <article className={classes}>
      <div className="data-list-row__main">{children}</div>
      {metadata ? <div className="data-list-row__meta">{metadata}</div> : null}
      {actions ? <div className="data-list-row__actions">{actions}</div> : null}
    </article>
  );
}
