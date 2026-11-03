import en from "@/messages/en.json";
import es from "@/messages/es.json";
import fr from "@/messages/fr.json";
import ms from "@/messages/ms.json";
import nl from "@/messages/nl.json";
import pl from "@/messages/pl.json";
import zh from "@/messages/zh.json";
import { clarityCopy } from "./clarity-copy";
import { rankingBrowserCopy } from "./ranking-browser-copy";
import { legacyLocale, type SupportedLocale } from "@/lib/i18n";
import type { ReadingLocale } from "@/lib/language-catalog";

const messagesByLocale: Partial<Record<SupportedLocale, typeof en>> = {
  en,
  zh,
  fr,
  pl,
  es,
  nl,
  ms
} as const;

export type ShellMessages = (typeof en)["Shell"];

export function getShellMessages(locale: ReadingLocale | SupportedLocale): ShellMessages {
  return (messagesByLocale[legacyLocale(locale as ReadingLocale)] ?? en).Shell;
}

export function getEnglishShellTextSources(): string[] {
  const output = new Set<string>();
  const visit = (value: unknown) => {
    if (typeof value === "string") { if (value.trim()) output.add(value); }
    else if (Array.isArray(value)) value.forEach(visit);
    else if (value && typeof value === "object") Object.values(value).forEach(visit);
  };
  visit(en.Shell);
  visit(clarityCopy.en);
  output.add(rankingBrowserCopy("en").directory);
  return [...output];
}

export { interpolate } from "./reading-ui-text";
