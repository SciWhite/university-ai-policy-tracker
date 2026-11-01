"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import {
  DEFAULT_LOCALE,
  getReadingLocaleFromPathname,
  legacyLocale,
  getLocaleLabel,
  getPathnameWithoutLocale,
  isLocalizablePath,
  isSupportedLocale,
  localizeHref,
  type SupportedLocale
} from "@/lib/i18n";
import { getShellMessages, interpolate } from "@/lib/i18n-messages";
import { applyAcceptedReadingUiText } from "@/lib/reading-ui-text";
import { useReadingUiText } from "@/components/reading-ui-text-provider";
import { trackResearchEvent } from "@/lib/analytics-client";
import { preferredReadingLocale } from "@/lib/language-catalog";

const DISMISS_STORAGE_KEY = "uapt-locale-suggestion-dismissed";
const CHOICE_STORAGE_KEY = "uapt-locale-choice";

export function LanguageSuggestion() {
  const pathname = usePathname();
  const readingLocale = getReadingLocaleFromPathname(pathname);
  const locale = legacyLocale(readingLocale);
  const [suggestedLocale, setSuggestedLocale] = useState<SupportedLocale | null>(
    null
  );
  const messages = applyAcceptedReadingUiText(getShellMessages(readingLocale).locale, useReadingUiText());

  useEffect(() => {
    if (readingLocale !== DEFAULT_LOCALE) return;

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

    // Every supported browser locale gets the same consent banner; silently
    // redirecting readers into a locale the switcher does not advertise left
    // them with no visible way back.
    const browserLocale = preferredReadingLocale(window.navigator.languages ?? []);
    setSuggestedLocale(browserLocale && browserLocale !== DEFAULT_LOCALE && isSupportedLocale(browserLocale) ? browserLocale : null);
  }, [readingLocale, pathname]);

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
