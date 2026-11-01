"use client";

import { preservePolicyReferenceSearch } from "@/lib/policy-reference-preview";
import { Suspense } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import {
  DEFAULT_LOCALE,
  ROUTED_LOCALES,
  getReadingLocaleFromPathname,
  getLocaleLabel,
  getPathnameWithoutLocale,
  isLocalizablePath,
  localizeHref,
} from "@/lib/i18n";
import type { ReadingLocale } from "@/lib/language-catalog";
import { getShellMessages } from "@/lib/i18n-messages";
import { applyAcceptedReadingUiText } from "@/lib/reading-ui-text";
import { useReadingUiText } from "@/components/reading-ui-text-provider";
import { trackResearchEvent } from "@/lib/analytics-client";
import { isReadingLocale } from "@/lib/language-catalog";

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
  const locale = getReadingLocaleFromPathname(pathname);
  const sharedUiText = useReadingUiText();
  const messages = applyAcceptedReadingUiText(getShellMessages(locale).locale, sharedUiText);
  const unprefixedPathname = getPathnameWithoutLocale(pathname);
  const isLocalizable = isLocalizablePath(pathname);
  // Every accepted reading version is directly selectable. Legacy UI message
  // dictionaries remain a separate seven-locale concern.
  const locales: ReadingLocale[] = [...ROUTED_LOCALES];

  function hrefFor(target: ReadingLocale): string {
    // Pages without localized variants keep the reader in place on the
    // default locale and fall back to the localized home elsewhere.
    if (!isLocalizable) {
      return target === DEFAULT_LOCALE
        ? `${unprefixedPathname}${search}`
        : localizeHref("/", target);
    }

    return localizeHref(`${unprefixedPathname}${search}`, target);
  }

  function rememberLocale(nextLocale: ReadingLocale) {
    if (isReadingLocale(locale) && isReadingLocale(nextLocale)) {
      trackResearchEvent("locale_switch", { from_locale: locale, to_locale: nextLocale });
    }

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
            onClick={(event) => {
              const target = preservePolicyReferenceSearch(hrefFor(supportedLocale), window.location.search);
              rememberLocale(supportedLocale);
              if (target.includes("layout=reference-v4") || target.includes("layout=home-v4")) {
                event.preventDefault();
                window.location.assign(target);
              }
            }}
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
