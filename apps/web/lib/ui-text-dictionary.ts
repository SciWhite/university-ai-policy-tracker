import { createHash } from "node:crypto";
import enShell from "@/messages/en.json";
import enPages from "@/messages/pages/en.json";
import enSurfaces from "@/messages/surfaces/en.json";
import publicUiSources from "@/messages/public-ui/en.json";
import { getEnglishShellTextSources } from "./i18n-messages";
import { isSupportedLocale } from "./i18n";
import { getPublicReadingUiText } from "./public-ui-translations";
import { getReadingSharedUiText } from "./reading-translations";
import { UI_ONLY_LOCALES } from "./content-locales";
import type { ReadingLocale } from "./language-catalog";
import { translatePolicyReferenceUi, policyReferenceUi } from "./policy-reference-ui";
import { changeHistoryCopy } from "./change-history-copy";
import { changeIndexEventsCopy } from "./change-index-events-copy";
import { changeSummaryCopy } from "./change-summary-copy";
import { discoveryCopy } from "./discovery-copy";
import { getHomeV4Copy } from "./home-v4-copy";
import { mockupCopy } from "./mockup-copy";
import { getPageCopy } from "./page-copy";
import { policyV6Copy } from "./policy-v6-copy";
import { policyV6DensityCopy } from "./policy-v6-density-copy";
import { policyV6InteractionCopy } from "./policy-v6-interaction-copy";
import { policyV6ReaderCopy } from "./policy-v6-reader-copy";
import { policyV6RecordCopy } from "./policy-v6-record-copy";
import { policyV6SourceMetadataCopy } from "./policy-v6-source-metadata-copy";
import { getProjectCopy } from "./project-copy";
import { rankingBrowserCopy } from "./ranking-browser-copy";
import { rankingsCopy } from "./rankings-copy";
import { v6ChangesCopy } from "./v6-changes-copy";

/**
 * Browser UI dictionaries for the UI-only reading locales (lib/content-locales.ts): English
 * source string -> translation, from the same sources the server used to render
 * /<locale>/... pages: the content release's accepted reading UI text and the
 * source-controlled public-UI additions (all 31 locales), plus, for the legacy UI locales
 * (fr/pl/es/nl/ms), the surface, page-copy and shell message files matched to English by
 * index or key. Served content-hashed by app/ui-text/[file]/route.ts.
 */
export const UI_TEXT_SCHEMA = "uapt-ui-text-v1";

type Json = string | number | boolean | null | Json[] | { [key: string]: Json };

function zip(source: Json, target: Json | undefined, out: Record<string, string>) {
  if (typeof source === "string") {
    if (typeof target === "string" && source.trim() && target.trim() && target !== source) out[source.trim()] = target.trim();
  } else if (Array.isArray(source)) {
    source.forEach((item, index) => zip(item, Array.isArray(target) ? target[index] : undefined, out));
  } else if (source && typeof source === "object") {
    for (const [key, value] of Object.entries(source)) zip(value, target && typeof target === "object" && !Array.isArray(target) ? target[key] : undefined, out);
  }
}

/**
 * Component copy modules (locale -> object), zipped by key against English. Functions that take
 * a SupportedLocale only run for the legacy UI locales; reading-locale ones run for all.
 */
const SUPPORTED_COPY: Array<(locale: never) => unknown> = [changeHistoryCopy, changeIndexEventsCopy, changeSummaryCopy, policyV6Copy, policyV6DensityCopy, policyV6InteractionCopy, policyV6ReaderCopy, policyV6RecordCopy, policyV6SourceMetadataCopy, v6ChangesCopy];
const READING_COPY: Array<(locale: never) => unknown> = [discoveryCopy, getHomeV4Copy, mockupCopy, getPageCopy, getProjectCopy, rankingBrowserCopy, rankingsCopy];

function copyModules(locale: ReadingLocale, out: Record<string, string>, sources?: Set<string>) {
  const call = (fn: (locale: never) => unknown, value: ReadingLocale) => { try { return fn(value as never) as Json; } catch { return undefined; } };
  for (const fn of [...READING_COPY, ...(isSupportedLocale(locale) ? SUPPORTED_COPY : [])]) {
    const english = call(fn, "en");
    if (english === undefined) continue;
    if (sources) collect(english, sources);
    else zip(english, call(fn, locale), out);
  }
  if (isSupportedLocale(locale)) for (const source of Object.keys(policyReferenceUi)) {
    if (sources) sources.add(source);
    else { const target = translatePolicyReferenceUi(source, locale); if (target !== source) out[source] = target; }
  }
}

function collect(value: Json, sources: Set<string>) {
  if (typeof value === "string") { if (value.trim()) sources.add(value.trim()); }
  else if (Array.isArray(value)) value.forEach(item => collect(item, sources));
  else if (value && typeof value === "object") Object.values(value).forEach(item => collect(item, sources));
}

async function legacyDictionaries(locale: ReadingLocale): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  copyModules(locale, out);
  if (!isSupportedLocale(locale) || locale === "en") return out;
  const [shell, pages, surfaces] = await Promise.all([
    import(`@/messages/${locale}.json`).then(m => m.default as Json),
    import(`@/messages/pages/${locale}.json`).then(m => m.default as Json),
    import(`@/messages/surfaces/${locale}.json`).then(m => m.default as Json)
  ]);
  zip(enSurfaces as Json, surfaces, out);
  zip(enPages as Json, pages, out);
  zip(enShell as Json, shell, out);
  return out;
}

/** Every English UI string the dictionaries can translate. */
export function uiTextSources(): string[] {
  const sources = new Set<string>([...(publicUiSources as string[]), ...getEnglishShellTextSources()]);
  const visit = (value: Json) => {
    if (typeof value === "string") { if (value.trim()) sources.add(value.trim()); }
    else if (Array.isArray(value)) value.forEach(visit);
    else if (value && typeof value === "object") Object.values(value).forEach(visit);
  };
  visit(enSurfaces as Json); visit(enPages as Json); visit(enShell as Json);
  copyModules("en", {}, sources);
  return [...sources].sort();
}

export async function buildUiTextDictionary(locale: ReadingLocale): Promise<Record<string, string>> {
  const legacy = await legacyDictionaries(locale);
  // Every accepted shared entry of the content release (component strings that no source list
  // names, e.g. the student guide), then the source-controlled public-UI additions.
  const [shared, accepted] = await Promise.all([
    getReadingSharedUiText(locale, "all").catch(() => ({} as Record<string, string>)),
    getPublicReadingUiText(locale, uiTextSources()).catch(() => ({} as Record<string, string>))
  ]);
  // Accepted reading text and public-UI additions win, as on the server-rendered pages.
  const merged: Record<string, string> = { ...legacy, ...shared, ...accepted };
  return Object.fromEntries(Object.entries(merged).filter(([source, target]) => source !== target).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));
}

export function dictionaryFile(locale: ReadingLocale, body: string): string {
  return `${locale}.${createHash("sha256").update(body).digest("hex").slice(0, 16)}.json`;
}

export async function uiTextManifest(): Promise<{ schemaVersion: string; files: Record<string, string>; bodies: Record<string, string> }> {
  const files: Record<string, string> = {}, bodies: Record<string, string> = {};
  for (const locale of UI_ONLY_LOCALES) {
    const body = JSON.stringify({ schemaVersion: UI_TEXT_SCHEMA, locale, text: await buildUiTextDictionary(locale) });
    const file = dictionaryFile(locale, body);
    files[locale] = file; bodies[file] = body;
  }
  return { schemaVersion: UI_TEXT_SCHEMA, files, bodies };
}
