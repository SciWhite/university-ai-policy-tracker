"use client";

import { Suspense, useEffect, useId, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { getReadingLocaleFromPathname } from "@/lib/i18n";
import { LANGUAGE_NAMES, readingDirection, type ReadingLocale } from "@/lib/language-catalog";
import { pageReadingLocales, readingLanguageHref } from "@/lib/language-choice";
import { useDeclaredPageReadingLocales } from "@/lib/page-reading-locales";
import { preservePolicyReferenceSearch } from "@/lib/policy-reference-preview";
import { useShellMessages } from "@/components/reading-ui-text-provider";
import { trackResearchEvent } from "@/lib/analytics-client";

export function LanguageSwitcher() {
  return (
    <Suspense fallback={<LanguageMenu search="" />}>
      <LanguageMenuWithSearch />
    </Suspense>
  );
}

function LanguageMenuWithSearch() {
  const search = useSearchParams().toString();
  return <LanguageMenu search={search ? `?${search}` : ""} />;
}

function LanguageMenu({ search }: { search: string }) {
  const pathname = usePathname();
  const locale = getReadingLocaleFromPathname(pathname);
  const messages = useShellMessages().locale;
  const detailsRef = useRef<HTMLDetailsElement>(null);
  const summaryRef = useRef<HTMLElement>(null);
  const [open, setOpen] = useState(false);
  const [hash, setHash] = useState("");
  const panelId = useId();
  const declared = useDeclaredPageReadingLocales(pathname);
  const locales = pageReadingLocales(pathname, declared);

  useEffect(() => {
    const updateHash = () => setHash(window.location.hash);
    updateHash();
    window.addEventListener("hashchange", updateHash);
    return () => window.removeEventListener("hashchange", updateHash);
  }, [pathname]);

  useEffect(() => {
    if (detailsRef.current) detailsRef.current.open = false;
    setOpen(false);
  }, [pathname, search]);

  useEffect(() => {
    if (!open) return;
    function closeOutside(event: PointerEvent) {
      if (event.target instanceof Node && !detailsRef.current?.contains(event.target)) {
        if (detailsRef.current) detailsRef.current.open = false;
      }
    }
    document.addEventListener("pointerdown", closeOutside);
    return () => document.removeEventListener("pointerdown", closeOutside);
  }, [open]);

  function rememberChoice(nextLocale: ReadingLocale) {
    trackResearchEvent("locale_switch", { from_locale: locale, to_locale: nextLocale });
    try {
      window.localStorage.setItem("uapt-locale-choice", nextLocale);
      window.localStorage.setItem("uapt-locale-suggestion-dismissed", "1");
    } catch {
      // The explicit language URL still works when storage is unavailable.
    }
  }

  if (locales.length < 2) return null;

  return (
    <details
      className="language-switcher"
      onToggle={() => setOpen(detailsRef.current?.open ?? false)}
      onKeyDown={(event) => {
        if (event.key === "Escape" && detailsRef.current?.open) {
          event.preventDefault();
          event.stopPropagation();
          detailsRef.current.open = false;
          summaryRef.current?.focus();
        }
      }}
      ref={detailsRef}
    >
      <summary
        aria-controls={panelId}
        aria-label={`${messages.label}: ${LANGUAGE_NAMES[locale]}`}
        ref={summaryRef}
      >
        <span className="language-switcher__current" lang={locale} dir={readingDirection(locale)}>{LANGUAGE_NAMES[locale]}</span>
        <span className="language-switcher__short" aria-hidden="true">{locale === "zh" ? "简中" : locale === "zh-Hant" ? "繁中" : locale.toUpperCase()}</span>
        <span className="language-switcher__chevron" aria-hidden="true" />
      </summary>
      <nav className="language-switcher__panel" id={panelId} aria-label={messages.label}>
        <p className="language-switcher__heading">{messages.label}</p>
        <ul className="language-switcher__links">
          {locales.map((target) => (
            <li key={target}>
              <a
                aria-current={target === locale ? "page" : undefined}
                href={readingLanguageHref(pathname, target, search, hash, declared)}
                hrefLang={target}
                lang={target}
                onClick={(event) => {
                  const href = readingLanguageHref(pathname, target, window.location.search, window.location.hash, declared);
                  if (!href) return;
                  event.currentTarget.href = preservePolicyReferenceSearch(href, window.location.search);
                  rememberChoice(target);
                  if (detailsRef.current) detailsRef.current.open = false;
                }}
              >
                <span dir={readingDirection(target)}>{LANGUAGE_NAMES[target]}</span>
                {target === locale ? <span aria-hidden="true">✓</span> : null}
              </a>
            </li>
          ))}
        </ul>
      </nav>
    </details>
  );
}
