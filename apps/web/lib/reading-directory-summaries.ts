import { createHash } from "node:crypto";
import type { PublicEntitySummary } from "@uapt/shared";
import type { ReadingLocale } from "./language-catalog";
import { isPublishedV6Slug } from "./policy-v6-published-gate";
import { getReadingTranslations, readingSummaryBasis, readingTranslation, type ReadingTranslationResult } from "./reading-translations";
import { getLocalPublicUniversitySummaryBySlug } from "./catalog";


export function translatedDirectorySummary(summary: PublicEntitySummary, translations: ReadingTranslationResult): string | undefined {
  if (translations.state !== "ready") return undefined;
  const basis = readingSummaryBasis(summary);
  if (basis.recordSha256 !== translations.school.recordSha256 || basis.originalEvidenceSha256 !== translations.school.originalEvidenceSha256) return undefined;
  const hash = createHash("sha256").update(summary.summary).digest("hex");
  if (!translations.school.sourceFieldUses?.[hash]?.includes("/public/summary")) return undefined;
  const text = readingTranslation(summary.summary, [translations.school]);
  return text.translated ? text.text : undefined;
}

/** Read only the visible page's selected schools; never load all school bundles. */
export async function localizeDirectorySummaries<T extends { slug: string; summary?: string }>(rows: T[], locale: ReadingLocale): Promise<T[]> {
  if (locale === "en") return rows;
  const localized: T[] = [];
  for (const row of rows) {
    if (!row.summary || !isPublishedV6Slug(row.slug)) { localized.push(row); continue; }
    const record = await getLocalPublicUniversitySummaryBySlug(row.slug);
    if (!record || record.summary !== row.summary) { localized.push(row); continue; }
    const translations = await getReadingTranslations(row.slug, locale, readingSummaryBasis(record));
    const text = translatedDirectorySummary(record, translations);
    localized.push(text ? { ...row, summary: text } : row);
  }
  return localized;
}
