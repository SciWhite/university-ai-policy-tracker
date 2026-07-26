"use client";

import { Suspense, useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import {
  DEFAULT_LOCALE,
  HIDDEN_AUTO_LOCALES,
  VISIBLE_LOCALES,
  getLocaleFromPathname,
  getLocaleLabel,
  getPathnameWithoutLocale,
  isLocalizablePath,
  localizeHref,
  normalizeLocale,
  type SupportedLocale
} from "@/lib/i18n";
import { getShellMessages } from "@/lib/i18n-messages";
import { trackResearchEvent } from "@/lib/analytics-client";

const LOCALE_STORAGE_KEY = "uapt-locale-choice";

// useSearchParams needs a Suspense boundary during prerender; the fallback
// renders the same switcher without the (client-only) query suffix.
export function LanguageSwitcher() {
  return (
    <Suspense fallback={<LanguageSwitcherLinks search="" />}>
      <LanguageSwitcherWithSearch />
    </Suspense>
  );
}

function LanguageSwitcherWithSearch() {
  const searchParams = useSearchParams();
  const search = searchParams.toString();

  return <LanguageSwitcherLinks search={search ? `?${search}` : ""} />;
}

function LanguageSwitcherLinks({ search }: { search: string }) {
  const pathname = usePathname();
  const locale = getLocaleFromPathname(pathname);
  const messages = getShellMessages(locale).locale;
  const unprefixedPathname = getPathnameWithoutLocale(pathname);
  const isLocalizable = isLocalizablePath(pathname);
  const [browserLocale, setBrowserLocale] = useState<SupportedLocale | null>(
    null
  );

  useEffect(() => {
    const preferred = window.navigator.languages
      ?.map((value) => normalizeLocale(value))
      .find((value) => HIDDEN_AUTO_LOCALES.includes(value));

    setBrowserLocale(preferred ?? null);
  }, []);

  // Hidden locales stay reachable for the readers they concern: the locale
  // the page is on now, and the browser's preferred one.
  const locales: SupportedLocale[] = [...VISIBLE_LOCALES];
  for (const extra of [locale, browserLocale]) {
    if (extra && !locales.includes(extra)) locales.push(extra);
  }

  function hrefFor(target: SupportedLocale): string {
    // Pages without localized variants keep the reader in place on the
    // default locale and fall back to the localized home elsewhere.
    if (!isLocalizable) {
      return target === DEFAULT_LOCALE
        ? `${unprefixedPathname}${search}`
        : localizeHref("/", target);
    }

    return localizeHref(`${unprefixedPathname}${search}`, target);
  }

  function rememberLocale(nextLocale: SupportedLocale) {
    trackResearchEvent("locale_switch", {
      from_locale: locale,
      to_locale: nextLocale
    });

    try {
      window.localStorage.setItem(LOCALE_STORAGE_KEY, nextLocale);
      window.localStorage.setItem("uapt-locale-suggestion-dismissed", "1");
    } catch {
      // localStorage can be unavailable in private or restricted contexts.
    }
  }

  return (
    <div className="language-switcher" aria-label={messages.label}>
      <span>{messages.label}</span>
      <div className="language-switcher__links">
        {locales.map((supportedLocale) => (
          <a
            aria-current={supportedLocale === locale ? "page" : undefined}
            href={hrefFor(supportedLocale)}
            hrefLang={supportedLocale}
            key={supportedLocale}
            onClick={() => rememberLocale(supportedLocale)}
          >
            {supportedLocale === DEFAULT_LOCALE ? "EN" : supportedLocale.toUpperCase()}
          </a>
        ))}
      </div>
      <span className="visually-hidden">
        {getLocaleLabel(locale)}
      </span>
    </div>
  );
}
