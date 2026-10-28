import type { ReadingLocale } from "./language-catalog";

export interface UniversityLocaleIndexPolicy {
  schemaVersion: "uapt-university-locale-index-policy-v1";
  sourceSha256: string;
  schools: Record<string, {
    recordSha256: string;
    locales: ReadingLocale[];
    evidence: Array<{ locale: ReadingLocale; kind: "published_source_language" | "verified_institution_language" | "retained_citation" | "user_instruction"; url?: string; sourceSnapshotHash?: string }>;
  }>;
  globalCitationExceptions: Record<string, ReadingLocale[]>;
}

export interface TranslationCoverage {
  sharedLocales: readonly ReadingLocale[];
  schools: Record<string, { recordSha256: string; completeLocales: readonly ReadingLocale[] }>;
}

/** Indexing requires both school applicability and complete accepted display prose. */
export function universityIndexLocales(slug: string, policy: UniversityLocaleIndexPolicy, coverage: TranslationCoverage): ReadingLocale[] {
  const school = policy.schools[slug];
  const translated = coverage.schools[slug];
  if (!school || !translated || school.recordSha256 !== translated.recordSha256) return ["en"];
  return ["en", ...school.locales.filter(locale => locale !== "en" && translated.completeLocales.includes(locale) && coverage.sharedLocales.includes(locale))];
}

export function readingUrlIndexEligible(pathname: string, locale: ReadingLocale, policy: UniversityLocaleIndexPolicy, coverage: TranslationCoverage): boolean {
  if (pathname.includes("?") || pathname.includes("#")) return false;
  if (locale === "en") return true;
  const university = /^\/universities\/([a-z0-9-]+)\/?$/.exec(pathname);
  if (university) return universityIndexLocales(university[1], policy, coverage).includes(locale);
  if (!coverage.sharedLocales.includes(locale)) return false;
  if (policy.globalCitationExceptions[pathname]?.includes(locale)) return true;
  return ["zh", "fr", "pl"].includes(locale);
}
