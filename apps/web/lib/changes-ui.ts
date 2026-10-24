import type { SupportedLocale } from "./i18n";
import { translateSurfaceText } from "./surface-localization";
export { changeSummaryText } from "./localized-change-summary";

export function changesUi(template: string, locale: SupportedLocale, ...values: Array<string | number>) {
  return translateSurfaceText(template, locale).replace(/\{(\d+)\}/g, (_, index) => String(values[Number(index)] ?? ""));
}
