import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import {
  NO_ADVICE_BOUNDARY,
  OFFICIAL_SOURCE_RIGHTS_CAVEAT,
  PUBLIC_API_VERSION,
  TRACKER_METADATA_LICENSE,
  buildPublicApiCitation,
  openClawRunPurposeSchema,
  openClawStagedArtifactSchema,
  type CatalogUniversity,
  type OpenClawStagedArtifact,
  type OpenClawRunPurpose,
  type PublicEntitySummary,
  type StagedFetchAttempt,
  type StagedSourceCandidate,
  type StagedSourceSnapshot
} from "@uapt/shared";
import { getStagedPublicDataset } from "./staged-public-data";
import { getAbsoluteSiteUrl } from "./site-url";

const QS_2026_TOP_100 =
  "data/rankings/qs-world-university-rankings-2026-top-100.json";

const REQUIRED_ARTIFACT_TYPES = [
  "crawl_plan",
  "source_candidate",
  "source_discovery_trace",
  "fetch_attempt",
  "source_snapshot",
  "claim_candidate",
  "evidence_candidate",
  "review_decision",
  "report_draft"
] as const;

export type CoverageStatus = "public" | "staging_unpromoted" | "missing";

export type SourceHealthStatus =
  | "ok"
  | "redirected"
  | "changed_hash"
  | "not_found"
  | "forbidden"
  | "robots_blocked"
  | "login_wall"
  | "paywall"
  | "captcha_or_waf"
  | "browser_verified"
  | "blocked_by_client"
  | "browser_timeout_unverified"
  | "rejected_not_policy_evidence"
  | "agent_verified_accessible"
  | "agent_verified_empty"
  | "agent_verified_404"
  | "agent_verified_redirect_unrelated"
  | "agent_blocked_login"
  | "agent_blocked_robots"
  | "agent_blocked_captcha_waf"
  | "agent_fetch_failed"
  | "agent_unresolved"
  | "firecrawl_verified"
  | "firecrawl_opened_no_content"
  | "firecrawl_failed"
  | "unknown_error";

export type SourceHealthSeverity = "info" | "warning" | "error";

interface JsonObject {
  [key: string]: unknown;
}

interface PublicReleaseManifest {
  includeStagedArtifactDirectories: string[];
  publishedAt: string;
  releaseId: string;
}

interface FirecrawlSourceCheckDocument {
  checkedWith?: string;
  generatedAt: string;
  records: FirecrawlSourceCheckRecord[];
  requestPolicy: string;
  schemaVersion: "uapt-source-health-firecrawl-v1";
  summary?: Partial<
    Record<
      | "total"
      | "browser_verified"
      | "blocked_by_client"
      | "browser_timeout_unverified"
      | "firecrawl_verified"
      | "firecrawl_failed"
      | "firecrawl_opened_no_content",
      number
    >
  >;
}

interface FirecrawlSourceCheckRecord {
  browserVerification?: {
    checkedAt?: string;
    checkedWith?: string;
    contentExtracted?: boolean;
    finalUrl?: string;
    navigationError?: string;
    note?: string;
    textLength?: number;
    title?: string;
  };
  firecrawl?: {
    checkedAt?: string;
    contentExtracted?: boolean;
    contentType?: string;
    error?: string;
    httpStatus?: number;
    metadataStatusCode?: number;
    note?: string;
    proxyUsed?: string;
    title?: string;
  };
  originalHttpStatus?: string;
  recommendedAction: string;
  sourceTitle?: string;
  sourceUrl: string;
  status:
    | "browser_verified"
    | "blocked_by_client"
    | "browser_timeout_unverified"
    | "firecrawl_verified"
    | "firecrawl_opened_no_content"
    | "firecrawl_failed";
}

interface FirecrawlSourceCheckIndex {
  checkedWith?: string;
  generatedAt?: string;
  recordsByUrl: Map<string, FirecrawlSourceCheckRecord>;
  requestPolicy?: string;
  summary: {
    blockedByClient: number;
    browserTimeoutUnverified: number;
    browserVerified: number;
    failed: number;
    openedNoContent: number;
    total: number;
    verified: number;
  };
}

interface AgentSourceCheckDocument {
  checkedWith?: string[];
  generatedAt: string;
  records: AgentSourceCheckRecord[];
  requestPolicy: string;
  schemaVersion: "uapt-source-health-agent-verification-v1";
  summary?: Partial<Record<SourceHealthStatus | "total", number>>;
}

interface AgentSourceCheckRecord {
  checkedAt?: string;
  finalUrl?: string;
  note?: string;
  recommendedAction: string;
  sourceCandidateId?: string;
  sourceTitle?: string;
  sourceUrl: string;
  stagingRun?: string;
  status: SourceHealthStatus;
  textLength?: number;
  title?: string;
}

interface AgentSourceCheckIndex {
  checkedWith?: string[];
  generatedAt?: string;
  recordsByCandidateKey: Map<string, AgentSourceCheckRecord>;
  recordsByUrl: Map<string, AgentSourceCheckRecord>;
  requestPolicy?: string;
  summary: AgentVerificationSummary;
}

export interface AgentVerificationSummary {
  blocked: number;
  fetchFailed: number;
  total: number;
  unresolved: number;
  verified404: number;
  verifiedAccessible: number;
  verifiedEmpty: number;
  verifiedRedirectUnrelated: number;
}

interface RankingUniversity {
  countryOrRegion: string;
  name: string;
  rankNumber: number;
  rankText: string;
  rowNumber: number;
}

interface RankingDocument {
  rankingSystem: string;
  rankingYear: number;
  scope?: string;
  source?: {
    name?: string;
    retrievedAt?: string;
    url?: string;
  };
  universities: RankingUniversity[];
}

const REJECTED_DISCOVERY_REASONS = new Set([
  "duplicate",
  "event_or_news_only",
  "generic_home_page",
  "low_policy_specificity",
  "no_ai_content",
  "not_official",
  "other",
  "research_showcase_only"
]);

const LOGIN_ERROR_PATTERN = /\b(401|login|log in|sign in|signin|sso|okta|sharepoint|authentication|unauthorized)\b/i;
const CAPTCHA_WAF_PATTERN = /\b(captcha|waf|cloudflare|radware|incapsula|managed challenge|access policy|denied crawler)\b/i;
const EMPTY_CONTENT_PATTERN = /\b(no usable content|empty|opened.*no content|shell|selectable text extraction)\b/i;

interface ArtifactMetadataCollector {
  dates: Set<string>;
  languages: Set<string>;
  reviewStates: Map<string, number>;
  runIds: Set<string>;
  runPurposes: Set<OpenClawRunPurpose>;
  slugs: Set<string>;
}

export interface StagingRunSummary {
  artifactCount: number;
  claimCount: number;
  detectedLanguages: string[];
  detectedSlugs: string[];
  directory: string;
  evidenceCount: number;
  healthCounts: Record<SourceHealthStatus, number>;
  issueCount: number;
  issues: string[];
  jsonFileCount: number;
  lastArtifactAt?: string;
  promoted: boolean;
  recommendedAction: string;
  reviewDecisionCount: number;
  reviewStates: Record<string, number>;
  runPurpose?: OpenClawRunPurpose;
  runIds: string[];
  sourceCandidateCount: number;
  sourceHealthRows: SourceHealthRow[];
  validationStatus: "pass" | "fail";
}

export interface CoverageRow {
  claimCount: number;
  countryOrRegion: string;
  lastCheckedAt?: string;
  publicJsonUrl?: string;
  publicSlug?: string;
  qsRank: number;
  rankText: string;
  recommendedAction: string;
  reviewState?: string;
  sourceCount: number;
  stagingRun?: string;
  status: CoverageStatus;
  universityName: string;
}

export interface SourceHealthRow {
  entitySlug: string;
  finalUrl?: string;
  lastCheckedAt?: string;
  note: string;
  scope: "public_release" | "staging_run";
  severity: SourceHealthSeverity;
  sourceTitle?: string;
  sourceType?: string;
  sourceUrl: string;
  status: SourceHealthStatus;
  stagingRun?: string;
}

export interface ReviewQueueRow {
  claimCount: number;
  detectedSlugs: string[];
  directory: string;
  issueCount: number;
  lastArtifactAt?: string;
  recommendedAction: string;
  reviewDecisionCount: number;
  runPurpose?: OpenClawRunPurpose;
  sourceCandidateCount: number;
  validationStatus: "pass" | "fail";
}

export interface CoverageDashboardData {
  apiPath: string;
  citation: ReturnType<typeof buildPublicApiCitation>;
  generatedAt: string;
  highPriorityGaps: CoverageRow[];
  limitations: string[];
  ranking: {
    rowCount: number;
    scope?: string;
    sourceName?: string;
    sourceUrl?: string;
    system: string;
    year: number;
  };
  rows: CoverageRow[];
  summary: {
    missingCount: number;
    publicClaimCount: number;
    publicCount: number;
    publicSourceCount: number;
    stagingUnpromotedCount: number;
    totalRows: number;
  };
}

export interface SourceHealthDashboardData {
  agentVerification: {
    checkedWith?: string[];
    generatedAt?: string;
    requestPolicy?: string;
    summary: AgentVerificationSummary;
  };
  apiPath: string;
  citation: ReturnType<typeof buildPublicApiCitation>;
  firecrawlVerification: {
    checkedWith?: string;
    generatedAt?: string;
    requestPolicy?: string;
    summary: {
      blockedByClient: number;
      browserTimeoutUnverified: number;
      browserVerified: number;
      failed: number;
      openedNoContent: number;
      total: number;
      verified: number;
    };
  };
  generatedAt: string;
  rows: SourceHealthRow[];
  summary: {
    actionableIssueCount: number;
    errorCount: number;
    publicSourceRows: number;
    rejectedDiscoveryRows: number;
    stagingSourceRows: number;
    statusCounts: Record<SourceHealthStatus, number>;
    totalRows: number;
    unresolvedAgentRows: number;
    warningCount: number;
  };
}

export interface ReviewQueueData {
  apiPath: string;
  generatedAt: string;
  rows: ReviewQueueRow[];
  summary: {
    promotedRunCount: number;
    readyForReviewCount: number;
    repairNeededCount: number;
    totalRuns: number;
    unpromotedRunCount: number;
  };
}

interface DashboardContext {
  agentSourceChecks: AgentSourceCheckIndex;
  catalogUniversities: CatalogUniversity[];
  firecrawlSourceChecks: FirecrawlSourceCheckIndex;
  manifest: PublicReleaseManifest | undefined;
  publicSummaries: PublicEntitySummary[];
  ranking: RankingDocument;
  stagingRuns: StagingRunSummary[];
}

let contextPromise: Promise<DashboardContext> | undefined;

export async function getCoverageDashboardData(): Promise<CoverageDashboardData> {
  const context = await getDashboardContext();
  const rows = buildCoverageRows(context);
  const publicRows = rows.filter((row) => row.status === "public");
  const generatedAt = getGeneratedAt(context);
  const apiPath = `/api/public/${PUBLIC_API_VERSION}/coverage/qs-2026.json`;
  const canonicalUrl = getAbsoluteSiteUrl("/coverage/qs-2026");
  const publicJsonUrl = getAbsoluteSiteUrl(apiPath);

  return {
    apiPath,
    citation: buildPublicApiCitation({
      citationTitle: "QS 2026 university AI policy coverage dashboard",
      canonicalUrl,
      publicJsonUrl,
      suggestedCitation:
        "University AI Policy Tracker QS 2026 coverage dashboard. University AI Policy Tracker. Version v1. " +
        canonicalUrl
    }),
    generatedAt,
    highPriorityGaps: rows
      .filter((row) => row.status !== "public")
      .sort((left, right) => left.qsRank - right.qsRank)
      .slice(0, 20),
    limitations: [
      "Coverage status measures tracker collection status, not university policy quality.",
      "Staging-only runs are not public canonical records until promoted through the release manifest.",
      NO_ADVICE_BOUNDARY
    ],
    ranking: {
      rowCount: context.ranking.universities.length,
      scope: context.ranking.scope,
      sourceName: context.ranking.source?.name,
      sourceUrl: context.ranking.source?.url,
      system: context.ranking.rankingSystem,
      year: context.ranking.rankingYear
    },
    rows,
    summary: {
      missingCount: rows.filter((row) => row.status === "missing").length,
      publicClaimCount: publicRows.reduce(
        (total, row) => total + row.claimCount,
        0
      ),
      publicCount: publicRows.length,
      publicSourceCount: publicRows.reduce(
        (total, row) => total + row.sourceCount,
        0
      ),
      stagingUnpromotedCount: rows.filter(
        (row) => row.status === "staging_unpromoted"
      ).length,
      totalRows: rows.length
    }
  };
}

export async function getSourceHealthDashboardData(): Promise<SourceHealthDashboardData> {
  const context = await getDashboardContext();
  const rows = buildSourceHealthRows(context);
  const statusCounts = countStatuses(rows);
  const generatedAt = getGeneratedAt(context);
  const apiPath = `/api/public/${PUBLIC_API_VERSION}/source-health.json`;
  const canonicalUrl = getAbsoluteSiteUrl("/source-health");
  const publicJsonUrl = getAbsoluteSiteUrl(apiPath);

  return {
    agentVerification: {
      checkedWith: context.agentSourceChecks.checkedWith,
      generatedAt: context.agentSourceChecks.generatedAt,
      requestPolicy: context.agentSourceChecks.requestPolicy,
      summary: context.agentSourceChecks.summary
    },
    apiPath,
    citation: buildPublicApiCitation({
      citationTitle: "University AI Policy Tracker source health dashboard",
      canonicalUrl,
      publicJsonUrl,
      suggestedCitation:
        "University AI Policy Tracker source health dashboard. University AI Policy Tracker. Version v1. " +
        canonicalUrl
    }),
    firecrawlVerification: {
      checkedWith: context.firecrawlSourceChecks.checkedWith,
      generatedAt: context.firecrawlSourceChecks.generatedAt,
      requestPolicy: context.firecrawlSourceChecks.requestPolicy,
      summary: context.firecrawlSourceChecks.summary
    },
    generatedAt,
    rows,
    summary: {
      actionableIssueCount: rows.filter(isActionableSourceHealthRow).length,
      errorCount: rows.filter((row) => row.severity === "error").length,
      publicSourceRows: rows.filter((row) => row.scope === "public_release")
        .length,
      rejectedDiscoveryRows: rows.filter(
        (row) => row.status === "rejected_not_policy_evidence"
      ).length,
      stagingSourceRows: rows.filter((row) => row.scope === "staging_run")
        .length,
      statusCounts,
      totalRows: rows.length,
      unresolvedAgentRows: rows.filter(
        (row) =>
          row.status === "agent_unresolved" ||
          row.status === "unknown_error" ||
          row.status === "agent_fetch_failed"
      ).length,
      warningCount: rows.filter((row) => row.severity === "warning").length
    }
  };
}

export async function getReviewQueueData(): Promise<ReviewQueueData> {
  const context = await getDashboardContext();
  const rows = context.stagingRuns
    .filter((run) => !run.promoted)
    .map((run) => ({
      claimCount: run.claimCount,
      detectedSlugs: run.detectedSlugs,
      directory: run.directory,
      issueCount: run.issueCount,
      lastArtifactAt: run.lastArtifactAt,
      recommendedAction: run.recommendedAction,
      reviewDecisionCount: run.reviewDecisionCount,
      runPurpose: run.runPurpose,
      sourceCandidateCount: run.sourceCandidateCount,
      validationStatus: run.validationStatus
    }))
    .sort((left, right) =>
      left.validationStatus === right.validationStatus
        ? left.directory.localeCompare(right.directory)
        : left.validationStatus === "fail"
          ? -1
          : 1
    );

  return {
    apiPath: `/api/public/${PUBLIC_API_VERSION}/review/queue.json`,
    generatedAt: getGeneratedAt(context),
    rows,
    summary: {
      promotedRunCount: context.stagingRuns.filter((run) => run.promoted)
        .length,
      readyForReviewCount: rows.filter(
        (row) =>
          row.validationStatus === "pass" && row.sourceCandidateCount >= 2
      ).length,
      repairNeededCount: rows.filter((row) => row.validationStatus === "fail")
        .length,
      totalRuns: context.stagingRuns.length,
      unpromotedRunCount: rows.length
    }
  };
}

export function buildCoverageApiResponse(data: CoverageDashboardData) {
  return {
    apiVersion: PUBLIC_API_VERSION,
    generatedAt: data.generatedAt,
    canonicalUrl: getAbsoluteSiteUrl("/coverage/qs-2026"),
    license: TRACKER_METADATA_LICENSE,
    trackerMetadataLicense: TRACKER_METADATA_LICENSE,
    sourcePolicy: OFFICIAL_SOURCE_RIGHTS_CAVEAT,
    sourceRightsPolicy: OFFICIAL_SOURCE_RIGHTS_CAVEAT,
    citation: data.citation,
    limitations: data.limitations,
    data: {
      ranking: data.ranking,
      summary: data.summary,
      rows: data.rows
    }
  };
}

export function buildSourceHealthApiResponse(data: SourceHealthDashboardData) {
  return {
    apiVersion: PUBLIC_API_VERSION,
    generatedAt: data.generatedAt,
    canonicalUrl: getAbsoluteSiteUrl("/source-health"),
    license: TRACKER_METADATA_LICENSE,
    trackerMetadataLicense: TRACKER_METADATA_LICENSE,
    sourcePolicy: OFFICIAL_SOURCE_RIGHTS_CAVEAT,
    sourceRightsPolicy: OFFICIAL_SOURCE_RIGHTS_CAVEAT,
    citation: data.citation,
    limitations: [
      "Public ok status means the source is present in promoted snapshot metadata; it is not a live recrawl guarantee.",
      "Agent, browser, and Firecrawl statuses are source-health verification metadata for URLs that normal requests could not verify; they do not publish source text.",
      "Agent verified and Firecrawl verified statuses do not upgrade claim review state, source officialness, or canonical evidence status.",
      "Agent verification must run without login, paywall, CAPTCHA, WAF, robots, or other access-control bypass.",
      "Rejected discovery candidates that are not policy evidence are separated from actionable source-access repair.",
      "Staging source health is planning metadata and does not publish canonical claims.",
      NO_ADVICE_BOUNDARY
    ],
    data: {
      agentVerification: data.agentVerification,
      firecrawlVerification: data.firecrawlVerification,
      summary: data.summary,
      rows: data.rows
    }
  };
}

export function buildReviewQueueApiResponse(data: ReviewQueueData) {
  const canonicalUrl = getAbsoluteSiteUrl("/review/queue");
  const publicJsonUrl = getAbsoluteSiteUrl(
    `/api/public/${PUBLIC_API_VERSION}/review/queue.json`
  );

  return {
    apiVersion: PUBLIC_API_VERSION,
    generatedAt: data.generatedAt,
    canonicalUrl,
    license: TRACKER_METADATA_LICENSE,
    trackerMetadataLicense: TRACKER_METADATA_LICENSE,
    sourcePolicy: OFFICIAL_SOURCE_RIGHTS_CAVEAT,
    sourceRightsPolicy: OFFICIAL_SOURCE_RIGHTS_CAVEAT,
    citation: buildPublicApiCitation({
      citationTitle: "University AI Policy Tracker review queue metadata",
      canonicalUrl,
      publicJsonUrl,
      suggestedCitation:
        "University AI Policy Tracker review queue metadata. University AI Policy Tracker. Version v1. " +
        canonicalUrl
    }),
    limitations: [
      "Review queue rows are planning metadata. They do not promote staging runs or publish claims.",
      NO_ADVICE_BOUNDARY
    ],
    data: {
      summary: data.summary,
      rows: data.rows
    }
  };
}

async function getDashboardContext(): Promise<DashboardContext> {
  contextPromise ??= buildDashboardContext();

  return contextPromise;
}

async function buildDashboardContext(): Promise<DashboardContext> {
  const repoRoot = await findRepoRoot();
  const [
    dataset,
    ranking,
    manifest,
    firecrawlSourceChecks,
    agentSourceChecks
  ] = await Promise.all([
    getStagedPublicDataset(),
    readJsonFile<RankingDocument>(path.join(repoRoot, QS_2026_TOP_100)),
    readPublicReleaseManifest(repoRoot),
    readFirecrawlSourceChecks(repoRoot),
    readAgentSourceChecks(repoRoot)
  ]);
  const stagingRuns = await buildStagingRunSummaries(
    repoRoot,
    manifest,
    agentSourceChecks
  );

  return {
    agentSourceChecks,
    catalogUniversities: dataset.catalogUniversities,
    firecrawlSourceChecks,
    manifest,
    publicSummaries: dataset.publicSummaries,
    ranking,
    stagingRuns
  };
}

function buildCoverageRows(context: DashboardContext): CoverageRow[] {
  const publicByRank = new Map<number, PublicEntitySummary>();
  const publicByName = new Map<string, PublicEntitySummary>();
  const publicBySlug = new Map(
    context.publicSummaries.map((summary) => [summary.entity.slug, summary])
  );

  for (const university of context.catalogUniversities) {
    const summary = publicBySlug.get(university.slug);
    if (!summary) continue;
    publicByName.set(normalizeName(university.name), summary);
    publicByName.set(normalizeName(summary.entity.name), summary);
    const ranking = university.rankings.find(
      (item) => item.systemId === "qs" && Number(item.rankingYear) === 2026
    );
    if (ranking?.rankNumber) publicByRank.set(ranking.rankNumber, summary);
  }

  const unpromotedBySlug = new Map<string, StagingRunSummary>();
  for (const run of context.stagingRuns) {
    if (run.promoted) continue;
    for (const slug of run.detectedSlugs) unpromotedBySlug.set(slug, run);
  }

  return context.ranking.universities.map((university) => {
    const guessedSlug = slugify(university.name);
    const aliases = new Set([
      guessedSlug,
      ...(QS_SLUG_ALIASES[guessedSlug] ?? [])
    ]);
    const publicSummary =
      publicByRank.get(university.rankNumber) ??
      publicByName.get(normalizeName(university.name)) ??
      Array.from(aliases)
        .map((alias) => publicBySlug.get(alias))
        .find(Boolean);
    const stagingRun = Array.from(aliases)
      .map((alias) => unpromotedBySlug.get(alias))
      .find(Boolean);
    const status: CoverageStatus = publicSummary
      ? "public"
      : stagingRun
        ? "staging_unpromoted"
        : "missing";

    return {
      claimCount: publicSummary?.claims.length ?? stagingRun?.claimCount ?? 0,
      countryOrRegion: university.countryOrRegion,
      lastCheckedAt:
        publicSummary?.lastCheckedAt ?? stagingRun?.lastArtifactAt,
      publicJsonUrl: publicSummary?.apiUrl,
      publicSlug: publicSummary?.entity.slug,
      qsRank: university.rankNumber,
      rankText: university.rankText,
      recommendedAction: getCoverageRecommendedAction(status, stagingRun),
      reviewState: publicSummary?.reviewState,
      sourceCount:
        publicSummary?.officialSources.length ??
        stagingRun?.sourceCandidateCount ??
        0,
      stagingRun: stagingRun?.directory,
      status,
      universityName: university.name
    };
  });
}

async function buildStagingRunSummaries(
  repoRoot: string,
  manifest: PublicReleaseManifest | undefined,
  agentSourceChecks: AgentSourceCheckIndex
): Promise<StagingRunSummary[]> {
  const promoted = new Set(
    (manifest?.includeStagedArtifactDirectories ?? []).map((directory) =>
      path.normalize(directory)
    )
  );
  const roots = [
    { directory: path.join(repoRoot, "staging", "uapt-runs"), skipArchive: true },
    { directory: path.join(repoRoot, "data", "openclaw-staging"), skipArchive: false }
  ];
  const summaries: StagingRunSummary[] = [];

  for (const root of roots) {
    const entries = await safeReadDir(root.directory);
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      if (root.skipArchive && entry.name.startsWith("_")) continue;

      const absoluteDirectory = path.join(root.directory, entry.name);
      const relativeDirectory = normalizeRelativePath(
        path.relative(repoRoot, absoluteDirectory)
      );
      const jsonFiles = await walkJsonFiles(absoluteDirectory);
      summaries.push(
        await summarizeStagingRun({
          absoluteDirectory,
          agentSourceChecks,
          jsonFiles,
          promoted: promoted.has(path.normalize(relativeDirectory)),
          relativeDirectory
        })
      );
    }
  }

  return summaries.sort((left, right) =>
    left.directory.localeCompare(right.directory)
  );
}

async function summarizeStagingRun(input: {
  absoluteDirectory: string;
  agentSourceChecks: AgentSourceCheckIndex;
  jsonFiles: string[];
  promoted: boolean;
  relativeDirectory: string;
}): Promise<StagingRunSummary> {
  const issues: string[] = [];
  const validArtifacts: OpenClawStagedArtifact[] = [];
  const rawCounts = new Map<string, number>();
  const metadata: ArtifactMetadataCollector = {
    dates: new Set(),
    languages: new Set(),
    reviewStates: new Map(),
    runIds: new Set(),
    runPurposes: new Set(),
    slugs: new Set()
  };

  for (const file of input.jsonFiles) {
    const parsed = await readJsonFile<unknown>(file);
    collectBundleRunPurpose(parsed, metadata.runPurposes);
    const values = extractArtifactValues(parsed);

    for (const value of values) {
      countRawArtifact(value, rawCounts);
      collectRawArtifactMetadata(value, metadata);

      const result = openClawStagedArtifactSchema.safeParse(value);
      if (result.success) {
        validArtifacts.push(result.data);
      } else {
        const message = result.error.issues
          .slice(0, 5)
          .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
          .join("; ");
        issues.push(`${normalizeRelativePath(path.relative(process.cwd(), file))}: ${message}`);
      }
    }
  }

  const validCounts = countArtifacts(validArtifacts);
  for (const artifactType of REQUIRED_ARTIFACT_TYPES) {
    if (!validCounts.get(artifactType)) {
      issues.push(`Missing required artifact type: ${artifactType}`);
    }
  }

  const sourceHealthRows = buildStagingSourceHealthRows(
    input.relativeDirectory,
    validArtifacts,
    input.agentSourceChecks
  );

  return {
    artifactCount: validArtifacts.length,
    claimCount: rawCounts.get("claim_candidate") ?? 0,
    detectedLanguages: Array.from(metadata.languages).sort(),
    detectedSlugs: Array.from(metadata.slugs).sort(),
    directory: input.relativeDirectory,
    evidenceCount: rawCounts.get("evidence_candidate") ?? 0,
    healthCounts: countStatuses(sourceHealthRows),
    issueCount: issues.length,
    issues,
    jsonFileCount: input.jsonFiles.length,
    lastArtifactAt: latestIso(Array.from(metadata.dates)),
    promoted: input.promoted,
    recommendedAction: recommendStagingAction({
      directory: input.relativeDirectory,
      issueCount: issues.length,
      promoted: input.promoted,
      runPurpose: getSingleRunPurpose(metadata.runPurposes),
      sourceCandidateCount: rawCounts.get("source_candidate") ?? 0
    }),
    reviewDecisionCount: rawCounts.get("review_decision") ?? 0,
    reviewStates: Object.fromEntries(
      Array.from(metadata.reviewStates.entries()).sort(([left], [right]) =>
        left.localeCompare(right)
      )
    ),
    runPurpose: getSingleRunPurpose(metadata.runPurposes),
    runIds: Array.from(metadata.runIds).sort(),
    sourceCandidateCount: rawCounts.get("source_candidate") ?? 0,
    sourceHealthRows,
    validationStatus: issues.length ? "fail" : "pass"
  };
}

function buildSourceHealthRows(context: DashboardContext): SourceHealthRow[] {
  const publicRows = context.publicSummaries.flatMap((summary) =>
    summary.officialSources.map((source) => {
      const agentCheck = context.agentSourceChecks.recordsByUrl.get(
        normalizeUrl(source.sourceUrl)
      );
      const firecrawlCheck = context.firecrawlSourceChecks.recordsByUrl.get(
        normalizeUrl(source.sourceUrl)
      );
      const status: SourceHealthStatus =
        agentCheck?.status ?? firecrawlCheck?.status ?? "ok";

      return {
        entitySlug: summary.entity.slug,
        finalUrl:
          agentCheck?.finalUrl ??
          firecrawlCheck?.browserVerification?.finalUrl ??
          source.finalUrl,
        lastCheckedAt:
          agentCheck?.checkedAt ??
          firecrawlCheck?.browserVerification?.checkedAt ??
          firecrawlCheck?.firecrawl?.checkedAt ??
          source.retrievedAt ??
          summary.lastCheckedAt,
        note: agentCheck
          ? getAgentSourceHealthNote(agentCheck)
          : firecrawlCheck
            ? getFirecrawlSourceHealthNote(firecrawlCheck)
            : "Promoted source attribution is present with snapshot metadata. This is not a live recrawl guarantee.",
        scope: "public_release" as const,
        severity: getSourceHealthSeverity(status),
        sourceTitle: source.citationTitle,
        sourceType: source.sourceType,
        sourceUrl: source.sourceUrl,
        status
      };
    })
  );
  const stagingRows = context.stagingRuns.flatMap((run) =>
    run.sourceHealthRows
  );

  return [...publicRows, ...stagingRows].sort((left, right) => {
    const severityOrder = { error: 0, warning: 1, info: 2 };
    return (
      severityOrder[left.severity] - severityOrder[right.severity] ||
      left.entitySlug.localeCompare(right.entitySlug) ||
      left.sourceUrl.localeCompare(right.sourceUrl)
    );
  });
}

function buildStagingSourceHealthRows(
  directory: string,
  artifacts: OpenClawStagedArtifact[],
  agentSourceChecks: AgentSourceCheckIndex
): SourceHealthRow[] {
  const fetches = artifacts.filter(
    (artifact): artifact is StagedFetchAttempt =>
      artifact.artifactType === "fetch_attempt"
  );
  const snapshots = artifacts.filter(
    (artifact): artifact is StagedSourceSnapshot =>
      artifact.artifactType === "source_snapshot"
  );
  const sourceCandidates = artifacts.filter(
    (artifact): artifact is StagedSourceCandidate =>
      artifact.artifactType === "source_candidate"
  );
  const fetchesByCandidate = groupBy(
    fetches,
    (fetch) => fetch.sourceCandidateId ?? fetch.sourceUrl
  );
  const snapshotsByCandidate = groupBy(
    snapshots,
    (snapshot) => snapshot.sourceCandidateId ?? snapshot.sourceUrl
  );

  return sourceCandidates.map((source) => {
    const relatedFetches = fetchesByCandidate.get(source.sourceCandidateId) ?? [];
    const relatedSnapshots =
      snapshotsByCandidate.get(source.sourceCandidateId) ?? [];
    const agentCheck =
      agentSourceChecks.recordsByCandidateKey.get(
        getAgentCandidateKey(directory, source.sourceCandidateId)
      ) ?? agentSourceChecks.recordsByUrl.get(normalizeUrl(source.sourceUrl));
    const status = agentCheck?.status ?? getSourceHealthStatus(
      source,
      relatedFetches,
      relatedSnapshots
    );
    const severity = getSourceHealthSeverity(status);

    return {
      entitySlug: source.entitySlug,
      finalUrl: agentCheck?.finalUrl ?? source.finalUrl,
      lastCheckedAt:
        agentCheck?.checkedAt ??
        source.verifiedAt ??
        latestIso([
          ...relatedFetches.map((fetch) => fetch.attemptedAt),
          ...relatedSnapshots.map((snapshot) => snapshot.fetchedAt)
        ]) ??
        source.discoveredAt,
      note: agentCheck
        ? getAgentSourceHealthNote(agentCheck)
        : getSourceHealthNote(status, source, relatedFetches),
      scope: "staging_run",
      severity,
      sourceTitle: source.sourceTitle,
      sourceType: source.sourceType,
      sourceUrl: source.sourceUrl,
      stagingRun: directory,
      status
    };
  });
}

function getSourceHealthStatus(
  source: StagedSourceCandidate,
  fetches: StagedFetchAttempt[],
  snapshots: StagedSourceSnapshot[]
): SourceHealthStatus {
  const rejectedStatus = getRejectedSourceHealthStatus(source.rejectionReason);
  if (source.verificationStatus === "rejected" && rejectedStatus) {
    return rejectedStatus;
  }

  const firecrawlFetches = fetches.filter(
    (fetch) => fetch.fetchMode === "firecrawl" || fetch.userAgentKind === "firecrawl"
  );

  if (firecrawlFetches.some((fetch) => fetch.outcome === "success")) {
    return "firecrawl_verified";
  }
  if (
    firecrawlFetches.some((fetch) => fetch.outcome === "retry_recommended")
  ) {
    return "firecrawl_opened_no_content";
  }
  if (
    firecrawlFetches.some(
      (fetch) =>
        fetch.outcome === "blocked" ||
        fetch.outcome === "error" ||
        fetch.outcome === "skipped"
    )
  ) {
    return "firecrawl_failed";
  }

  if (hasFetchError(fetches, LOGIN_ERROR_PATTERN)) return "agent_blocked_login";
  if (hasFetchError(fetches, CAPTCHA_WAF_PATTERN)) {
    return "agent_blocked_captcha_waf";
  }
  if (hasFetchError(fetches, EMPTY_CONTENT_PATTERN)) return "agent_verified_empty";

  if (
    source.rejectionReason === "robots_disallowed" ||
    fetches.some((fetch) => fetch.robotsAllowed === false) ||
    snapshots.some((snapshot) => snapshot.robotsAllowed === false)
  ) {
    return "agent_blocked_robots";
  }
  if (source.rejectionReason === "login_required") return "agent_blocked_login";
  if (source.rejectionReason === "paywall") return "paywall";
  if (source.rejectionReason === "captcha") return "agent_blocked_captcha_waf";
  if (
    source.rejectionReason === "stale_404" ||
    fetches.some((fetch) => fetch.httpStatus === 404)
  ) {
    return "agent_verified_404";
  }
  if (source.rejectionReason === "redirect_unrelated") {
    return "agent_verified_redirect_unrelated";
  }
  if (
    source.rejectionReason === "http_error" ||
    source.rejectionReason === "inaccessible"
  ) {
    return "agent_fetch_failed";
  }
  if (fetches.some((fetch) => fetch.httpStatus === 403)) return "forbidden";
  if (
    source.finalUrl &&
    normalizeUrl(source.finalUrl) !== normalizeUrl(source.sourceUrl)
  ) {
    return "redirected";
  }
  if (
    snapshots.length ||
    source.verificationStatus === "verified" ||
    fetches.some((fetch) => fetch.outcome === "success")
  ) {
    return "ok";
  }
  if (
    fetches.some(
      (fetch) =>
        fetch.outcome === "blocked" ||
        fetch.outcome === "error" ||
        fetch.outcome === "retry_recommended"
    )
  ) {
    return "agent_fetch_failed";
  }
  if (
    source.verificationStatus === "blocked" ||
    source.verificationStatus === "inaccessible" ||
    source.verificationStatus === "needs_browser" ||
    source.verificationStatus === "skipped" ||
    source.verificationStatus === "unknown" ||
    source.verificationStatus === "discovered"
  ) {
    return "agent_unresolved";
  }

  return "unknown_error";
}

function getRejectedSourceHealthStatus(
  rejectionReason: string | undefined
): SourceHealthStatus | undefined {
  if (!rejectionReason) return undefined;
  if (REJECTED_DISCOVERY_REASONS.has(rejectionReason)) {
    return "rejected_not_policy_evidence";
  }
  if (rejectionReason === "stale_404") return "agent_verified_404";
  if (rejectionReason === "redirect_unrelated") {
    return "agent_verified_redirect_unrelated";
  }
  if (rejectionReason === "login_required") return "agent_blocked_login";
  if (rejectionReason === "robots_disallowed") return "agent_blocked_robots";
  if (rejectionReason === "captcha") return "agent_blocked_captcha_waf";
  if (rejectionReason === "paywall") return "paywall";
  if (rejectionReason === "http_error" || rejectionReason === "inaccessible") {
    return "agent_fetch_failed";
  }
  return undefined;
}

function hasFetchError(
  fetches: StagedFetchAttempt[],
  pattern: RegExp
): boolean {
  return fetches.some((fetch) =>
    pattern.test(
      [
        fetch.errorReason,
        fetch.contentType,
        fetch.outcome,
        fetch.httpStatus?.toString()
      ]
        .filter(Boolean)
        .join(" ")
    )
  );
}

function getSourceHealthSeverity(
  status: SourceHealthStatus
): SourceHealthSeverity {
  if (
    status === "robots_blocked" ||
    status === "login_wall" ||
    status === "paywall" ||
    status === "captcha_or_waf" ||
    status === "forbidden" ||
    status === "agent_blocked_login" ||
    status === "agent_blocked_robots" ||
    status === "agent_blocked_captcha_waf" ||
    status === "firecrawl_failed"
  ) {
    return "error";
  }
  if (
    status === "not_found" ||
    status === "unknown_error" ||
    status === "changed_hash" ||
    status === "agent_fetch_failed" ||
    status === "agent_unresolved" ||
    status === "agent_verified_empty" ||
    status === "agent_verified_404" ||
    status === "agent_verified_redirect_unrelated" ||
    status === "firecrawl_opened_no_content" ||
    status === "blocked_by_client" ||
    status === "browser_timeout_unverified"
  ) {
    return "warning";
  }
  return "info";
}

function getSourceHealthNote(
  status: SourceHealthStatus,
  source: StagedSourceCandidate,
  fetches: StagedFetchAttempt[]
): string {
  if (status === "ok") return "Validated staging source candidate has usable fetch or snapshot metadata.";
  if (status === "rejected_not_policy_evidence") {
    return (
      source.verificationNotes ??
      "Rejected discovery candidate is not policy evidence; exclude from actionable source-health repair."
    );
  }
  if (status === "agent_verified_accessible") {
    return "Agent verification confirmed this official URL opens with readable content. This does not upgrade claim review state or source officialness.";
  }
  if (status === "agent_verified_empty") {
    return "Agent verification opened the URL but did not extract readable policy content; keep out of claim evidence unless another official source is found.";
  }
  if (status === "agent_verified_404") {
    return "Agent verification confirmed a 404 or stale public route; use another official source if this candidate is needed.";
  }
  if (status === "agent_verified_redirect_unrelated") {
    return "Agent verification confirmed the URL redirects away from the intended policy source.";
  }
  if (status === "agent_blocked_login") {
    return "Agent verification reached a login or authentication boundary; do not bypass access controls.";
  }
  if (status === "agent_blocked_robots") {
    return "Agent verification found robots restrictions; do not bypass robots policy.";
  }
  if (status === "agent_blocked_captcha_waf") {
    return "Agent verification reached CAPTCHA, WAF, or anti-bot protection; do not bypass access controls.";
  }
  if (status === "agent_fetch_failed") {
    const firstError = fetches.find((fetch) => fetch.errorReason)?.errorReason;
    return (
      firstError ??
      source.verificationNotes ??
      "Agent verification could not fetch readable content from this source."
    );
  }
  if (status === "agent_unresolved") {
    return (
      source.verificationNotes ??
      "Source still needs automated verification because current metadata is inconclusive."
    );
  }
  if (status === "browser_verified") {
    return "Browser verification confirmed this official URL opens with readable content. This does not upgrade claim review state or source officialness.";
  }
  if (status === "blocked_by_client") {
    return "Browser verification hit client-side blocking; treat this as a source-health warning, not proof that the official source is down.";
  }
  if (status === "browser_timeout_unverified") {
    return "Browser verification timed out or returned no readable content; keep this as unverified maintenance metadata until another compliant check succeeds.";
  }
  if (status === "firecrawl_verified") {
    return "Firecrawl extracted source content for maintenance planning only. This does not publish canonical claims or upgrade review state.";
  }
  if (status === "firecrawl_opened_no_content") {
    const firstRetry = fetches.find((fetch) => fetch.outcome === "retry_recommended");
    return (
      firstRetry?.errorReason ??
      "Firecrawl did not extract usable content; keep this as a source-health warning and do not treat it as claim evidence."
    );
  }
  if (status === "firecrawl_failed") {
    const firstError = fetches.find((fetch) => fetch.errorReason)?.errorReason;
    return (
      firstError ??
      "Firecrawl could not verify this URL; prioritize alternate official source discovery or manual source repair."
    );
  }
  if (status === "redirected") return "Fetch final URL differs from the discovered source URL; review canonical URL before promotion.";
  if (status === "not_found") return "Source appears to return 404 or was rejected as stale 404; rerun source discovery.";
  if (status === "forbidden") return "Source returned 403; do not bypass access controls.";
  if (status === "robots_blocked") return "Robots policy disallowed fetch or source was rejected for robots restrictions.";
  if (status === "login_wall") return "Source appears to require login; do not bypass authentication.";
  if (status === "paywall") return "Source appears paywalled; do not bypass access controls.";
  if (status === "captcha_or_waf") return "Source appears protected by CAPTCHA or WAF; do not bypass access controls.";

  const firstError = fetches.find((fetch) => fetch.errorReason)?.errorReason;
  return (
    firstError ??
    source.verificationNotes ??
    "Source needs manual inspection before promotion."
  );
}

function getFirecrawlSourceHealthNote(check: FirecrawlSourceCheckRecord): string {
  const title = check.firecrawl?.title ? ` Title: ${check.firecrawl.title}.` : "";
  const browserTitle = check.browserVerification?.title
    ? ` Title: ${check.browserVerification.title}.`
    : "";
  const browserFinalUrl = check.browserVerification?.finalUrl
    ? ` Final URL: ${check.browserVerification.finalUrl}.`
    : "";
  const browserTextLength =
    typeof check.browserVerification?.textLength === "number"
      ? ` Readable text length: ${check.browserVerification.textLength}.`
      : "";
  const browserError = check.browserVerification?.navigationError
    ? ` Browser error: ${check.browserVerification.navigationError}.`
    : "";
  const originalStatus = check.originalHttpStatus
    ? ` Normal request status: ${check.originalHttpStatus}.`
    : "";
  const firecrawlStatus = check.firecrawl?.metadataStatusCode
    ? ` Firecrawl status: ${check.firecrawl.metadataStatusCode}.`
    : "";

  if (check.status === "browser_verified") {
    return (
      `Browser verification confirmed this official URL opens with readable content after Firecrawl or normal HTTP was blocked or inconclusive.${originalStatus}${browserFinalUrl}${browserTextLength}${browserTitle}`
    );
  }

  if (check.status === "blocked_by_client") {
    return (
      `Browser verification was blocked by the current client or browser profile. Keep as a source-health warning, not a source-down finding.${originalStatus}${browserError}${browserTitle}`
    );
  }

  if (check.status === "browser_timeout_unverified") {
    return (
      `Browser verification timed out or returned no readable content. Keep this URL in the manual or alternate-source follow-up queue.${originalStatus}${browserError}${browserTitle}`
    );
  }

  if (check.status === "firecrawl_verified") {
    return (
      `Firecrawl fresh scrape extracted content after a normal request was blocked or inconclusive.${originalStatus}${firecrawlStatus}${title}`
    );
  }

  if (check.status === "firecrawl_opened_no_content") {
    return (
      `Firecrawl opened the URL but did not extract meaningful source content. ${check.recommendedAction}${originalStatus}${firecrawlStatus}${title}`
    );
  }

  return (
    `Firecrawl could not verify this URL. ${check.recommendedAction}${originalStatus}${firecrawlStatus}` +
    (check.firecrawl?.error ? ` Error: ${check.firecrawl.error}` : "")
  );
}

function getAgentSourceHealthNote(check: AgentSourceCheckRecord): string {
  const finalUrl = check.finalUrl ? ` Final URL: ${check.finalUrl}.` : "";
  const textLength =
    typeof check.textLength === "number"
      ? ` Readable text length: ${check.textLength}.`
      : "";
  const title = check.title ? ` Title: ${check.title}.` : "";
  return `${check.note ?? check.recommendedAction}${finalUrl}${textLength}${title}`;
}

function getCoverageRecommendedAction(
  status: CoverageStatus,
  stagingRun: StagingRunSummary | undefined
): string {
  if (status === "public") return "No crawl action required for coverage.";
  if (!stagingRun) return "Send to source discovery.";
  if (stagingRun.validationStatus === "fail") {
    return "Repair validator issues before promotion.";
  }
  if (stagingRun.sourceCandidateCount < 2) {
    return "Review source breadth before promotion.";
  }
  return "Review validated staging run before promotion.";
}

function recommendStagingAction(input: {
  directory: string;
  issueCount: number;
  promoted: boolean;
  runPurpose?: OpenClawRunPurpose;
  sourceCandidateCount: number;
}): string {
  if (input.promoted) return "Already promoted in the current public release.";
  if (input.issueCount > 0) return "Repair validator issues before review.";
  if (input.runPurpose === "source_health_maintenance") {
    return "Keep as source-health maintenance metadata; do not add to the public release manifest.";
  }
  if (input.sourceCandidateCount < 2) {
    return "Review source breadth before promotion.";
  }
  if (input.directory.includes("johns-hopkins")) {
    return "Resolve JHU canonical slug/review-state mapping before promotion.";
  }
  return "Review for possible next manifest promotion.";
}

async function findRepoRoot(): Promise<string> {
  let current = process.cwd();

  for (;;) {
    try {
      await readFile(path.join(current, "package.json"), "utf8");
      const stagingExists = await directoryExists(path.join(current, "staging"));
      const appsExists = await directoryExists(path.join(current, "apps"));

      if (stagingExists && appsExists) return current;
    } catch {
      // Continue walking upward.
    }

    const parent = path.dirname(current);
    if (parent === current) return process.cwd();
    current = parent;
  }
}

async function directoryExists(directory: string): Promise<boolean> {
  try {
    const stats = await readdir(directory);
    return Array.isArray(stats);
  } catch {
    return false;
  }
}

async function readPublicReleaseManifest(
  repoRoot: string
): Promise<PublicReleaseManifest | undefined> {
  const file = path.join(repoRoot, "data", "public-releases", "current.json");
  try {
    const value = await readJsonFile<unknown>(file);
    if (!isRecord(value) || !Array.isArray(value.includeStagedArtifactDirectories)) {
      return undefined;
    }
    return {
      includeStagedArtifactDirectories:
        value.includeStagedArtifactDirectories.filter(
          (item): item is string => typeof item === "string"
        ),
      publishedAt: typeof value.publishedAt === "string" ? value.publishedAt : "",
      releaseId: typeof value.releaseId === "string" ? value.releaseId : ""
    };
  } catch {
    return undefined;
  }
}

async function readFirecrawlSourceChecks(
  repoRoot: string
): Promise<FirecrawlSourceCheckIndex> {
  const file = path.join(
    repoRoot,
    "data",
    "source-health",
    "firecrawl-blocked-source-checks-20260517.json"
  );

  try {
    const document = await readJsonFile<FirecrawlSourceCheckDocument>(file);
    return {
      checkedWith: document.checkedWith,
      generatedAt: document.generatedAt,
      recordsByUrl: new Map(
        document.records.map((record) => [
          normalizeUrl(record.sourceUrl),
          record
        ])
      ),
      requestPolicy: document.requestPolicy,
      summary: {
        blockedByClient:
          document.summary?.blocked_by_client ??
          document.records.filter((record) => record.status === "blocked_by_client")
            .length,
        browserTimeoutUnverified:
          document.summary?.browser_timeout_unverified ??
          document.records.filter(
            (record) => record.status === "browser_timeout_unverified"
          ).length,
        browserVerified:
          document.summary?.browser_verified ??
          document.records.filter((record) => record.status === "browser_verified")
            .length,
        failed:
          document.summary?.firecrawl_failed ??
          document.records.filter((record) => record.status === "firecrawl_failed")
            .length,
        openedNoContent:
          document.summary?.firecrawl_opened_no_content ??
          document.records.filter(
            (record) => record.status === "firecrawl_opened_no_content"
          ).length,
        total: document.summary?.total ?? document.records.length,
        verified:
          document.summary?.firecrawl_verified ??
          document.records.filter(
            (record) => record.status === "firecrawl_verified"
          ).length
      }
    };
  } catch {
    return {
      recordsByUrl: new Map(),
      summary: {
        blockedByClient: 0,
        browserTimeoutUnverified: 0,
        browserVerified: 0,
        failed: 0,
        openedNoContent: 0,
        total: 0,
        verified: 0
      }
    };
  }
}

async function readAgentSourceChecks(
  repoRoot: string
): Promise<AgentSourceCheckIndex> {
  const file = path.join(
    repoRoot,
    "data",
    "source-health",
    "agent-verification-latest.json"
  );

  try {
    const document = await readJsonFile<AgentSourceCheckDocument>(file);
    const recordsByCandidateKey = new Map<string, AgentSourceCheckRecord>();
    const recordsByUrl = new Map<string, AgentSourceCheckRecord>();

    for (const record of document.records) {
      recordsByUrl.set(normalizeUrl(record.sourceUrl), record);
      if (record.stagingRun && record.sourceCandidateId) {
        recordsByCandidateKey.set(
          getAgentCandidateKey(record.stagingRun, record.sourceCandidateId),
          record
        );
      }
    }

    return {
      checkedWith: document.checkedWith,
      generatedAt: document.generatedAt,
      recordsByCandidateKey,
      recordsByUrl,
      requestPolicy: document.requestPolicy,
      summary: summarizeAgentSourceChecks(document.records)
    };
  } catch {
    return {
      recordsByCandidateKey: new Map(),
      recordsByUrl: new Map(),
      summary: summarizeAgentSourceChecks([])
    };
  }
}

function summarizeAgentSourceChecks(
  records: AgentSourceCheckRecord[]
): AgentVerificationSummary {
  const statusCounts = countStatuses(records);
  return {
    blocked:
      statusCounts.agent_blocked_captcha_waf +
      statusCounts.agent_blocked_login +
      statusCounts.agent_blocked_robots +
      statusCounts.paywall,
    fetchFailed: statusCounts.agent_fetch_failed,
    total: records.length,
    unresolved: statusCounts.agent_unresolved + statusCounts.unknown_error,
    verified404: statusCounts.agent_verified_404,
    verifiedAccessible: statusCounts.agent_verified_accessible,
    verifiedEmpty: statusCounts.agent_verified_empty,
    verifiedRedirectUnrelated: statusCounts.agent_verified_redirect_unrelated
  };
}

function getAgentCandidateKey(
  stagingRun: string,
  sourceCandidateId: string
): string {
  return `${path.normalize(stagingRun)}::${sourceCandidateId}`;
}

async function safeReadDir(directory: string) {
  try {
    return await readdir(directory, { withFileTypes: true });
  } catch {
    return [];
  }
}

async function walkJsonFiles(directory: string): Promise<string[]> {
  const entries = await safeReadDir(directory);
  const files = await Promise.all(
    entries.map(async (entry) => {
      const entryPath = path.join(directory, entry.name);
      if (entry.isDirectory()) return walkJsonFiles(entryPath);
      if (entry.isFile() && entry.name.endsWith(".json")) return [entryPath];
      return [];
    })
  );

  return files.flat().sort();
}

async function readJsonFile<T>(file: string): Promise<T> {
  return JSON.parse(await readFile(file, "utf8")) as T;
}

function extractArtifactValues(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (isRecord(value) && Array.isArray(value.artifacts)) return value.artifacts;
  return [value];
}

function collectBundleRunPurpose(
  value: unknown,
  output: Set<OpenClawRunPurpose>
): void {
  if (!isRecord(value)) return;

  const result = openClawRunPurposeSchema.safeParse(value.runPurpose);
  if (result.success) output.add(result.data);
}

function getSingleRunPurpose(
  values: Set<OpenClawRunPurpose>
): OpenClawRunPurpose | undefined {
  if (values.has("source_health_maintenance")) {
    return "source_health_maintenance";
  }
  if (values.has("claim_evidence_release")) {
    return "claim_evidence_release";
  }
  return undefined;
}

function countRawArtifact(value: unknown, counts: Map<string, number>): void {
  if (!isRecord(value) || typeof value.artifactType !== "string") return;
  increment(counts, value.artifactType);
}

function collectRawArtifactMetadata(
  value: unknown,
  output: ArtifactMetadataCollector
): void {
  if (!isRecord(value)) return;

  addString(output.runIds, value.runId);
  addString(output.slugs, value.entitySlug);
  addString(output.languages, value.sourceLanguage);
  addDate(output.dates, value.createdAt);
  addDate(output.dates, value.discoveredAt);
  addDate(output.dates, value.verifiedAt);
  addDate(output.dates, value.attemptedAt);
  addDate(output.dates, value.fetchedAt);
  addDate(output.dates, value.generatedAt);
  addDate(output.dates, value.decidedAt);
  addDate(output.dates, value.rejectedAt);
  addDate(output.dates, value.startedAt);
  addDate(output.dates, value.endedAt);
  if (typeof value.reviewState === "string") {
    increment(output.reviewStates, value.reviewState);
  }
  if (Array.isArray(value.targets)) {
    for (const target of value.targets) {
      if (!isRecord(target)) continue;
      addString(output.slugs, target.entitySlug);
      addString(output.languages, target.sourceLanguage);
    }
  }
}

function countArtifacts(artifacts: OpenClawStagedArtifact[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const artifact of artifacts) increment(counts, artifact.artifactType);
  return counts;
}

function countStatuses<T extends { status: SourceHealthStatus }>(
  rows: T[]
): Record<SourceHealthStatus, number> {
  const initial: Record<SourceHealthStatus, number> = {
    agent_blocked_captcha_waf: 0,
    agent_blocked_login: 0,
    agent_blocked_robots: 0,
    agent_fetch_failed: 0,
    agent_unresolved: 0,
    agent_verified_404: 0,
    agent_verified_accessible: 0,
    agent_verified_empty: 0,
    agent_verified_redirect_unrelated: 0,
    blocked_by_client: 0,
    browser_timeout_unverified: 0,
    browser_verified: 0,
    captcha_or_waf: 0,
    changed_hash: 0,
    firecrawl_failed: 0,
    firecrawl_opened_no_content: 0,
    firecrawl_verified: 0,
    forbidden: 0,
    login_wall: 0,
    not_found: 0,
    ok: 0,
    paywall: 0,
    redirected: 0,
    rejected_not_policy_evidence: 0,
    robots_blocked: 0,
    unknown_error: 0
  };

  for (const row of rows) initial[row.status] += 1;

  return initial;
}

function isActionableSourceHealthRow(row: SourceHealthRow): boolean {
  if (row.status === "rejected_not_policy_evidence") return false;
  return row.severity === "error" || row.severity === "warning";
}

function groupBy<T>(values: T[], getKey: (value: T) => string): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const value of values) {
    const key = getKey(value);
    const group = groups.get(key) ?? [];
    group.push(value);
    groups.set(key, group);
  }
  return groups;
}

function latestIso(values: Array<string | undefined>): string | undefined {
  return values
    .filter((value): value is string => Boolean(value))
    .sort((left, right) => new Date(right).getTime() - new Date(left).getTime())[0];
}

function increment(map: Map<string, number>, key: string): void {
  map.set(key, (map.get(key) ?? 0) + 1);
}

function addString(set: Set<string>, value: unknown): void {
  if (typeof value === "string" && value) set.add(value);
}

function addDate(set: Set<string>, value: unknown): void {
  if (typeof value === "string" && value) set.add(value);
}

function isRecord(value: unknown): value is JsonObject {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizeName(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[^\x00-\x7F]/g, "")
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/\([^)]*\)/g, "")
    .replace(/^the\s+/u, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function slugify(value: string): string {
  return normalizeName(value).replace(/\s+/g, "-");
}

function normalizeUrl(value: string): string {
  try {
    const url = new URL(value);
    url.hash = "";
    return url.toString().replace(/\/$/u, "");
  } catch {
    return value.replace(/\/$/u, "");
  }
}

function normalizeRelativePath(value: string): string {
  return value.split(path.sep).join("/");
}

function getGeneratedAt(context: DashboardContext): string {
  return context.manifest?.publishedAt || new Date().toISOString();
}

const QS_SLUG_ALIASES: Record<string, string[]> = {
  "adelaide-university": ["adelaide-university"],
  "australian-national-university": ["anu"],
  "california-institute-of-technology": ["california-institute-of-technology"],
  "epfl-ecole-polytechnique-federale-de-lausanne": ["epfl"],
  "johns-hopkins-university": ["jhu", "johns-hopkins-university"],
  "king-s-college-london": ["kcl"],
  "massachusetts-institute-of-technology": ["massachusetts-institute-of-technology"],
  "nanyang-technological-university-singapore": [
    "nanyang-technological-university"
  ],
  "national-university-of-singapore": ["national-university-of-singapore"],
  "new-york-university": ["new-york-university"],
  "seoul-national-university": ["snu"],
  "the-chinese-university-of-hong-kong": ["cuhk"],
  "hong-kong-polytechnic-university": [
    "the-hong-kong-polytechnic-university"
  ],
  "london-school-of-economics-and-political-science": [
    "the-london-school-of-economics-and-political-science"
  ],
  "the-hong-kong-polytechnic-university": [
    "the-hong-kong-polytechnic-university"
  ],
  "the-hong-kong-university-of-science-and-technology": ["hkust"],
  "the-london-school-of-economics-and-political-science": [
    "the-london-school-of-economics-and-political-science"
  ],
  "the-university-of-edinburgh": ["edinburgh"],
  "the-university-of-manchester": ["manchester"],
  "the-university-of-melbourne": ["university-of-melbourne"],
  "the-university-of-new-south-wales": ["unsw-sydney"],
  "the-university-of-queensland": ["university-of-queensland"],
  "the-university-of-sydney": ["university-of-sydney"],
  "the-university-of-tokyo": ["u-tokyo"],
  "university-of-british-columbia": ["ubc"],
  "university-of-california-berkeley": ["university-of-california-berkeley"],
  "university-of-california-los-angeles": ["ucla"],
  "university-of-california-san-diego": ["university-of-california-san-diego"],
  "university-of-texas-at-austin": ["university-of-texas-at-austin"],
  "universit-psl": ["universite-psl"],
  "universiti-malaya": ["universiti-malaya"]
};
