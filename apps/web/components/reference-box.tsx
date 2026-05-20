import type { ReactNode } from "react";

interface ReferenceBoxProps {
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  description?: ReactNode;
  headingLevel?: "h2" | "h3";
  id?: string;
  title?: ReactNode;
}

export function ReferenceBox({
  actions,
  children,
  className,
  description,
  headingLevel = "h2",
  id,
  title
}: ReferenceBoxProps) {
  const classes = ["reference-box", className].filter(Boolean).join(" ");
  const TitleTag = headingLevel;

  return (
    <section className={classes} id={id}>
      {title || description || actions ? (
        <header className="reference-box__header">
          <div>
            {title ? <TitleTag>{title}</TitleTag> : null}
            {description ? <p>{description}</p> : null}
          </div>
          {actions ? <div className="reference-box__actions">{actions}</div> : null}
        </header>
      ) : null}
      <div className="reference-box__body">{children}</div>
    </section>
  );
}
