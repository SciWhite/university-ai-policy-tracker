"use client";

import { usePathname } from "next/navigation";
import { getLocaleFromPathname, type SupportedLocale } from "@/lib/i18n";

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

  return (
    <main aria-busy="true" className="page-shell">
      <p className="notice-card">{loadingCopy[locale]}</p>
    </main>
  );
}
