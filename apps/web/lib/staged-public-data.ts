import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import {
  DEFAULT_PUBLIC_SITE_BASE_URL,
  NO_ADVICE_BOUNDARY,
  OFFICIAL_SOURCE_RIGHTS_CAVEAT,
  PUBLIC_API_VERSION,
  TRACKER_METADATA_LICENSE,
  buildPublicApiIndexResponse,
  buildPublicEntitySummaryResponse,
  buildPublicRecentChangesEnvelope,
  buildPublicRecentChangesData,
  buildPublicUniversityListResponse,
  openClawStagedArtifactSchema,
  publicEntitySummarySchema,
  publicRecentChangesResponseSchema,
  type CatalogSourceRecord,
  type CatalogUniversity,
  type ClaimEvidence,
  type ClaimReviewState,
  type OpenClawStagedArtifact,
  type PolicyClaim,
  type PolicyClaimType,
  type PublicApiIndexResponse,
  type PublicEntitySummary,
  type PublicEntitySummaryResponse,
  type PublicRecentChangesEnvelope,
  type PublicUniversityListResponse,
  type SourceAttribution,
  type StagedClaimCandidate,
  type StagedEvidenceCandidate,
  type StagedFetchAttempt,
  type StagedReportDraft,
  type StagedReviewDecision,
  type StagedSourceCandidate,
  type StagedSourceSnapshot
} from "@uapt/shared";
import { getSiteBaseUrl } from "./site-url";

interface RankingRecord {
  rowNumber: number;
  rankText: string;
  rankNumber: number;
  name: string;
  city?: string;
  countryOrRegion: string;
  overallScore?: number;
}

interface RankingSource {
  universities: RankingRecord[];
}

interface EntityArtifacts {
  slug: string;
  claims: StagedClaimCandidate[];
  evidences: StagedEvidenceCandidate[];
  fetchAttempts: StagedFetchAttempt[];
  reports: StagedReportDraft[];
  reviews: StagedReviewDecision[];
  snapshots: StagedSourceSnapshot[];
  sources: StagedSourceCandidate[];
}

interface PublicDataset {
  catalogSources: CatalogSourceRecord[];
  catalogUniversities: CatalogUniversity[];
  publicSummaries: PublicEntitySummary[];
}

let datasetPromise: Promise<PublicDataset> | undefined;

export async function getStagedPublicDataset(): Promise<PublicDataset> {
  datasetPromise ??= buildStagedPublicDataset();

  return datasetPromise;
}

export async function getStagedCatalogUniversities(): Promise<CatalogUniversity[]> {
  return (await getStagedPublicDataset()).catalogUniversities;
}

export async function getStagedCatalogSources(): Promise<CatalogSourceRecord[]> {
  return (await getStagedPublicDataset()).catalogSources;
}

export async function getStagedPublicSummaries(): Promise<PublicEntitySummary[]> {
  return (await getStagedPublicDataset()).publicSummaries;
}

export async function getStagedPublicSummaryBySlug(
  slug: string
): Promise<PublicEntitySummary | undefined> {
  return (await getStagedPublicSummaries()).find(
    (summary) => summary.entity.slug === slug
  );
}

export async function getStagedPublicUniversityListResponse(): Promise<PublicUniversityListResponse> {
  return buildPublicUniversityListResponse(
    await getStagedPublicSummaries(),
    getSiteBaseUrl()
  );
}

export async function getStagedPublicUniversityResponseBySlug(
  slug: string
): Promise<PublicEntitySummaryResponse | undefined> {
  const summary = await getStagedPublicSummaryBySlug(slug);

  return summary
    ? buildPublicEntitySummaryResponse(summary, getSiteBaseUrl())
    : undefined;
}

export function getStagedPublicApiIndexResponse(): PublicApiIndexResponse {
  return buildPublicApiIndexResponse(getSiteBaseUrl());
}

export async function getStagedRecentChangesEnvelope(): Promise<PublicRecentChangesEnvelope> {
  const summaries = (await getStagedPublicSummaries()).sort(compareFreshness);
  const response = publicRecentChangesResponseSchema.parse({
    schemaVersion: PUBLIC_API_VERSION,
    generatedAt: new Date().toISOString(),
    license: TRACKER_METADATA_LICENSE,
    trackerMetadataLicense: TRACKER_METADATA_LICENSE,
    sourcePolicy: OFFICIAL_SOURCE_RIGHTS_CAVEAT,
    sourceRightsPolicy: OFFICIAL_SOURCE_RIGHTS_CAVEAT,
    limitations: [NO_ADVICE_BOUNDARY],
    changes: buildPublicRecentChangesData(summaries).changes
  });

  return buildPublicRecentChangesEnvelope(response, getSiteBaseUrl());
}

async function buildStagedPublicDataset(): Promise<PublicDataset> {
  const repoRoot = await findRepoRoot();
  const artifacts = await readStagedArtifacts(repoRoot);
  const rankings = await readRankings(repoRoot);
  const rankingBySlug = buildRankingIndex(rankings);
  const byEntity = groupArtifactsByEntity(artifacts);
  const publicSummaries = Array.from(byEntity.values())
    .map((entityArtifacts) =>
      buildPublicSummary(entityArtifacts, rankingBySlug.get(entityArtifacts.slug))
    )
    .filter((summary): summary is PublicEntitySummary => Boolean(summary))
    .sort((left, right) => left.entity.name.localeCompare(right.entity.name));
  const catalogUniversities = publicSummaries.map((summary) =>
    buildCatalogUniversity(summary, rankingBySlug.get(summary.entity.slug))
  );
  const catalogSources = catalogUniversities.flatMap((university) =>
    university.sources.map((source) => ({
      ...source,
      universityName: university.name,
      universitySlug: university.slug
    }))
  );

  return {
    catalogSources,
    catalogUniversities,
    publicSummaries
  };
}

async function findRepoRoot(): Promise<string> {
  let current = process.cwd();

  for (;;) {
    try {
      await readFile(path.join(current, "package.json"), "utf8");
      const stagingExists = await pathExists(path.join(current, "staging"));
      const appsExists = await pathExists(path.join(current, "apps"));

      if (stagingExists && appsExists) return current;
    } catch {
      // Continue walking upward.
    }

    const parent = path.dirname(current);
    if (parent === current) return process.cwd();
    current = parent;
  }
}

async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await readdir(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function readStagedArtifacts(repoRoot: string): Promise<OpenClawStagedArtifact[]> {
  const roots = [
    path.join(repoRoot, "staging", "uapt-runs"),
    path.join(repoRoot, "data", "openclaw-staging")
  ];
  const files = (
    await Promise.all(roots.map((root) => walkJsonFiles(root)))
  ).flat();
  const artifacts: OpenClawStagedArtifact[] = [];

  for (const file of files) {
    const parsed = await readJson(file);
    const candidates = extractArtifactCandidates(parsed);

    for (const candidate of candidates) {
      const result = openClawStagedArtifactSchema.safeParse(candidate);
      if (result.success) artifacts.push(result.data);
    }
  }

  return artifacts;
}

async function walkJsonFiles(root: string): Promise<string[]> {
  let entries;

  try {
    entries = await readdir(root, { withFileTypes: true });
  } catch {
    return [];
  }

  const files = await Promise.all(
    entries.map(async (entry) => {
      const entryPath = path.join(root, entry.name);
      if (entry.isDirectory()) return walkJsonFiles(entryPath);
      if (entry.isFile() && entry.name.endsWith(".json")) return [entryPath];
      return [];
    })
  );

  return files.flat();
}

async function readJson(file: string): Promise<unknown> {
  try {
    return JSON.parse(await readFile(file, "utf8")) as unknown;
  } catch {
    return undefined;
  }
}

function extractArtifactCandidates(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (isRecord(value) && Array.isArray(value.artifacts)) return value.artifacts;
  if (isRecord(value)) return [value];
  return [];
}

function groupArtifactsByEntity(
  artifacts: OpenClawStagedArtifact[]
): Map<string, EntityArtifacts> {
  const byEntity = new Map<string, EntityArtifacts>();
  const claimToSlug = new Map<string, string>();
  const sourceCandidateToSlug = new Map<string, string>();
  const runToSlugs = new Map<string, Set<string>>();

  for (const artifact of artifacts) {
    if (!("entitySlug" in artifact) || artifact.entityType !== "university") {
      continue;
    }

    const bucket = getEntityBucket(byEntity, artifact.entitySlug);
    addRunSlug(runToSlugs, artifact.runId, artifact.entitySlug);

    if (artifact.artifactType === "claim_candidate") {
      bucket.claims.push(artifact);
      claimToSlug.set(scopedKey(artifact.runId, artifact.claimId), artifact.entitySlug);
    }

    if (artifact.artifactType === "source_candidate") {
      bucket.sources.push(artifact);
      sourceCandidateToSlug.set(
        scopedKey(artifact.runId, artifact.sourceCandidateId),
        artifact.entitySlug
      );
    }
  }

  for (const artifact of artifacts) {
    switch (artifact.artifactType) {
      case "evidence_candidate": {
        const slug = claimToSlug.get(scopedKey(artifact.runId, artifact.claimId));
        if (slug) getEntityBucket(byEntity, slug).evidences.push(artifact);
        break;
      }
      case "fetch_attempt": {
        const slug = artifact.sourceCandidateId
          ? sourceCandidateToSlug.get(scopedKey(artifact.runId, artifact.sourceCandidateId))
          : undefined;
        if (slug) getEntityBucket(byEntity, slug).fetchAttempts.push(artifact);
        break;
      }
      case "report_draft": {
        const slugs = runToSlugs.get(artifact.runId);
        if (slugs?.size === 1) {
          getEntityBucket(byEntity, Array.from(slugs)[0]).reports.push(artifact);
        }
        break;
      }
      case "review_decision": {
        const slug = claimToSlug.get(scopedKey(artifact.runId, artifact.claimId));
        if (slug) getEntityBucket(byEntity, slug).reviews.push(artifact);
        break;
      }
      case "source_snapshot": {
        const slug = artifact.sourceCandidateId
          ? sourceCandidateToSlug.get(scopedKey(artifact.runId, artifact.sourceCandidateId))
          : undefined;
        if (slug) getEntityBucket(byEntity, slug).snapshots.push(artifact);
        break;
      }
      default:
        break;
    }
  }

  return byEntity;
}

function scopedKey(runId: string, id: string): string {
  return `${runId}:${id}`;
}

function addRunSlug(
  runToSlugs: Map<string, Set<string>>,
  runId: string,
  slug: string
): void {
  const slugs = runToSlugs.get(runId) ?? new Set<string>();
  slugs.add(slug);
  runToSlugs.set(runId, slugs);
}

function getEntityBucket(
  byEntity: Map<string, EntityArtifacts>,
  slug: string
): EntityArtifacts {
  const existing = byEntity.get(slug);
  if (existing) return existing;

  const created: EntityArtifacts = {
    slug,
    claims: [],
    evidences: [],
    fetchAttempts: [],
    reports: [],
    reviews: [],
    snapshots: [],
    sources: []
  };
  byEntity.set(slug, created);

  return created;
}

function buildPublicSummary(
  entityArtifacts: EntityArtifacts,
  ranking: RankingRecord | undefined
): PublicEntitySummary | undefined {
  const siteBaseUrl = getSiteBaseUrl();
  const canonicalUrl = new URL(
    `/universities/${entityArtifacts.slug}`,
    siteBaseUrl
  ).toString();
  const apiUrl = new URL(
    `/api/public/${PUBLIC_API_VERSION}/universities/${entityArtifacts.slug}.json`,
    siteBaseUrl
  ).toString();
  const evidencesById = new Map(
    entityArtifacts.evidences.map((evidence) => [
      scopedKey(evidence.runId, evidence.evidenceId),
      evidence
    ])
  );
  const reviewsByClaimId = newestByKey(
    entityArtifacts.reviews,
    (review) => scopedKey(review.runId, review.claimId),
    (review) => review.decidedAt
  );
  const claims = dedupeClaims(
    entityArtifacts.claims
      .map((claim) =>
        buildPolicyClaim(
          claim,
          reviewsByClaimId.get(scopedKey(claim.runId, claim.claimId)),
          evidencesById
        )
      )
      .filter((claim): claim is PolicyClaim => Boolean(claim))
  );

  if (!claims.length) return undefined;

  const name = ranking?.name ?? deriveEntityName(entityArtifacts);
  const officialSources = buildOfficialSources(entityArtifacts, claims);
  const lastCheckedAt = latestIso([
    ...entityArtifacts.sources.map((source) => source.verifiedAt ?? source.discoveredAt),
    ...entityArtifacts.snapshots.map((snapshot) => snapshot.fetchedAt),
    ...claims.map((claim) => claim.lastCheckedAt)
  ]);
  const lastChangedAt = latestIso([
    ...entityArtifacts.reviews.map((review) => review.decidedAt),
    ...claims.map((claim) => claim.lastChangedAt)
  ]);
  const summary = buildSummary(name, claims.length, officialSources.length, ranking);

  return publicEntitySummarySchema.parse({
    schemaVersion: PUBLIC_API_VERSION,
    citationTitle: `${name} AI Policy Tracker record`,
    canonicalUrl,
    publicPageUrl: canonicalUrl,
    apiUrl,
    entityType: "university",
    entitySlug: entityArtifacts.slug,
    entity: {
      type: "university",
      slug: entityArtifacts.slug,
      name,
      canonicalUrl,
      aliases: buildAliases(name, ranking),
      summary
    },
    summary,
    lastCheckedAt,
    lastChangedAt,
    confidence: claims.length
      ? Math.max(...claims.map((claim) => claim.confidence))
      : undefined,
    reviewState: aggregateReviewState(claims.map((claim) => claim.reviewState)),
    license: TRACKER_METADATA_LICENSE,
    trackerMetadataLicense: TRACKER_METADATA_LICENSE,
    sourcePolicy: OFFICIAL_SOURCE_RIGHTS_CAVEAT,
    sourceRightsPolicy: OFFICIAL_SOURCE_RIGHTS_CAVEAT,
    limitations: [NO_ADVICE_BOUNDARY],
    officialSources,
    claims,
    suggestedCitation: buildSuggestedCitation(name, canonicalUrl, lastCheckedAt)
  });
}

function buildPolicyClaim(
  claim: StagedClaimCandidate,
  review: StagedReviewDecision | undefined,
  evidencesById: Map<string, StagedEvidenceCandidate>
): PolicyClaim | undefined {
  if (review?.decision === "reject") return undefined;

  const evidence = claim.evidenceIds
    .map((evidenceId) => evidencesById.get(scopedKey(claim.runId, evidenceId)))
    .filter((evidence): evidence is StagedEvidenceCandidate => Boolean(evidence))
    .map(buildClaimEvidence);

  if (!evidence.length) return undefined;

  const reviewState = normalizeReviewState(review?.reviewState ?? claim.reviewState);
  const lastCheckedAt = latestIso([
    claim.citation.retrievedAt,
    ...evidence.map((item) => item.retrievedAt)
  ]);
  const lastChangedAt = review?.decidedAt;

  return {
    id: claim.claimId,
    entitySlug: claim.entitySlug,
    entityType: "university",
    claimType: normalizeClaimType(claim.claimType),
    claimText: claim.claimText,
    claimValue: claim.normalizedValue,
    confidence: claim.confidence,
    reviewState,
    lastCheckedAt,
    lastChangedAt,
    evidence
  };
}

function buildClaimEvidence(evidence: StagedEvidenceCandidate): ClaimEvidence {
  return {
    id: evidence.evidenceId,
    sourceUrl: evidence.sourceUrl,
    sourceLanguage: evidence.sourceLanguage,
    sourceSnapshotHash: evidence.snapshotHash,
    evidenceSnippet: evidence.evidenceSnippetOriginal,
    evidenceSnippetDisplay: evidence.evidenceSnippetDisplay,
    snippetLocation: evidence.evidenceLocator,
    retrievedAt: evidence.citation.retrievedAt,
    attribution: {
      id: evidence.sourceSnapshotId,
      sourceUrl: evidence.sourceUrl,
      finalUrl: evidence.finalUrl,
      citationTitle: evidence.sourceTitle,
      publisher: evidence.citation.publisher,
      retrievedAt: evidence.citation.retrievedAt,
      snapshotHash: evidence.snapshotHash,
      sourceType: evidence.evidenceType === "pdf" ? "official_pdf" : "official_policy_page",
      official: true,
      sourceRights: evidence.rightsNote
    }
  };
}

function buildOfficialSources(
  entityArtifacts: EntityArtifacts,
  claims: PolicyClaim[]
): SourceAttribution[] {
  const snapshotsByCandidateId = newestByKey(
    entityArtifacts.snapshots.filter((snapshot) => snapshot.sourceCandidateId),
    (snapshot) =>
      snapshot.sourceCandidateId
        ? scopedKey(snapshot.runId, snapshot.sourceCandidateId)
      : "",
    (snapshot) => snapshot.fetchedAt
  );
  const sourcesFromCandidates: SourceAttribution[] = [];

  for (const source of entityArtifacts.sources) {
    if (source.verificationStatus !== "verified") continue;
    const snapshot = snapshotsByCandidateId.get(
      scopedKey(source.runId, source.sourceCandidateId)
    );
    if (!snapshot) continue;

    sourcesFromCandidates.push({
      id: source.sourceCandidateId,
      sourceUrl: source.sourceUrl,
      finalUrl: source.finalUrl ?? snapshot.finalUrl,
      citationTitle: source.sourceTitle ?? snapshot.sourceTitle ?? source.sourceUrl,
      publisher: derivePublisher(source.sourceUrl),
      retrievedAt: snapshot.fetchedAt,
      snapshotHash: snapshot.contentHash,
      sourceType: mapSourceType(source.sourceType),
      official: true,
      sourceRights: OFFICIAL_SOURCE_RIGHTS_CAVEAT
    });
  }
  const sourcesFromEvidence = claims.flatMap((claim) =>
    claim.evidence.map((evidence) => evidence.attribution)
  );

  return dedupeBy(
    [...sourcesFromCandidates, ...sourcesFromEvidence],
    (source) => `${source.sourceUrl}:${source.snapshotHash}`
  ).sort((left, right) => left.citationTitle.localeCompare(right.citationTitle));
}

function buildCatalogUniversity(
  summary: PublicEntitySummary,
  ranking: RankingRecord | undefined
): CatalogUniversity {
  const firstSourceUrl = summary.officialSources[0]?.sourceUrl ?? summary.canonicalUrl;

  return {
    slug: summary.entity.slug,
    name: summary.entity.name,
    country: ranking?.countryOrRegion ?? "Unknown",
    region: ranking?.city ?? "Unknown",
    website: new URL("/", firstSourceUrl).toString(),
    summary: summary.summary,
    sourceCount: summary.officialSources.length,
    sources: summary.officialSources.map((source) => ({
      id: source.id,
      title: source.citationTitle,
      url: source.sourceUrl,
      documentStatus: "university_wide_policy",
      serviceTreatment: "not_mentioned",
      reviewState: mapCatalogReviewState(summary.reviewState),
      themes: [],
      tools: [],
      lastCheckedAt: source.retrievedAt ?? summary.lastCheckedAt,
      lastChangedAt: summary.lastChangedAt
    }))
  };
}

function mapCatalogReviewState(
  reviewState: ClaimReviewState
): CatalogUniversity["sources"][number]["reviewState"] {
  if (reviewState === "machine_candidate") return "machine_extracted";
  if (reviewState === "rejected") return "needs_review";

  return reviewState;
}

async function readRankings(repoRoot: string): Promise<RankingRecord[]> {
  const ranking = await readJson(
    path.join(
      repoRoot,
      "data",
      "rankings",
      "qs-world-university-rankings-2026-top-100.json"
    )
  );

  if (!isRankingSource(ranking)) return [];

  return ranking.universities;
}

function isRankingSource(value: unknown): value is RankingSource {
  return isRecord(value) && Array.isArray(value.universities);
}

function buildRankingIndex(rankings: RankingRecord[]): Map<string, RankingRecord> {
  const index = new Map<string, RankingRecord>();

  for (const ranking of rankings) {
    for (const slug of buildRankingSlugs(ranking.name)) {
      index.set(slug, ranking);
    }
  }

  return index;
}

function buildRankingSlugs(name: string): string[] {
  const withoutParentheses = name.replace(/\([^)]*\)/g, "").trim();
  const slugs = new Set([slugify(name), slugify(withoutParentheses)]);
  const shortAliases: Record<string, string[]> = {
    "australian-national-university": ["anu"],
    "california-institute-of-technology": ["caltech"],
    "columbia-university": ["columbia"],
    "johns-hopkins-university": ["jhu"],
    "king-s-college-london": ["kcl", "kings-college-london"],
    "kings-college-london": ["kcl"],
    "monash-university": ["monash"],
    "national-university-of-singapore": ["nus", "national-university-of-singapore"],
    "nanyang-technological-university-singapore": [
      "nanyang-technological-university",
      "ntu"
    ],
    "seoul-national-university": ["snu"],
    "the-chinese-university-of-hong-kong": ["cuhk"],
    "the-hong-kong-university-of-science-and-technology": ["hkust"],
    "the-university-of-edinburgh": ["edinburgh"],
    "the-university-of-hong-kong": ["university-of-hong-kong"],
    "the-university-of-manchester": ["manchester"],
    "the-university-of-melbourne": ["university-of-melbourne"],
    "the-university-of-new-south-wales": ["unsw-sydney"],
    "the-university-of-queensland": ["university-of-queensland"],
    "the-university-of-tokyo": ["u-tokyo"],
    "university-of-british-columbia": ["ubc"],
    "university-of-california-berkeley": ["uc-berkeley"],
    "university-of-california-berkeley-ucb": ["university-of-california-berkeley"],
    "university-of-michigan-ann-arbor": ["university-of-michigan-ann-arbor"]
  };

  for (const slug of Array.from(slugs)) {
    for (const alias of shortAliases[slug] ?? []) slugs.add(alias);
  }

  return Array.from(slugs);
}

function deriveEntityName(entityArtifacts: EntityArtifacts): string {
  const title = entityArtifacts.reports
    .map((report) => report.title)
    .find(Boolean);

  if (title) {
    return title
      .replace(/\s*[-—:]\s*AI Policy.*$/i, "")
      .replace(/\s*\(QS 2026 #[^)]+\)/i, "")
      .replace(/^University AI Policy Tracker\s*[-—:]\s*/i, "")
      .trim();
  }

  return entityArtifacts.slug
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function buildSummary(
  name: string,
  claimCount: number,
  sourceCount: number,
  ranking: RankingRecord | undefined
): string {
  const rankPrefix = ranking
    ? `${name} is listed as QS 2026 rank ${ranking.rankText}. `
    : "";

  return (
    `${rankPrefix}${name} has ${claimCount} source-backed AI policy claim ` +
    `record${claimCount === 1 ? "" : "s"} from ${sourceCount} official source ` +
    `attribution${sourceCount === 1 ? "" : "s"}. The public record preserves ` +
    "original-language evidence snippets, source URLs, snapshot hashes, " +
    "confidence, and review state."
  );
}

function buildAliases(
  name: string,
  ranking: RankingRecord | undefined
): string[] {
  return dedupeBy(
    [ranking?.name, name, ranking?.rankText ? `QS 2026 ${ranking.rankText}` : undefined]
      .filter((value): value is string => Boolean(value)),
    (value) => value
  ).filter((alias) => alias !== name);
}

function buildSuggestedCitation(
  name: string,
  canonicalUrl: string,
  lastCheckedAt: string | undefined
): string {
  const checked = lastCheckedAt
    ? ` Last checked ${formatCitationDate(lastCheckedAt)}.`
    : "";

  return `University AI Policy Tracker. "${name} AI Policy Tracker record."${checked} ${canonicalUrl}`;
}

function formatCitationDate(value: string): string {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "long",
    timeZone: "UTC"
  }).format(new Date(value));
}

function dedupeClaims(claims: PolicyClaim[]): PolicyClaim[] {
  return dedupeBy(
    claims,
    (claim) =>
      `${claim.entitySlug}:${claim.claimText.toLowerCase()}:${claim.evidence
        .map((evidence) => evidence.sourceSnapshotHash)
        .sort()
        .join(",")}`
  ).sort((left, right) => {
    const reviewedDelta =
      reviewStateWeight(right.reviewState) - reviewStateWeight(left.reviewState);
    if (reviewedDelta !== 0) return reviewedDelta;

    return right.confidence - left.confidence;
  });
}

function aggregateReviewState(states: ClaimReviewState[]): ClaimReviewState {
  if (!states.length) return "machine_candidate";
  if (states.every((state) => state === "human_reviewed")) return "human_reviewed";
  if (states.some((state) => state === "agent_reviewed")) return "agent_reviewed";
  if (states.some((state) => state === "needs_review")) return "needs_review";
  if (states.some((state) => state === "machine_candidate")) return "machine_candidate";
  return "rejected";
}

function reviewStateWeight(state: ClaimReviewState): number {
  switch (state) {
    case "human_reviewed":
      return 5;
    case "agent_reviewed":
      return 4;
    case "machine_candidate":
      return 3;
    case "needs_review":
      return 2;
    case "rejected":
      return 1;
  }
}

function normalizeReviewState(state: ClaimReviewState): ClaimReviewState {
  return state === "rejected" ? "rejected" : state;
}

function normalizeClaimType(value: PolicyClaimType): PolicyClaimType {
  return value;
}

function mapSourceType(value: StagedSourceCandidate["sourceType"]): SourceAttribution["sourceType"] {
  if (value === "formal_policy") return "official_policy_page";
  if (value === "official_pdf") return "official_pdf";
  if (value === "external_declaration") return "other";
  if (value === "generic_or_unclear" || value === "other") return "other";
  return "official_guidance";
}

function newestByKey<T>(
  values: T[],
  getKey: (value: T) => string,
  getDate: (value: T) => string | undefined
): Map<string, T> {
  const map = new Map<string, T>();

  for (const value of values) {
    const key = getKey(value);
    if (!key) continue;
    const existing = map.get(key);
    if (!existing || compareIso(getDate(value), getDate(existing)) > 0) {
      map.set(key, value);
    }
  }

  return map;
}

function compareFreshness(left: PublicEntitySummary, right: PublicEntitySummary): number {
  return compareIso(
    right.lastChangedAt ?? right.lastCheckedAt,
    left.lastChangedAt ?? left.lastCheckedAt
  );
}

function compareIso(left: string | undefined, right: string | undefined): number {
  return (left ? new Date(left).getTime() : 0) - (right ? new Date(right).getTime() : 0);
}

function latestIso(values: Array<string | undefined>): string | undefined {
  return values.filter((value): value is string => Boolean(value)).sort().at(-1);
}

function dedupeBy<T>(values: T[], getKey: (value: T) => string): T[] {
  const seen = new Set<string>();
  const result: T[] = [];

  for (const value of values) {
    const key = getKey(value);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(value);
  }

  return result;
}

function derivePublisher(sourceUrl: string): string {
  try {
    return new URL(sourceUrl).hostname.replace(/^www\./, "");
  } catch {
    return "Official university source";
  }
}

function slugify(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
