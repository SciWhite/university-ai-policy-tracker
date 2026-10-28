import { createHash } from "node:crypto";
import { readFile, realpath, stat } from "node:fs/promises";
import path from "node:path";
import { isReadingLocale, type ReadingLocale } from "./language-catalog";
import type { PublicEntitySummary } from "@uapt/shared";

export interface ReadingTranslation {
  source: string;
  sourceSha256: string;
  translation: string;
}
export interface ReadingTranslationBundle {
  schemaVersion: "uapt-reading-translations-v1";
  sourceSha256: string;
  locale: ReadingLocale;
  slug: string;
  recordSha256: string;
  originalEvidenceSha256: string;
  review: { status: "accepted"; receiptSha256: string };
  protectedClaimIds: string[];
  requiredSourceHashes: string[];
  strings: Record<string, ReadingTranslation>;
}
export interface ReadingTranslationSelection {
  schemaVersion: "uapt-reading-selection-v1";
  revision: string;
  sourceSha256: string;
  publicationApproved: boolean;
  candidateOnly?: true;
  shared: Partial<Record<ReadingLocale, { path: string; sha256: string }>>;
  schools: Record<string, Partial<Record<ReadingLocale, { path: string; sha256: string }>>>;
}
export type ReadingTranslationResult =
  | { state: "ready"; revision: string; shared: ReadingTranslationBundle; school: ReadingTranslationBundle }
  | { state: "not_configured" | "unavailable" | "unapproved" | "stale_record" | "invalid_package" };
const digest = (bytes: string | Buffer) => createHash("sha256").update(bytes).digest("hex");
const sha = (value: unknown): value is string => typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
const safeSlug = (value: string) => /^(?:_shared|[a-z0-9]+(?:-[a-z0-9]+)*)$/.test(value);
const protectedTokens = (text: string) => [...text.matchAll(/https?:\/\/[^\s<>]+|\{[^{}]+\}|\b[a-f0-9]{64}\b|\b[a-z]+(?:_[a-z]+)+\b/g)].map(match => match[0]).sort();
const occurrences = (text: string, token: string) => text.split(token).length - 1;
function literalNumbers(text: string, claimIds: readonly string[]): Map<string, number> {
  for (const token of [...protectedTokens(text), ...claimIds].sort((a, b) => b.length - a.length)) text = text.split(token).join(" ");
  const counts = new Map<string, number>();
  for (const [number] of text.matchAll(/(?<![A-Za-z0-9_])\d+(?:[.,:/-]\d+)*(?![A-Za-z0-9_])/g)) counts.set(number, (counts.get(number) ?? 0) + 1);
  return counts;
}

/** Display-only translations; original evidence and canonical records remain separate. */
export function validateReadingTranslationBundle(value: ReadingTranslationBundle, expected: { sourceSha256: string; locale: ReadingLocale; slug: string }): ReadingTranslationBundle {
  if (value.schemaVersion !== "uapt-reading-translations-v1" || value.sourceSha256 !== expected.sourceSha256 || !sha(value.sourceSha256) || value.locale !== expected.locale || value.slug !== expected.slug || !safeSlug(value.slug) || !sha(value.recordSha256) || !sha(value.originalEvidenceSha256) || value.review?.status !== "accepted" || !sha(value.review.receiptSha256)) throw Error("Invalid translation identity or review");
  if (!Array.isArray(value.protectedClaimIds) || new Set(value.protectedClaimIds).size !== value.protectedClaimIds.length || value.protectedClaimIds.some(id => typeof id !== "string" || !id || id.length > 300)) throw Error("Invalid protected Claim inventory");
  if (!Array.isArray(value.requiredSourceHashes) || new Set(value.requiredSourceHashes).size !== value.requiredSourceHashes.length || !value.requiredSourceHashes.length || !value.strings || typeof value.strings !== "object" || Array.isArray(value.strings)) throw Error("Invalid translation coverage");
  const keys = Object.keys(value.strings);
  if (keys.length !== value.requiredSourceHashes.length || value.requiredSourceHashes.some(key => !sha(key) || !Object.hasOwn(value.strings, key))) throw Error("Incomplete display translations");
  for (const [key, unit] of Object.entries(value.strings)) {
    if (!unit || key !== unit.sourceSha256 || typeof unit.source !== "string" || digest(unit.source) !== key || typeof unit.translation !== "string" || !unit.translation.trim() || /[\u202a-\u202e\u2066-\u2069]/u.test(unit.translation)) throw Error("Invalid translation source or text");
    if (JSON.stringify(protectedTokens(unit.source)) !== JSON.stringify(protectedTokens(unit.translation))) throw Error("Translation changed protected tokens");
    for (const id of value.protectedClaimIds) if (occurrences(unit.source, id) !== occurrences(unit.translation, id)) throw Error("Translation changed protected Claim ID");
    const sourceNumbers = literalNumbers(unit.source, value.protectedClaimIds), targetNumbers = literalNumbers(unit.translation, value.protectedClaimIds);
    // Preserve each existing literal and its count, as the generator does. A
    // reviewed word-to-digit rendering (three -> 3) may add a target numeral;
    // its meaning is covered by the accepted, hash-bound semantic receipt.
    for (const [number, count] of sourceNumbers) if (targetNumbers.get(number) !== count) throw Error("Translation changed numeric facts");
  }
  return value;
}

async function verifiedJson<T>(root: string, ref: { path: string; sha256: string }, limit: number): Promise<T> {
  if (!ref || !sha(ref.sha256) || typeof ref.path !== "string" || path.isAbsolute(ref.path) || ref.path.split(/[\\/]/).includes("..")) throw Error("Invalid translation reference");
  const target = await realpath(path.join(root, ref.path));
  if (!target.startsWith(root + path.sep)) throw Error("Translation reference escapes package");
  const info = await stat(target);
  if (!info.isFile() || info.size > limit) throw Error("Translation artifact exceeds limit");
  const raw = await readFile(target);
  if (raw.byteLength > limit || digest(raw) !== ref.sha256) throw Error("Translation bytes changed");
  return JSON.parse(raw.toString("utf8")) as T;
}

/** Reads a selected immutable public display package; never reads generator queues or candidate outputs. */
export async function getReadingTranslations(slug: string, locale: ReadingLocale, basis: { recordSha256: string; originalEvidenceSha256: string }, pointer = process.env.UAPT_READING_PACKAGE_POINTER): Promise<ReadingTranslationResult> {
  if (!pointer) return { state: "not_configured" };
  if (!safeSlug(slug) || !isReadingLocale(locale)) return { state: "invalid_package" };
  try {
    const root = await realpath(path.dirname(pointer));
    const pointerPath = await realpath(pointer);
    if (!pointerPath.startsWith(root + path.sep)) return { state: "invalid_package" };
    const ref = JSON.parse(await readFile(pointerPath, "utf8")) as { path: string; sha256: string };
    const selection = await verifiedJson<ReadingTranslationSelection>(root, ref, 8 * 1024 * 1024);
    if (selection.schemaVersion !== "uapt-reading-selection-v1" || !sha(selection.sourceSha256) || !selection.revision || !selection.shared || !selection.schools) return { state: "invalid_package" };
    if (selection.publicationApproved !== true || selection.candidateOnly) return { state: "unapproved" };
    const sharedRef = selection.shared[locale], schoolRef = selection.schools[slug]?.[locale];
    if (!sharedRef || !schoolRef) return { state: "unavailable" };
    const [shared, school] = await Promise.all([verifiedJson<ReadingTranslationBundle>(root, sharedRef, 4 * 1024 * 1024), verifiedJson<ReadingTranslationBundle>(root, schoolRef, 4 * 1024 * 1024)]);
    validateReadingTranslationBundle(shared, { sourceSha256: selection.sourceSha256, locale, slug: "_shared" });
    validateReadingTranslationBundle(school, { sourceSha256: selection.sourceSha256, locale, slug });
    if (school.recordSha256 !== basis.recordSha256 || school.originalEvidenceSha256 !== basis.originalEvidenceSha256) return { state: "stale_record" };
    return { state: "ready", revision: selection.revision, shared, school };
  } catch { return { state: "invalid_package" }; }
}

/** Exact source hashes allow faithful reuse. Missing text is never counted as translated. */
export function readingTranslation(text: string, bundles: readonly ReadingTranslationBundle[]): { text: string; translated: boolean } {
  const key = digest(text);
  for (const bundle of bundles) {
    const unit = bundle.strings[key];
    if (unit && unit.source === text) return { text: unit.translation, translated: true };
  }
  return { text, translated: false };
}

/** Build a page's display record after its original record has passed normal acceptance.
 * This returned view must never replace the canonical API/MCP record or snapshot input. */
export function readingSummaryView(summary: PublicEntitySummary, translations: Extract<ReadingTranslationResult, { state: "ready" }>): PublicEntitySummary {
  const basis = digest(JSON.stringify(summary));
  const evidence = digest(JSON.stringify(summary.claims.map(claim => ({ id: claim.id, evidence: claim.evidence }))));
  if (basis !== translations.school.recordSha256 || evidence !== translations.school.originalEvidenceSha256) throw Error("Display record basis changed");
  const bundles = [translations.school, translations.shared];
  const required = (source: string) => {
    const value = readingTranslation(source, bundles);
    if (!value.translated) throw Error("Display translation missing");
    return value.text;
  };
  return { ...summary, summary: required(summary.summary), claims: summary.claims.map(claim => ({ ...claim, claimText: required(claim.claimText) })) };
}

export function readingMetadata(pathname: string, locale: ReadingLocale, eligibleLocales: readonly ReadingLocale[], siteUrl: string, complete: boolean) {
  const localized = (language: ReadingLocale) => new URL(`${language === "en" ? "" : "/" + language}${pathname}`, siteUrl).href;
  const eligible = complete && eligibleLocales.includes(locale);
  return {
    alternates: { canonical: localized(locale), languages: eligible ? { ...Object.fromEntries(eligibleLocales.map(language => [language, localized(language)])), "x-default": localized("en") } : {} },
    robots: { index: locale === "en" || eligible, follow: true }
  };
}
