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
  snapshotHash: string;
  sourceType?: string;
  sourceUrl: string;
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
  changeUrl: string;
  claimChanges: ClaimChangeRecord[];
  claimCount: number;
  confidence?: number;
  diffLines: DiffPreviewLine[];
  diffRows: ReleaseDiffRow[];
  lastChangedAt?: string;
  lastCheckedAt?: string;
  modified: number;
  name: string;
  previousReleaseId?: string;
  publicJsonUrl: string;
  releaseId?: string;
  removed: number;
  reviewState: ClaimReviewState;
  reviewedClaimCount: number;
  slug: string;
  sourceChanges: SourceChangeRecord[];
  sourceCount: number;
  summary: string;
  unchanged: number;
  universityUrl: string;
}

export async function getChangeRecords(): Promise<ChangeRecord[]> {
  const dataset = await getStagedPublicDataset();
  const releaseDiff = await getLatestReleaseDiff().catch(() => undefined);
  const diffsBySlug = new Map(
    releaseDiff?.entities.map((entity) => [entity.entitySlug, entity]) ?? []
  );

  return dataset.publicSummaries
    .map((summary) => buildChangeRecord(summary, diffsBySlug.get(summary.entity.slug)))
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
    reviewedClaimCount,
    candidateClaimCount: summary.claims.length - reviewedClaimCount,
    diffRows: diff?.rows ?? [],
    modified: diff?.modified ?? 0,
    previousReleaseId: diff?.previousReleaseId,
    releaseId: diff?.currentReleaseId,
    removed: diff?.removed ?? 0,
    sourceCount: summary.officialSources.length,
    sourceChanges,
    claimChanges,
    diffLines: buildDiffPreview(summary, diff),
    unchanged: diff?.unchanged ?? 0
  };
}

function buildDiffOnlyChangeRecord(diff: ReleaseEntityDiff): ChangeRecord {
  return {
    added: diff.added,
    candidateClaimCount: 0,
    canonicalUrl: diff.canonicalUrl,
    changeUrl: `/changes/${diff.entitySlug}`,
    claimChanges: [],
    claimCount: 0,
    diffLines: buildDiffPreview(undefined, diff),
    diffRows: diff.rows,
    lastChangedAt: diff.lastChangedAt,
    lastCheckedAt: diff.lastCheckedAt,
    modified: diff.modified,
    name: diff.entityName,
    previousReleaseId: diff.previousReleaseId,
    publicJsonUrl: diff.publicJsonUrl,
    releaseId: diff.currentReleaseId,
    removed: diff.removed,
    reviewState: "agent_reviewed",
    reviewedClaimCount: 0,
    slug: diff.entitySlug,
    sourceChanges: [],
    sourceCount: 0,
    summary: "",
    universityUrl: `/universities/${diff.entitySlug}`,
    unchanged: diff.unchanged
  };
}

function buildSourceChangeRecord(source: SourceAttribution): SourceChangeRecord {
  return {
    citationTitle: source.citationTitle,
    retrievedAt: source.retrievedAt,
    snapshotHash: source.snapshotHash,
    sourceType: source.sourceType,
    sourceUrl: source.sourceUrl
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

function rowToOldLines(row: ReleaseDiffRow): string[] {
  if (row.oldClaim) {
    return [
      `${row.oldClaim.claimType}: ${row.oldClaim.claimText}`,
      ...((row.oldEvidence ?? row.oldClaim.evidence).slice(0, 1).map(
        (evidence) =>
          `Evidence (${evidence.sourceLanguage ?? "und"}, ${evidence.sourceSnapshotHash.slice(0, 12)}): ${evidence.evidenceSnippet}`
      ))
    ];
  }
  if (row.oldSnapshotHash && row.sourceUrl) {
    return [`Source ${row.sourceUrl} snapshot ${row.oldSnapshotHash}`];
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
      ))
    ];
  }
  if (row.newSnapshotHash && row.sourceUrl) {
    return [`Source ${row.sourceUrl} snapshot ${row.newSnapshotHash}`];
  }
  return [];
}

function compareFreshness(left: ChangeRecord, right: ChangeRecord): number {
  const freshnessDifference = getFreshnessTime(right) - getFreshnessTime(left);
  if (freshnessDifference) return freshnessDifference;

  return left.name.localeCompare(right.name);
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
