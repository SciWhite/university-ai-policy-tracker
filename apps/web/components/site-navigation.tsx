"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

interface SiteNavigationItem {
  href: string;
  label: string;
}

interface SiteNavigationProps {
  items: readonly SiteNavigationItem[];
}

export function SiteNavigation({ items }: SiteNavigationProps) {
  const pathname = usePathname();

  return (
    <nav className="site-nav" aria-label="Primary navigation">
      {items.map((item) => {
        const isActive = matchesPath(pathname, item.href);

        return (
          <Link
            aria-current={isActive ? "page" : undefined}
            href={item.href}
            key={item.href}
          >
            {item.label}
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
