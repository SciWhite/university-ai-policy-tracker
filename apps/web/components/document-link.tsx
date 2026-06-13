"use client";

import type { ReactNode } from "react";
import type { ComponentPropsWithoutRef } from "react";
import { LocalizedLink } from "@/components/localized-link";

interface DocumentLinkProps
  extends Omit<ComponentPropsWithoutRef<"a">, "href"> {
  children: ReactNode;
  href: string;
}

export function DocumentLink({
  children,
  className,
  href,
  ...props
}: DocumentLinkProps) {
  if (isDocumentLink(href)) {
    return (
      <a className={className} href={href} {...props}>
        {children}
      </a>
    );
  }

  return (
    <LocalizedLink className={className} href={href} {...props}>
      {children}
    </LocalizedLink>
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
