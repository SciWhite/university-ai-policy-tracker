import Link from "next/link";
import type { ReactNode } from "react";

interface DocumentLinkProps {
  children: ReactNode;
  className?: string;
  href: string;
}

export function DocumentLink({ children, className, href }: DocumentLinkProps) {
  if (isDocumentLink(href)) {
    return (
      <a className={className} href={href}>
        {children}
      </a>
    );
  }

  return (
    <Link className={className} href={href}>
      {children}
    </Link>
  );
}

export function isDocumentLink(href: string): boolean {
  return (
    href.startsWith("http") ||
    href.startsWith("/api/") ||
    href.startsWith("/feeds/") ||
    href.endsWith(".txt") ||
    href.endsWith(".json") ||
    href.endsWith(".xml")
  );
}
