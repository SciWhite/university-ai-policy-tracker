"use client";
import { useSyncExternalStore } from "react";
import { UI_LOCALE_STORAGE_KEY, isUiOnlyLocale, uiLocaleFromFragment } from "./content-locales";
import type { ReadingLocale } from "./language-catalog";

/**
 * The reader's UI language on content-language pages (lib/content-locales.ts): a UI-only
 * reading locale, or undefined for the page's own language. Kept in localStorage; a
 * `#ui=<locale>` fragment (redirects, switcher links) sets it, `#ui=en` clears it.
 */
const EVENT = "uapt-ui-locale-change";
let memory: ReadingLocale | undefined;

export function readUiLocale(): ReadingLocale | undefined {
  try {
    const stored = window.localStorage.getItem(UI_LOCALE_STORAGE_KEY);
    return stored && isUiOnlyLocale(stored) ? stored : undefined;
  } catch {
    return memory;
  }
}

export function writeUiLocale(locale: ReadingLocale | undefined) {
  const value = locale && isUiOnlyLocale(locale) ? locale : undefined;
  memory = value;
  try {
    if (value) window.localStorage.setItem(UI_LOCALE_STORAGE_KEY, value);
    else window.localStorage.removeItem(UI_LOCALE_STORAGE_KEY);
  } catch {
    // Without storage the preference lasts for this page only.
  }
  window.dispatchEvent(new CustomEvent(EVENT));
}

/** Adopt a `#ui=` fragment into the preference and drop it from the address bar. */
export function adoptUiLocaleFragment(): boolean {
  const locale = uiLocaleFromFragment(window.location.hash);
  if (!locale) return false;
  // Drop the fragment first: writeUiLocale notifies listeners synchronously, and they adopt again.
  window.history.replaceState(window.history.state, "", window.location.pathname + window.location.search);
  writeUiLocale(isUiOnlyLocale(locale) ? locale : undefined);
  return true;
}

function subscribe(listener: () => void) {
  window.addEventListener(EVENT, listener);
  window.addEventListener("storage", listener);
  return () => {
    window.removeEventListener(EVENT, listener);
    window.removeEventListener("storage", listener);
  };
}

export function useUiLocale(): ReadingLocale | undefined {
  return useSyncExternalStore(subscribe, readUiLocale, () => undefined);
}
