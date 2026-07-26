import { readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  getCurrentPublicReleaseManifest,
  getStagedPublicDataset
} from "../apps/web/lib/staged-public-data";
import { getChangeRecords } from "../apps/web/lib/change-records";
import { getEntityAliasResolver } from "../apps/web/lib/entity-aliases";
import { normalizeEntityAliasName } from "@uapt/shared";

// Regenerates the derived knowledge/ snapshots from the current release merge
// so they can no longer drift behind release promotions. Run after each
// promotion (pnpm knowledge:update). Pass --review to also write a dated
// public-vs-staging-vs-QS review note under knowledge/reviews/.

const WRITE_REVIEW = process.argv.includes("--review");

interface QsRow {
  rankNumber: number;
  name: string;
}

async function main() {
  const repoRoot = process.cwd();
  const generatedAt = new Date().toISOString();
  const manifest = await getCurrentPublicReleaseManifest();
  if (!manifest) throw new Error("No current public release manifest found.");
  const dataset = await getStagedPublicDataset();
  const changeRecords = await getChangeRecords();
  const aliasResolver = await getEntityAliasResolver();

  const summaries = dataset.publicSummaries;
  let claims = 0;
  let evidence = 0;
  let sources = 0;
  const claimStates = new Map<string, number>();
  const entityStates = new Map<string, number>();
  const languages = new Map<string, number>();

  for (const summary of summaries) {
    sources += summary.officialSources.length;
    entityStates.set(
      summary.reviewState,
      (entityStates.get(summary.reviewState) ?? 0) + 1
    );
    for (const claim of summary.claims) {
      claims += 1;
      evidence += claim.evidence.length;
      claimStates.set(
        claim.reviewState,
        (claimStates.get(claim.reviewState) ?? 0) + 1
      );
      for (const item of claim.evidence) {
        if (item.sourceLanguage) {
          languages.set(
            item.sourceLanguage,
            (languages.get(item.sourceLanguage) ?? 0) + 1
          );
        }
      }
    }
  }

  const rankingIndex = JSON.parse(
    await readFile(
      path.join(repoRoot, "data", "rankings", "ranking-index.json"),
      "utf8"
    )
  ) as {
    sources: Array<{
      rankingSystemId: string;
      rankingYear: number | string;
      recordCount?: number;
      status?: string;
    }>;
  };
  const rankingCoverage = rankingIndex.sources.map((ranking) => {
    const covered = dataset.catalogUniversities.filter((university) =>
      university.rankings.some(
        (item) => item.systemId === ranking.rankingSystemId
      )
    ).length;

    return {
      systemId: ranking.rankingSystemId,
      year: ranking.rankingYear,
      covered,
      rows: ranking.recordCount ?? 0,
      expected: 1000,
      status: ranking.status ?? "unknown"
    };
  });

  const qsTop100 = JSON.parse(
    await readFile(
      path.join(
        repoRoot,
        "data",
        "rankings",
        "qs-world-university-rankings-2026-top-100.json"
      ),
      "utf8"
    )
  ) as { universities: QsRow[] };

  const publicByName = new Map(
    summaries.map((summary) => [
      normalizeEntityAliasName(summary.entity.name),
      summary.entity.slug
    ])
  );
  const publicSlugs = new Set(summaries.map((summary) => summary.entity.slug));
  const stagingDirs = await listStagingDirs(repoRoot);
  const promoted = new Set(
    manifest.includeStagedArtifactDirectories.map((dir) =>
      path.basename(dir)
    )
  );
  const unpromoted = stagingDirs.filter((dir) => !promoted.has(dir));

  const qsRows = qsTop100.universities.map((row) => {
    const slugGuess = slugifyName(row.name);
    const canonical =
      aliasResolver.nameAliases.get(normalizeEntityAliasName(row.name)) ??
      aliasResolver.slugAliases.get(slugGuess) ??
      slugGuess;
    const isPublic =
      publicSlugs.has(canonical) ||
      publicByName.has(normalizeEntityAliasName(row.name));
    const inStaging = unpromoted.some((dir) => dir.includes(canonical));

    return {
      rank: row.rankNumber,
      name: row.name,
      status: isPublic ? "public" : inStaging ? "staging only" : "missing"
    };
  });
  const qsPublic = qsRows.filter((row) => row.status === "public").length;
  const qsStaging = qsRows.filter((row) => row.status === "staging only").length;
  const qsMissing = qsRows.filter((row) => row.status === "missing").length;

  const releaseSnapshot = buildCurrentReleaseSnapshot({
    generatedAt,
    manifest,
    universities: summaries.length,
    claims,
    evidence,
    sources,
    changeRecords: changeRecords.length,
    entityStates,
    claimStates,
    languages,
    rankingCoverage
  });
  await writeFile(
    path.join(repoRoot, "knowledge", "crawl-runs", "current-public-release.md"),
    releaseSnapshot,
    "utf8"
  );

  const unpromotedSnapshot = buildUnpromotedSnapshot({
    generatedAt,
    stagingDirs,
    promoted,
    unpromoted
  });
  await writeFile(
    path.join(repoRoot, "knowledge", "crawl-runs", "unpromoted-staging-runs.md"),
    unpromotedSnapshot,
    "utf8"
  );

  const qsSnapshot = buildQsCoverageSnapshot({
    generatedAt,
    qsRows,
    qsPublic,
    qsStaging,
    qsMissing
  });
  await writeFile(
    path.join(repoRoot, "knowledge", "rankings", "qs-2026-coverage.md"),
    qsSnapshot,
    "utf8"
  );

  const written = [
    "knowledge/crawl-runs/current-public-release.md",
    "knowledge/crawl-runs/unpromoted-staging-runs.md",
    "knowledge/rankings/qs-2026-coverage.md"
  ];

  if (WRITE_REVIEW) {
    const reviewDate = generatedAt.slice(0, 10);
    const reviewPath = path.join(
      "knowledge",
      "reviews",
      `${reviewDate}-public-vs-staging-vs-qs.md`
    );
    await writeFile(
      path.join(repoRoot, reviewPath),
      buildReviewNote({
        generatedAt,
        manifest,
        universities: summaries.length,
        claims,
        qsPublic,
        qsStaging,
        qsMissing,
        unpromotedCount: unpromoted.length
      }),
      "utf8"
    );
    written.push(reviewPath);
  }

  console.log(`Knowledge snapshots updated:\n${written.map((file) => `- ${file}`).join("\n")}`);
}

function frontmatter(options: {
  title: string;
  generatedAt: string;
  sourceFiles: string[];
  refreshCadence: string;
  canonicalBoundary: string;
}): string {
  return [
    "---",
    `title: ${options.title}`,
    "authoritativeLevel: derived_snapshot",
    `generatedAt: ${options.generatedAt}`,
    "sourceFiles:",
    ...options.sourceFiles.map((file) => `  - ${file}`),
    "sourceCommands:",
    "  - pnpm knowledge:update",
    `refreshCadence: ${options.refreshCadence}`,
    `canonicalBoundary: ${options.canonicalBoundary}`,
    "---",
    ""
  ].join("\n");
}

function statesTable(scope: string, states: Map<string, number>): string[] {
  return [...states.entries()]
    .sort((left, right) => right[1] - left[1])
    .map(([state, count]) => `| ${scope} | \`${state}\` | ${count} |`);
}

function buildCurrentReleaseSnapshot(input: {
  generatedAt: string;
  manifest: { releaseId: string; publishedAt: string; includeStagedArtifactDirectories: string[] };
  universities: number;
  claims: number;
  evidence: number;
  sources: number;
  changeRecords: number;
  entityStates: Map<string, number>;
  claimStates: Map<string, number>;
  languages: Map<string, number>;
  rankingCoverage: Array<{
    systemId: string;
    year: number | string;
    covered: number;
    rows: number;
    expected: number;
    status: string;
  }>;
}): string {
  const topLanguages = [...input.languages.entries()]
    .sort((left, right) => right[1] - left[1])
    .slice(0, 12)
    .map(([language, count]) => `| \`${language}\` | ${count} |`);

  return `${frontmatter({
    title: "Current Public Release",
    generatedAt: input.generatedAt,
    sourceFiles: [
      "data/public-releases/current.json",
      "data/entity-aliases.json",
      "data/rankings/ranking-index.json",
      "apps/web/lib/staged-public-data.ts"
    ],
    refreshCadence: "after each public release promotion",
    canonicalBoundary:
      "This file is a retrieval summary only and cannot create public claims."
  })}# Current Public Release

This snapshot summarizes the current public release manifest and the staged
public merge. It is for retrieval and planning only. The public release
manifest and generated public JSON remain authoritative for what is promoted.

## Release Manifest

- Release ID: \`${input.manifest.releaseId}\`
- Published at: \`${input.manifest.publishedAt}\`
- Promoted artifact directories: ${input.manifest.includeStagedArtifactDirectories.length}

## Public Dataset Summary

| Metric | Value |
| --- | ---: |
| Public universities | ${input.universities} |
| Public claims | ${input.claims} |
| Evidence records | ${input.evidence} |
| Official source attributions | ${input.sources} |
| Public recent-change records | ${input.changeRecords} |

Duplicate university identities are merged through \`data/entity-aliases.json\`
before counting.

## Review State Summary

| Scope | State | Count |
| --- | --- | ---: |
${[...statesTable("Entity", input.entityStates), ...statesTable("Claim", input.claimStates)].join("\n")}

Review state is not the same as confidence. This snapshot does not change any
review state.

## Source Language Distribution (top 12)

Original-language evidence remains canonical. ${input.languages.size} language
tags appear across the evidence set.

| Source language | Evidence count |
| --- | ---: |
${topLanguages.join("\n")}

## Ranking Coverage In Public Dataset

This table reports ranking metadata coverage for the ${input.universities}
public universities. It does not imply that all rows in the ranking sources are
covered.

| Ranking source | Public coverage | Source rows | Source status |
| --- | ---: | ---: | --- |
${input.rankingCoverage
  .map(
    (ranking) =>
      `| ${ranking.systemId} ${ranking.year} | ${ranking.covered}/${input.universities} | ${ranking.rows}/${ranking.expected} | ${ranking.status} |`
  )
  .join("\n")}
`;
}

function buildUnpromotedSnapshot(input: {
  generatedAt: string;
  stagingDirs: string[];
  promoted: Set<string>;
  unpromoted: string[];
}): string {
  return `${frontmatter({
    title: "Unpromoted Staging Runs",
    generatedAt: input.generatedAt,
    sourceFiles: [
      "data/public-releases/current.json",
      "staging/uapt-runs/"
    ],
    refreshCadence: "after each public release promotion or staged run",
    canonicalBoundary:
      "This file is a staging review summary only. Unpromoted runs are not public data."
  })}# Unpromoted Staging Runs

This file lists staging directories under \`staging/uapt-runs/\` that are not
listed in \`data/public-releases/current.json\`. Unpromoted data must not be
used by public pages or public JSON until a run is reviewed, validated, added
to the public release manifest, and re-audited.

## Summary

| Category | Count |
| --- | ---: |
| Staging directories checked | ${input.stagingDirs.length} |
| Manifest-promoted staging directories | ${input.stagingDirs.length - input.unpromoted.length} |
| Unpromoted staging directories | ${input.unpromoted.length} |

## Unpromoted Directories

${input.unpromoted.length ? input.unpromoted.map((dir) => `- \`staging/uapt-runs/${dir}\``).join("\n") : "None."}
`;
}

function buildQsCoverageSnapshot(input: {
  generatedAt: string;
  qsRows: Array<{ rank: number; name: string; status: string }>;
  qsPublic: number;
  qsStaging: number;
  qsMissing: number;
}): string {
  const queue = input.qsRows
    .filter((row) => row.status !== "public")
    .slice(0, 25)
    .map(
      (row, index) =>
        `| ${index + 1} | ${row.rank} | ${row.name} | ${row.status} | ${
          row.status === "staging only"
            ? "Review the unpromoted staged run and decide whether to promote"
            : "Discover and stage official AI policy sources"
        } |`
    );

  return `${frontmatter({
    title: "QS 2026 Coverage",
    generatedAt: input.generatedAt,
    sourceFiles: [
      "data/rankings/qs-world-university-rankings-2026-top-100.json",
      "data/public-releases/current.json",
      "data/entity-aliases.json",
      "staging/uapt-runs/"
    ],
    refreshCadence:
      "after each public release promotion or ranking source update",
    canonicalBoundary:
      "Ranking coverage is crawl-planning metadata only and cannot create public claims."
  })}# QS 2026 Coverage

This snapshot tracks coverage against the QS World University Rankings 2026
top 100 target list. Entity aliases from \`data/entity-aliases.json\` are used
for exact name/slug joins.

## Summary

| Status | Count |
| --- | ---: |
| Public | ${input.qsPublic} |
| Staging only / unpromoted | ${input.qsStaging} |
| Missing | ${input.qsMissing} |
| Total QS top 100 rows | ${input.qsRows.length} |

## Immediate Crawl/Review Queue (top 25)

| Priority | QS rank | University | Status | Recommended action |
| ---: | ---: | --- | --- | --- |
${queue.length ? queue.join("\n") : "| - | - | none | - | Queue is empty |"}
`;
}

function buildReviewNote(input: {
  generatedAt: string;
  manifest: { releaseId: string };
  universities: number;
  claims: number;
  qsPublic: number;
  qsStaging: number;
  qsMissing: number;
  unpromotedCount: number;
}): string {
  return `${frontmatter({
    title: `Public vs Staging vs QS Review ${input.generatedAt.slice(0, 10)}`,
    generatedAt: input.generatedAt,
    sourceFiles: [
      "data/public-releases/current.json",
      "knowledge/crawl-runs/current-public-release.md",
      "knowledge/rankings/qs-2026-coverage.md"
    ],
    refreshCadence: "dated review note; superseded by newer review notes",
    canonicalBoundary:
      "This file is a review note only and cannot create public claims."
  })}# Public vs Staging vs QS Review (${input.generatedAt.slice(0, 10)})

- Current release: \`${input.manifest.releaseId}\` with ${input.universities}
  public universities and ${input.claims} public claims (entity aliases merged).
- QS top 100: ${input.qsPublic} public, ${input.qsStaging} staging only,
  ${input.qsMissing} missing.
- Unpromoted staging directories: ${input.unpromotedCount}.
- Derived snapshots regenerated by \`pnpm knowledge:update\` on
  ${input.generatedAt.slice(0, 10)}; see the snapshot files for tables.
`;
}

function slugifyName(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function listStagingDirs(repoRoot: string): Promise<string[]> {
  try {
    const entries = await readdir(path.join(repoRoot, "staging", "uapt-runs"), {
      withFileTypes: true
    });

    return entries
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort();
  } catch {
    return [];
  }
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
