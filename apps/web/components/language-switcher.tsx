"use client";

import { usePathname } from "next/navigation";
import {
  DEFAULT_LOCALE,
  VISIBLE_LOCALES,
  getLocaleFromPathname,
  getLocaleLabel,
  getPathnameWithoutLocale,
  isLocalizablePath,
  localizeHref,
  type SupportedLocale
} from "@/lib/i18n";
import { getShellMessages } from "@/lib/i18n-messages";

const LOCALE_STORAGE_KEY = "uapt-locale-choice";

export function LanguageSwitcher() {
  const pathname = usePathname();
  const locale = getLocaleFromPathname(pathname);
  const messages = getShellMessages(locale).locale;
  const unprefixedPathname = getPathnameWithoutLocale(pathname);
  const switchBasePath = isLocalizablePath(pathname) ? unprefixedPathname : "/";

  function rememberLocale(nextLocale: SupportedLocale) {
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
        {VISIBLE_LOCALES.map((supportedLocale) => (
          <a
            aria-current={supportedLocale === locale ? "page" : undefined}
            href={localizeHref(switchBasePath, supportedLocale)}
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
