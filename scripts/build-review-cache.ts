import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, rm } from "node:fs/promises";
import path from "node:path";
import {
  openClawStagedArtifactSchema,
  type OpenClawStagedArtifact
} from "@uapt/shared";
import { getDatasetRelease } from "../apps/web/lib/dataset-release";
import { getPolicyAnalysisProfiles } from "../apps/web/lib/policy-analysis";
import { getStagedPublicDataset } from "../apps/web/lib/staged-public-data";

const CACHE_PATH = ".local/uapt-review.sqlite";
const QS_2026_TOP_100 = "data/rankings/qs-world-university-rankings-2026-top-100.json";
const CURRENT_RELEASE_MANIFEST = "data/public-releases/current.json";
const REFERENCE_SHEET_SUMMARY =
  "knowledge/reference-sheets/plsc-edtechai-policy-v4-summary.md";

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

interface PublicReleaseManifest {
  includeStagedArtifactDirectories: string[];
  publishedAt: string;
  releaseId: string;
}

interface JsonObject {
  [key: string]: unknown;
}

interface RankingUniversity {
  countryOrRegion: string;
  name: string;
  rankNumber: number;
  rankText: string;
}

interface RankingDocument {
  rankingSystem: string;
  rankingYear: number;
  source?: {
    url?: string;
  };
  universities: RankingUniversity[];
}

interface StagingRunSummary {
  artifactCount: number;
  claimCount: number;
  detectedLanguages: string[];
  detectedSlugs: string[];
  directory: string;
  evidenceCount: number;
  issueCount: number;
  issues: string[];
  jsonFileCount: number;
  promoted: boolean;
  recommendedAction: string;
  reviewDecisionCount: number;
  reviewStates: Record<string, number>;
  runIds: string[];
  sourceCandidateCount: number;
  validationStatus: "pass" | "fail";
}

interface QsCoverageRow {
  countryOrRegion: string;
  publicSlug: string | null;
  qsRank: number;
  rankingSystem: string;
  rankingYear: number;
  recommendedAction: string;
  stagingRun: string | null;
  status: "public" | "staging_unpromoted" | "missing";
  universityName: string;
}

interface ReferenceSheetRow {
  institutionRows: number | null;
  notes: string;
  rowCount: number | null;
  sheet: string;
  uniqueInstitutions: number | null;
  workbook: string;
}

async function main(): Promise<void> {
  const sqlitePath = resolveSqlite();
  const generatedAt = new Date().toISOString();
  const repoRoot = process.cwd();
  const outputPath = path.resolve(repoRoot, CACHE_PATH);
  const outputDir = path.dirname(outputPath);
  const releaseManifest = await readJsonFile<PublicReleaseManifest>(
    CURRENT_RELEASE_MANIFEST
  );
  const datasetRelease = await getDatasetRelease();
  const publicDataset = await getStagedPublicDataset();
  const analysisProfiles = await getPolicyAnalysisProfiles();
  const stagingRuns = await buildStagingRunSummaries(releaseManifest);
  const qsCoverageRows = await buildQsCoverageRows(publicDataset, stagingRuns);
  const referenceRows = await readReferenceSheetRows();
  const sql = buildSql({
    analysisProfiles,
    datasetRelease,
    generatedAt,
    publicDataset,
    qsCoverageRows,
    referenceRows,
    releaseManifest,
    stagingRuns
  });

  await mkdir(outputDir, { recursive: true });
  await rm(outputPath, { force: true });

  const result = spawnSync(sqlitePath, [outputPath], {
    encoding: "utf8",
    input: sql,
    maxBuffer: 1024 * 1024 * 64
  });

  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(
      [
        "sqlite3 failed while building the review cache.",
        result.stderr,
        result.stdout
      ]
        .filter(Boolean)
        .join("\n")
    );
  }

  console.log(`Built local review cache: ${CACHE_PATH}`);
  console.log(`Release: ${releaseManifest.releaseId}`);
  console.log(`Public universities: ${publicDataset.publicSummaries.length}`);
  console.log(
    `Public claims: ${publicDataset.publicSummaries.reduce(
      (total, summary) => total + summary.claims.length,
      0
    )}`
  );
  console.log(`Staging runs indexed: ${stagingRuns.length}`);
  console.log(
    `QS 2026 top 100 coverage: ${countBy(qsCoverageRows, (row) => row.status)}`
  );
  console.log(`Reference sheet summary rows: ${referenceRows.length}`);
}

function resolveSqlite(): string {
  const result = spawnSync("which", ["sqlite3"], { encoding: "utf8" });
  const sqlitePath = result.stdout.trim();

  if (!sqlitePath) {
    throw new Error(
      "sqlite3 CLI was not found. Install SQLite or adjust scripts/build-review-cache.ts to use another local cache engine."
    );
  }

  return sqlitePath;
}

async function buildStagingRunSummaries(
  manifest: PublicReleaseManifest
): Promise<StagingRunSummary[]> {
  const promoted = new Set(
    manifest.includeStagedArtifactDirectories.map((directory) =>
      path.normalize(directory)
    )
  );
  const roots = [
    ["staging/uapt-runs", true],
    ["data/openclaw-staging", false]
  ] as const;
  const summaries: StagingRunSummary[] = [];

  for (const [root, skipArchive] of roots) {
    const entries = await safeReadDir(root);
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      if (skipArchive && entry.name.startsWith("_")) continue;

      const directory = path.join(root, entry.name);
      const jsonFiles = await walkJsonFiles(directory);
      const summary = await summarizeStagingRun(
        directory,
        jsonFiles,
        promoted.has(path.normalize(directory))
      );
      summaries.push(summary);
    }
  }

  return summaries.sort((left, right) =>
    left.directory.localeCompare(right.directory)
  );
}

async function summarizeStagingRun(
  directory: string,
  jsonFiles: string[],
  promoted: boolean
): Promise<StagingRunSummary> {
  const issues: string[] = [];
  const validArtifacts: OpenClawStagedArtifact[] = [];
  const rawCounts = new Map<string, number>();
  const runIds = new Set<string>();
  const slugs = new Set<string>();
  const languages = new Set<string>();
  const reviewStates = new Map<string, number>();

  for (const file of jsonFiles) {
    const parsed = await readJsonFile<unknown>(file);
    const values = extractArtifactValues(parsed);

    for (const value of values) {
      countRawArtifact(value, rawCounts);
      collectRawArtifactMetadata(value, { languages, reviewStates, runIds, slugs });

      const result = openClawStagedArtifactSchema.safeParse(value);
      if (result.success) {
        validArtifacts.push(result.data);
      } else {
        const message = result.error.issues
          .slice(0, 5)
          .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
          .join("; ");
        issues.push(`${file}: ${message}`);
      }
    }
  }

  const validCounts = countArtifacts(validArtifacts);
  for (const artifactType of REQUIRED_ARTIFACT_TYPES) {
    if (!validCounts.get(artifactType)) {
      issues.push(`Missing required artifact type: ${artifactType}`);
    }
  }

  return {
    artifactCount: validArtifacts.length,
    claimCount: rawCounts.get("claim_candidate") ?? 0,
    detectedLanguages: Array.from(languages).sort(),
    detectedSlugs: Array.from(slugs).sort(),
    directory,
    evidenceCount: rawCounts.get("evidence_candidate") ?? 0,
    issueCount: issues.length,
    issues,
    jsonFileCount: jsonFiles.length,
    promoted,
    recommendedAction: recommendStagingAction({
      directory,
      issueCount: issues.length,
      promoted,
      sourceCandidateCount: rawCounts.get("source_candidate") ?? 0
    }),
    reviewDecisionCount: rawCounts.get("review_decision") ?? 0,
    reviewStates: Object.fromEntries(
      Array.from(reviewStates.entries()).sort(([left], [right]) =>
        left.localeCompare(right)
      )
    ),
    runIds: Array.from(runIds).sort(),
    sourceCandidateCount: rawCounts.get("source_candidate") ?? 0,
    validationStatus: issues.length ? "fail" : "pass"
  };
}

function recommendStagingAction(input: {
  directory: string;
  issueCount: number;
  promoted: boolean;
  sourceCandidateCount: number;
}): string {
  if (input.promoted) return "Already promoted in the current public release.";
  if (input.issueCount > 0) return "Repair validator issues before review.";
  if (input.sourceCandidateCount < 2) {
    return "Review source breadth before promotion.";
  }
  if (input.directory.includes("johns-hopkins")) {
    return "Resolve JHU canonical slug/review-state mapping before promotion.";
  }
  return "Review for possible next manifest promotion.";
}

async function buildQsCoverageRows(
  publicDataset: Awaited<ReturnType<typeof getStagedPublicDataset>>,
  stagingRuns: StagingRunSummary[]
): Promise<QsCoverageRow[]> {
  const ranking = await readJsonFile<RankingDocument>(QS_2026_TOP_100);
  const publicByRank = new Map<number, string>();
  const publicByName = new Map<string, string>();

  for (const university of publicDataset.catalogUniversities) {
    publicByName.set(normalizeName(university.name), university.slug);
    for (const rankingItem of university.rankings) {
      if (
        rankingItem.systemId === "qs" &&
        rankingItem.year === 2026 &&
        rankingItem.rankNumber
      ) {
        publicByRank.set(rankingItem.rankNumber, university.slug);
      }
    }
  }

  const unpromotedBySlug = new Map<string, string>();
  for (const run of stagingRuns) {
    if (run.promoted) continue;
    for (const slug of run.detectedSlugs) {
      unpromotedBySlug.set(slug, run.directory);
    }
  }

  return ranking.universities.map((university) => {
    const guessedSlug = slugify(university.name);
    const aliases = new Set([guessedSlug, ...(QS_SLUG_ALIASES[guessedSlug] ?? [])]);
    const publicSlug =
      publicByRank.get(university.rankNumber) ??
      publicByName.get(normalizeName(university.name)) ??
      null;
    const stagingAlias = Array.from(aliases).find((alias) =>
      unpromotedBySlug.has(alias)
    );
    const stagingRun = stagingAlias
      ? unpromotedBySlug.get(stagingAlias) ?? null
      : null;
    const status = publicSlug
      ? "public"
      : stagingRun
        ? "staging_unpromoted"
        : "missing";

    return {
      countryOrRegion: university.countryOrRegion,
      publicSlug,
      qsRank: university.rankNumber,
      rankingSystem: ranking.rankingSystem,
      rankingYear: ranking.rankingYear,
      recommendedAction:
        status === "public"
          ? "No crawl action required for coverage."
          : status === "staging_unpromoted"
            ? "Review validated staging run before promotion."
            : "Send to source discovery.",
      stagingRun,
      status,
      universityName: university.name
    };
  });
}

async function readReferenceSheetRows(): Promise<ReferenceSheetRow[]> {
  const content = await readFile(REFERENCE_SHEET_SUMMARY, "utf8").catch(() => "");
  if (!content) return [];

  const shapeSection = content.match(
    /## Workbook Shape\n\n(?<table>(?:\|.+\|\n)+)/u
  )?.groups?.table;
  if (!shapeSection) return [];

  return shapeSection
    .trim()
    .split("\n")
    .slice(2)
    .map((line) => line.split("|").slice(1, -1).map((cell) => cell.trim()))
    .filter((cells) => cells.length >= 5)
    .map(([sheet, rowCount, institutionRows, uniqueInstitutions, notes]) => ({
      institutionRows: parseNullableInteger(institutionRows),
      notes,
      rowCount: parseNullableInteger(rowCount),
      sheet: sheet.replace(/`/g, ""),
      uniqueInstitutions: parseNullableInteger(uniqueInstitutions),
      workbook: "PLSC-EdTechAI_Policy_V4.xlsx"
    }));
}

function buildSql(input: {
  analysisProfiles: Awaited<ReturnType<typeof getPolicyAnalysisProfiles>>;
  datasetRelease: Awaited<ReturnType<typeof getDatasetRelease>>;
  generatedAt: string;
  publicDataset: Awaited<ReturnType<typeof getStagedPublicDataset>>;
  qsCoverageRows: QsCoverageRow[];
  referenceRows: ReferenceSheetRow[];
  releaseManifest: PublicReleaseManifest;
  stagingRuns: StagingRunSummary[];
}): string {
  const universities = parseArtifactRows(input.datasetRelease, "universities");
  const claims = parseArtifactRows(input.datasetRelease, "claims");
  const sources = parseArtifactRows(input.datasetRelease, "sources");
  const changes = parseArtifactRows(input.datasetRelease, "changes");
  const statements: string[] = [
    "PRAGMA foreign_keys = OFF;",
    "BEGIN;",
    ...DROP_TABLES.map((table) => `DROP TABLE IF EXISTS ${table};`),
    ...CREATE_TABLES,
    ...insertRows("cache_metadata", [
      ["generated_at", input.generatedAt],
      ["cache_path", CACHE_PATH],
      ["release_id", input.releaseManifest.releaseId],
      ["release_published_at", input.releaseManifest.publishedAt],
      ["canonical_boundary", "Local review cache only; not policy evidence; cannot write production DB."],
      ["source_files", JSON.stringify([
        CURRENT_RELEASE_MANIFEST,
        QS_2026_TOP_100,
        REFERENCE_SHEET_SUMMARY,
        "staging/uapt-runs/",
        "data/openclaw-staging/"
      ])]
    ]),
    ...insertPublicUniversities(universities),
    ...insertPublicClaims(claims),
    ...insertPublicEvidence(claims),
    ...insertPublicSources(sources),
    ...insertPublicChanges(changes),
    ...insertAnalysisProfiles(input.analysisProfiles),
    ...insertStagingRuns(input.stagingRuns),
    ...insertStagingArtifactCounts(input.stagingRuns),
    ...insertStagingValidationResults(input.stagingRuns),
    ...insertRankingQs2026(input.qsCoverageRows),
    ...insertCoverageGaps(input.qsCoverageRows),
    ...insertReferenceSheetRows(input.referenceRows),
    ...insertEntityAliases(input.publicDataset.publicSummaries),
    ...insertSourceHealthChecks(universities, input.stagingRuns),
    ...CREATE_INDEXES,
    "COMMIT;"
  ];

  return `${statements.join("\n")}\n`;
}

function insertPublicUniversities(rows: JsonObject[]): string[] {
  return insertRows(
    "public_universities",
    rows.map((row) => [
      row.entitySlug,
      row.entityName,
      row.canonicalUrl,
      row.publicJsonUrl,
      row.summary,
      row.reviewState,
      row.confidence,
      row.claimCount,
      row.officialSourceCount,
      JSON.stringify(row.sourceLanguages ?? []),
      row.lastCheckedAt,
      row.lastChangedAt
    ])
  );
}

function insertPublicClaims(rows: JsonObject[]): string[] {
  return insertRows(
    "public_claims",
    rows.map((row) => [
      row.entitySlug,
      row.claimId,
      row.claimType,
      row.claimValue,
      row.confidence,
      row.reviewState,
      row.evidenceCount,
      row.lastCheckedAt,
      row.lastChangedAt,
      textLength(row.claimText)
    ])
  );
}

function insertPublicEvidence(claimRows: JsonObject[]): string[] {
  const evidenceRows = claimRows.flatMap((claim) =>
    Array.isArray(claim.evidence)
      ? claim.evidence.map((evidence) => ({
          claimId: claim.claimId,
          entitySlug: claim.entitySlug,
          evidence: evidence as JsonObject
        }))
      : []
  );

  return insertRows(
    "public_evidence",
    evidenceRows.map((row) => [
      row.entitySlug,
      row.claimId,
      row.evidence.sourceUrl,
      row.evidence.sourceLanguage,
      row.evidence.sourceSnapshotHash,
      row.evidence.retrievedAt,
      row.evidence.snippetLocation,
      textLength(row.evidence.evidenceSnippet),
      typeof row.evidence.evidenceSnippetDisplay === "string" ? 1 : 0
    ])
  );
}

function insertPublicSources(rows: JsonObject[]): string[] {
  return insertRows(
    "public_sources",
    rows.map((row) => [
      row.entitySlug,
      row.sourceUrl,
      row.finalUrl,
      row.citationTitle,
      row.publisher,
      row.retrievedAt,
      row.snapshotHash,
      row.sourceType,
      row.official === true ? 1 : 0
    ])
  );
}

function insertPublicChanges(rows: JsonObject[]): string[] {
  return insertRows(
    "public_changes",
    rows.map((row) => [
      row.entitySlug,
      row.changeUrl,
      row.publicJsonUrl,
      row.lastCheckedAt,
      row.lastChangedAt,
      row.reviewState,
      row.confidence,
      row.claimCount,
      row.officialSourceCount,
      row.reviewedClaimCount,
      JSON.stringify(row.sourceSnapshotHashes ?? [])
    ])
  );
}

function insertAnalysisProfiles(
  profiles: Awaited<ReturnType<typeof getPolicyAnalysisProfiles>>
): string[] {
  return insertRows(
    "analysis_profiles",
    profiles.map((profile) => [
      profile.entitySlug,
      profile.entityName,
      profile.publicJsonUrl,
      profile.reviewState,
      profile.confidence,
      profile.coverageScore.score,
      profile.coverageScore.label,
      profile.dimensions.length,
      profile.dimensions.filter((dimension) => dimension.evidenceCount > 0)
        .length,
      profile.sourceLanguages.length,
      JSON.stringify(profile.basedOnClaimIds),
      JSON.stringify(profile.basedOnSourceUrls)
    ])
  );
}

function insertStagingRuns(rows: StagingRunSummary[]): string[] {
  return insertRows(
    "staging_runs",
    rows.map((row) => [
      row.directory,
      row.promoted ? 1 : 0,
      row.validationStatus,
      row.issueCount,
      row.jsonFileCount,
      row.artifactCount,
      JSON.stringify(row.runIds),
      JSON.stringify(row.detectedSlugs),
      row.claimCount,
      row.evidenceCount,
      row.sourceCandidateCount,
      row.reviewDecisionCount,
      JSON.stringify(row.detectedLanguages),
      JSON.stringify(row.reviewStates),
      row.recommendedAction
    ])
  );
}

function insertStagingArtifactCounts(rows: StagingRunSummary[]): string[] {
  const countRows = rows.flatMap((row) => [
    [row.directory, "claim_candidate", row.claimCount],
    [row.directory, "evidence_candidate", row.evidenceCount],
    [row.directory, "source_candidate", row.sourceCandidateCount],
    [row.directory, "review_decision", row.reviewDecisionCount]
  ]);

  return insertRows("staging_artifact_counts", countRows);
}

function insertStagingValidationResults(rows: StagingRunSummary[]): string[] {
  return insertRows(
    "staging_validation_results",
    rows.map((row) => [
      row.directory,
      row.validationStatus,
      row.issueCount,
      JSON.stringify(row.issues.slice(0, 20)),
      row.recommendedAction
    ])
  );
}

function insertRankingQs2026(rows: QsCoverageRow[]): string[] {
  return insertRows(
    "ranking_qs_2026",
    rows.map((row) => [
      row.qsRank,
      row.universityName,
      row.countryOrRegion,
      row.status,
      row.publicSlug,
      row.stagingRun,
      row.recommendedAction
    ])
  );
}

function insertCoverageGaps(rows: QsCoverageRow[]): string[] {
  return insertRows(
    "coverage_gaps",
    rows
      .filter((row) => row.status !== "public")
      .map((row) => [
        "qs",
        2026,
        row.qsRank,
        row.universityName,
        row.countryOrRegion,
        row.status,
        row.stagingRun,
        row.recommendedAction
      ])
  );
}

function insertReferenceSheetRows(rows: ReferenceSheetRow[]): string[] {
  return insertRows(
    "reference_sheet_rows",
    rows.map((row) => [
      row.workbook,
      row.sheet,
      row.rowCount,
      row.institutionRows,
      row.uniqueInstitutions,
      row.notes,
      "non_authoritative_benchmark"
    ])
  );
}

function insertEntityAliases(
  summaries: Awaited<ReturnType<typeof getStagedPublicDataset>>["publicSummaries"]
): string[] {
  return insertRows(
    "entity_aliases",
    summaries.flatMap((summary) =>
      summary.entity.aliases.map((alias) => [summary.entity.slug, alias])
    )
  );
}

function insertSourceHealthChecks(
  universityRows: JsonObject[],
  stagingRuns: StagingRunSummary[]
): string[] {
  const publicRows = universityRows.flatMap((row) => {
    const checks: Array<[unknown, ...unknown[]]> = [];
    const sourceCount = Number(row.officialSourceCount ?? 0);
    const reviewState = String(row.reviewState ?? "");
    const languages = Array.isArray(row.sourceLanguages)
      ? row.sourceLanguages
      : [];

    if (sourceCount < 2) {
      checks.push([
        row.entitySlug,
        "low_public_source_count",
        "warning",
        `Official source count is ${sourceCount}.`
      ]);
    }

    if (reviewState === "needs_review") {
      checks.push([
        row.entitySlug,
        "public_entity_needs_review",
        "warning",
        "Public entity review state is needs_review."
      ]);
    }

    if (languages.some((language) => language !== "en" && !String(language).startsWith("en-"))) {
      checks.push([
        row.entitySlug,
        "non_english_evidence_present",
        "info",
        `Original-language evidence includes ${languages.join(", ")}.`
      ]);
    }

    return checks;
  });
  const stagingRows = stagingRuns
    .filter((run) => !run.promoted && run.validationStatus === "fail")
    .map((run) => [
      run.detectedSlugs[0] ?? run.directory,
      "staging_validator_failed",
      "error",
      `${run.directory} has ${run.issueCount} validation issue(s).`
    ]);

  return insertRows("source_health_checks", [...publicRows, ...stagingRows]);
}

function parseArtifactRows(
  release: Awaited<ReturnType<typeof getDatasetRelease>>,
  id: string
): JsonObject[] {
  const artifact = Array.from(release.artifactsByPath.values()).find(
    (item) => item.id === id
  );
  if (!artifact) return [];

  return artifact.content
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line) as JsonObject);
}

function insertRows(table: string, rows: unknown[][]): string[] {
  if (!rows.length) return [];

  return rows.map(
    (row) => `INSERT INTO ${table} VALUES (${row.map(sqlValue).join(", ")});`
  );
}

function sqlValue(value: unknown): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "NULL";
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "NULL";
  if (typeof value === "boolean") return value ? "1" : "0";
  return `'${String(value).replaceAll("'", "''")}'`;
}

async function walkJsonFiles(root: string): Promise<string[]> {
  const entries = await safeReadDir(root);
  const files = await Promise.all(
    entries.map(async (entry) => {
      const entryPath = path.join(root, entry.name);
      if (entry.isDirectory()) return walkJsonFiles(entryPath);
      if (entry.isFile() && entry.name.endsWith(".json")) return [entryPath];
      return [];
    })
  );

  return files.flat().sort();
}

async function safeReadDir(root: string) {
  try {
    return await readdir(root, { withFileTypes: true });
  } catch {
    return [];
  }
}

async function readJsonFile<T>(file: string): Promise<T> {
  return JSON.parse(await readFile(file, "utf8")) as T;
}

function extractArtifactValues(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (isRecord(value) && Array.isArray(value.artifacts)) return value.artifacts;
  return [value];
}

function countRawArtifact(
  value: unknown,
  counts: Map<string, number>
): void {
  if (!isRecord(value) || typeof value.artifactType !== "string") return;
  increment(counts, value.artifactType);
}

function collectRawArtifactMetadata(
  value: unknown,
  output: {
    languages: Set<string>;
    reviewStates: Map<string, number>;
    runIds: Set<string>;
    slugs: Set<string>;
  }
): void {
  if (!isRecord(value)) return;

  addString(output.runIds, value.runId);
  addString(output.slugs, value.entitySlug);
  addString(output.languages, value.sourceLanguage);
  if (isRecord(value.citation)) addString(output.languages, value.citation.sourceLanguage);
  if (typeof value.reviewState === "string") increment(output.reviewStates, value.reviewState);
  if (typeof value.decision === "string") increment(output.reviewStates, value.decision);
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

function increment(map: Map<string, number>, key: string): void {
  map.set(key, (map.get(key) ?? 0) + 1);
}

function addString(set: Set<string>, value: unknown): void {
  if (typeof value === "string" && value) set.add(value);
}

function isRecord(value: unknown): value is JsonObject {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function textLength(value: unknown): number {
  return typeof value === "string" ? value.length : 0;
}

function parseNullableInteger(value: string): number | null {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
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

function countBy<T>(rows: T[], getKey: (row: T) => string): string {
  const counts = new Map<string, number>();
  for (const row of rows) increment(counts, getKey(row));
  return JSON.stringify(Object.fromEntries([...counts.entries()].sort()));
}

const QS_SLUG_ALIASES: Record<string, string[]> = {
  "adelaide-university": ["adelaide-university"],
  "australian-national-university": ["anu"],
  "california-institute-of-technology": ["california-institute-of-technology"],
  "epfl-ecole-polytechnique-federale-de-lausanne": ["epfl"],
  "johns-hopkins-university": ["jhu", "johns-hopkins-university"],
  "king-s-college-london": ["kcl"],
  "massachusetts-institute-of-technology": ["massachusetts-institute-of-technology"],
  "nanyang-technological-university-singapore": ["nanyang-technological-university"],
  "national-university-of-singapore": ["national-university-of-singapore"],
  "new-york-university": ["new-york-university"],
  "seoul-national-university": ["snu"],
  "the-chinese-university-of-hong-kong": ["cuhk"],
  "hong-kong-polytechnic-university": ["the-hong-kong-polytechnic-university"],
  "london-school-of-economics-and-political-science": [
    "the-london-school-of-economics-and-political-science"
  ],
  "the-hong-kong-polytechnic-university": ["the-hong-kong-polytechnic-university"],
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
  "universit-psl": ["universite-psl"],
  "universiti-malaya": ["universiti-malaya"]
};

const DROP_TABLES = [
  "cache_metadata",
  "public_universities",
  "public_claims",
  "public_evidence",
  "public_sources",
  "public_changes",
  "analysis_profiles",
  "staging_runs",
  "staging_artifact_counts",
  "staging_validation_results",
  "ranking_qs_2026",
  "reference_sheet_rows",
  "entity_aliases",
  "coverage_gaps",
  "source_health_checks"
];

const CREATE_TABLES = [
  `CREATE TABLE cache_metadata (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );`,
  `CREATE TABLE public_universities (
    entity_slug TEXT PRIMARY KEY,
    entity_name TEXT NOT NULL,
    canonical_url TEXT NOT NULL,
    public_json_url TEXT NOT NULL,
    summary TEXT NOT NULL,
    review_state TEXT NOT NULL,
    confidence REAL,
    claim_count INTEGER NOT NULL,
    official_source_count INTEGER NOT NULL,
    source_languages_json TEXT NOT NULL,
    last_checked_at TEXT,
    last_changed_at TEXT
  );`,
  `CREATE TABLE public_claims (
    entity_slug TEXT NOT NULL,
    claim_id TEXT,
    claim_type TEXT,
    claim_value TEXT,
    confidence REAL,
    review_state TEXT NOT NULL,
    evidence_count INTEGER NOT NULL,
    last_checked_at TEXT,
    last_changed_at TEXT,
    claim_text_length INTEGER NOT NULL
  );`,
  `CREATE TABLE public_evidence (
    entity_slug TEXT NOT NULL,
    claim_id TEXT,
    source_url TEXT NOT NULL,
    source_language TEXT,
    source_snapshot_hash TEXT,
    retrieved_at TEXT,
    snippet_location TEXT,
    evidence_snippet_length INTEGER NOT NULL,
    has_display_snippet INTEGER NOT NULL
  );`,
  `CREATE TABLE public_sources (
    entity_slug TEXT NOT NULL,
    source_url TEXT NOT NULL,
    final_url TEXT,
    citation_title TEXT,
    publisher TEXT,
    retrieved_at TEXT,
    snapshot_hash TEXT,
    source_type TEXT,
    official INTEGER NOT NULL
  );`,
  `CREATE TABLE public_changes (
    entity_slug TEXT NOT NULL,
    change_url TEXT NOT NULL,
    public_json_url TEXT NOT NULL,
    last_checked_at TEXT,
    last_changed_at TEXT,
    review_state TEXT NOT NULL,
    confidence REAL,
    claim_count INTEGER NOT NULL,
    official_source_count INTEGER NOT NULL,
    reviewed_claim_count INTEGER NOT NULL,
    source_snapshot_hashes_json TEXT NOT NULL
  );`,
  `CREATE TABLE analysis_profiles (
    entity_slug TEXT PRIMARY KEY,
    entity_name TEXT NOT NULL,
    public_json_url TEXT NOT NULL,
    review_state TEXT NOT NULL,
    confidence REAL,
    coverage_score INTEGER NOT NULL,
    coverage_label TEXT NOT NULL,
    dimension_count INTEGER NOT NULL,
    evidence_backed_dimension_count INTEGER NOT NULL,
    source_language_count INTEGER NOT NULL,
    based_on_claim_ids_json TEXT NOT NULL,
    based_on_source_urls_json TEXT NOT NULL
  );`,
  `CREATE TABLE staging_runs (
    directory TEXT PRIMARY KEY,
    promoted INTEGER NOT NULL,
    validation_status TEXT NOT NULL,
    issue_count INTEGER NOT NULL,
    json_file_count INTEGER NOT NULL,
    artifact_count INTEGER NOT NULL,
    run_ids_json TEXT NOT NULL,
    detected_slugs_json TEXT NOT NULL,
    claim_count INTEGER NOT NULL,
    evidence_count INTEGER NOT NULL,
    source_candidate_count INTEGER NOT NULL,
    review_decision_count INTEGER NOT NULL,
    detected_languages_json TEXT NOT NULL,
    review_states_json TEXT NOT NULL,
    recommended_action TEXT NOT NULL
  );`,
  `CREATE TABLE staging_artifact_counts (
    directory TEXT NOT NULL,
    artifact_type TEXT NOT NULL,
    count INTEGER NOT NULL
  );`,
  `CREATE TABLE staging_validation_results (
    directory TEXT PRIMARY KEY,
    validation_status TEXT NOT NULL,
    issue_count INTEGER NOT NULL,
    issues_json TEXT NOT NULL,
    recommended_action TEXT NOT NULL
  );`,
  `CREATE TABLE ranking_qs_2026 (
    qs_rank INTEGER NOT NULL,
    university_name TEXT NOT NULL,
    country_or_region TEXT NOT NULL,
    public_status TEXT NOT NULL,
    public_slug TEXT,
    staging_run TEXT,
    recommended_action TEXT NOT NULL
  );`,
  `CREATE TABLE reference_sheet_rows (
    workbook TEXT NOT NULL,
    sheet TEXT NOT NULL,
    row_count INTEGER,
    institution_rows INTEGER,
    unique_institutions INTEGER,
    notes TEXT,
    authoritative_level TEXT NOT NULL
  );`,
  `CREATE TABLE entity_aliases (
    entity_slug TEXT NOT NULL,
    alias TEXT NOT NULL
  );`,
  `CREATE TABLE coverage_gaps (
    ranking_system TEXT NOT NULL,
    ranking_year INTEGER NOT NULL,
    rank_number INTEGER NOT NULL,
    university_name TEXT NOT NULL,
    country_or_region TEXT NOT NULL,
    status TEXT NOT NULL,
    staging_run TEXT,
    recommended_action TEXT NOT NULL
  );`,
  `CREATE TABLE source_health_checks (
    entity_slug TEXT NOT NULL,
    check_id TEXT NOT NULL,
    severity TEXT NOT NULL,
    message TEXT NOT NULL
  );`
];

const CREATE_INDEXES = [
  "CREATE INDEX idx_public_claims_entity ON public_claims(entity_slug);",
  "CREATE INDEX idx_public_evidence_entity ON public_evidence(entity_slug);",
  "CREATE INDEX idx_public_sources_entity ON public_sources(entity_slug);",
  "CREATE INDEX idx_ranking_qs_status ON ranking_qs_2026(public_status, qs_rank);",
  "CREATE INDEX idx_staging_runs_status ON staging_runs(validation_status, promoted);",
  "CREATE INDEX idx_coverage_gaps_status ON coverage_gaps(status, rank_number);"
];

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
