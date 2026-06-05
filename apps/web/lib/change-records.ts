import {
  PUBLIC_API_VERSION,
  type ClaimReviewState,
  type PolicyClaim,
  type PublicEntitySummary,
  type SourceAttribution
} from "@uapt/shared";
import { getStagedPublicDataset } from "./staged-public-data";
import {
  getLatestReleaseDiff,
  getKnownReleaseIds,
  getReleaseDiff,
  type ReleaseDiffRow,
  type ReleaseEntityDiff
} from "./release-diffs";
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
}

export interface EntityChangeHistory {
  record: ChangeRecord;
  releaseRecords: ChangeRecord[];
}

let aggregateChangeRecordsPromise: Promise<ChangeRecord[]> | undefined;
let allReleaseChangedRecordsPromise: Promise<ChangeRecord[]> | undefined;

export async function getChangeRecords(): Promise<ChangeRecord[]> {
  aggregateChangeRecordsPromise ??= buildAggregatedChangeRecords();

  return aggregateChangeRecordsPromise;
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
    unchanged: diff?.unchanged ?? 0
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
    unchanged: diff.unchanged
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

function getFreshnessTime(
  value: Pick<ChangeRecord, "lastChangedAt" | "lastCheckedAt"> | ClaimChangeRecord
): number {
  const iso = value.lastChangedAt ?? value.lastCheckedAt;
  return iso ? new Date(iso).getTime() : 0;
}

function isReviewedClaim(reviewState: string): boolean {
  return reviewState === "agent_reviewed" || reviewState === "human_reviewed";
}
