import { createHash } from "node:crypto";
import scope from "../../../data/confirmed-empty-diff-scope.json";
import type { ChangeRecord } from "./change-records";

const approved = new Map(Object.entries(scope.releases).map(([id, slugs]) => [id, new Set<string>(slugs)]));
const fingerprints = new Map(Object.entries(scope.fingerprints).map(([id, rows]) => [id, new Map(Object.entries(rows))]));
const protectedPairs = new Set<string>(scope.protectedRevisionSchoolPairs);
const sitemapAliases = new Map<string, string>(Object.entries(scope.sitemapAliasTargets));
const counters = ["added", "modified", "removed", "claimMetadataChanged", "evidenceChanged", "newlyExtractedClaims", "policyTextChanged", "sourceAdded", "sourceRemoved", "sourceSnapshotChanged", "sourceTextChanged", "trackerRemovedClaims"] as const;

export function isIndexPolicySitemapAlias(slug: string): boolean { return sitemapAliases.has(slug); }

/** Legacy main has no v2 history loader. Its exact immutable leaf scope is bound to
 * the accepted 881-event projection in the release ledger. Stage 3 must recheck
 * those runtime hashes/route owners before packaging; no live history is replaced. */
export function frozenLegacyEventState(releaseId: string, slug: string): "none" | "present" | "unknown" {
  if (protectedPairs.has(`${releaseId}/${slug}`)) return "present";
  return fingerprints.get(releaseId)?.has(slug) ? "none" : "unknown";
}

/** Narrow first batch; uncertainty preserves index behavior. Never used for school/overview routes. */
export function isConfirmedEmptyDiff(record: ChangeRecord & {publicationKind?: string}, input: {
  releaseId: string; locale: string; alias: boolean; eventState: "none" | "present" | "unknown";
}): boolean {
  if (input.locale !== "en" || input.alias || input.eventState !== "none" || isIndexPolicySitemapAlias(record.slug) ||
      protectedPairs.has(`${input.releaseId}/${record.slug}`) ||
      approved.get(input.releaseId)?.has(record.slug) !== true || record.releaseId !== input.releaseId ||
      !record.previousReleaseId || record.publicationKind === "scoped_record_correction" ||
      !Array.isArray(record.diffRows) || record.diffRows.length !== 0 ||
      !Array.isArray(record.diffLines) || record.diffLines.length !== 0 ||
      !counters.every(key => typeof record[key] === "number" && record[key] === 0)) return false;
  const shape = [record.releaseId, record.previousReleaseId, record.slug, ...counters.map(key => record[key]), record.diffRows.length, record.diffLines.length];
  return createHash("sha256").update(JSON.stringify(shape)).digest("hex") === fingerprints.get(input.releaseId)?.get(record.slug);
}
export function emptyDiffMetadata(canonical: string) {
  return { robots: { index: false, follow: true }, alternates: { canonical, languages: {} } };
}
