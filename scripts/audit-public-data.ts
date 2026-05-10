import { access, readFile } from "node:fs/promises";
import path from "node:path";
import type {
  CatalogUniversity,
  PublicEntitySummary,
  RankingSystemId
} from "@uapt/shared";
import {
  getCurrentPublicReleaseManifest,
  getStagedPublicDataset
} from "../apps/web/lib/staged-public-data";

interface AuditIssue {
  severity: "error" | "warning";
  code: string;
  message: string;
}

interface RankingIndex {
  sources: RankingIndexSource[];
}

interface RankingIndexSource {
  rankingSystemId: RankingSystemId;
  rankingSystem: string;
  rankingYear: number | string;
  file: string;
  status?: "complete" | "partial" | "blocked" | "not_yet_released";
  recordCount?: number;
  requestedLimit?: number;
  rankType?: "official_ordinal" | "derived_metric_order";
}

interface RankingSourceDocument {
  universities: unknown[];
}

interface RankingCoverageRecord {
  publicCoverage: number;
  recordCount: number;
  requestedLimit?: number;
  status: string;
  systemId: RankingSystemId;
}

const hashPattern = /^[a-f0-9]{64}$/;

async function main() {
  const repoRoot = process.cwd();
  const manifest = await getCurrentPublicReleaseManifest();
  const dataset = await getStagedPublicDataset();
  const issues: AuditIssue[] = [];

  if (!manifest) {
    issues.push({
      severity: "error",
      code: "missing_manifest",
      message: "data/public-releases/current.json was not found or is invalid."
    });
  } else {
    for (const directory of manifest.includeStagedArtifactDirectories) {
      await assertPathExists(repoRoot, directory, issues);
    }
  }

  if (!dataset.publicSummaries.length) {
    issues.push({
      severity: "error",
      code: "empty_public_dataset",
      message: "No public university summaries were produced."
    });
  }

  auditSummaries(dataset.publicSummaries, dataset.catalogUniversities, issues);
  const rankingCoverage = await auditRankingCoverage(
    repoRoot,
    dataset.catalogUniversities,
    issues
  );

  const stats = buildStats(
    dataset.publicSummaries,
    dataset.catalogUniversities,
    rankingCoverage
  );
  printStats(stats, manifest?.releaseId, process.argv.includes("--details"));
  printIssues(issues);

  if (issues.some((issue) => issue.severity === "error")) {
    process.exitCode = 1;
  }
}

async function assertPathExists(
  repoRoot: string,
  relativePath: string,
  issues: AuditIssue[]
): Promise<void> {
  try {
    await access(path.join(repoRoot, relativePath));
  } catch {
    issues.push({
      severity: "error",
      code: "manifest_path_missing",
      message: `Manifest directory does not exist: ${relativePath}`
    });
  }
}

function auditSummaries(
  summaries: PublicEntitySummary[],
  catalogUniversities: CatalogUniversity[],
  issues: AuditIssue[]
): void {
  const slugs = new Set<string>();
  const catalogBySlug = new Map(
    catalogUniversities.map((university) => [university.slug, university])
  );

  for (const summary of summaries) {
    if (slugs.has(summary.entity.slug)) {
      issues.push({
        severity: "error",
        code: "duplicate_entity_slug",
        message: `Duplicate public entity slug: ${summary.entity.slug}`
      });
    }
    slugs.add(summary.entity.slug);

    if (!summary.claims.length) {
      issues.push({
        severity: "error",
        code: "entity_without_claims",
        message: `${summary.entity.slug} has no public claims.`
      });
    }

    if (!summary.officialSources.length) {
      issues.push({
        severity: "error",
        code: "entity_without_sources",
        message: `${summary.entity.slug} has no official source attributions.`
      });
    }

    if (!summary.entity.aliases.some((alias) => alias.startsWith("QS 2026"))) {
      issues.push({
        severity: "warning",
        code: "missing_qs_rank_alias",
        message: `${summary.entity.slug} is missing a QS 2026 rank alias.`
      });
    }

    const catalog = catalogBySlug.get(summary.entity.slug);
    if (!catalog || catalog.country === "Unknown" || catalog.region === "Unknown") {
      issues.push({
        severity: "warning",
        code: "missing_location",
        message: `${summary.entity.slug} is missing region/country display data.`
      });
    }

    auditSources(summary, issues);
    auditClaims(summary, issues);
  }
}

async function auditRankingCoverage(
  repoRoot: string,
  catalogUniversities: CatalogUniversity[],
  issues: AuditIssue[]
): Promise<RankingCoverageRecord[]> {
  const rankingRoot = path.join(repoRoot, "data", "rankings");
  const index = await readJson(path.join(rankingRoot, "ranking-index.json"));
  const coverage: RankingCoverageRecord[] = [];

  if (!isRankingIndex(index)) {
    issues.push({
      severity: "error",
      code: "missing_ranking_index",
      message: "data/rankings/ranking-index.json was not found or is invalid."
    });
    return coverage;
  }

  for (const source of index.sources) {
    const sourcePath = path.join(rankingRoot, source.file);
    const document = await readJson(sourcePath);

    if (!isRankingSourceDocument(document)) {
      issues.push({
        severity: "error",
        code: "invalid_ranking_source",
        message: `${source.file} is missing a universities array.`
      });
      continue;
    }

    const recordCount = document.universities.length;
    if (source.recordCount !== undefined && source.recordCount !== recordCount) {
      issues.push({
        severity: "warning",
        code: "ranking_record_count_mismatch",
        message: `${source.file} index recordCount=${source.recordCount} but file has ${recordCount}.`
      });
    }

    if (source.status === "complete" && source.requestedLimit && recordCount < source.requestedLimit) {
      issues.push({
        severity: "warning",
        code: "ranking_complete_below_requested_limit",
        message: `${source.file} is marked complete with ${recordCount}/${source.requestedLimit} rows.`
      });
    }

    const publicCoverage = catalogUniversities.filter((university) =>
      university.rankings.some(
        (ranking) => ranking.systemId === source.rankingSystemId
      )
    ).length;
    coverage.push({
      publicCoverage,
      recordCount,
      requestedLimit: source.requestedLimit,
      status: source.status ?? "unknown",
      systemId: source.rankingSystemId
    });
  }

  const qsCoverage = catalogUniversities.filter((university) =>
    university.rankings.some((ranking) => ranking.systemId === "qs")
  );

  if (qsCoverage.length < catalogUniversities.length) {
    issues.push({
      severity: "warning",
      code: "missing_qs_ranking_coverage",
      message: `${catalogUniversities.length - qsCoverage.length} public university records are missing QS ranking coverage.`
    });
  }

  return coverage;
}

async function readJson(file: string): Promise<unknown> {
  try {
    return JSON.parse(await readFile(file, "utf8")) as unknown;
  } catch {
    return undefined;
  }
}

function isRankingIndex(value: unknown): value is RankingIndex {
  return (
    isRecord(value) &&
    Array.isArray(value.sources) &&
    value.sources.every(
      (source) =>
        isRecord(source) &&
        isRankingSystemId(source.rankingSystemId) &&
        typeof source.rankingSystem === "string" &&
        (typeof source.rankingYear === "number" ||
          typeof source.rankingYear === "string") &&
        typeof source.file === "string"
    )
  );
}

function isRankingSourceDocument(value: unknown): value is RankingSourceDocument {
  return isRecord(value) && Array.isArray(value.universities);
}

function isRankingSystemId(value: unknown): value is RankingSystemId {
  return (
    value === "qs" ||
    value === "the" ||
    value === "arwu" ||
    value === "usnews" ||
    value === "cwts"
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function auditSources(summary: PublicEntitySummary, issues: AuditIssue[]): void {
  for (const source of summary.officialSources) {
    if (!hashPattern.test(source.snapshotHash)) {
      issues.push({
        severity: "error",
        code: "invalid_source_hash",
        message: `${summary.entity.slug} source has invalid snapshot hash: ${source.sourceUrl}`
      });
    }
  }
}

function auditClaims(summary: PublicEntitySummary, issues: AuditIssue[]): void {
  const claimIds = new Set<string>();

  for (const claim of summary.claims) {
    if (claim.id) {
      const key = `${summary.entity.slug}:${claim.id}`;
      if (claimIds.has(key)) {
        issues.push({
          severity: "warning",
          code: "duplicate_claim_id",
          message: `${summary.entity.slug} has duplicate claim id: ${claim.id}`
        });
      }
      claimIds.add(key);
    }

    if (!claim.evidence.length) {
      issues.push({
        severity: "error",
        code: "claim_without_evidence",
        message: `${summary.entity.slug} claim has no evidence: ${claim.id ?? claim.claimText}`
      });
    }

    for (const evidence of claim.evidence) {
      if (!hashPattern.test(evidence.sourceSnapshotHash)) {
        issues.push({
          severity: "error",
          code: "invalid_evidence_hash",
          message: `${summary.entity.slug} evidence has invalid snapshot hash: ${claim.id ?? claim.claimText}`
        });
      }

      if (evidence.sourceSnapshotHash !== evidence.attribution.snapshotHash) {
        issues.push({
          severity: "error",
          code: "evidence_hash_mismatch",
          message: `${summary.entity.slug} evidence hash mismatch: ${claim.id ?? claim.claimText}`
        });
      }

      if (evidence.sourceUrl !== evidence.attribution.sourceUrl) {
        issues.push({
          severity: "error",
          code: "evidence_source_url_mismatch",
          message: `${summary.entity.slug} evidence URL mismatch: ${claim.id ?? claim.claimText}`
        });
      }

      if (!evidence.evidenceSnippet.trim()) {
        issues.push({
          severity: "error",
          code: "empty_evidence_snippet",
          message: `${summary.entity.slug} evidence snippet is empty: ${claim.id ?? claim.claimText}`
        });
      }
    }
  }
}

function buildStats(
  summaries: PublicEntitySummary[],
  catalogUniversities: CatalogUniversity[],
  rankingCoverage: RankingCoverageRecord[]
) {
  const claimReviewStates = new Map<string, number>();
  const entityReviewStates = new Map<string, number>();
  const sourceLanguages = new Map<string, number>();
  let claimCount = 0;
  let evidenceCount = 0;
  let officialSourceCount = 0;

  for (const summary of summaries) {
    increment(entityReviewStates, summary.reviewState);
    officialSourceCount += summary.officialSources.length;

    for (const claim of summary.claims) {
      claimCount += 1;
      increment(claimReviewStates, claim.reviewState);

      for (const evidence of claim.evidence) {
        evidenceCount += 1;
        increment(sourceLanguages, evidence.sourceLanguage ?? "unknown");
      }
    }
  }

  const missingLocation = catalogUniversities.filter(
    (university) => university.country === "Unknown" || university.region === "Unknown"
  );
  const missingQsRank = summaries.filter(
    (summary) => !summary.entity.aliases.some((alias) => alias.startsWith("QS 2026"))
  );
  const nonEnglishEvidence = Array.from(sourceLanguages.entries())
    .filter(([language]) => language !== "en" && !language.startsWith("en-"))
    .sort(([left], [right]) => left.localeCompare(right));
  const perUniversity = summaries
    .map((summary) => ({
      slug: summary.entity.slug,
      name: summary.entity.name,
      claims: summary.claims.length,
      sources: summary.officialSources.length,
      reviewState: summary.reviewState,
      lastCheckedAt: summary.lastCheckedAt ?? "none"
    }))
    .sort((left, right) => right.claims - left.claims);

  return {
    claimCount,
    claimReviewStates: Object.fromEntries(claimReviewStates),
    entityReviewStates: Object.fromEntries(entityReviewStates),
    evidenceCount,
    missingLocation,
    missingQsRank,
    nonEnglishEvidence,
    officialSourceCount,
    perUniversity,
    rankingCoverage,
    sourceLanguages: Object.fromEntries(sourceLanguages),
    universityCount: summaries.length
  };
}

function printStats(
  stats: ReturnType<typeof buildStats>,
  releaseId: string | undefined,
  showDetails: boolean
): void {
  console.log("Public data audit");
  console.log(`Release: ${releaseId ?? "none"}`);
  console.log(`Universities: ${stats.universityCount}`);
  console.log(`Claims: ${stats.claimCount}`);
  console.log(`Evidence records: ${stats.evidenceCount}`);
  console.log(`Official source attributions: ${stats.officialSourceCount}`);
  console.log(`Entity review states: ${JSON.stringify(stats.entityReviewStates)}`);
  console.log(`Claim review states: ${JSON.stringify(stats.claimReviewStates)}`);
  console.log(`Source languages: ${JSON.stringify(stats.sourceLanguages)}`);
  console.log(`Missing QS rank aliases: ${stats.missingQsRank.length}`);
  console.log(`Missing region/country: ${stats.missingLocation.length}`);
  console.log(
    `Ranking coverage: ${stats.rankingCoverage
      .map(
        (record) =>
          `${record.systemId}=${record.publicCoverage}/${stats.universityCount} public, ${record.recordCount}${record.requestedLimit ? `/${record.requestedLimit}` : ""} rows, ${record.status}`
      )
      .join("; ")}`
  );
  console.log(
    `Non-English evidence languages: ${
      stats.nonEnglishEvidence.length
        ? JSON.stringify(Object.fromEntries(stats.nonEnglishEvidence))
        : "none"
    }`
  );
  if (showDetails) {
    console.table(stats.perUniversity);
  } else {
    const topRecords = stats.perUniversity
      .slice(0, 8)
      .map((record) => `${record.slug}:${record.claims}`)
      .join(", ");
    console.log(`Largest records by claim count: ${topRecords}`);
    console.log("Run `pnpm audit:public-data -- --details` for the per-university table.");
  }
}

function printIssues(issues: AuditIssue[]): void {
  const errors = issues.filter((issue) => issue.severity === "error");
  const warnings = issues.filter((issue) => issue.severity === "warning");

  if (!issues.length) {
    console.log("Audit issues: none");
    return;
  }

  if (warnings.length) {
    console.log("Warnings:");
    for (const warning of warnings) {
      console.log(`- [${warning.code}] ${warning.message}`);
    }
  }

  if (errors.length) {
    console.error("Errors:");
    for (const error of errors) {
      console.error(`- [${error.code}] ${error.message}`);
    }
  }
}

function increment(map: Map<string, number>, key: string): void {
  map.set(key, (map.get(key) ?? 0) + 1);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
