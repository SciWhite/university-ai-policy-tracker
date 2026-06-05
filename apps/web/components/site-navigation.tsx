"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  getLocaleFromPathname,
  getPathnameWithoutLocale,
  localizeHref
} from "@/lib/i18n";
import { getShellMessages } from "@/lib/i18n-messages";

interface SiteNavigationItem {
  href: string;
  labelKey: keyof ReturnType<typeof getShellMessages>["navigation"];
}

interface SiteNavigationProps {
  items: readonly SiteNavigationItem[];
}

export function SiteNavigation({ items }: SiteNavigationProps) {
  const pathname = usePathname();
  const locale = getLocaleFromPathname(pathname);
  const labels = getShellMessages(locale).navigation;
  const unprefixedPathname = getPathnameWithoutLocale(pathname);

  return (
    <nav className="site-nav" aria-label={labels.search}>
      {items.map((item) => {
        const isActive = matchesPath(unprefixedPathname, item.href);

        return (
          <Link
            aria-current={isActive ? "page" : undefined}
            href={localizeHref(item.href, locale)}
            key={item.href}
            prefetch={false}
          >
            {labels[item.labelKey]}
          </Link>
        );
      })}
    </nav>
  );
}

function matchesPath(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}
