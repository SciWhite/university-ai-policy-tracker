import type { DiffPreviewLine } from "@/lib/change-records";

interface DiffBlockProps {
  description?: string;
  lines: DiffPreviewLine[];
  title: string;
}

export function DiffBlock({ description, lines, title }: DiffBlockProps) {
  const added = lines.filter((line) => line.type === "insert").length;
  const removed = lines.filter((line) => line.type === "delete").length;

  return (
    <section className="diff-block" aria-label={title}>
      <header className="diff-block__header">
        <div>
          <h3>{title}</h3>
          {description ? <p>{description}</p> : null}
        </div>
        <div className="diff-block__summary">
          <span>+{added}</span>
          <span>-{removed}</span>
        </div>
      </header>
      <div className="diff-block__body">
        {lines.map((line, index) => (
          <div
            className="diff-line"
            data-diff-type={line.type}
            key={`${line.type}:${line.oldLineNumber ?? ""}:${line.newLineNumber ?? ""}:${index}`}
          >
            <span className="diff-line__number">
              {line.oldLineNumber ?? ""}
            </span>
            <span className="diff-line__number">
              {line.newLineNumber ?? ""}
            </span>
            <span className="diff-line__marker">
              {line.type === "insert" ? "+" : line.type === "delete" ? "-" : " "}
            </span>
            <span className="diff-line__value">{line.value}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
