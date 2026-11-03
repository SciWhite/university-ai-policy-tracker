import type { ReadingLocale } from "./language-catalog";
import { getReadingSharedUiText } from "./reading-translations";

const additionsByLocale = {
  "ar": () => import("../messages/public-ui/ar.json"),
  "bn": () => import("../messages/public-ui/bn.json"),
  "cs": () => import("../messages/public-ui/cs.json"),
  "da": () => import("../messages/public-ui/da.json"),
  "de": () => import("../messages/public-ui/de.json"),
  "el": () => import("../messages/public-ui/el.json"),
  "es": () => import("../messages/public-ui/es.json"),
  "fa": () => import("../messages/public-ui/fa.json"),
  "fi": () => import("../messages/public-ui/fi.json"),
  "fr": () => import("../messages/public-ui/fr.json"),
  "he": () => import("../messages/public-ui/he.json"),
  "hi": () => import("../messages/public-ui/hi.json"),
  "hu": () => import("../messages/public-ui/hu.json"),
  "id": () => import("../messages/public-ui/id.json"),
  "it": () => import("../messages/public-ui/it.json"),
  "ja": () => import("../messages/public-ui/ja.json"),
  "ko": () => import("../messages/public-ui/ko.json"),
  "lt": () => import("../messages/public-ui/lt.json"),
  "ms": () => import("../messages/public-ui/ms.json"),
  "nb": () => import("../messages/public-ui/nb.json"),
  "nl": () => import("../messages/public-ui/nl.json"),
  "pl": () => import("../messages/public-ui/pl.json"),
  "pt": () => import("../messages/public-ui/pt.json"),
  "ru": () => import("../messages/public-ui/ru.json"),
  "sv": () => import("../messages/public-ui/sv.json"),
  "th": () => import("../messages/public-ui/th.json"),
  "tr": () => import("../messages/public-ui/tr.json"),
  "uk": () => import("../messages/public-ui/uk.json"),
  "ur": () => import("../messages/public-ui/ur.json"),
  "vi": () => import("../messages/public-ui/vi.json"),
  "zh": () => import("../messages/public-ui/zh.json"),
  "zh-Hant": () => import("../messages/public-ui/zh-Hant.json"),
} satisfies Record<Exclude<ReadingLocale, "en">, () => Promise<{ default: Record<string, string> }>>;

/** Small source-controlled UI additions; policy/evidence packages stay separate. */
export async function getPublicReadingUiText(locale: ReadingLocale, sources: readonly string[]): Promise<Record<string, string>> {
  if (locale === "en") return {};
  const [accepted, additions] = await Promise.all([
    getReadingSharedUiText(locale, sources),
    additionsByLocale[locale]().then(module => module.default as Record<string, string>)
  ]);
  const result = { ...accepted };
  for (const source of sources) {
    if (Object.hasOwn(additions, source)) result[source] = additions[source];
  }
  return result;
}
