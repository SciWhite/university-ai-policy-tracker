"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { getReadingLocaleFromPathname } from "@/lib/i18n";
import { LANGUAGE_NAMES, isReadingLocale, type ReadingLocale } from "@/lib/language-catalog";
import { readingLanguageHref, suggestedReadingLocale } from "@/lib/language-choice";
import { useDeclaredPageReadingLocales } from "@/lib/page-reading-locales";
import { interpolate } from "@/lib/reading-ui-text";
import { useShellMessages } from "@/components/reading-ui-text-provider";
import { trackResearchEvent } from "@/lib/analytics-client";

const DISMISS_STORAGE_KEY = "uapt-locale-suggestion-dismissed";
const CHOICE_STORAGE_KEY = "uapt-locale-choice";

export function LanguageSuggestion() {
  const pathname = usePathname();
  const declared = useDeclaredPageReadingLocales(pathname);
  const locale = getReadingLocaleFromPathname(pathname);
  const messages = useShellMessages().locale;
  const [suggestedLocale, setSuggestedLocale] = useState<ReadingLocale | undefined>();
  const [suffix, setSuffix] = useState({ search: "", hash: "" });

  useEffect(() => {
    const updateSuffix = () => setSuffix({ search: window.location.search, hash: window.location.hash });
    updateSuffix();
    window.addEventListener("hashchange", updateSuffix);
    return () => window.removeEventListener("hashchange", updateSuffix);
  }, [pathname]);

  useEffect(() => {
    let choice = false;
    let dismissed = false;
    try {
      const stored = window.localStorage.getItem(CHOICE_STORAGE_KEY);
      choice = stored !== null && isReadingLocale(stored);
      dismissed = window.localStorage.getItem(DISMISS_STORAGE_KEY) === "1";
    } catch {
      // Browsing without storage still supports an explicit choice.
    }
    setSuggestedLocale(suggestedReadingLocale(pathname, window.navigator.languages ?? [], choice, dismissed, declared));
  }, [pathname, declared]);

  if (!suggestedLocale) return null;
  const targetHref = readingLanguageHref(pathname, suggestedLocale, suffix.search, suffix.hash, declared);
  if (!targetHref) return null;

  function dismiss(source: "stay" | "close") {
    trackResearchEvent("language_suggestion_dismiss", { locale, suggested_locale: suggestedLocale ?? "unknown", source });
    try {
      window.localStorage.setItem(DISMISS_STORAGE_KEY, "1");
      if (source === "stay") window.localStorage.setItem(CHOICE_STORAGE_KEY, "en");
    } catch {
      // No persistence is required to dismiss this prompt.
    }
    setSuggestedLocale(undefined);
  }

  return (
    <div className="language-suggestion" role="status">
      <p>{messages.prompt}</p>
      <a
        href={targetHref}
        hrefLang={suggestedLocale}
        onClick={(event) => {
          const target = readingLanguageHref(pathname, suggestedLocale, window.location.search, window.location.hash, declared);
          if (target) event.currentTarget.href = target;
          trackResearchEvent("language_suggestion_accept", { locale, suggested_locale: suggestedLocale });
          try {
            window.localStorage.setItem(CHOICE_STORAGE_KEY, suggestedLocale);
            window.localStorage.setItem(DISMISS_STORAGE_KEY, "1");
          } catch {
            // The destination URL preserves the selected language.
          }
        }}
      >
        {interpolate(messages.switchTo, { language: LANGUAGE_NAMES[suggestedLocale] })}
      </a>
      <button onClick={() => dismiss("stay")} type="button">{messages.stay}</button>
      <button aria-label={messages.close} className="language-suggestion__close" onClick={() => dismiss("close")} type="button">×</button>
    </div>
  );
}
