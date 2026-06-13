"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  DEFAULT_LOCALE,
  HIDDEN_AUTO_LOCALES,
  SUPPORTED_LOCALES,
  VISIBLE_LOCALES,
  getLocaleFromPathname,
  getLocaleLabel,
  getPathnameWithoutLocale,
  isLocalizablePath,
  localizeHref,
  normalizeLocale,
  type SupportedLocale
} from "@/lib/i18n";
import { getShellMessages, interpolate } from "@/lib/i18n-messages";
import { trackResearchEvent } from "@/lib/analytics-client";

const DISMISS_STORAGE_KEY = "uapt-locale-suggestion-dismissed";
const CHOICE_STORAGE_KEY = "uapt-locale-choice";

export function LanguageSuggestion() {
  const pathname = usePathname();
  const router = useRouter();
  const locale = getLocaleFromPathname(pathname);
  const [suggestedLocale, setSuggestedLocale] = useState<SupportedLocale | null>(
    null
  );
  const messages = getShellMessages(locale).locale;

  useEffect(() => {
    if (locale !== DEFAULT_LOCALE) return;

    try {
      if (
        window.localStorage.getItem(DISMISS_STORAGE_KEY) ||
        window.localStorage.getItem(CHOICE_STORAGE_KEY)
      ) {
        return;
      }
    } catch {
      // Continue without persistence when storage is unavailable.
    }

    const browserLocale = window.navigator.languages
      ?.map((value) => normalizeLocale(value))
      .find(
        (value) => value !== DEFAULT_LOCALE && SUPPORTED_LOCALES.includes(value)
      );

    if (
      browserLocale &&
      HIDDEN_AUTO_LOCALES.includes(browserLocale) &&
      isLocalizablePath(pathname)
    ) {
      const targetHref = localizeHref(
        getPathnameWithoutLocale(pathname),
        browserLocale
      );

      try {
        window.localStorage.setItem(CHOICE_STORAGE_KEY, browserLocale);
        window.localStorage.setItem(DISMISS_STORAGE_KEY, "1");
      } catch {
        // Continue without persistence when storage is unavailable.
      }

      router.replace(targetHref);
      return;
    }

    if (browserLocale && !VISIBLE_LOCALES.includes(browserLocale)) {
      setSuggestedLocale(null);
      return;
    }

    setSuggestedLocale(browserLocale ?? null);
  }, [locale, pathname, router]);

  if (!suggestedLocale) return null;

  const targetPath = isLocalizablePath(pathname)
    ? getPathnameWithoutLocale(pathname)
    : "/";
  const targetHref = localizeHref(targetPath, suggestedLocale);
  const language = getLocaleLabel(suggestedLocale);

  function dismiss(source: "stay" | "close") {
    trackResearchEvent("language_suggestion_dismiss", {
      locale,
      suggested_locale: suggestedLocale ?? "unknown",
      source
    });

    try {
      window.localStorage.setItem(DISMISS_STORAGE_KEY, "1");
    } catch {
      // localStorage can be unavailable in private or restricted contexts.
    }
    setSuggestedLocale(null);
  }

  function rememberChoice() {
    if (!suggestedLocale) return;

    trackResearchEvent("language_suggestion_accept", {
      locale,
      suggested_locale: suggestedLocale
    });

    try {
      window.localStorage.setItem(CHOICE_STORAGE_KEY, suggestedLocale);
      window.localStorage.setItem(DISMISS_STORAGE_KEY, "1");
    } catch {
      // localStorage can be unavailable in private or restricted contexts.
    }
  }

  return (
    <div className="language-suggestion" role="status">
      <p>{messages.prompt}</p>
      <a href={targetHref} hrefLang={suggestedLocale} onClick={rememberChoice}>
        {interpolate(messages.switchTo, { language })}
      </a>
      <button onClick={() => dismiss("stay")} type="button">
        {messages.stay}
      </button>
      <button
        aria-label={messages.close}
        className="language-suggestion__close"
        onClick={() => dismiss("close")}
        type="button"
      >
        x
      </button>
    </div>
  );
}
