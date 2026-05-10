import {
  PUBLIC_API_VERSION,
  type ClaimReviewState,
  type PolicyClaim,
  type PublicEntitySummary,
  type SourceAttribution
} from "@uapt/shared";
import { getStagedPublicDataset } from "./staged-public-data";
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
  candidateClaimCount: number;
  canonicalUrl: string;
  changeUrl: string;
  claimChanges: ClaimChangeRecord[];
  claimCount: number;
  confidence?: number;
  diffLines: DiffPreviewLine[];
  lastChangedAt?: string;
  lastCheckedAt?: string;
  name: string;
  publicJsonUrl: string;
  reviewState: ClaimReviewState;
  reviewedClaimCount: number;
  slug: string;
  sourceChanges: SourceChangeRecord[];
  sourceCount: number;
  summary: string;
  universityUrl: string;
}

export async function getChangeRecords(): Promise<ChangeRecord[]> {
  const dataset = await getStagedPublicDataset();

  return dataset.publicSummaries.map(buildChangeRecord).sort(compareFreshness);
}

export async function getChangeRecordBySlug(
  slug: string
): Promise<ChangeRecord | undefined> {
  return (await getChangeRecords()).find((record) => record.slug === slug);
}

function buildChangeRecord(summary: PublicEntitySummary): ChangeRecord {
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
    reviewedClaimCount,
    candidateClaimCount: summary.claims.length - reviewedClaimCount,
    sourceCount: summary.officialSources.length,
    sourceChanges,
    claimChanges,
    diffLines: buildDiffPreview(summary)
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

function buildDiffPreview(summary: PublicEntitySummary): DiffPreviewLine[] {
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
