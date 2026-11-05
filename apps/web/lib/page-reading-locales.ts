import { useSyncExternalStore } from "react";
import { getPathnameWithoutLocale } from "./i18n";
import type { ReadingLocale } from "./language-catalog";

/**
 * Client-safe store for languages a page declares it has content in. Base-tier
 * university pages compute this on the server (translation gate) and declare it
 * here, so the site header's language switcher lists only those languages.
 */
type Declaration = { path: string; locales: readonly ReadingLocale[] };
let declaration: Declaration | undefined;
const listeners = new Set<() => void>();

export function declarePageReadingLocales(value: Declaration | undefined) {
  declaration = value;
  listeners.forEach(listener => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function declaredPageReadingLocales(pathname: string): readonly ReadingLocale[] | undefined {
  const path = getPathnameWithoutLocale(pathname).split(/[?#]/, 1)[0];
  return declaration && declaration.path === path ? declaration.locales : undefined;
}

export function useDeclaredPageReadingLocales(pathname: string): readonly ReadingLocale[] | undefined {
  const current = useSyncExternalStore(subscribe, () => declaration, () => undefined);
  return current ? declaredPageReadingLocales(pathname) : undefined;
}
