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
  sourceSnapshotHash: string;
  sourceUrl: string;
}

export interface ReleaseSourceSnapshot {
  citationTitle: string;
  entityName: string;
  entitySlug: string;
  finalUrl?: string;
  releaseId: string;
  retrievedAt?: string;
  snapshotHash: string;
  sourceType?: string;
  sourceUrl: string;
}

export interface ReleaseDiffRow {
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
  sourceUrl?: string;
}

export interface ReleaseEntityDiff {
  added: number;
  canonicalUrl: string;
  currentReleaseId: string;
  entityName: string;
  entitySlug: string;
  lastChangedAt?: string;
  lastCheckedAt?: string;
  modified: number;
  previousReleaseId?: string;
  publicJsonUrl: string;
  removed: number;
  rows: ReleaseDiffRow[];
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
  entitiesChanged: number;
  metadata: number;
  modified: number;
  removed: number;
  unchanged: number;
}

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
      buildEntityDiff(manifest, previousManifest, previousBySlug.get(summary.entity.slug), summary)
    ),
    ...previousOnlySummaries.map((summary) =>
      buildEntityDiff(manifest, previousManifest, summary, undefined)
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
  currentSummary: PublicEntitySummary | undefined
): ReleaseEntityDiff {
  const summary = currentSummary ?? previousSummary;
  if (!summary) throw new Error("Missing both current and previous entity summary");

  const rows = [
    ...diffClaims(manifest, previousManifest, previousSummary, currentSummary),
    ...diffSources(manifest, previousManifest, previousSummary, currentSummary)
  ].sort(compareRows);
  const counts = summarizeRows(rows);

  return {
    added: counts.added,
    canonicalUrl: summary.canonicalUrl,
    currentReleaseId: manifest.releaseId,
    entityName: summary.entity.name,
    entitySlug: summary.entity.slug,
    lastChangedAt: currentSummary?.lastChangedAt ?? previousSummary?.lastChangedAt,
    lastCheckedAt: currentSummary?.lastCheckedAt ?? previousSummary?.lastCheckedAt,
    modified: counts.modified + counts.metadata,
    previousReleaseId: previousManifest?.releaseId,
    publicJsonUrl: summary.apiUrl ?? new URL(
      `/api/public/${PUBLIC_API_VERSION}/universities/${summary.entity.slug}.json`,
      getSiteBaseUrl()
    ).toString(),
    removed: counts.removed,
    rows,
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
  currentSummary: PublicEntitySummary | undefined
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
          source
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
          source
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
          undefined
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

  const sourceTypeIndex = oldClaims.findIndex(
    (claim, index) =>
      !matchedOld.has(index) &&
      claim.claimType === newClaim.claimType &&
      firstSourceUrl(claim) === firstSourceUrl(newClaim)
  );
  if (sourceTypeIndex >= 0) {
    return {
      claim: oldClaims[sourceTypeIndex],
      index: sourceTypeIndex,
      method: "source_claim_type"
    };
  }

  const snapshotIndex = oldClaims.findIndex(
    (claim, index) =>
      !matchedOld.has(index) &&
      claim.claimType === newClaim.claimType &&
      firstSnapshotHash(claim) === firstSnapshotHash(newClaim)
  );
  if (snapshotIndex >= 0) {
    return {
      claim: oldClaims[snapshotIndex],
      index: snapshotIndex,
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
  newSource: SourceAttribution | undefined
): ReleaseDiffRow {
  const source = newSource ?? oldSource;
  if (!source) throw new Error(`Cannot build ${changeType} without a source`);
  const summary = currentSummary ?? previousSummary;
  if (!summary) throw new Error(`Cannot build ${changeType} without a summary`);
  const entitySlug = summary.entity.slug;
  const entityName = summary.entity.name;

  return {
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
    sourceUrl: source.sourceUrl
  };
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

  return {
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
    ...values
  };
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
    sourceSnapshotHash: evidence.sourceSnapshotHash,
    sourceUrl: evidence.sourceUrl
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
    sourceType: source.sourceType,
    sourceUrl: source.sourceUrl
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
    entitiesChanged: new Set(rows.map((row) => row.entitySlug).filter(Boolean)).size,
    metadata: rows.filter((row) => row.changeType === "metadata_changed").length,
    modified: rows.filter(
      (row) =>
        row.changeType.endsWith("_modified") ||
        row.changeType === "source_snapshot_changed"
    ).length,
    removed: rows.filter((row) => row.changeType.endsWith("_removed")).length,
    unchanged: 0
  };
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
