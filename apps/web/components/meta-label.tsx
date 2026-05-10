import type { ReactNode } from "react";

interface MetaLabelProps {
  label?: string;
  children: ReactNode;
}

export function MetaLabel({ label, children }: MetaLabelProps) {
  return (
    <span className="meta-label">
      {label ? <span className="meta-label__name">{label}</span> : null}
      <span>{children}</span>
    </span>
  );
}
