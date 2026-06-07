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
import { getStagedPublicDataset } from "./staged-public-data";
import {
  getLatestReleaseDiff,
  getKnownReleaseIds,
  getReleaseDiff,
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
  record: ChangeRecord;
  releaseRecords: ChangeRecord[];
}

let aggregateChangeRecordsPromise: Promise<ChangeRecord[]> | undefined;
let allReleaseChangedRecordsPromise: Promise<ChangeRecord[]> | undefined;
let changeIndexPromise: Promise<ChangeIndexData> | undefined;

export async function getChangeRecords(): Promise<ChangeRecord[]> {
  aggregateChangeRecordsPromise ??= buildAggregatedChangeRecords();

  return aggregateChangeRecordsPromise;
}

export async function getChangeIndexData(): Promise<ChangeIndexData> {
  changeIndexPromise ??= buildChangeIndexData();

  return changeIndexPromise;
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
      const summary = summariesBySlug.get(entity.entitySlug);
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
  slug: string
): Promise<EntityChangeHistory | undefined> {
  const dataset = await getStagedPublicDataset();
  const summary = dataset.publicSummaries.find((item) => item.entity.slug === slug);
  const releaseRecords = (await getAllReleaseChangedRecords()).filter(
    (record) => record.slug === slug
  );

  if (!summary && !releaseRecords.length) return undefined;

  const record = summary
    ? buildAggregateChangeRecord(summary, releaseRecords)
    : buildDiffOnlyAggregateChangeRecord(slug, releaseRecords);

  return {
    record,
    releaseRecords
  };
}

async function getAllReleaseChangedRecords(): Promise<ChangeRecord[]> {
  allReleaseChangedRecordsPromise ??= buildAllReleaseChangedRecords();

  return allReleaseChangedRecordsPromise;
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
  const indexRecords = records.map(buildChangeIndexRecord);
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

function buildChangeIndexRecord(record: ChangeRecord): ChangeIndexRecord {
  const themes = countThemes(record);
  const sourceHealth = summarizeRecordSourceHealth(record);

  return {
    canonicalUrl: record.canonicalUrl,
    changeUrl: record.changeUrl,
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
    lastChangedAt: summary.lastChangedAt,
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
  summary: PublicEntitySummary | undefined,
  diff: ReleaseEntityDiff | undefined
): DiffPreviewLine[] {
  if (diff) return diff.rows.length ? buildReleaseDiffLines(diff) : [];

  if (!summary) return [];
  const lines: DiffPreviewLine[] = [];
  let newLineNumber = 1;

  lines.push({
    type: "equal",
    oldLineNumber: 1,
    newLineNumber,
    value: `# ${summary.entity.name} AI policy record`
  });
  newLineNumber += 1;

  for (const claim of summary.claims.slice(0, 10)) {
    lines.push({
      type: "insert",
      newLineNumber,
      value: `${claim.claimType}: ${claim.claimText}`
    });
    newLineNumber += 1;

    for (const evidence of claim.evidence.slice(0, 1)) {
      const sourceLanguage = evidence.sourceLanguage ?? "und";

      lines.push({
        type: "insert",
        newLineNumber,
        value: `Evidence (${sourceLanguage}, ${evidence.sourceSnapshotHash.slice(0, 12)}): ${evidence.evidenceSnippet}`
      });
      newLineNumber += 1;
    }
  }

  return lines;
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

function compareFreshness(left: ChangeRecord, right: ChangeRecord): number {
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
