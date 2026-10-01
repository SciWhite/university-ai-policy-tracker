"use client";

import type { ReactNode } from "react";
import type { ComponentPropsWithoutRef } from "react";
import type { SupportedLocale } from "@/lib/i18n";
import { LocalizedLink } from "@/components/localized-link";

interface DocumentLinkProps
  extends Omit<ComponentPropsWithoutRef<"a">, "href"> {
  children: ReactNode;
  href: string;
  localeOverride?: SupportedLocale;
}

export function DocumentLink({
  children,
  className,
  href,
  localeOverride,
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
    <LocalizedLink className={className} href={href} localeOverride={localeOverride} {...props}>
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
