"use client";
import { requestDiscoveryPosition } from "@/lib/discovery-return-state";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { safeDiscoveryReturn } from "@/lib/discovery-query";
import { rankingBrowserCopy } from "@/lib/ranking-browser-copy";
import { getLocaleFromPathname, localizeHref } from "@/lib/i18n";
/** Always occupies the same breadcrumb row in SSR and after hydration. */
export function ReturnToDiscovery() {
  const pathname = usePathname(),
    locale = getLocaleFromPathname(pathname),
    copy = rankingBrowserCopy(locale);
  const [href, setHref] = useState<string | null>(null);
  useEffect(
    () =>
      setHref(
        safeDiscoveryReturn(
          new URLSearchParams(location.search).get("returnTo"),
        ),
      ),
    [pathname],
  );
  useEffect(() => {
    const returning = () => {
      if (href) requestDiscoveryPosition(href);
    };
    window.addEventListener("popstate", returning);
    return () => window.removeEventListener("popstate", returning);
  }, [href]);
  return (
    <nav
      data-return-ready={href !== null}
      className="discovery-return"
      aria-label={copy.directory}
    >
      <a
        href={href ?? localizeHref("/universities", locale)}
        onClick={() => {
          if (href) requestDiscoveryPosition(href);
        }}
      >
        ← {href ? copy.back : copy.directory}
      </a>
    </nav>
  );
}
