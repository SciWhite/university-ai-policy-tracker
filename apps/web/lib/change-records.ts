import { countCorrectionIds, selectChangeSummary } from "./change-presentation";
import { cache } from "react";
import {v6HistoryRepair} from "./v6-history-repair";
import {BoundedAsyncCache} from './bounded-cache';
import {v6FrozenHistory} from "./v6-history-cache";
import {readV6RecordCorrections,readV6RecordCorrectionRevision,v6SummaryAtRevision} from "./v6-effective-records";
import {
  OFFICIAL_SOURCE_RIGHTS_CAVEAT,
  PUBLIC_API_VERSION,
  TRACKER_METADATA_LICENSE,
  NO_ADVICE_BOUNDARY,
  policyClaimTypeSchema,
  type ClaimReviewState,
  type PolicyClaim,
  type PolicyClaimType,
  type PublicEntitySummary,
  type SourceAttribution,
  buildPublicApiCitation
} from "@uapt/shared";
import {readFile} from "node:fs/promises";
import path from "node:path";
import {findRepoRoot} from "./repo-root";
import {readCorrectionChangeCache,readRecordCorrectionChanges} from "./record-correction-changes";
import { getEntityAliasResolver } from "./entity-aliases";
import { readPublicChangeHistory } from "./public-change-history";
import { getStagedPublicDataset } from "./staged-public-data";
import {
  getLatestReleaseDiff,
  getKnownReleaseIds,
  getReleaseDiff,
  buildPublicReleaseDiff,
  type ReleaseDiff,
  type ReleaseDiffRow,
  type ReleaseEntityDiff
} from "./release-diffs";
import { getPolicyThemeLabel } from "./policy-theme-labels";
import { getSiteBaseUrl } from "./site-url";

export interface DiffPreviewLine {
  newLineNumber?: number;
  oldLineNumber?: number;
  type: "equal" | "insert" | "delete";
  value: string;
}

export interface SourceChangeRecord {
  citationTitle: string;
  retrievedAt?: string;
  sourceLastModified?: string;
  snapshotHash: string;
  sourceType?: string;
  sourceUrl: string;
  trackerCheckedAt?: string;
}

export interface ClaimChangeRecord {
  claimId?: string;
  claimText: string;
  claimType: string;
  confidence: number;
  evidenceCount: number;
  lastChangedAt?: string;
  lastCheckedAt?: string;
  reviewState: ClaimReviewState;
  sourceLanguages: string[];
}

export interface ChangeRecord {
  publicationKind?: "scoped_record_correction";
  changeSummary?: string;
  recordSha256?: string;
  added: number;
  candidateClaimCount: number;
  canonicalUrl: string;
  claimMetadataChanged: number;
  changeUrl: string;
  claimChanges: ClaimChangeRecord[];
  claimCount: number;
  confidence?: number;
  diffLines: DiffPreviewLine[];
  diffRows: ReleaseDiffRow[];
  evidenceChanged: number;
  lastChangedAt?: string;
  lastCheckedAt?: string;
  modified: number;
  name: string;
  newlyExtractedClaims: number;
  previousReleaseId?: string;
  policyTextChanged: number;
  publicJsonUrl: string;
  releaseId?: string;
  removed: number;
  reviewState: ClaimReviewState;
  reviewedClaimCount: number;
  slug: string;
  sourceAdded: number;
  sourceChanges: SourceChangeRecord[];
  sourceCount: number;
  sourceRemoved: number;
  sourceSnapshotChanged: number;
  sourceTextChanged: number;
  summary: string;
  trackerRemovedClaims: number;
  unchanged: number;
  universityUrl: string;
  firstSeenAt?: string;
  releaseCount: number;
}

export interface ChangeIndexThemeFacet {
  count: number;
  label: string;
  theme: PolicyClaimType;
}

export interface ChangeIndexReviewFacet {
  count: number;
  label: string;
  reviewState: ClaimReviewState;
}

export type ChangeIndexSourceHealthSeverity =
  | "healthy"
  | "warning"
  | "error"
  | "unknown";

export interface ChangeIndexSourceHealthFacet {
  count: number;
  label: string;
  severity: ChangeIndexSourceHealthSeverity;
}

export interface ChangeIndexPrimaryDiff {
  changeCategory: string;
  changeExplanation: string;
  changeType: string;
  newClaimText?: string;
  newClaimType?: string;
  oldClaimText?: string;
  oldClaimType?: string;
  previousReleaseId?: string;
  releaseId: string;
}

export interface ChangeIndexRecord {
  publicationKind?: "scoped_record_correction";
  changeSummary?: string;
  recordSha256?: string;
  canonicalUrl: string;
  changeUrl: string;
  claimCount: number;
  claimMetadataChanged: number;
  confidence?: number;
  evidenceChanged: number;
  firstSeenAt?: string;
  lastChangedAt?: string;
  lastCheckedAt?: string;
  name: string;
  newlyExtractedClaims: number;
  reviewedClaimCount: number;
  policyTextChanged: number;
  primaryDiff?: ChangeIndexPrimaryDiff;
  primaryTheme?: PolicyClaimType;
  publicJsonUrl: string;
  releaseCount: number;
  releaseId?: string;
  removed: number;
  reviewState: ClaimReviewState;
  slug: string;
  sourceAdded: number;
  sourceCount: number;
  sourceHealth: ChangeIndexSourceHealthSeverity;
  sourceHealthLabel: string;
  sourceRemoved: number;
  sourceSnapshotChanged: number;
  sourceTextChanged: number;
  summary: string;
  themes: ChangeIndexThemeFacet[];
  trackerRemovedClaims: number;
  universityUrl: string;
}

export interface ChangeIndexData {
  apiVersion: typeof PUBLIC_API_VERSION;
  canonicalUrl: string;
  citation: ReturnType<typeof buildPublicApiCitation>;
  data: {
    facets: {
      reviewStates: ChangeIndexReviewFacet[];
      sourceHealth: ChangeIndexSourceHealthFacet[];
      themes: ChangeIndexThemeFacet[];
    };
    records: ChangeIndexRecord[];
    summary: {
      claimCount: number;
      newlyExtractedClaimsCount: number;
      policyTextChangedCount: number;
      recordCount: number;
      reviewedClaimCount: number;
      sourceHealthIssueCount: number;
      sourceSnapshotChangedCount: number;
      sourceTextChangedCount: number;
    };
  };
  generatedAt: string;
  license: typeof TRACKER_METADATA_LICENSE;
  limitations: string[];
  publicJsonUrl: string;
  sourcePolicy: typeof OFFICIAL_SOURCE_RIGHTS_CAVEAT;
  sourceRightsPolicy: typeof OFFICIAL_SOURCE_RIGHTS_CAVEAT;
  trackerMetadataLicense: typeof TRACKER_METADATA_LICENSE;
}

export interface EntityChangeHistory {
  summaryLanguage?: string;
  record: ChangeRecord;
  releaseRecords: ChangeRecord[];
}

const aggregateChangeRecordsCache = new BoundedAsyncCache<ChangeRecord[]>(1, 8*1024*1024, 1, 32);
const allReleaseChangedRecordsCache = new BoundedAsyncCache<ChangeRecord[]>(1, 8*1024*1024, 1, 32);
const changeIndexCache = new BoundedAsyncCache<ChangeIndexData>(1, 4*1024*1024, 1, 32);

export function changeHistoryCacheStats(){return {aggregate:aggregateChangeRecordsCache.stats(),releases:allReleaseChangedRecordsCache.stats(),index:changeIndexCache.stats()};}

export async function getChangeRecords(): Promise<ChangeRecord[]> {
  const rows = await aggregateChangeRecordsCache.get("current", buildAggregatedChangeRecords);
  const correction = readV6RecordCorrections();
  if (!correction) return rows;
  const correctedSlugs = new Set(correction.summaries.map((s) => s.entity.slug));
  return [...correction.summaries.map(v6ChangeRecord), ...rows.filter((r) => !correctedSlugs.has(r.slug))].sort(compareFreshness);
}

export async function getChangeIndexData(): Promise<ChangeIndexData> {
  const cached = withoutAliasSlugRows(
    await changeIndexCache.get("current", () => readCorrectionChangeCache<ChangeIndexData>("index.json").then(cached => cached ?? buildChangeIndexData())),
    (await getEntityAliasResolver()).slugAliases
  );
  const correction = readV6RecordCorrections();
  if (!correction) return cached;
  const correctedSlugs = new Set(correction.summaries.map((s) => s.entity.slug));
  const records = [...correction.summaries.map(s => buildChangeIndexRecord(v6ChangeRecord(s))), ...cached.data.records.filter((r) => !correctedSlugs.has(r.slug))].sort(compareFreshness);
  return {...cached, data: {...cached.data, records, facets: buildChangeIndexFacets(records), summary: buildChangeIndexSummary(records)}};
}

export async function getChangeIndexResponse(): Promise<ChangeIndexData> {
  return getChangeIndexData();
}

async function buildAggregatedChangeRecords(): Promise<ChangeRecord[]> {
  const dataset = await getStagedPublicDataset();
  const releaseRecords = await getAllReleaseChangedRecords();
  const releaseRecordsBySlug = groupBySlug(releaseRecords);

  return dataset.publicSummaries
    .map((summary) =>
      buildAggregateChangeRecord(
        summary,
        releaseRecordsBySlug.get(summary.entity.slug) ?? []
      )
    )
    .filter((record) => record.diffRows.length)
    .sort(compareFreshness);
}

/** Detail pages select one entity before resolving policy shards. Global listings
 * retain their existing complete-record loader. Cache only within this request. */
export const getReleaseChangeRecord = cache(async (releaseId: string, slug: string): Promise<ChangeRecord | undefined> => {
  const releaseDiff = await getReleaseDiff(releaseId);
  const entity = releaseDiff?.entities.find(row => row.entitySlug === slug);
  if (!releaseDiff || !entity) return undefined;
  const corrected = (releaseDiff.releaseId ? v6SummaryAtRevision(slug, releaseDiff.releaseId) : undefined) ?? v6SummaryAtRevision(slug);
  const summary = corrected ?? (await getStagedPublicDataset()).publicSummaries.find(row => row.entity.slug === slug);
  return summary ? buildChangeRecord(summary, entity) : buildDiffOnlyChangeRecord(entity);
});

export async function getReleaseChangeRecords(
  releaseId: string
): Promise<ChangeRecord[] | undefined> {
  const releaseDiff = await getReleaseDiff(releaseId);
  if (!releaseDiff) return undefined;
  const dataset = await getStagedPublicDataset();
  const summariesBySlug = new Map(
    dataset.publicSummaries.map((summary) => [summary.entity.slug, summary])
  );

  return releaseDiff.entities
    .map((entity) => {
      const summary = (releaseDiff.releaseId ? v6SummaryAtRevision(entity.entitySlug, releaseDiff.releaseId) : undefined) ?? v6SummaryAtRevision(entity.entitySlug) ?? summariesBySlug.get(entity.entitySlug);
      return summary
        ? buildChangeRecord(summary, entity)
        : buildDiffOnlyChangeRecord(entity);
    })
    .sort(compareFreshness);
}

export async function getChangeRecordBySlug(
  slug: string
): Promise<ChangeRecord | undefined> {
  return (await getChangeRecords()).find((record) => record.slug === slug);
}

export async function getEntityChangeHistory(
  slug: string,
  locale: import("./i18n").SupportedLocale = "en"
): Promise<EntityChangeHistory | undefined> {
  const frozen = v6FrozenHistory(slug);
  if (frozen) {
    const normalizedFrozen = frozen.map((row) => ({
      ...row,
      changeSummary: selectChangeSummary(row.changeSummary, locale)?.text,
    }));
    const corrected = v6SummaryAtRevision(slug)!;
    const current = v6ChangeRecord(corrected);
    const candidateFrozen = normalizedFrozen.find(
      (row) => row.releaseId === current.releaseId
    );
    const repaired=v6HistoryRepair(slug,current.releaseId!);
    const effectiveCurrent = repaired ?? (candidateFrozen
      ? { ...current, ...candidateFrozen,
          added: current.added, modified: current.modified, removed: current.removed,
          newlyExtractedClaims: current.newlyExtractedClaims,
          trackerRemovedClaims: current.trackerRemovedClaims,
          unchanged: current.unchanged,
          changeSummary: candidateFrozen.changeSummary === "Reviewed scoped record correction; historical held claims remain excluded from current policy conclusions."
            ? current.changeSummary : candidateFrozen.changeSummary,
        }
      : current);
    return {
      summaryLanguage: selectChangeSummary((repaired ?? frozen.find(row => row.releaseId === current.releaseId) ?? current).changeSummary, locale)?.language,
      record: effectiveCurrent,
      releaseRecords: [
        effectiveCurrent,
        ...normalizedFrozen.filter((row) => row.releaseId !== current.releaseId),
      ],
    };
  }
  if ((await readRecordCorrectionChanges()).some(entry => entry.slug === slug)) {
    const cached = await readCorrectionChangeCache<EntityChangeHistory>(`${slug}.json`);
    if (cached) {const corrected=v6SummaryAtRevision(slug);return corrected?{record:v6ChangeRecord(corrected),releaseRecords:[v6ChangeRecord(corrected),...cached.releaseRecords]}:cached;}
  }
  const dataset = await getStagedPublicDataset();
  const summary = dataset.publicSummaries.find((item) => item.entity.slug === slug);
  const releaseRecords = await readPublicChangeHistory(slug);

  if (!summary && !releaseRecords.length) return undefined;

  const record = summary
    ? buildAggregateChangeRecord(summary, releaseRecords)
    : buildDiffOnlyAggregateChangeRecord(slug, releaseRecords);

  const corrected=v6SummaryAtRevision(slug);
  return corrected?{record:v6ChangeRecord(corrected),releaseRecords:[v6ChangeRecord(corrected),...releaseRecords]}:{record,releaseRecords};
}

async function getAllReleaseChangedRecords(): Promise<ChangeRecord[]> {
  return allReleaseChangedRecordsCache.get("history", buildAllReleaseChangedRecords);
}

/** Offline export only: keep global historical reconstruction off page requests. */
export async function buildPublicHistoryProjection() {
  const dataset = await getStagedPublicDataset();
  const summaries = new Map(dataset.publicSummaries.map(summary => [summary.entity.slug, summary]));
  const records: ChangeRecord[] = [];
  const releases: Record<string, ReleaseDiff> = {};
  for (const releaseId of await getKnownReleaseIds()) {
    const diff = await buildPublicReleaseDiff(releaseId);
    if (!diff) continue;
    releases[releaseId] = diff;
    if (!diff.previousReleaseId) continue;
    for (const entity of diff.entities.filter(entity => entity.rows.length)) {
      const summary = summaries.get(entity.entitySlug);
      records.push(summary ? buildChangeRecord(summary, entity) : buildDiffOnlyChangeRecord(entity));
    }
  }
  return { histories: Object.fromEntries(groupBySlug(records.sort(compareFreshness))), releases };
}

async function buildAllReleaseChangedRecords(): Promise<ChangeRecord[]> {
  const releaseIds = await getKnownReleaseIds();
  const records: ChangeRecord[] = [];

  for (const releaseId of releaseIds) {
    const releaseDiff = await getReleaseDiff(releaseId);
    if (!releaseDiff?.previousReleaseId) continue;

    const releaseRecords = await getReleaseChangeRecords(releaseId);
    records.push(
      ...(releaseRecords ?? []).filter((record) => record.diffRows.length)
    );
  }

  return records.sort(compareFreshness);
}

async function buildChangeIndexData(): Promise<ChangeIndexData> {
  const records = await getChangeRecords();
  const computedRecords = records.map(buildChangeIndexRecord);
  // Scope this correction release to the two audited schools. Preserve every
  // other published index row instead of silently recalculating global history.
  const baseline = JSON.parse(await readFile(path.join(await findRepoRoot(), "data/public-record-repairs/change-index-baseline.json"), "utf8")) as ChangeIndexData;
  const corrections = await readRecordCorrectionChanges();
  const corrected = corrections.map(entry => {
    const record = computedRecords.find(item => item.slug === entry.slug);
    if (!record) throw new Error("Missing corrected change index record");
    return record;
  });
  // Baseline rows frozen under a registered alias slug predate that identity
  // merge. Like corrections, the merged canonical identity is recomputed from
  // the current record, whose release history now includes the alias rows.
  const { slugAliases } = await getEntityAliasResolver();
  const mergedSlugs = new Set(
    baseline.data.records
      .filter(item => slugAliases.has(item.slug))
      .map(item => slugAliases.get(item.slug)!)
      .filter(slug => !corrections.some(entry => entry.slug === slug))
  );
  const merged = [...mergedSlugs].map(slug => {
    const record = computedRecords.find(item => item.slug === slug);
    if (!record) throw new Error(`Missing merged identity change index record: ${slug}`);
    return record;
  });
  const indexRecords = [...corrected, ...merged, ...baseline.data.records.filter(item => !corrections.some(entry => entry.slug === item.slug) && !mergedSlugs.has(item.slug) && !slugAliases.has(item.slug))];
  const facets = buildChangeIndexFacets(indexRecords);
  const summary = buildChangeIndexSummary(indexRecords);
  const canonicalUrl = `${getSiteBaseUrl()}/changes`;
  const publicJsonUrl = `${getSiteBaseUrl()}/api/public/${PUBLIC_API_VERSION}/changes/index.json`;

  return {
    apiVersion: PUBLIC_API_VERSION,
    canonicalUrl,
    citation: buildPublicApiCitation({
      citationTitle: "University AI Policy Tracker changes index",
      canonicalUrl,
      publicJsonUrl,
      suggestedCitation:
        "University AI Policy Tracker changes index. University AI Policy Tracker. Version v1. " +
        canonicalUrl
    }),
    data: {
      facets,
      records: indexRecords,
      summary
    },
    generatedAt: new Date().toISOString(),
    license: TRACKER_METADATA_LICENSE,
    limitations: [
      "Change records are tracker metadata and do not publish official source text.",
      "Newly extracted claims and source snapshot changes are not by themselves policy conclusions.",
      NO_ADVICE_BOUNDARY
    ],
    publicJsonUrl,
    sourcePolicy: OFFICIAL_SOURCE_RIGHTS_CAVEAT,
    sourceRightsPolicy: OFFICIAL_SOURCE_RIGHTS_CAVEAT,
    trackerMetadataLicense: TRACKER_METADATA_LICENSE
  };
}

// A projection frozen before an identity merge must not list the retired alias
// beside its canonical record; the regenerated projection carries the merge.
function withoutAliasSlugRows(
  data: ChangeIndexData,
  slugAliases: ReadonlyMap<string, string>
): ChangeIndexData {
  if (!data.data.records.some(record => slugAliases.has(record.slug))) return data;
  const records = data.data.records.filter(record => !slugAliases.has(record.slug));
  return {...data, data: {...data.data, records, facets: buildChangeIndexFacets(records), summary: buildChangeIndexSummary(records)}};
}

function buildChangeIndexRecord(record: ChangeRecord): ChangeIndexRecord {
  const themes = countThemes(record);
  const sourceHealth = summarizeRecordSourceHealth(record);

  return {
    canonicalUrl: record.canonicalUrl,
    changeUrl: record.changeUrl,
    publicationKind: record.publicationKind,
    changeSummary: record.changeSummary,
    recordSha256: record.recordSha256,
    claimCount: record.claimCount,
    claimMetadataChanged: record.claimMetadataChanged,
    confidence: record.confidence,
    evidenceChanged: record.evidenceChanged,
    firstSeenAt: record.firstSeenAt,
    lastChangedAt: record.lastChangedAt,
    lastCheckedAt: record.lastCheckedAt,
    name: record.name,
    newlyExtractedClaims: record.newlyExtractedClaims,
    reviewedClaimCount: record.reviewedClaimCount,
    policyTextChanged: record.policyTextChanged,
    primaryDiff: pickPrimaryDiff(record),
    primaryTheme: themes[0]?.theme,
    publicJsonUrl: record.publicJsonUrl,
    releaseCount: record.releaseCount,
    releaseId: record.releaseId,
    removed: record.removed,
    reviewState: record.reviewState,
    slug: record.slug,
    sourceAdded: record.sourceAdded,
    sourceCount: record.sourceCount,
    sourceHealth: sourceHealth.severity,
    sourceHealthLabel: sourceHealth.label,
    sourceRemoved: record.sourceRemoved,
    sourceSnapshotChanged: record.sourceSnapshotChanged,
    sourceTextChanged: record.sourceTextChanged,
    summary: record.summary,
    themes,
    trackerRemovedClaims: record.trackerRemovedClaims,
    universityUrl: record.universityUrl
  };
}

function buildChangeIndexFacets(records: ChangeIndexRecord[]) {
  const reviewStates = new Map<ClaimReviewState, number>();
  const sourceHealth = new Map<ChangeIndexSourceHealthSeverity, number>();
  const themes = new Map<PolicyClaimType, number>();

  for (const record of records) {
    reviewStates.set(
      record.reviewState,
      (reviewStates.get(record.reviewState) ?? 0) + 1
    );
    sourceHealth.set(
      record.sourceHealth,
      (sourceHealth.get(record.sourceHealth) ?? 0) + 1
    );

    for (const theme of record.themes) {
      themes.set(theme.theme, (themes.get(theme.theme) ?? 0) + 1);
    }
  }

  return {
    reviewStates: Array.from(reviewStates.entries())
      .map(([reviewState, count]) => ({
        reviewState,
        count,
        label: formatReviewState(reviewState)
      }))
      .sort((left, right) => right.count - left.count || left.label.localeCompare(right.label)),
    sourceHealth: Array.from(sourceHealth.entries())
      .map(([severity, count]) => ({
        severity,
        count,
        label: formatSourceHealthSeverity(severity)
      }))
      .sort((left, right) => right.count - left.count || left.label.localeCompare(right.label)),
    themes: Array.from(themes.entries())
      .map(([theme, count]) => ({
        theme,
        count,
        label: getPolicyThemeLabel(theme)
      }))
      .sort((left, right) => right.count - left.count || left.label.localeCompare(right.label))
  };
}

function buildChangeIndexSummary(records: ChangeIndexRecord[]) {
  return {
    claimCount: records.reduce((total, record) => total + record.claimCount, 0),
    newlyExtractedClaimsCount: records.reduce(
      (total, record) => total + record.newlyExtractedClaims,
      0
    ),
    policyTextChangedCount: records.reduce(
      (total, record) => total + record.policyTextChanged,
      0
    ),
    recordCount: records.length,
    reviewedClaimCount: records.reduce(
      (total, record) => total + record.reviewedClaimCount,
      0
    ),
    sourceHealthIssueCount: records.filter(
      (record) => record.sourceHealth !== "healthy"
    ).length,
    sourceSnapshotChangedCount: records.reduce(
      (total, record) => total + record.sourceSnapshotChanged,
      0
    ),
    sourceTextChangedCount: records.reduce(
      (total, record) => total + record.sourceTextChanged,
      0
    )
  };
}

function countThemes(record: ChangeRecord): ChangeIndexThemeFacet[] {
  const themeCounts = new Map<PolicyClaimType, number>();

  for (const claim of record.claimChanges) {
    const parsedTheme = policyClaimTypeSchema.safeParse(claim.claimType);
    const theme = parsedTheme.success ? parsedTheme.data : "other";
    themeCounts.set(theme, (themeCounts.get(theme) ?? 0) + 1);
  }

  return Array.from(themeCounts.entries())
    .map(([theme, count]) => ({
      theme,
      count,
      label: getPolicyThemeLabel(theme)
    }))
    .sort((left, right) => right.count - left.count || left.label.localeCompare(right.label));
}

function summarizeRecordSourceHealth(
  record: ChangeRecord
): { label: string; severity: ChangeIndexSourceHealthSeverity } {
  if (record.sourceRemoved > 0) {
    return { label: "Source removed", severity: "error" };
  }

  if (
    record.sourceSnapshotChanged > 0 ||
    record.sourceTextChanged > 0 ||
    record.sourceAdded > 0
  ) {
    return { label: "Source changed", severity: "warning" };
  }

  if (record.sourceCount > 0) {
    return { label: "Healthy", severity: "healthy" };
  }

  return { label: "Unknown", severity: "unknown" };
}

function pickPrimaryDiff(record: ChangeRecord): ChangeIndexPrimaryDiff | undefined {
  const preferredRow =
    record.diffRows.find((row) => row.oldClaim || row.newClaim) ?? record.diffRows[0];

  if (!preferredRow) return undefined;

  return {
    changeCategory: preferredRow.changeCategory,
    changeExplanation: preferredRow.changeExplanation,
    changeType: preferredRow.changeType,
    newClaimText: preferredRow.newClaim?.claimText,
    newClaimType: preferredRow.newClaim?.claimType,
    oldClaimText: preferredRow.oldClaim?.claimText,
    oldClaimType: preferredRow.oldClaim?.claimType,
    previousReleaseId: preferredRow.previousReleaseId,
    releaseId: preferredRow.releaseId
  };
}

function buildChangeRecord(
  summary: PublicEntitySummary,
  diff?: ReleaseEntityDiff
): ChangeRecord {
  const siteBaseUrl = getSiteBaseUrl();
  const slug = summary.entity.slug;
  const reviewedClaimCount = summary.claims.filter((claim) =>
    isReviewedClaim(claim.reviewState)
  ).length;
  const sourceChanges = summary.officialSources.map(buildSourceChangeRecord);
  const claimChanges = summary.claims.map(buildClaimChangeRecord).sort(
    (left, right) => getFreshnessTime(right) - getFreshnessTime(left)
  );
  const semanticCounts = countSemanticRows(diff?.rows ?? []);

  return {
    slug,
    name: summary.entity.name,
    summary: summary.summary,
    canonicalUrl: summary.canonicalUrl,
    universityUrl: `/universities/${slug}`,
    changeUrl: `/changes/${slug}`,
    publicJsonUrl:
      summary.apiUrl ??
      new URL(
        `/api/public/${PUBLIC_API_VERSION}/universities/${slug}.json`,
        siteBaseUrl
      ).toString(),
    lastCheckedAt: summary.lastCheckedAt,
    lastChangedAt: diff?.lastChangedAt ?? summary.lastChangedAt,
    publicationKind: diff?.publicationKind,
    changeSummary: diff?.changeSummary,
    recordSha256: diff?.recordSha256,
    confidence: summary.confidence,
    reviewState: summary.reviewState,
    claimCount: summary.claims.length,
    added: diff?.added ?? 0,
    claimMetadataChanged: semanticCounts.claimMetadataChanged,
    reviewedClaimCount,
    candidateClaimCount: summary.claims.length - reviewedClaimCount,
    diffRows: diff?.rows ?? [],
    evidenceChanged: semanticCounts.evidenceChanged,
    modified: diff?.modified ?? 0,
    newlyExtractedClaims: semanticCounts.newlyExtractedClaims,
    previousReleaseId: diff?.previousReleaseId,
    policyTextChanged: semanticCounts.policyTextChanged,
    releaseId: diff?.currentReleaseId,
    removed: diff?.removed ?? 0,
    sourceAdded: semanticCounts.sourceAdded,
    sourceCount: summary.officialSources.length,
    sourceRemoved: semanticCounts.sourceRemoved,
    sourceChanges,
    sourceSnapshotChanged: semanticCounts.sourceSnapshotChanged,
    sourceTextChanged: semanticCounts.sourceTextChanged,
    claimChanges,
    diffLines: buildDiffPreview(summary, diff),
    trackerRemovedClaims: semanticCounts.trackerRemovedClaims,
    unchanged: diff?.unchanged ?? 0,
    firstSeenAt: diff?.lastChangedAt ?? diff?.lastCheckedAt ?? summary.lastCheckedAt,
    releaseCount: diff ? 1 : 0
  };
}

function buildDiffOnlyChangeRecord(diff: ReleaseEntityDiff): ChangeRecord {
  const semanticCounts = countSemanticRows(diff.rows);

  return {
    added: diff.added,
    candidateClaimCount: 0,
    canonicalUrl: diff.canonicalUrl,
    claimMetadataChanged: semanticCounts.claimMetadataChanged,
    changeUrl: `/changes/${diff.entitySlug}`,
    claimChanges: [],
    claimCount: 0,
    diffLines: buildDiffPreview(undefined, diff),
    diffRows: diff.rows,
    evidenceChanged: semanticCounts.evidenceChanged,
    lastChangedAt: diff.lastChangedAt,
    lastCheckedAt: diff.lastCheckedAt,
    modified: diff.modified,
    name: diff.entityName,
    newlyExtractedClaims: semanticCounts.newlyExtractedClaims,
    previousReleaseId: diff.previousReleaseId,
    policyTextChanged: semanticCounts.policyTextChanged,
    publicJsonUrl: diff.publicJsonUrl,
    releaseId: diff.currentReleaseId,
    removed: diff.removed,
    reviewState: "agent_reviewed",
    reviewedClaimCount: 0,
    slug: diff.entitySlug,
    sourceAdded: semanticCounts.sourceAdded,
    sourceChanges: [],
    sourceCount: 0,
    sourceRemoved: semanticCounts.sourceRemoved,
    sourceSnapshotChanged: semanticCounts.sourceSnapshotChanged,
    sourceTextChanged: semanticCounts.sourceTextChanged,
    summary: "",
    trackerRemovedClaims: semanticCounts.trackerRemovedClaims,
    universityUrl: `/universities/${diff.entitySlug}`,
    unchanged: diff.unchanged,
    firstSeenAt: diff.lastChangedAt ?? diff.lastCheckedAt,
    releaseCount: 1
  };
}

function buildAggregateChangeRecord(
  summary: PublicEntitySummary,
  releaseRecords: ChangeRecord[]
): ChangeRecord {
  if (!releaseRecords.length) return buildChangeRecord(summary);

  const aggregateDiff = buildAggregateEntityDiff(
    summary.entity.slug,
    summary.entity.name,
    releaseRecords
  );
  const record = buildChangeRecord(summary, aggregateDiff);

  return {
    ...record,
    changeUrl: `/changes/${summary.entity.slug}`,
    firstSeenAt:
      earliestIsoValue(
        releaseRecords.map((item) => item.lastChangedAt ?? item.lastCheckedAt)
      ) ?? record.firstSeenAt,
    releaseCount: releaseRecords.length,
    lastChangedAt: latestIsoValue(releaseRecords.map((item) => item.lastChangedAt)),
    lastCheckedAt:
      latestIsoValue(releaseRecords.map((item) => item.lastCheckedAt)) ??
      record.lastCheckedAt
  };
}

function buildDiffOnlyAggregateChangeRecord(
  slug: string,
  releaseRecords: ChangeRecord[]
): ChangeRecord {
  const newest = releaseRecords[0];
  const aggregateDiff = buildAggregateEntityDiff(
    slug,
    newest?.name ?? slug,
    releaseRecords
  );

  return {
    ...buildDiffOnlyChangeRecord(aggregateDiff),
    changeUrl: `/changes/${slug}`,
    firstSeenAt: earliestIsoValue(
      releaseRecords.map((item) => item.lastChangedAt ?? item.lastCheckedAt)
    ),
    releaseCount: releaseRecords.length,
    lastChangedAt: latestIsoValue(releaseRecords.map((item) => item.lastChangedAt)),
    lastCheckedAt: latestIsoValue(releaseRecords.map((item) => item.lastCheckedAt))
  };
}

function buildAggregateEntityDiff(
  slug: string,
  name: string,
  releaseRecords: ChangeRecord[]
): ReleaseEntityDiff {
  const latest = releaseRecords[0];
  const rows = releaseRecords.flatMap((record) => record.diffRows);
  const semanticCounts = countSemanticRows(rows);

  return {
    added: releaseRecords.reduce((total, record) => total + record.added, 0),
    canonicalUrl: latest?.canonicalUrl ?? `/changes/${slug}`,
    claimMetadataChanged: semanticCounts.claimMetadataChanged,
    currentReleaseId: latest?.releaseId ?? "multiple-releases",
    publicationKind: latest?.publicationKind,
    changeSummary:
      typeof latest?.changeSummary === "object" && latest?.changeSummary !== null
        ? ((latest.changeSummary as any).en || (latest.changeSummary as any).zh)
        : latest?.changeSummary,
    recordSha256: latest?.recordSha256,
    entityName: latest?.name ?? name,
    entitySlug: slug,
    evidenceChanged: semanticCounts.evidenceChanged,
    lastChangedAt: latestIsoValue(releaseRecords.map((item) => item.lastChangedAt)),
    lastCheckedAt: latestIsoValue(releaseRecords.map((item) => item.lastCheckedAt)),
    modified: releaseRecords.reduce((total, record) => total + record.modified, 0),
    newlyExtractedClaims: semanticCounts.newlyExtractedClaims,
    previousReleaseId: latest?.previousReleaseId,
    policyTextChanged: semanticCounts.policyTextChanged,
    publicJsonUrl: latest?.publicJsonUrl ?? "",
    removed: releaseRecords.reduce((total, record) => total + record.removed, 0),
    rows,
    sourceAdded: semanticCounts.sourceAdded,
    sourceRemoved: semanticCounts.sourceRemoved,
    sourceSnapshotChanged: semanticCounts.sourceSnapshotChanged,
    sourceTextChanged: semanticCounts.sourceTextChanged,
    trackerRemovedClaims: semanticCounts.trackerRemovedClaims,
    unchanged: 0
  };
}

function groupBySlug(records: ChangeRecord[]): Map<string, ChangeRecord[]> {
  const grouped = new Map<string, ChangeRecord[]>();

  for (const record of records) {
    const recordsForSlug = grouped.get(record.slug) ?? [];
    recordsForSlug.push(record);
    grouped.set(record.slug, recordsForSlug);
  }

  for (const recordsForSlug of grouped.values()) {
    recordsForSlug.sort(compareFreshness);
  }

  return grouped;
}

function buildSourceChangeRecord(source: SourceAttribution): SourceChangeRecord {
  return {
    citationTitle: source.citationTitle,
    retrievedAt: source.retrievedAt,
    sourceLastModified: source.sourceLastModified,
    snapshotHash: source.snapshotHash,
    sourceType: source.sourceType,
    sourceUrl: source.sourceUrl,
    trackerCheckedAt: source.trackerCheckedAt
  };
}

function buildClaimChangeRecord(claim: PolicyClaim): ClaimChangeRecord {
  return {
    claimId: claim.id,
    claimText: claim.claimText,
    claimType: claim.claimType,
    confidence: claim.confidence,
    evidenceCount: claim.evidence.length,
    lastChangedAt: claim.lastChangedAt,
    lastCheckedAt: claim.lastCheckedAt,
    reviewState: claim.reviewState,
    sourceLanguages: Array.from(
      new Set(
        claim.evidence
          .map((evidence) => evidence.sourceLanguage)
          .filter((language): language is string => Boolean(language))
      )
    ).sort()
  };
}

function buildDiffPreview(
  _summary: PublicEntitySummary | undefined,
  diff: ReleaseEntityDiff | undefined
): DiffPreviewLine[] {
  // A current snapshot without a recorded comparison is not an addition.
  return diff?.rows.length ? buildReleaseDiffLines(diff) : [];
}

function buildReleaseDiffLines(diff: ReleaseEntityDiff): DiffPreviewLine[] {
  const lines: DiffPreviewLine[] = [];
  let oldLineNumber = 1;
  let newLineNumber = 1;

  lines.push({
    type: "equal",
    oldLineNumber,
    newLineNumber,
    value: `# ${diff.entityName} AI policy diff`
  });
  oldLineNumber += 1;
  newLineNumber += 1;

  for (const row of diff.rows.slice(0, 80)) {
    lines.push({
      type: "equal",
      oldLineNumber,
      newLineNumber,
      value: `## ${formatChangeCategory(row)}`
    });
    oldLineNumber += 1;
    newLineNumber += 1;

    lines.push({
      type: "equal",
      oldLineNumber,
      newLineNumber,
      value: row.changeExplanation
    });
    oldLineNumber += 1;
    newLineNumber += 1;

    if (row.sourceTextDiffStatus || row.sourceTextDiffSummary) {
      lines.push({
        type: "equal",
        oldLineNumber,
        newLineNumber,
        value: formatSourceTextDiffLine(row)
      });
      oldLineNumber += 1;
      newLineNumber += 1;
    }

    if (
      row.changeType.endsWith("_removed") ||
      row.changeType === "claim_modified" ||
      row.changeType === "evidence_modified" ||
      row.changeType === "source_snapshot_changed"
    ) {
      const oldValues = rowToOldLines(row);
      for (const value of oldValues) {
        lines.push({ type: "delete", oldLineNumber, value });
        oldLineNumber += 1;
      }
    }

    if (row.changeType.endsWith("_added") || row.changeType === "claim_modified" || row.changeType === "evidence_modified" || row.changeType === "source_snapshot_changed") {
      const newValues = rowToNewLines(row);
      for (const value of newValues) {
        lines.push({ type: "insert", newLineNumber, value });
        newLineNumber += 1;
      }
    }
  }

  return lines;
}

function countSemanticRows(rows: ReleaseDiffRow[]) {
  return {
    claimMetadataChanged: rows.filter(
      (row) => row.changeCategory === "claim_metadata_changed"
    ).length,
    evidenceChanged: rows.filter((row) => row.changeCategory === "evidence_changed")
      .length,
    newlyExtractedClaims: rows.filter(
      (row) => row.changeCategory === "newly_extracted_claim"
    ).length,
    policyTextChanged: rows.filter(
      (row) => row.changeCategory === "policy_text_changed"
    ).length,
    sourceAdded: rows.filter((row) => row.changeCategory === "source_added").length,
    sourceRemoved: rows.filter((row) => row.changeCategory === "source_removed")
      .length,
    sourceSnapshotChanged: rows.filter(
      (row) => row.changeCategory === "source_snapshot_changed"
    ).length,
    sourceTextChanged: rows.filter(
      (row) => row.sourceTextDiffStatus === "normalized_text_changed"
    ).length,
    trackerRemovedClaims: rows.filter(
      (row) => row.changeCategory === "tracker_removed_claim"
    ).length
  };
}

function formatChangeCategory(row: ReleaseDiffRow): string {
  switch (row.changeCategory) {
    case "policy_text_changed":
      return "Policy text changed";
    case "newly_extracted_claim":
      return "Newly extracted tracker claim";
    case "tracker_removed_claim":
      return "Tracker claim removed";
    case "claim_metadata_changed":
      return "Claim metadata changed";
    case "evidence_changed":
      return "Evidence linkage changed";
    case "source_added":
      return "Source attribution added";
    case "source_removed":
      return "Source attribution removed";
    case "source_snapshot_changed":
      return "Source snapshot hash changed";
    case "metadata_changed":
    default:
      return "Tracker metadata changed";
  }
}

function rowToOldLines(row: ReleaseDiffRow): string[] {
  if (row.oldClaim) {
    return [
      `${row.oldClaim.claimType}: ${row.oldClaim.claimText}`,
      ...((row.oldEvidence ?? row.oldClaim.evidence).slice(0, 1).map(
        (evidence) =>
          `Evidence (${evidence.sourceLanguage ?? "und"}, ${evidence.sourceSnapshotHash.slice(0, 12)}): ${evidence.evidenceSnippet}`
      )),
      ...formatSourceFreshnessLines(row)
    ];
  }
  if (row.oldSnapshotHash && row.sourceUrl) {
    return [
      `Source ${row.sourceUrl} snapshot ${row.oldSnapshotHash}`,
      ...formatSourceFreshnessLines(row)
    ];
  }
  return [];
}

function rowToNewLines(row: ReleaseDiffRow): string[] {
  if (row.newClaim) {
    return [
      `${row.newClaim.claimType}: ${row.newClaim.claimText}`,
      ...((row.newEvidence ?? row.newClaim.evidence).slice(0, 1).map(
        (evidence) =>
          `Evidence (${evidence.sourceLanguage ?? "und"}, ${evidence.sourceSnapshotHash.slice(0, 12)}): ${evidence.evidenceSnippet}`
      )),
      ...formatSourceFreshnessLines(row)
    ];
  }
  if (row.newSnapshotHash && row.sourceUrl) {
    return [
      `Source ${row.sourceUrl} snapshot ${row.newSnapshotHash}`,
      ...formatSourceFreshnessLines(row)
    ];
  }
  return [];
}

function formatSourceFreshnessLines(row: ReleaseDiffRow): string[] {
  if (row.sourceLastModified) {
    return [`Source Last-Modified: ${row.sourceLastModified}`];
  }

  if (row.trackerCheckedAt) {
    return [`Tracker checked at: ${row.trackerCheckedAt}`];
  }

  return [];
}

function formatSourceTextDiffLine(row: ReleaseDiffRow): string {
  const status = row.sourceTextDiffStatus
    ? `Source text diff status: ${row.sourceTextDiffStatus}`
    : "Source text diff status: unavailable";
  const summary = row.sourceTextDiffSummary ? ` ${row.sourceTextDiffSummary}` : "";

  return `${status}.${summary}`;
}

function compareFreshness(
  left: Pick<ChangeRecord, "lastChangedAt" | "lastCheckedAt" | "name">,
  right: Pick<ChangeRecord, "lastChangedAt" | "lastCheckedAt" | "name">
): number {
  const freshnessDifference = getFreshnessTime(right) - getFreshnessTime(left);
  if (freshnessDifference) return freshnessDifference;

  return left.name.localeCompare(right.name);
}

function latestIsoValue(values: Array<string | undefined>): string | undefined {
  return values
    .filter((value): value is string => Boolean(value))
    .sort((left, right) => new Date(right).getTime() - new Date(left).getTime())[0];
}

function earliestIsoValue(values: Array<string | undefined>): string | undefined {
  return values
    .filter((value): value is string => Boolean(value))
    .sort((left, right) => new Date(left).getTime() - new Date(right).getTime())[0];
}

function getFreshnessTime(
  value: Pick<ChangeRecord, "lastChangedAt" | "lastCheckedAt"> | ClaimChangeRecord
): number {
  const iso = value.lastChangedAt ?? value.lastCheckedAt;
  return iso ? new Date(iso).getTime() : 0;
}

function formatReviewState(reviewState: ClaimReviewState): string {
  switch (reviewState) {
    case "agent_reviewed":
      return "Agent reviewed";
    case "human_reviewed":
      return "Human reviewed";
    case "machine_candidate":
      return "Machine candidate";
    case "needs_review":
      return "Needs review";
    case "rejected":
      return "Rejected";
  }
}

function formatSourceHealthSeverity(
  severity: ChangeIndexSourceHealthSeverity
): string {
  switch (severity) {
    case "healthy":
      return "Healthy";
    case "warning":
      return "Warning";
    case "error":
      return "Error";
    case "unknown":
      return "Unknown";
  }
}

function isReviewedClaim(reviewState: string): boolean {
  return reviewState === "agent_reviewed" || reviewState === "human_reviewed";
}

function v6ChangeRecord(summary:PublicEntitySummary):ChangeRecord {
 const selected=readV6RecordCorrections()!;const slug=summary.entity.slug;
 // An inherited record keeps its actual correction version and timestamp.
 const recordRevision=selected.recordRevisions[slug].universityRevisionId;
 const repaired=v6HistoryRepair(slug,recordRevision);if(repaired)return repaired;
 const p=recordRevision===selected.revision?selected:readV6RecordCorrectionRevision(recordRevision)??selected;
 const diff=p.changesBySlug[slug];
 const counts=countCorrectionIds(diff);
 const previous=(p.parentRevisionId?v6SummaryAtRevision(slug,p.parentRevisionId):undefined)??p.historical[slug]?.baseline;
 const before=new Map(previous?.officialSources.map(s=>[s.sourceUrl,s.snapshotHash])??[]),after=new Map(summary.officialSources.map(s=>[s.sourceUrl,s.snapshotHash]));
 const sourceAdded=[...after.keys()].filter(u=>!before.has(u)).length,sourceRemoved=[...before.keys()].filter(u=>!after.has(u)).length,sourceSnapshotChanged=[...after].filter(([u,h])=>before.has(u)&&before.get(u)!==h).length;
 return {slug,name:summary.entity.name,releaseId:p.revision,previousReleaseId:p.parentRevisionId??"baseline-v6-pages-20261013",publicationKind:"scoped_record_correction",recordSha256:p.recordRevisions[slug].recordSha256,changeSummary:counts.affected ? `Tracker record correction: ${counts.modified} updated claims, ${counts.added} newly recorded claims, ${counts.held} held or excluded claims.` : selectChangeSummary(p.changeSummary)?.text ?? "Reviewed scoped record correction; historical held claims remain excluded from current policy conclusions.",summary:summary.summary,canonicalUrl:`${getSiteBaseUrl()}/changes/${p.revision}/${slug}`,changeUrl:`/changes/${p.revision}/${slug}`,universityUrl:`/universities/${slug}`,publicJsonUrl:summary.apiUrl!,claimCount:summary.claims.length,reviewedClaimCount:summary.claims.length,candidateClaimCount:0,sourceCount:summary.officialSources.length,reviewState:summary.reviewState,lastCheckedAt:summary.lastCheckedAt,lastChangedAt:p.publishedAt,added:counts.added,modified:counts.modified,removed:counts.held,newlyExtractedClaims:counts.added,trackerRemovedClaims:counts.held,claimMetadataChanged:counts.modified,evidenceChanged:counts.modified,policyTextChanged:0,unchanged:summary.claims.filter(c=>!counts.changedCurrentIds.has(c.id!)).length,sourceAdded,sourceRemoved,sourceSnapshotChanged,sourceTextChanged:0,diffLines:[],diffRows:[],claimChanges:summary.claims.map(c=>({claimId:c.id,claimText:c.claimText,claimType:c.claimType,confidence:c.confidence,evidenceCount:c.evidence.length,lastCheckedAt:c.lastCheckedAt,lastChangedAt:c.lastChangedAt,reviewState:c.reviewState,sourceLanguages:[...new Set(c.evidence.map(e=>e.sourceLanguage??"en"))]})),sourceChanges:summary.officialSources,releaseCount:1};
}
