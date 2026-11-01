"use client";
import { requestDiscoveryPosition } from "@/lib/discovery-return-state";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { safeDiscoveryReturn } from "@/lib/discovery-query";
import { rankingBrowserCopy } from "@/lib/ranking-browser-copy";
import { getReadingLocaleFromPathname, legacyLocale, localizeHref } from "@/lib/i18n";
import { useReadingUiText } from "./reading-ui-text-provider";
/** Always occupies the same breadcrumb row in SSR and after hydration. */
export function ReturnToDiscovery() {
  const pathname = usePathname(),
    readingLocale = getReadingLocaleFromPathname(pathname),
    copy = rankingBrowserCopy(legacyLocale(readingLocale));
  const sharedUiText = useReadingUiText();
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
      aria-label={sharedUiText["University directory"] ?? copy.directory}
    >
      <a
        href={href ?? localizeHref("/universities", readingLocale)}
        onClick={() => {
          if (href) requestDiscoveryPosition(href);
        }}
      >
        ← {href ? copy.back : sharedUiText["University directory"] ?? copy.directory}
      </a>
    </nav>
  );
}
