import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import {
  NO_ADVICE_BOUNDARY,
  OFFICIAL_SOURCE_RIGHTS_CAVEAT,
  PUBLIC_API_VERSION,
  TRACKER_METADATA_LICENSE,
  type ClaimEvidence,
  type ClaimReviewState,
  type PolicyClaim,
  type PublicEntitySummary,
  type SourceAttribution
} from "@uapt/shared";
import {
  getCurrentPublicReleaseManifest,
  getStagedPublicDataset,
  getStagedPublicDatasetForManifest,
  type PublicReleaseManifest
} from "./staged-public-data";
import { getSiteBaseUrl } from "./site-url";

export type ReleaseDiffChangeType =
  | "claim_added"
  | "claim_removed"
  | "claim_modified"
  | "evidence_added"
  | "evidence_removed"
  | "evidence_modified"
  | "source_added"
  | "source_removed"
  | "source_snapshot_changed"
  | "metadata_changed";

export type ReleaseDiffMatchMethod =
  | "claim_id"
  | "fuzzy_claim"
  | "source_claim_type"
  | "none";

export type ReleaseDiffCategory =
  | "policy_text_changed"
  | "newly_extracted_claim"
  | "tracker_removed_claim"
  | "claim_metadata_changed"
  | "evidence_changed"
  | "source_added"
  | "source_removed"
  | "source_snapshot_changed"
  | "metadata_changed";

export type SourceTextDiffStatus =
  | "added"
  | "removed"
  | "unchanged"
  | "normalized_text_changed"
  | "metadata_changed"
  | "metadata_only"
  | "unavailable";

export interface ReleaseClaimSnapshot {
  claimId?: string;
  claimText: string;
  claimType: string;
  claimValue?: string;
  confidence: number;
  entityName: string;
  entitySlug: string;
  evidence: ReleaseEvidenceSnapshot[];
  lastChangedAt?: string;
  lastCheckedAt?: string;
  releaseId: string;
  reviewState: ClaimReviewState;
}

export interface ReleaseEvidenceSnapshot {
  evidenceSnippet: string;
  evidenceSnippetDisplay?: string;
  retrievedAt?: string;
  sourceLanguage?: string;
  sourceLastModified?: string;
  sourceSnapshotHash: string;
  sourceUrl: string;
  trackerCheckedAt?: string;
}

export interface ReleaseSourceSnapshot {
  citationTitle: string;
  entityName: string;
  entitySlug: string;
  finalUrl?: string;
  releaseId: string;
  retrievedAt?: string;
  snapshotHash: string;
  sourceLastModified?: string;
  sourceType?: string;
  sourceUrl: string;
  trackerCheckedAt?: string;
}

export interface ReleaseDiffRow {
  changeCategory: ReleaseDiffCategory;
  changeExplanation: string;
  changeType: ReleaseDiffChangeType;
  citation: {
    canonicalUrl: string;
    publicJsonUrl: string;
    sourceRightsPolicy: string;
  };
  claimId?: string;
  confidence?: number;
  currentReleaseId: string;
  entityName: string;
  entitySlug: string;
  limitations: string[];
  matchMethod: ReleaseDiffMatchMethod;
  newClaim?: ReleaseClaimSnapshot;
  newEvidence?: ReleaseEvidenceSnapshot[];
  newSnapshotHash?: string;
  oldClaim?: ReleaseClaimSnapshot;
  oldEvidence?: ReleaseEvidenceSnapshot[];
  oldSnapshotHash?: string;
  previousReleaseId?: string;
  releaseId: string;
  reviewState?: ClaimReviewState;
  sourceLanguage?: string;
  sourceTextDiffStatus?: SourceTextDiffStatus;
  sourceTextDiffSummary?: string;
  sourceLastModified?: string;
  sourceUrl?: string;
  trackerCheckedAt?: string;
}

export interface ReleaseEntityDiff {
  added: number;
  canonicalUrl: string;
  claimMetadataChanged: number;
  currentReleaseId: string;
  entityName: string;
  entitySlug: string;
  evidenceChanged: number;
  lastChangedAt?: string;
  lastCheckedAt?: string;
  modified: number;
  newlyExtractedClaims: number;
  previousReleaseId?: string;
  policyTextChanged: number;
  publicJsonUrl: string;
  removed: number;
  rows: ReleaseDiffRow[];
  sourceAdded: number;
  sourceRemoved: number;
  sourceSnapshotChanged: number;
  sourceTextChanged: number;
  trackerRemovedClaims: number;
  unchanged: number;
}

export interface ReleaseDiff {
  apiVersion: typeof PUBLIC_API_VERSION;
  canonicalUrl: string;
  changeCounts: ReleaseDiffCounts;
  currentReleaseId: string;
  entities: ReleaseEntityDiff[];
  generatedAt: string;
  license: typeof TRACKER_METADATA_LICENSE;
  limitations: string[];
  previousReleaseId?: string;
  releaseId: string;
  sourcePolicy: string;
  sourceRightsPolicy: string;
}

export interface ReleaseDiffCounts {
  added: number;
  claimMetadataChanged: number;
  entitiesChanged: number;
  evidenceChanged: number;
  metadata: number;
  modified: number;
  newlyExtractedClaims: number;
  policyTextChanged: number;
  removed: number;
  sourceAdded: number;
  sourceRemoved: number;
  sourceSnapshotChanged: number;
  sourceTextChanged: number;
  trackerRemovedClaims: number;
  unchanged: number;
}

type ReleaseDiffRowBase = Omit<
  ReleaseDiffRow,
  "changeCategory" | "changeExplanation"
>;

interface PrivateSourceTextDiffRow {
  currentReleaseId: string;
  entityName: string;
  entitySlug: string;
  newNormalizedTextHash?: string;
  newPublicSnapshotHash?: string;
  oldNormalizedTextHash?: string;
  oldPublicSnapshotHash?: string;
  previousReleaseId: string;
  sourceUrl: string;
  status: SourceTextDiffStatus;
  summary: string;
}

interface PrivateSourceTextDiffFile {
  schemaVersion: "uapt-private-source-snapshot-diff-v1";
  currentReleaseId: string;
  previousReleaseId: string;
  rows: PrivateSourceTextDiffRow[];
}

type PrivateSourceTextDiffIndex = Map<string, PrivateSourceTextDiffRow>;

const FUZZY_MATCH_THRESHOLD = 0.82;

export async function getLatestReleaseDiff(): Promise<ReleaseDiff> {
  const currentManifest = await getRequiredCurrentManifest();

  return buildReleaseDiff(currentManifest.releaseId);
}

export async function getReleaseDiff(
  releaseId: string
): Promise<ReleaseDiff | undefined> {
  const manifests = await getKnownReleaseManifests();
  const manifest = manifests.find((item) => item.releaseId === releaseId);

  if (!manifest) return undefined;

  return buildReleaseDiff(releaseId);
}

export async function getLatestEntityReleaseDiff(
  slug: string
): Promise<ReleaseEntityDiff | undefined> {
  const diff = await getLatestReleaseDiff();

  return getEntityDiff(diff, slug);
}

export async function getEntityReleaseDiff(
  releaseId: string,
  slug: string
): Promise<ReleaseEntityDiff | undefined> {
  const diff = await getReleaseDiff(releaseId);

  return diff ? getEntityDiff(diff, slug) : undefined;
}

export async function getKnownReleaseIds(): Promise<string[]> {
  return (await getKnownReleaseManifests()).map((manifest) => manifest.releaseId);
}

export async function getReleaseClaimSnapshotRows(
  releaseId: string
): Promise<ReleaseClaimSnapshot[] | undefined> {
  const manifest = await getManifestByReleaseId(releaseId);
  if (!manifest) return undefined;
  const dataset = await getDatasetForManifest(manifest);

  return dataset.publicSummaries.flatMap((summary) =>
    summary.claims.map((claim) => toClaimSnapshot(manifest.releaseId, summary, claim))
  );
}

export async function getReleaseSourceSnapshotRows(
  releaseId: string
): Promise<ReleaseSourceSnapshot[] | undefined> {
  const manifest = await getManifestByReleaseId(releaseId);
  if (!manifest) return undefined;
  const dataset = await getDatasetForManifest(manifest);

  return dataset.publicSummaries.flatMap((summary) =>
    summary.officialSources.map((source) =>
      toSourceSnapshot(manifest.releaseId, summary, source)
    )
  );
}

export async function getReleaseSnapshotManifest(releaseId: string) {
  const manifest = await getManifestByReleaseId(releaseId);
  if (!manifest) return undefined;
  const claims = await getReleaseClaimSnapshotRows(releaseId);
  const sources = await getReleaseSourceSnapshotRows(releaseId);
  const siteBaseUrl = getSiteBaseUrl();

  return {
    apiVersion: PUBLIC_API_VERSION,
    releaseId,
    publishedAt: manifest.publishedAt,
    generatedAt: manifest.publishedAt,
    canonicalUrl: new URL("/datasets", siteBaseUrl).toString(),
    claimSnapshotUrl: new URL(
      `/api/public/${PUBLIC_API_VERSION}/datasets/release-snapshots/${releaseId}/claims.jsonl`,
      siteBaseUrl
    ).toString(),
    sourceSnapshotUrl: new URL(
      `/api/public/${PUBLIC_API_VERSION}/datasets/release-snapshots/${releaseId}/sources.jsonl`,
      siteBaseUrl
    ).toString(),
    counts: {
      claims: claims?.length ?? 0,
      sources: sources?.length ?? 0
    },
    license: TRACKER_METADATA_LICENSE,
    sourceRightsPolicy: OFFICIAL_SOURCE_RIGHTS_CAVEAT,
    limitations: [NO_ADVICE_BOUNDARY]
  };
}

export function toJsonLines(rows: unknown[]): string {
  return `${rows.map((row) => JSON.stringify(row)).join("\n")}\n`;
}

async function buildReleaseDiff(releaseId: string): Promise<ReleaseDiff> {
  const manifest = await getManifestByReleaseId(releaseId);
  if (!manifest) throw new Error(`Unknown release: ${releaseId}`);

  const previousManifest = await getPreviousReleaseManifest(manifest);
  const [currentDataset, previousDataset] = await Promise.all([
    getDatasetForManifest(manifest),
    previousManifest ? getDatasetForManifest(previousManifest) : undefined
  ]);
  const privateSourceTextDiffs = previousManifest
    ? await getPrivateSourceTextDiffIndex(previousManifest.releaseId, manifest.releaseId)
    : new Map<string, PrivateSourceTextDiffRow>();
  const previousBySlug = new Map(
    previousDataset?.publicSummaries.map((summary) => [summary.entity.slug, summary]) ??
      []
  );
  const currentSlugs = new Set(
    currentDataset.publicSummaries.map((summary) => summary.entity.slug)
  );
  const previousOnlySummaries =
    previousDataset?.publicSummaries.filter(
      (summary) => !currentSlugs.has(summary.entity.slug)
    ) ?? [];
  const entities = [
    ...currentDataset.publicSummaries.map((summary) =>
      buildEntityDiff(
        manifest,
        previousManifest,
        previousBySlug.get(summary.entity.slug),
        summary,
        privateSourceTextDiffs
      )
    ),
    ...previousOnlySummaries.map((summary) =>
      buildEntityDiff(manifest, previousManifest, summary, undefined, privateSourceTextDiffs)
    )
  ].sort(compareEntityDiffs);
  const counts = summarizeRows(entities.flatMap((entity) => entity.rows));
  counts.unchanged = Math.max(0, entities.length - counts.entitiesChanged);
  const siteBaseUrl = getSiteBaseUrl();

  return {
    apiVersion: PUBLIC_API_VERSION,
    canonicalUrl: new URL(`/changes/${releaseId}`, siteBaseUrl).toString(),
    changeCounts: counts,
    currentReleaseId: manifest.releaseId,
    entities,
    generatedAt: manifest.publishedAt,
    license: TRACKER_METADATA_LICENSE,
    limitations: [NO_ADVICE_BOUNDARY],
    previousReleaseId: previousManifest?.releaseId,
    releaseId: manifest.releaseId,
    sourcePolicy: OFFICIAL_SOURCE_RIGHTS_CAVEAT,
    sourceRightsPolicy: OFFICIAL_SOURCE_RIGHTS_CAVEAT
  };
}

function buildEntityDiff(
  manifest: PublicReleaseManifest,
  previousManifest: PublicReleaseManifest | undefined,
  previousSummary: PublicEntitySummary | undefined,
  currentSummary: PublicEntitySummary | undefined,
  privateSourceTextDiffs: PrivateSourceTextDiffIndex
): ReleaseEntityDiff {
  const summary = currentSummary ?? previousSummary;
  if (!summary) throw new Error("Missing both current and previous entity summary");

  const rows = [
    ...diffClaims(manifest, previousManifest, previousSummary, currentSummary),
    ...diffSources(
      manifest,
      previousManifest,
      previousSummary,
      currentSummary,
      privateSourceTextDiffs
    )
  ].sort(compareRows);
  const counts = summarizeRows(rows);

  return {
    added: counts.added,
    canonicalUrl: summary.canonicalUrl,
    claimMetadataChanged: counts.claimMetadataChanged,
    currentReleaseId: manifest.releaseId,
    entityName: summary.entity.name,
    entitySlug: summary.entity.slug,
    evidenceChanged: counts.evidenceChanged,
    lastChangedAt: currentSummary?.lastChangedAt ?? previousSummary?.lastChangedAt,
    lastCheckedAt: currentSummary?.lastCheckedAt ?? previousSummary?.lastCheckedAt,
    modified: counts.modified + counts.metadata,
    newlyExtractedClaims: counts.newlyExtractedClaims,
    previousReleaseId: previousManifest?.releaseId,
    policyTextChanged: counts.policyTextChanged,
    publicJsonUrl: summary.apiUrl ?? new URL(
      `/api/public/${PUBLIC_API_VERSION}/universities/${summary.entity.slug}.json`,
      getSiteBaseUrl()
    ).toString(),
    removed: counts.removed,
    rows,
    sourceAdded: counts.sourceAdded,
    sourceRemoved: counts.sourceRemoved,
    sourceSnapshotChanged: counts.sourceSnapshotChanged,
    sourceTextChanged: counts.sourceTextChanged,
    trackerRemovedClaims: counts.trackerRemovedClaims,
    unchanged: counts.unchanged
  };
}

function diffClaims(
  manifest: PublicReleaseManifest,
  previousManifest: PublicReleaseManifest | undefined,
  previousSummary: PublicEntitySummary | undefined,
  currentSummary: PublicEntitySummary | undefined
): ReleaseDiffRow[] {
  const oldClaims = previousSummary?.claims ?? [];
  const newClaims = currentSummary?.claims ?? [];
  const rows: ReleaseDiffRow[] = [];
  const matchedOld = new Set<number>();

  for (const newClaim of newClaims) {
    const match = findClaimMatch(newClaim, oldClaims, matchedOld);
    if (!match) {
      rows.push(buildClaimRow("claim_added", manifest, previousManifest, undefined, newClaim, "none"));
      continue;
    }

    matchedOld.add(match.index);
    if (claimsDiffer(match.claim, newClaim)) {
      rows.push(
        buildClaimRow(
          "claim_modified",
          manifest,
          previousManifest,
          match.claim,
          newClaim,
          match.method
        )
      );
      rows.push(
        ...diffClaimEvidence(manifest, previousManifest, match.claim, newClaim, match.method)
      );
    }
  }

  oldClaims.forEach((oldClaim, index) => {
    if (!matchedOld.has(index)) {
      rows.push(
        buildClaimRow("claim_removed", manifest, previousManifest, oldClaim, undefined, "none")
      );
    }
  });

  return rows;
}

function diffSources(
  manifest: PublicReleaseManifest,
  previousManifest: PublicReleaseManifest | undefined,
  previousSummary: PublicEntitySummary | undefined,
  currentSummary: PublicEntitySummary | undefined,
  privateSourceTextDiffs: PrivateSourceTextDiffIndex
): ReleaseDiffRow[] {
  const oldSources = new Map(
    (previousSummary?.officialSources ?? []).map((source) => [source.sourceUrl, source])
  );
  const newSources = new Map(
    (currentSummary?.officialSources ?? []).map((source) => [source.sourceUrl, source])
  );
  const rows: ReleaseDiffRow[] = [];

  for (const [sourceUrl, source] of newSources.entries()) {
    const old = oldSources.get(sourceUrl);
    if (!old) {
      rows.push(
        buildSourceRow(
          "source_added",
          manifest,
          previousManifest,
          previousSummary,
          currentSummary,
          undefined,
          source,
          privateSourceTextDiffs.get(privateSourceTextDiffKey(currentSummary?.entity.slug, source.sourceUrl))
        )
      );
    } else if (old.snapshotHash !== source.snapshotHash) {
      rows.push(
        buildSourceRow(
          "source_snapshot_changed",
          manifest,
          previousManifest,
          previousSummary,
          currentSummary,
          old,
          source,
          privateSourceTextDiffs.get(privateSourceTextDiffKey(currentSummary?.entity.slug, source.sourceUrl))
        )
      );
    }
  }

  for (const [sourceUrl, source] of oldSources.entries()) {
    if (!newSources.has(sourceUrl)) {
      rows.push(
        buildSourceRow(
          "source_removed",
          manifest,
          previousManifest,
          previousSummary,
          currentSummary,
          source,
          undefined,
          privateSourceTextDiffs.get(privateSourceTextDiffKey(previousSummary?.entity.slug, source.sourceUrl))
        )
      );
    }
  }

  return rows;
}

function diffClaimEvidence(
  manifest: PublicReleaseManifest,
  previousManifest: PublicReleaseManifest | undefined,
  oldClaim: PolicyClaim,
  newClaim: PolicyClaim,
  matchMethod: ReleaseDiffMatchMethod
): ReleaseDiffRow[] {
  const rows: ReleaseDiffRow[] = [];
  const oldByKey = new Map(oldClaim.evidence.map((evidence) => [evidenceKey(evidence), evidence]));
  const newByKey = new Map(newClaim.evidence.map((evidence) => [evidenceKey(evidence), evidence]));

  for (const [key, evidence] of newByKey.entries()) {
    const oldEvidence = oldByKey.get(key);
    if (!oldEvidence) {
      rows.push(buildEvidenceRow("evidence_added", manifest, previousManifest, oldClaim, newClaim, undefined, evidence, matchMethod));
    } else if (evidence.sourceSnapshotHash !== oldEvidence.sourceSnapshotHash || evidence.evidenceSnippet !== oldEvidence.evidenceSnippet) {
      rows.push(buildEvidenceRow("evidence_modified", manifest, previousManifest, oldClaim, newClaim, oldEvidence, evidence, matchMethod));
    }
  }

  for (const [key, evidence] of oldByKey.entries()) {
    if (!newByKey.has(key)) {
      rows.push(buildEvidenceRow("evidence_removed", manifest, previousManifest, oldClaim, newClaim, evidence, undefined, matchMethod));
    }
  }

  return rows;
}

function findClaimMatch(
  newClaim: PolicyClaim,
  oldClaims: PolicyClaim[],
  matchedOld: Set<number>
): { claim: PolicyClaim; index: number; method: ReleaseDiffMatchMethod } | undefined {
  if (newClaim.id) {
    const exactIndex = oldClaims.findIndex(
      (claim, index) => !matchedOld.has(index) && claim.id === newClaim.id
    );
    if (exactIndex >= 0) {
      return { claim: oldClaims[exactIndex], index: exactIndex, method: "claim_id" };
    }
  }

  const sourceTypeMatch = bestScopedClaimMatch(newClaim, oldClaims, matchedOld, (claim) =>
    firstSourceUrl(claim) === firstSourceUrl(newClaim)
  );
  if (sourceTypeMatch && sourceTypeMatch.score >= FUZZY_MATCH_THRESHOLD) {
    return {
      claim: sourceTypeMatch.claim,
      index: sourceTypeMatch.index,
      method: "source_claim_type"
    };
  }

  const snapshotMatch = bestScopedClaimMatch(newClaim, oldClaims, matchedOld, (claim) =>
    firstSnapshotHash(claim) === firstSnapshotHash(newClaim)
  );
  if (snapshotMatch && snapshotMatch.score >= FUZZY_MATCH_THRESHOLD) {
    return {
      claim: snapshotMatch.claim,
      index: snapshotMatch.index,
      method: "source_claim_type"
    };
  }

  let best: { claim: PolicyClaim; index: number; score: number } | undefined;
  oldClaims.forEach((claim, index) => {
    if (matchedOld.has(index) || claim.claimType !== newClaim.claimType) return;
    const score = textSimilarity(claim.claimText, newClaim.claimText);
    if (!best || score > best.score) best = { claim, index, score };
  });

  if (best && best.score >= FUZZY_MATCH_THRESHOLD) {
    return { claim: best.claim, index: best.index, method: "fuzzy_claim" };
  }

  return undefined;
}

function bestScopedClaimMatch(
  newClaim: PolicyClaim,
  oldClaims: PolicyClaim[],
  matchedOld: Set<number>,
  predicate: (claim: PolicyClaim) => boolean
): { claim: PolicyClaim; index: number; score: number } | undefined {
  let best: { claim: PolicyClaim; index: number; score: number } | undefined;

  oldClaims.forEach((claim, index) => {
    if (matchedOld.has(index) || claim.claimType !== newClaim.claimType) return;
    if (!predicate(claim)) return;
    const score = textSimilarity(claim.claimText, newClaim.claimText);
    if (!best || score > best.score) best = { claim, index, score };
  });

  return best;
}

function claimsDiffer(oldClaim: PolicyClaim, newClaim: PolicyClaim): boolean {
  return (
    oldClaim.claimText !== newClaim.claimText ||
    oldClaim.claimValue !== newClaim.claimValue ||
    oldClaim.reviewState !== newClaim.reviewState ||
    oldClaim.confidence !== newClaim.confidence ||
    oldClaim.evidence.length !== newClaim.evidence.length ||
    oldClaim.evidence.some((evidence, index) => {
      const next = newClaim.evidence[index];
      return !next || evidenceKey(evidence) !== evidenceKey(next);
    })
  );
}

function buildClaimRow(
  changeType: Extract<ReleaseDiffChangeType, "claim_added" | "claim_removed" | "claim_modified">,
  manifest: PublicReleaseManifest,
  previousManifest: PublicReleaseManifest | undefined,
  oldClaim: PolicyClaim | undefined,
  newClaim: PolicyClaim | undefined,
  matchMethod: ReleaseDiffMatchMethod
): ReleaseDiffRow {
  const claim = newClaim ?? oldClaim;
  if (!claim) throw new Error(`Cannot build ${changeType} without a claim`);

  return baseRow(changeType, manifest, previousManifest, claim, {
    claimId: claim.id,
    confidence: claim.confidence,
    matchMethod,
    newClaim: newClaim ? toClaimSnapshot(manifest.releaseId, undefined, newClaim) : undefined,
    newEvidence: newClaim?.evidence.map(toEvidenceSnapshot),
    newSnapshotHash: newClaim ? firstSnapshotHash(newClaim) : undefined,
    oldClaim: oldClaim ? toClaimSnapshot(previousManifest?.releaseId ?? "unknown", undefined, oldClaim) : undefined,
    oldEvidence: oldClaim?.evidence.map(toEvidenceSnapshot),
    oldSnapshotHash: oldClaim ? firstSnapshotHash(oldClaim) : undefined,
    reviewState: claim.reviewState,
    sourceLanguage: firstSourceLanguage(claim),
    sourceUrl: firstSourceUrl(claim)
  });
}

function buildEvidenceRow(
  changeType: Extract<ReleaseDiffChangeType, "evidence_added" | "evidence_removed" | "evidence_modified">,
  manifest: PublicReleaseManifest,
  previousManifest: PublicReleaseManifest | undefined,
  oldClaim: PolicyClaim,
  newClaim: PolicyClaim,
  oldEvidence: ClaimEvidence | undefined,
  newEvidence: ClaimEvidence | undefined,
  matchMethod: ReleaseDiffMatchMethod
): ReleaseDiffRow {
  const claim = newClaim ?? oldClaim;
  const evidence = newEvidence ?? oldEvidence;
  if (!evidence) throw new Error(`Cannot build ${changeType} without evidence`);

  return baseRow(changeType, manifest, previousManifest, claim, {
    claimId: claim.id,
    confidence: claim.confidence,
    matchMethod,
    newClaim: toClaimSnapshot(manifest.releaseId, undefined, newClaim),
    newEvidence: newEvidence ? [toEvidenceSnapshot(newEvidence)] : undefined,
    newSnapshotHash: newEvidence?.sourceSnapshotHash,
    oldClaim: toClaimSnapshot(previousManifest?.releaseId ?? "unknown", undefined, oldClaim),
    oldEvidence: oldEvidence ? [toEvidenceSnapshot(oldEvidence)] : undefined,
    oldSnapshotHash: oldEvidence?.sourceSnapshotHash,
    reviewState: claim.reviewState,
    sourceLanguage: evidence.sourceLanguage,
    sourceUrl: evidence.sourceUrl
  });
}

function buildSourceRow(
  changeType: Extract<ReleaseDiffChangeType, "source_added" | "source_removed" | "source_snapshot_changed">,
  manifest: PublicReleaseManifest,
  previousManifest: PublicReleaseManifest | undefined,
  previousSummary: PublicEntitySummary | undefined,
  currentSummary: PublicEntitySummary | undefined,
  oldSource: SourceAttribution | undefined,
  newSource: SourceAttribution | undefined,
  privateSourceTextDiff: PrivateSourceTextDiffRow | undefined
): ReleaseDiffRow {
  const source = newSource ?? oldSource;
  if (!source) throw new Error(`Cannot build ${changeType} without a source`);
  const summary = currentSummary ?? previousSummary;
  if (!summary) throw new Error(`Cannot build ${changeType} without a summary`);
  const entitySlug = summary.entity.slug;
  const entityName = summary.entity.name;

  return withDiffSemantics({
    changeType,
    citation: {
      canonicalUrl: new URL(`/changes/${manifest.releaseId}/${entitySlug}`, getSiteBaseUrl()).toString(),
      publicJsonUrl: new URL(
        `/api/public/${PUBLIC_API_VERSION}/changes/${manifest.releaseId}/${entitySlug}.json`,
        getSiteBaseUrl()
      ).toString(),
      sourceRightsPolicy: OFFICIAL_SOURCE_RIGHTS_CAVEAT
    },
    currentReleaseId: manifest.releaseId,
    entityName,
    entitySlug,
    limitations: [NO_ADVICE_BOUNDARY],
    matchMethod: "source_claim_type",
    newSnapshotHash: newSource?.snapshotHash,
    oldSnapshotHash: oldSource?.snapshotHash,
    previousReleaseId: previousManifest?.releaseId,
    releaseId: manifest.releaseId,
    sourceTextDiffStatus: privateSourceTextDiff?.status,
    sourceTextDiffSummary: privateSourceTextDiff?.summary,
    sourceLastModified: newSource?.sourceLastModified ?? oldSource?.sourceLastModified,
    trackerCheckedAt:
      newSource?.trackerCheckedAt ??
      newSource?.retrievedAt ??
      oldSource?.trackerCheckedAt ??
      oldSource?.retrievedAt,
    sourceUrl: source.sourceUrl
  });
}

function baseRow(
  changeType: ReleaseDiffChangeType,
  manifest: PublicReleaseManifest,
  previousManifest: PublicReleaseManifest | undefined,
  claim: PolicyClaim,
  values: Partial<ReleaseDiffRow>
): ReleaseDiffRow {
  const siteBaseUrl = getSiteBaseUrl();
  const entitySlug = claim.entitySlug;

  return withDiffSemantics({
    changeType,
    citation: {
      canonicalUrl: new URL(`/changes/${manifest.releaseId}/${entitySlug}`, siteBaseUrl).toString(),
      publicJsonUrl: new URL(
        `/api/public/${PUBLIC_API_VERSION}/changes/${manifest.releaseId}/${entitySlug}.json`,
        siteBaseUrl
      ).toString(),
      sourceRightsPolicy: OFFICIAL_SOURCE_RIGHTS_CAVEAT
    },
    currentReleaseId: manifest.releaseId,
    entityName: entitySlugToName(entitySlug),
    entitySlug,
    limitations: [NO_ADVICE_BOUNDARY],
    matchMethod: "none",
    previousReleaseId: previousManifest?.releaseId,
    releaseId: manifest.releaseId,
    sourceLastModified:
      values.sourceLastModified ??
      values.newEvidence?.[0]?.sourceLastModified ??
      values.oldEvidence?.[0]?.sourceLastModified ??
      values.newClaim?.evidence[0]?.sourceLastModified ??
      values.oldClaim?.evidence[0]?.sourceLastModified,
    trackerCheckedAt:
      values.trackerCheckedAt ??
      values.newEvidence?.[0]?.trackerCheckedAt ??
      values.oldEvidence?.[0]?.trackerCheckedAt ??
      values.newEvidence?.[0]?.retrievedAt ??
      values.oldEvidence?.[0]?.retrievedAt ??
      values.newClaim?.evidence[0]?.trackerCheckedAt ??
      values.oldClaim?.evidence[0]?.trackerCheckedAt ??
      values.newClaim?.evidence[0]?.retrievedAt ??
      values.oldClaim?.evidence[0]?.retrievedAt,
    ...values
  } as ReleaseDiffRowBase);
}

function toClaimSnapshot(
  releaseId: string,
  summary: PublicEntitySummary | undefined,
  claim: PolicyClaim
): ReleaseClaimSnapshot {
  return {
    claimId: claim.id,
    claimText: claim.claimText,
    claimType: claim.claimType,
    claimValue: claim.claimValue,
    confidence: claim.confidence,
    entityName: summary?.entity.name ?? entitySlugToName(claim.entitySlug),
    entitySlug: claim.entitySlug,
    evidence: claim.evidence.map(toEvidenceSnapshot),
    lastChangedAt: claim.lastChangedAt,
    lastCheckedAt: claim.lastCheckedAt,
    releaseId,
    reviewState: claim.reviewState
  };
}

function toEvidenceSnapshot(evidence: ClaimEvidence): ReleaseEvidenceSnapshot {
  return {
    evidenceSnippet: evidence.evidenceSnippet,
    evidenceSnippetDisplay: evidence.evidenceSnippetDisplay,
    retrievedAt: evidence.retrievedAt,
    sourceLanguage: evidence.sourceLanguage,
    sourceLastModified: evidence.attribution.sourceLastModified,
    sourceSnapshotHash: evidence.sourceSnapshotHash,
    sourceUrl: evidence.sourceUrl,
    trackerCheckedAt: evidence.attribution.trackerCheckedAt
  };
}

function toSourceSnapshot(
  releaseId: string,
  summary: PublicEntitySummary,
  source: SourceAttribution
): ReleaseSourceSnapshot {
  return {
    citationTitle: source.citationTitle,
    entityName: summary.entity.name,
    entitySlug: summary.entity.slug,
    finalUrl: source.finalUrl,
    releaseId,
    retrievedAt: source.retrievedAt,
    snapshotHash: source.snapshotHash,
    sourceLastModified: source.sourceLastModified,
    sourceType: source.sourceType,
    sourceUrl: source.sourceUrl,
    trackerCheckedAt: source.trackerCheckedAt
  };
}

function getEntityDiff(
  diff: ReleaseDiff,
  slug: string
): ReleaseEntityDiff | undefined {
  return diff.entities.find((entity) => entity.entitySlug === slug);
}

async function getDatasetForManifest(manifest: PublicReleaseManifest) {
  const current = await getCurrentPublicReleaseManifest();
  if (current?.releaseId === manifest.releaseId) return getStagedPublicDataset();

  return getStagedPublicDatasetForManifest(manifest);
}

async function getRequiredCurrentManifest(): Promise<PublicReleaseManifest> {
  const manifest = await getCurrentPublicReleaseManifest();
  if (!manifest) throw new Error("Missing current public release manifest");

  return manifest;
}

async function getManifestByReleaseId(
  releaseId: string
): Promise<PublicReleaseManifest | undefined> {
  const manifests = await getKnownReleaseManifests();

  return manifests.find((manifest) => manifest.releaseId === releaseId);
}

async function getPreviousReleaseManifest(
  manifest: PublicReleaseManifest
): Promise<PublicReleaseManifest | undefined> {
  const publishedAt = new Date(manifest.publishedAt).getTime();

  return (await getKnownReleaseManifests())
    .filter(
      (candidate) =>
        candidate.releaseId !== manifest.releaseId &&
        new Date(candidate.publishedAt).getTime() < publishedAt
    )
    .sort((left, right) => new Date(right.publishedAt).getTime() - new Date(left.publishedAt).getTime())[0];
}

async function getKnownReleaseManifests(): Promise<PublicReleaseManifest[]> {
  const current = await getRequiredCurrentManifest();
  const repoRoot = await findRepoRoot();
  const historyRoot = path.join(repoRoot, "data", "public-releases", "history");
  let historyFiles: string[] = [];

  try {
    historyFiles = (await readdir(historyRoot))
      .filter((file) => file.endsWith(".json"))
      .map((file) => path.join(historyRoot, file));
  } catch {
    historyFiles = [];
  }

  const history = (
    await Promise.all(
      historyFiles.map(async (file) => parseManifest(await readFile(file, "utf8")))
    )
  ).filter((manifest): manifest is PublicReleaseManifest => Boolean(manifest));
  const byId = new Map<string, PublicReleaseManifest>();

  for (const manifest of [...history, current]) {
    byId.set(manifest.releaseId, manifest);
  }

  return [...byId.values()].sort(
    (left, right) => new Date(left.publishedAt).getTime() - new Date(right.publishedAt).getTime()
  );
}

async function getPrivateSourceTextDiffIndex(
  previousReleaseId: string,
  currentReleaseId: string
): Promise<PrivateSourceTextDiffIndex> {
  const repoRoot = await findRepoRoot();
  const candidateRoots = [
    process.env.UAPT_PRIVATE_SNAPSHOT_DIFF_ROOT,
    path.join(repoRoot, ".local", "source-snapshots", "diffs")
  ].filter((root): root is string => Boolean(root));
  const fileName = `${previousReleaseId}__${currentReleaseId}.json`;

  for (const root of candidateRoots) {
    try {
      const parsed = JSON.parse(
        await readFile(path.join(root, fileName), "utf8")
      ) as Partial<PrivateSourceTextDiffFile>;
      if (
        parsed.schemaVersion !== "uapt-private-source-snapshot-diff-v1" ||
        parsed.previousReleaseId !== previousReleaseId ||
        parsed.currentReleaseId !== currentReleaseId ||
        !Array.isArray(parsed.rows)
      ) {
        continue;
      }

      return new Map(
        parsed.rows
          .filter(isPrivateSourceTextDiffRow)
          .map((row) => [privateSourceTextDiffKey(row.entitySlug, row.sourceUrl), row])
      );
    } catch {
      continue;
    }
  }

  return new Map();
}

function isPrivateSourceTextDiffRow(value: unknown): value is PrivateSourceTextDiffRow {
  if (!value || typeof value !== "object") return false;
  const row = value as Partial<PrivateSourceTextDiffRow>;

  return (
    typeof row.entitySlug === "string" &&
    typeof row.sourceUrl === "string" &&
    typeof row.summary === "string" &&
    isSourceTextDiffStatus(row.status)
  );
}

function isSourceTextDiffStatus(value: unknown): value is SourceTextDiffStatus {
  return (
    value === "added" ||
    value === "removed" ||
    value === "unchanged" ||
    value === "normalized_text_changed" ||
    value === "metadata_changed" ||
    value === "metadata_only" ||
    value === "unavailable"
  );
}

function parseManifest(content: string): PublicReleaseManifest | undefined {
  try {
    const value = JSON.parse(content) as Partial<PublicReleaseManifest>;
    if (
      value.schemaVersion === "uapt-public-release-manifest-v1" &&
      typeof value.releaseId === "string" &&
      typeof value.publishedAt === "string" &&
      Array.isArray(value.includeStagedArtifactDirectories)
    ) {
      return value as PublicReleaseManifest;
    }
  } catch {
    return undefined;
  }

  return undefined;
}

async function findRepoRoot(): Promise<string> {
  let current = process.cwd();

  for (;;) {
    try {
      await readFile(path.join(current, "package.json"), "utf8");
      await readdir(path.join(current, "apps"));
      return current;
    } catch {
      const parent = path.dirname(current);
      if (parent === current) return process.cwd();
      current = parent;
    }
  }
}

function summarizeRows(rows: ReleaseDiffRow[]): ReleaseDiffCounts {
  return {
    added: rows.filter((row) => row.changeType.endsWith("_added")).length,
    claimMetadataChanged: rows.filter(
      (row) => row.changeCategory === "claim_metadata_changed"
    ).length,
    entitiesChanged: new Set(rows.map((row) => row.entitySlug).filter(Boolean)).size,
    evidenceChanged: rows.filter(
      (row) => row.changeCategory === "evidence_changed"
    ).length,
    metadata: rows.filter((row) => row.changeType === "metadata_changed").length,
    modified: rows.filter(
      (row) =>
        row.changeType.endsWith("_modified") ||
        row.changeType === "source_snapshot_changed"
    ).length,
    newlyExtractedClaims: rows.filter(
      (row) => row.changeCategory === "newly_extracted_claim"
    ).length,
    policyTextChanged: rows.filter(
      (row) => row.changeCategory === "policy_text_changed"
    ).length,
    removed: rows.filter((row) => row.changeType.endsWith("_removed")).length,
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
    ).length,
    unchanged: 0
  };
}

function withDiffSemantics(row: ReleaseDiffRowBase): ReleaseDiffRow {
  const { category, explanation } = getRowSemantics(row);

  return {
    ...row,
    changeCategory: category,
    changeExplanation: explanation
  };
}

function getRowSemantics(row: ReleaseDiffRowBase): {
  category: ReleaseDiffCategory;
  explanation: string;
} {
  switch (row.changeType) {
    case "claim_added":
      return {
        category: "newly_extracted_claim",
        explanation:
          "This claim was newly extracted or newly promoted in the tracker release. It is not necessarily newly published by the university."
      };
    case "claim_removed":
      return {
        category: "tracker_removed_claim",
        explanation:
          "This claim was present in the previous tracker release and is no longer present in the current tracker release. This does not by itself prove the university removed the policy."
      };
    case "claim_modified":
      if (
        row.oldClaim &&
        row.newClaim &&
        (row.oldClaim.claimText !== row.newClaim.claimText ||
          row.oldClaim.claimValue !== row.newClaim.claimValue)
      ) {
        return {
          category: "policy_text_changed",
          explanation:
            "The tracker matched an old claim to a new claim and the claim text or normalized value changed between release snapshots."
        };
      }

      return {
        category: "claim_metadata_changed",
        explanation:
          "The tracker matched the same claim across releases, but only claim metadata or evidence linkage changed."
      };
    case "evidence_added":
    case "evidence_removed":
    case "evidence_modified":
      return {
        category: "evidence_changed",
        explanation:
          "The claim evidence snippet, source hash, or evidence linkage changed between tracker releases. Confirm the official source before treating it as a policy change."
      };
    case "source_added":
      return {
        category: "source_added",
        explanation:
          "An official source attribution was added to the tracker record."
      };
    case "source_removed":
      return {
        category: "source_removed",
        explanation:
          "An official source attribution was removed from the tracker record."
      };
    case "source_snapshot_changed":
      if (row.sourceTextDiffStatus === "normalized_text_changed") {
        return {
          category: "source_snapshot_changed",
          explanation:
            "The same source URL has a different snapshot hash and private normalized source text comparison also changed. Review the public evidence snippets and official source before treating this as a policy change."
        };
      }
      if (row.sourceTextDiffStatus === "metadata_only") {
        return {
          category: "source_snapshot_changed",
          explanation:
            "The same source URL has a different snapshot hash, but only private metadata records were available for comparison. This may reflect page chrome, crawler metadata, or source text changes."
        };
      }
      if (row.sourceTextDiffStatus === "unavailable") {
        return {
          category: "source_snapshot_changed",
          explanation:
            "The same source URL has a different snapshot hash, but private normalized source text comparison was unavailable. Treat this as a source-health signal until reviewed."
        };
      }
      return {
        category: "source_snapshot_changed",
        explanation:
          "The same source URL has a different snapshot hash. This may reflect policy text, page layout, navigation, or metadata changes; it is not by itself a policy change."
      };
    case "metadata_changed":
    default:
      return {
        category: "metadata_changed",
        explanation:
          "Tracker metadata changed between release snapshots."
      };
  }
}

function compareEntityDiffs(left: ReleaseEntityDiff, right: ReleaseEntityDiff): number {
  const changed = Number(right.rows.length > 0) - Number(left.rows.length > 0);
  if (changed) return changed;

  return left.entityName.localeCompare(right.entityName);
}

function compareRows(left: ReleaseDiffRow, right: ReleaseDiffRow): number {
  return (
    (left.claimId ?? left.sourceUrl ?? "").localeCompare(
      right.claimId ?? right.sourceUrl ?? ""
    ) || left.changeType.localeCompare(right.changeType)
  );
}

function evidenceKey(evidence: ClaimEvidence): string {
  return `${evidence.sourceUrl}:${evidence.sourceSnapshotHash}:${evidence.evidenceSnippet}`;
}

function privateSourceTextDiffKey(entitySlug: string | undefined, sourceUrl: string): string {
  return `${entitySlug ?? ""}:${sourceUrl}`;
}

function firstSourceUrl(claim: PolicyClaim): string | undefined {
  return claim.evidence[0]?.sourceUrl;
}

function firstSnapshotHash(claim: PolicyClaim): string | undefined {
  return claim.evidence[0]?.sourceSnapshotHash;
}

function firstSourceLanguage(claim: PolicyClaim): string | undefined {
  return claim.evidence[0]?.sourceLanguage;
}

function textSimilarity(left: string, right: string): number {
  const leftTokens = new Set(tokenize(left));
  const rightTokens = new Set(tokenize(right));
  const intersection = [...leftTokens].filter((token) => rightTokens.has(token)).length;
  const union = new Set([...leftTokens, ...rightTokens]).size;

  return union ? intersection / union : 0;
}

function tokenize(value: string): string[] {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .split(/\s+/)
    .filter((token) => token.length > 2);
}

function entitySlugToName(slug: string): string {
  return slug
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
