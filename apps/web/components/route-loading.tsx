"use client";

import { usePathname } from "next/navigation";
import { getLocaleFromPathname, type SupportedLocale } from "@/lib/i18n";
import { useReadingUiText } from "./reading-ui-text-provider";

const loadingCopy: Record<SupportedLocale, string> = {
  en: "Loading...",
  zh: "正在加载…",
  fr: "Chargement…",
  pl: "Wczytywanie…",
  es: "Cargando…",
  nl: "Laden…",
  ms: "Memuatkan…"
};

// Shared route-level loading state for both root layout groups.
export function RouteLoading() {
  const pathname = usePathname();
  const locale = getLocaleFromPathname(pathname);
  const label = useReadingUiText()[loadingCopy.en] ?? loadingCopy[locale];

  return (
    <main aria-busy="true" className="page-shell">
      <p className="notice-card">{label}</p>
    </main>
  );
}
