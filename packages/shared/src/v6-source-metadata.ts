import { z } from "zod";

/**
 * Public document metadata for the official sources of V6 university records
 * (content file `data/public-v6-source-metadata.json`). Every value carries a
 * verbatim quote from the captured source text. Review is agent-only
 * (`agent_reviewed`); nothing here asserts human or institutional review.
 */
export const V6_SOURCE_METADATA_FILE = "data/public-v6-source-metadata.json";

export const v6SourceDateKinds = ["effective", "approved", "adopted", "issued_or_published", "revised", "reviewed", "last_updated_page", "next_review"] as const;
export const v6SourceDocTypes = ["policy", "procedure", "guideline", "guidance_page", "faq", "committee_report", "announcement", "course_statement", "form_or_template", "tool_listing", "other"] as const;
export const v6SourceIssuerCategories = ["university_leadership", "provost_academic_affairs", "academic_senate_or_board", "teaching_learning_centre", "library", "it_services", "faculty_or_department", "graduate_school", "research_office", "student_affairs_or_integrity", "communications_or_news", "legal_or_compliance", "other"] as const;

const quote = z.string().min(1).max(2000);
const precision = z.enum(["day", "month", "year"]);
const dateValue = z.string().regex(/^\d{4}(-(0[1-9]|1[0-2])(-(0[1-9]|[12]\d|3[01]))?)?$/);
const precisionMatches = (d: { value: string; precision: "day" | "month" | "year" }) => d.value.split("-").length === { year: 1, month: 2, day: 3 }[d.precision];
const shownDate = z.object({ kind: z.enum([...v6SourceDateKinds, "verified"]), value: dateValue, precision }).refine(precisionMatches, "Date precision does not match its value");

export const v6SourceDocumentSchema = z.object({
  url: z.string().url().regex(/^https?:\/\//),
  docType: z.enum(v6SourceDocTypes),
  stage: z.enum(["issued", "draft", "unknown"]),
  issuer: z.object({ name: z.string().min(1).max(300), role: z.enum(["owner", "approver", "publisher_unit"]), category: z.enum(v6SourceIssuerCategories), quote }).nullable(),
  approvedBy: z.object({ name: z.string().min(1).max(300), quote }).nullable(),
  dates: z.array(z.object({ kind: z.enum(v6SourceDateKinds), value: dateValue, precision, quote }).refine(precisionMatches, "Date precision does not match its value")),
  displayDate: shownDate,
  latestUpdate: shownDate.nullable(),
  version: z.object({ value: z.string().min(1).max(200), quote }).nullable(),
  scope: z.object({ en: z.string().min(1).max(1000), quote }).nullable(),
  lastVerifiedOn: z.iso.date(),
  capture: z.object({ sha256: z.string().regex(/^[a-f0-9]{64}$/), hashKind: z.enum(["raw_captured_bytes", "rendered_dom", "rendered_markdown"]) })
});

/**
 * An official source that has no document record, with the reason. Only
 * `fetch_failed` is open to new work: the source was requested on `checkedOn`
 * and could not be read (HTTP error, bot challenge, empty page). A source whose
 * text was read but states no date or issuer is not a gap: it is a document with
 * `issuer: null`, no dates and `displayDate.kind: "verified"`.
 */
export const v6SourceMetadataGapReasons = ["fetch_failed"] as const;
export const v6SourceMetadataGapSchema = z.object({
  url: z.string().url().regex(/^https?:\/\//),
  reason: z.enum(v6SourceMetadataGapReasons),
  detail: z.string().min(1).max(500),
  checkedOn: z.iso.date()
});

const slugKey = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
export const v6SourceMetadataSchema = z.object({
  schemaVersion: z.literal("uapt-v6-source-metadata-v1"),
  generatedAt: z.iso.datetime(),
  reviewState: z.literal("agent_reviewed"),
  method: z.string().min(1),
  dateRule: z.string().min(1),
  basis: z.object({ contentId: z.string().min(1), candidateSha256: z.string().regex(/^[a-f0-9]{64}$/), schools: z.number().int().nonnegative() }),
  schools: z.record(slugKey, z.array(v6SourceDocumentSchema)),
  gaps: z.record(slugKey, z.array(v6SourceMetadataGapSchema)).optional()
});

export type V6SourceDocument = z.infer<typeof v6SourceDocumentSchema>;
export type V6SourceMetadata = z.infer<typeof v6SourceMetadataSchema>;
export type V6SourceMetadataGap = z.infer<typeof v6SourceMetadataGapSchema>;

/**
 * Delivery contract for V6 schools: every official source of every V6 school
 * has a document record or a `fetch_failed` gap. `legacyUnprocessed` lists the
 * (slug, URL key) pairs the first bulk run (2026-11-18) never processed; they
 * pass without a record until they are processed. The list may only shrink:
 * new schools and new sources get no exemption.
 */
export function v6SourceMetadataCoverage(
  metadata: V6SourceMetadata,
  officialUrlsBySlug: Record<string, readonly string[]>,
  legacyUnprocessed: Readonly<Record<string, readonly string[]>> = {}
) {
  const errors: string[] = [];
  const stats = { schools: 0, officialSources: 0, documented: 0, fetchFailed: 0, legacyUnprocessed: 0 };
  for (const [slug, urls] of Object.entries(officialUrlsBySlug).sort(([a], [b]) => a.localeCompare(b))) {
    stats.schools += 1;
    const documented = new Set((metadata.schools[slug] ?? []).map((document) => v6SourceUrlKey(document.url)));
    const gaps = new Map((metadata.gaps?.[slug] ?? []).map((gap) => [v6SourceUrlKey(gap.url), gap]));
    const legacy = new Set(legacyUnprocessed[slug] ?? []);
    for (const key of gaps.keys()) if (documented.has(key)) errors.push(`${slug}: ${key} is both documented and listed as a gap`);
    for (const key of [...new Set(urls.map(v6SourceUrlKey))].sort()) {
      stats.officialSources += 1;
      if (documented.has(key)) stats.documented += 1;
      else if (gaps.has(key)) stats.fetchFailed += 1;
      else if (legacy.has(key)) stats.legacyUnprocessed += 1;
      else errors.push(`${slug}: official source ${key} has no source-metadata record (document or fetch_failed gap)`);
    }
  }
  return { errors, stats };
}

/** Match key for official source URLs: host without www, path without trailing slash, query kept. */
export function v6SourceUrlKey(url: string): string {
  try {
    const parsed = new URL(url.trim());
    return `${parsed.hostname.toLowerCase().replace(/^www\./, "")}${parsed.pathname.replace(/\/+$/, "")}${parsed.search}`;
  } catch {
    return url.trim();
  }
}

/** Public projection used by the university API (full documents with quotes). */
export function v6SourceMetadataProjection(metadata: V6SourceMetadata, slug: string) {
  const documents = metadata.schools[slug];
  if (!documents?.length) return undefined;
  return {
    schemaVersion: metadata.schemaVersion,
    reviewState: metadata.reviewState,
    generatedAt: metadata.generatedAt,
    method: metadata.method,
    dateRule: metadata.dateRule,
    documents
  };
}

/**
 * Compact MCP projection: no quotes (they stay in the public JSON), limited to
 * the given official source URLs when provided, so tool output stays small.
 */
export function v6SourceMetadataCompact(metadata: V6SourceMetadata, slug: string, onlyUrls?: Iterable<string>) {
  const documents = metadata.schools[slug];
  if (!documents?.length) return undefined;
  const wanted = onlyUrls ? new Set([...onlyUrls].map(v6SourceUrlKey)) : undefined;
  const selected = documents.filter((document) => !wanted || wanted.has(v6SourceUrlKey(document.url)));
  if (!selected.length) return undefined;
  return {
    schemaVersion: metadata.schemaVersion,
    reviewState: metadata.reviewState,
    generatedAt: metadata.generatedAt,
    dateRule: metadata.dateRule,
    documents: selected.map((document) => ({
      url: document.url, docType: document.docType, stage: document.stage,
      displayDate: document.displayDate, latestUpdate: document.latestUpdate,
      issuer: document.issuer ? { name: document.issuer.name, category: document.issuer.category } : null,
      approvedBy: document.approvedBy?.name ?? null,
    })),
  };
}
