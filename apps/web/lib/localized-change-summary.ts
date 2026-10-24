import { discoveryCopy } from "./discovery-copy";
import { selectChangeSummary } from "./change-presentation";
import type { SupportedLocale } from "./i18n";

/** Only known tracker templates are localized; stored editorial prose is preserved. */
export function changeSummaryText(value: unknown, locale: SupportedLocale, languageHint?: string) {
  const selected = selectChangeSummary(value, locale);
  if (!selected) return undefined;
  const copy = discoveryCopy(locale);
  const counts = selected.text.match(/^Tracker record correction: (\d+) updated claims, (\d+) newly recorded claims, (\d+) held or excluded claims\.$/);
  if (counts) return {
    text: copy.correctionSummary.replace(/\{(\d+)\}/g, (_, index) => counts[Number(index) + 1]),
    language: locale
  };
  if (selected.text === "Reviewed scoped record correction; historical held claims remain excluded from current policy conclusions.") {
    return { text: copy.correctionFallback, language: locale };
  }
  return { text: selected.text, language: languageHint ?? selected.language };
}
