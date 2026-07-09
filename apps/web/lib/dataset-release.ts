import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import {
  NO_ADVICE_BOUNDARY,
  OFFICIAL_SOURCE_RIGHTS_CAVEAT,
  PUBLIC_API_VERSION,
  TRACKER_METADATA_LICENSE,
  buildPublicApiCitation,
  publicDatasetReleaseManifestSchema,
  type ClaimEvidence,
  type PolicyClaim,
  type PublicDatasetArtifact,
  type PublicDatasetArtifactId,
  type PublicDatasetReleaseManifest,
  type PublicEntitySummary,
  type SourceAttribution
} from "@uapt/shared";
import {
  getCurrentPublicReleaseManifest,
  getStagedPublicDataset,
  getStagedPublicDatasetForManifest,
  type PublicReleaseManifest
} from "./staged-public-data";
import { getLatestReleaseDiff, getReleaseSnapshotManifest } from "./release-diffs";
import { findRepoRoot } from "./repo-root";
import { getSiteBaseUrl } from "./site-url";

export interface DatasetReleaseArtifactContent {
  content: string;
  fileName: string;
  id: PublicDatasetArtifactId;
  mediaType: PublicDatasetArtifact["mediaType"];
  path: string;
  sha256: string;
}

export interface DatasetRelease {
  artifactsByPath: Map<string, DatasetReleaseArtifactContent>;
  manifest: PublicDatasetReleaseManifest;
}

interface DatasetArtifactDefinition {
  description: string;
  filePrefix: string;
  id: PublicDatasetArtifactId;
  label: string;
  mediaType: PublicDatasetArtifact["mediaType"];
  routeSegment: string;
}

const datasetArtifactDefinitions = [
  {
    id: "universities",
    label: "Universities JSONL",
    description: "One public university policy record per JSONL row.",
    routeSegment: "universities.jsonl",
    filePrefix: "university-ai-policy-universities",
    mediaType: "application/jsonl"
  },
  {
    id: "claims",
    label: "Claims JSONL",
    description: "One claim-level record per JSONL row, including evidence.",
    routeSegment: "claims.jsonl",
    filePrefix: "university-ai-policy-claims",
    mediaType: "application/jsonl"
  },
  {
    id: "sources",
    label: "Sources JSONL",
    description: "One official source attribution per JSONL row.",
    routeSegment: "sources.jsonl",
    filePrefix: "university-ai-policy-sources",
    mediaType: "application/jsonl"
  },
  {
    id: "changes",
    label: "Changes JSONL",
    description: "One public source-check or change record per JSONL row.",
    routeSegment: "changes.jsonl",
    filePrefix: "university-ai-policy-changes",
    mediaType: "application/jsonl"
  },
  {
    id: "data_dictionary",
    label: "Data dictionary",
    description: "Markdown dictionary for public JSON and JSONL fields.",
    routeSegment: "data-dictionary.md",
    filePrefix: "university-ai-policy-data-dictionary",
    mediaType: "text/markdown"
  },
  {
    id: "checksums",
    label: "Checksums",
    description: "SHA-256 checksums for dataset release artifacts.",
    routeSegment: "checksums.txt",
    filePrefix: "university-ai-policy-checksums",
    mediaType: "text/plain"
  }
] as const satisfies readonly DatasetArtifactDefinition[];

export const datasetArtifactRouteSegments = datasetArtifactDefinitions.map(
  (definition) => definition.routeSegment
);

export async function getDatasetRelease(): Promise<DatasetRelease> {
  const publicReleaseManifest = await getCurrentPublicReleaseManifest();
  const dataset = await getStagedPublicDataset();

  return buildDatasetRelease(dataset.publicSummaries, publicReleaseManifest);
}

export async function getDatasetReleaseForPublicManifest(
  publicReleaseManifest: PublicReleaseManifest
): Promise<DatasetRelease> {
  const dataset = await getStagedPublicDatasetForManifest(publicReleaseManifest);

  return buildDatasetRelease(dataset.publicSummaries, publicReleaseManifest);
}

async function buildDatasetRelease(
  publicSummaries: PublicEntitySummary[],
  publicReleaseManifest: PublicReleaseManifest | undefined
): Promise<DatasetRelease> {
  const publishedAt =
    publicReleaseManifest?.publishedAt ?? new Date().toISOString();
  const generatedAt = publishedAt;
  const releasePeriod = publishedAt.slice(0, 7);
  const releaseId =
    publicReleaseManifest?.releaseId ?? `public-release-${publishedAt.slice(0, 10)}`;
  const siteBaseUrl = getSiteBaseUrl();
  const canonicalUrl = new URL("/datasets", siteBaseUrl).toString();
  const sortedSummaries = [...publicSummaries].sort((left, right) =>
    left.entity.name.localeCompare(right.entity.name)
  );
  const rawArtifacts = await buildRawArtifacts({
    releasePeriod,
    siteBaseUrl,
    summaries: sortedSummaries
  });
  const releaseDiff = await getLatestReleaseDiff().catch(() => undefined);
  const releaseSnapshot = await getReleaseSnapshotManifest(releaseId).catch(
    () => undefined
  );
  const checksumRows = rawArtifacts
    .filter((artifact) => artifact.id !== "checksums")
    .map((artifact) => {
      const rowCount = getArtifactRowCount(artifact.content);
      const rowText =
        rowCount === undefined ? "" : ` rows=${rowCount.toString()}`;

      return `${artifact.sha256}  ${artifact.fileName}  bytes=${Buffer.byteLength(
        artifact.content,
        "utf8"
      )}${rowText} path=${artifact.path}`;
    });
  const checksumsDefinition = getArtifactDefinition("checksums");
  const checksumsContent = `${checksumRows.join("\n")}\n`;
  const checksumsArtifact = buildArtifactContent(
    checksumsDefinition,
    checksumsContent,
    releasePeriod
  );
  const artifacts = [
    ...rawArtifacts.filter((artifact) => artifact.id !== "checksums"),
    checksumsArtifact
  ];
  const manifestArtifacts = artifacts.map((artifact) =>
    buildArtifactManifest(artifact, siteBaseUrl)
  );
  const manifest = publicDatasetReleaseManifestSchema.parse({
    schemaVersion: "uapt-dataset-release-v1",
    apiVersion: PUBLIC_API_VERSION,
    releaseId,
    releasePeriod,
    publishedAt,
    generatedAt,
    canonicalUrl,
    license: TRACKER_METADATA_LICENSE,
    trackerMetadataLicense: TRACKER_METADATA_LICENSE,
    sourcePolicy: OFFICIAL_SOURCE_RIGHTS_CAVEAT,
    sourceRightsPolicy: OFFICIAL_SOURCE_RIGHTS_CAVEAT,
    limitations: [NO_ADVICE_BOUNDARY],
    citation: buildPublicApiCitation({
      citationTitle: "University AI Policy Tracker dataset release",
      canonicalUrl,
      publicJsonUrl: new URL(
        `/api/public/${PUBLIC_API_VERSION}/datasets/latest.json`,
        siteBaseUrl
      ).toString(),
      suggestedCitation:
        "University AI Policy Tracker dataset release. University AI Policy Tracker. " +
        `Release ${releaseId}. ${canonicalUrl}`
    }),
    counts: buildDatasetCounts(sortedSummaries),
    previousReleaseId: releaseDiff?.previousReleaseId,
    diffArtifactUrl: new URL(
      `/api/public/${PUBLIC_API_VERSION}/changes/${releaseId}.json`,
      siteBaseUrl
    ).toString(),
    releaseSnapshotUrl: releaseSnapshot
      ? new URL(
          `/api/public/${PUBLIC_API_VERSION}/datasets/release-snapshots/${releaseId}/manifest.json`,
          siteBaseUrl
        ).toString()
      : undefined,
    changeCounts: releaseDiff
      ? {
          entitiesChanged: releaseDiff.changeCounts.entitiesChanged,
          added: releaseDiff.changeCounts.added,
          removed: releaseDiff.changeCounts.removed,
          modified:
            releaseDiff.changeCounts.modified + releaseDiff.changeCounts.metadata,
          unchanged: releaseDiff.changeCounts.unchanged
        }
      : undefined,
    artifacts: manifestArtifacts
  });

  return {
    manifest,
    artifactsByPath: new Map(artifacts.map((artifact) => [artifact.path, artifact]))
  };
}

export async function getDatasetArtifactByRouteSegment(
  routeSegment: string
): Promise<DatasetReleaseArtifactContent | undefined> {
  const path = `/api/public/${PUBLIC_API_VERSION}/datasets/${routeSegment}`;

  return (await getDatasetRelease()).artifactsByPath.get(path);
}

async function buildRawArtifacts(input: {
  releasePeriod: string;
  siteBaseUrl: string;
  summaries: PublicEntitySummary[];
}): Promise<DatasetReleaseArtifactContent[]> {
  const dictionary = await readDataDictionary();

  return [
    buildArtifactContent(
      getArtifactDefinition("universities"),
      toJsonLines(input.summaries.map((summary) => buildUniversityRow(summary))),
      input.releasePeriod
    ),
    buildArtifactContent(
      getArtifactDefinition("claims"),
      toJsonLines(
        input.summaries.flatMap((summary) =>
          summary.claims.map((claim) => buildClaimRow(summary, claim))
        )
      ),
      input.releasePeriod
    ),
    buildArtifactContent(
      getArtifactDefinition("sources"),
      toJsonLines(
        input.summaries.flatMap((summary) =>
          summary.officialSources.map((source) =>
            buildSourceRow(summary, source)
          )
        )
      ),
      input.releasePeriod
    ),
    buildArtifactContent(
      getArtifactDefinition("changes"),
      toJsonLines(
        input.summaries
          .map((summary) => buildChangeRow(summary, input.siteBaseUrl))
          .sort(compareChangeRows)
      ),
      input.releasePeriod
    ),
    buildArtifactContent(
      getArtifactDefinition("data_dictionary"),
      dictionary,
      input.releasePeriod
    )
  ];
}

function buildUniversityRow(summary: PublicEntitySummary) {
  return {
    apiVersion: PUBLIC_API_VERSION,
    entitySlug: summary.entity.slug,
    entityName: summary.entity.name,
    entityType: summary.entity.type,
    canonicalUrl: summary.canonicalUrl,
    publicPageUrl: summary.publicPageUrl ?? summary.canonicalUrl,
    publicJsonUrl: summary.apiUrl,
    citationTitle: summary.citationTitle,
    summary: summary.summary,
    lastCheckedAt: summary.lastCheckedAt,
    lastChangedAt: summary.lastChangedAt,
    reviewState: summary.reviewState,
    confidence: summary.confidence,
    claimCount: summary.claims.length,
    officialSourceCount: summary.officialSources.length,
    sourceLanguages: collectSourceLanguages(summary),
    license: summary.trackerMetadataLicense,
    sourceRightsPolicy: summary.sourceRightsPolicy,
    limitations: summary.limitations,
    suggestedCitation: summary.suggestedCitation
  };
}

function buildClaimRow(summary: PublicEntitySummary, claim: PolicyClaim) {
  return {
    apiVersion: PUBLIC_API_VERSION,
    entitySlug: summary.entity.slug,
    entityName: summary.entity.name,
    canonicalUrl: summary.canonicalUrl,
    publicJsonUrl: summary.apiUrl,
    claimId: claim.id,
    claimType: claim.claimType,
    claimText: claim.claimText,
    claimValue: claim.claimValue,
    confidence: claim.confidence,
    reviewState: claim.reviewState,
    lastCheckedAt: claim.lastCheckedAt,
    lastChangedAt: claim.lastChangedAt,
    evidenceCount: claim.evidence.length,
    evidence: claim.evidence.map(buildEvidenceExport)
  };
}

function buildEvidenceExport(evidence: ClaimEvidence) {
  return {
    sourceUrl: evidence.sourceUrl,
    sourceLanguage: evidence.sourceLanguage,
    sourceSnapshotHash: evidence.sourceSnapshotHash,
    evidenceSnippet: evidence.evidenceSnippet,
    evidenceSnippetDisplay: evidence.evidenceSnippetDisplay,
    snippetLocation: evidence.snippetLocation,
    retrievedAt: evidence.retrievedAt,
    attribution: evidence.attribution
  };
}

function buildSourceRow(
  summary: PublicEntitySummary,
  source: SourceAttribution
) {
  return {
    apiVersion: PUBLIC_API_VERSION,
    entitySlug: summary.entity.slug,
    entityName: summary.entity.name,
    canonicalUrl: summary.canonicalUrl,
    publicJsonUrl: summary.apiUrl,
    sourceUrl: source.sourceUrl,
    finalUrl: source.finalUrl,
    citationTitle: source.citationTitle,
    publisher: source.publisher,
    retrievedAt: source.retrievedAt,
    snapshotHash: source.snapshotHash,
    sourceType: source.sourceType,
    official: source.official,
    sourceRights: source.sourceRights
  };
}

function buildChangeRow(summary: PublicEntitySummary, siteBaseUrl: string) {
  return {
    apiVersion: PUBLIC_API_VERSION,
    entitySlug: summary.entity.slug,
    entityName: summary.entity.name,
    canonicalUrl: summary.canonicalUrl,
    changeUrl: new URL(`/changes/${summary.entity.slug}`, siteBaseUrl).toString(),
    publicJsonUrl: summary.apiUrl,
    citationTitle: summary.citationTitle,
    lastCheckedAt: summary.lastCheckedAt,
    lastChangedAt: summary.lastChangedAt,
    reviewState: summary.reviewState,
    confidence: summary.confidence,
    claimCount: summary.claims.length,
    officialSourceCount: summary.officialSources.length,
    reviewedClaimCount: summary.claims.filter((claim) =>
      isReviewedClaim(claim.reviewState)
    ).length,
    sourceSnapshotHashes: Array.from(
      new Set(summary.officialSources.map((source) => source.snapshotHash))
    ).sort()
  };
}

function buildDatasetCounts(summaries: PublicEntitySummary[]) {
  const sourceLanguageCounts = new Map<string, number>();
  const reviewStateCounts = new Map<string, number>();
  let evidenceRecords = 0;

  for (const summary of summaries) {
    increment(reviewStateCounts, summary.reviewState);

    for (const claim of summary.claims) {
      increment(reviewStateCounts, claim.reviewState);
      evidenceRecords += claim.evidence.length;

      for (const evidence of claim.evidence) {
        increment(sourceLanguageCounts, evidence.sourceLanguage ?? "und");
      }
    }
  }

  return {
    universities: summaries.length,
    claims: summaries.reduce((total, summary) => total + summary.claims.length, 0),
    sources: summaries.reduce(
      (total, summary) => total + summary.officialSources.length,
      0
    ),
    changes: summaries.length,
    evidenceRecords,
    sourceLanguages: Object.fromEntries(
      [...sourceLanguageCounts.entries()].sort(([left], [right]) =>
        left.localeCompare(right)
      )
    ),
    reviewStates: Object.fromEntries(
      [...reviewStateCounts.entries()].sort(([left], [right]) =>
        left.localeCompare(right)
      )
    )
  };
}

function buildArtifactContent(
  definition: DatasetArtifactDefinition,
  content: string,
  releasePeriod: string
): DatasetReleaseArtifactContent {
  const extension = definition.routeSegment.split(".").pop() ?? "txt";
  const fileName = `${definition.filePrefix}-${releasePeriod}.${extension}`;
  const artifactPath = `/api/public/${PUBLIC_API_VERSION}/datasets/${definition.routeSegment}`;

  return {
    content,
    fileName,
    id: definition.id,
    mediaType: definition.mediaType,
    path: artifactPath,
    sha256: sha256(content)
  };
}

function buildArtifactManifest(
  artifact: DatasetReleaseArtifactContent,
  siteBaseUrl: string
): PublicDatasetArtifact {
  const definition = getArtifactDefinition(artifact.id);
  const rowCount = getArtifactRowCount(artifact.content);

  return {
    id: artifact.id,
    label: definition.label,
    description: definition.description,
    path: artifact.path,
    url: new URL(artifact.path, siteBaseUrl).toString(),
    fileName: artifact.fileName,
    mediaType: artifact.mediaType,
    byteLength: Buffer.byteLength(artifact.content, "utf8"),
    rowCount,
    sha256: artifact.sha256
  };
}

function getArtifactDefinition(
  id: PublicDatasetArtifactId
): DatasetArtifactDefinition {
  const definition = datasetArtifactDefinitions.find((item) => item.id === id);

  if (!definition) throw new Error(`Unknown dataset artifact id: ${id}`);

  return definition;
}

function getArtifactRowCount(content: string): number | undefined {
  const lines = content.split("\n").filter(Boolean);

  return lines.every((line) => line.trim().startsWith("{"))
    ? lines.length
    : undefined;
}

function toJsonLines(rows: unknown[]): string {
  return `${rows.map((row) => JSON.stringify(row)).join("\n")}\n`;
}

function collectSourceLanguages(summary: PublicEntitySummary): string[] {
  return Array.from(
    new Set(
      summary.claims.flatMap((claim) =>
        claim.evidence.map((evidence) => evidence.sourceLanguage ?? "und")
      )
    )
  ).sort();
}

function compareChangeRows(
  left: ReturnType<typeof buildChangeRow>,
  right: ReturnType<typeof buildChangeRow>
): number {
  const leftTime = getFreshnessTime(left);
  const rightTime = getFreshnessTime(right);

  if (leftTime !== rightTime) return rightTime - leftTime;

  return left.entityName.localeCompare(right.entityName);
}

function getFreshnessTime(value: {
  lastChangedAt?: string;
  lastCheckedAt?: string;
}): number {
  const iso = value.lastChangedAt ?? value.lastCheckedAt;

  return iso ? new Date(iso).getTime() : 0;
}

function isReviewedClaim(reviewState: string): boolean {
  return reviewState === "agent_reviewed" || reviewState === "human_reviewed";
}

function increment(map: Map<string, number>, key: string): void {
  map.set(key, (map.get(key) ?? 0) + 1);
}

function sha256(content: string): string {
  return createHash("sha256").update(content, "utf8").digest("hex");
}

async function readDataDictionary(): Promise<string> {
  const repoRoot = await findRepoRoot();

  return readFile(path.join(repoRoot, "DATA_DICTIONARY.md"), "utf8");
}
