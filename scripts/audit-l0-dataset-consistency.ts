/**
 * L0 offline consistency audit for the full 858-university re-check.
 *
 * This script never touches the network. It compares three offline layers:
 *
 *   1. raw staged artifacts on disk (the original crawl output)
 *   2. the release manifests in data/public-releases (what later updates kept)
 *   3. the dataset the public site actually serves today
 *
 * It reports ingest losses, referential breaks, publish drop-out reasons,
 * duplicate/contradiction candidates, evidence-anchor usability for the later
 * live-verification stages, and release-history regressions.
 *
 * Output goes to .local/full-audit/<run-id>/ which is gitignored. The script is
 * read-only: it never edits staged artifacts, claims, review states, or
 * releases.
 */
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  openClawStagedArtifactSchema,
  type OpenClawStagedArtifact,
  type StagedClaimCandidate,
  type StagedEvidenceCandidate,
  type StagedReviewDecision,
  type StagedSourceCandidate,
  type StagedSourceSnapshot
} from "@uapt/shared";
import { getEntityAliasResolver } from "../apps/web/lib/entity-aliases";
import { findRepoRoot } from "../apps/web/lib/repo-root";
import {
  getCurrentPublicReleaseManifest,
  getStagedPublicDataset
} from "../apps/web/lib/staged-public-data";

interface RawRecord {
  artifact: OpenClawStagedArtifact;
  dir: string;
  file: string;
}

interface ParseFailure {
  artifactType: string;
  file: string;
  issue: string;
  path: string;
}

interface BundleMeta {
  dir: string;
  file: string;
  runId?: string;
  runPurpose?: string;
  snippetPolicy?: string;
}

interface Finding {
  check: string;
  count: number;
  detail: string;
  samples: unknown[];
  severity: "high" | "medium" | "low" | "info";
}

const OUTPUT_ROOT = ".local/full-audit";
const SAMPLE_LIMIT = 25;

// Scripts writing script-family CJK/other detection: sourceLanguage -> regex the
// verbatim original snippet must satisfy to be a plausible source-language quote.
const SCRIPT_EXPECTATIONS: Array<{ pattern: RegExp; prefixes: string[] }> = [
  { prefixes: ["zh", "ja"], pattern: /[぀-ヿ㐀-鿿]/ },
  { prefixes: ["ko"], pattern: /[가-힯ᄀ-ᇿ]/ },
  { prefixes: ["ru", "uk", "bg", "sr", "mk", "be", "kk"], pattern: /[Ѐ-ӿ]/ },
  { prefixes: ["ar", "fa", "ur"], pattern: /[؀-ۿ]/ },
  { prefixes: ["he"], pattern: /[֐-׿]/ },
  { prefixes: ["el"], pattern: /[Ͱ-Ͽ]/ },
  { prefixes: ["th"], pattern: /[฀-๿]/ },
  { prefixes: ["hi", "mr", "ne"], pattern: /[ऀ-ॿ]/ }
];

void main();

async function main(): Promise<void> {
  const repoRoot = await findRepoRoot();
  const generatedAt = new Date().toISOString();
  const runId = `l0-${generatedAt.replace(/[:.]/g, "-")}`;
  const outputDir = path.join(repoRoot, OUTPUT_ROOT, runId);
  await mkdir(outputDir, { recursive: true });

  const manifest = await getCurrentPublicReleaseManifest();
  if (!manifest) throw new Error("No current public release manifest found.");

  const { slugAliases } = await getEntityAliasResolver();
  const canonicalSlug = (slug: string): string => slugAliases.get(slug) ?? slug;

  const scanRoots = ["staging/uapt-runs", "data/openclaw-staging"];
  const { bundles, failures, records } = await loadRawArtifacts(repoRoot, scanRoots);
  const manifestDirs = new Set(manifest.includeStagedArtifactDirectories);
  const inRelease = (dir: string): boolean => manifestDirs.has(dir);

  const dataset = await getStagedPublicDataset();
  const findings: Finding[] = [];

  // ---------------------------------------------------------------- ingest ---
  const dirsOnDisk = new Set(records.map((record) => record.dir));
  const claimsByDir = countBy(
    records.filter((record) => record.artifact.artifactType === "claim_candidate"),
    (record) => record.dir
  );

  findings.push({
    check: "ingest.schema_parse_failures",
    count: failures.length,
    detail:
      "Artifact objects on disk that fail openClawStagedArtifactSchema. The site loader drops these silently, so any claim inside them is invisible to the public dataset.",
    samples: failures.slice(0, SAMPLE_LIMIT),
    severity: failures.length ? "high" : "info"
  });

  const missingManifestDirs = manifest.includeStagedArtifactDirectories.filter(
    (dir) => !dirsOnDisk.has(dir)
  );
  findings.push({
    check: "manifest.dirs_missing_on_disk",
    count: missingManifestDirs.length,
    detail: "Directories listed in the release manifest that produced no parsable artifact on disk.",
    samples: missingManifestDirs.slice(0, SAMPLE_LIMIT),
    severity: missingManifestDirs.length ? "high" : "info"
  });

  const excludedDirs = Array.from(dirsOnDisk)
    .filter((dir) => !inRelease(dir))
    .map((dir) => ({ dir, stagedClaims: claimsByDir.get(dir) ?? 0 }))
    .sort((left, right) => right.stagedClaims - left.stagedClaims);
  findings.push({
    check: "manifest.dirs_excluded_from_release",
    count: excludedDirs.length,
    detail:
      "Staged run directories present on disk but not included by the current release manifest. Claim counts show how much data is withheld from the public dataset.",
    samples: excludedDirs.slice(0, SAMPLE_LIMIT),
    severity: excludedDirs.some((entry) => entry.stagedClaims > 0) ? "medium" : "info"
  });

  const bundlesWithoutSnippetPolicy = bundles.filter((bundle) => !bundle.snippetPolicy);
  findings.push({
    check: "ingest.bundles_without_snippet_policy",
    count: bundlesWithoutSnippetPolicy.length,
    detail:
      "Artifact bundles that do not declare snippetPolicy. Per the schema these fall back to legacy_display semantics, so evidenceSnippetOriginal is not guaranteed verbatim source text.",
    samples: bundlesWithoutSnippetPolicy.slice(0, SAMPLE_LIMIT).map((bundle) => bundle.dir),
    severity: bundlesWithoutSnippetPolicy.length ? "medium" : "info"
  });

  // -------------------------------------------------- referential integrity ---
  const releaseRecords = records.filter((record) => inRelease(record.dir));
  const claims = collect<StagedClaimCandidate>(releaseRecords, "claim_candidate");
  const evidences = collect<StagedEvidenceCandidate>(releaseRecords, "evidence_candidate");
  const snapshots = collect<StagedSourceSnapshot>(releaseRecords, "source_snapshot");
  const sources = collect<StagedSourceCandidate>(releaseRecords, "source_candidate");
  const reviews = collect<StagedReviewDecision>(releaseRecords, "review_decision");

  const evidenceByKey = new Map(
    evidences.map((item) => [scoped(item.artifact.runId, item.artifact.evidenceId), item])
  );
  const claimByKey = new Map(
    claims.map((item) => [scoped(item.artifact.runId, item.artifact.claimId), item])
  );
  const snapshotByKey = new Map(
    snapshots.map((item) => [scoped(item.artifact.runId, item.artifact.sourceSnapshotId), item])
  );
  const sourceByKey = new Map(
    sources.map((item) => [
      scoped(item.artifact.runId, item.artifact.sourceCandidateId),
      item
    ])
  );

  const claimsMissingEvidence = claims
    .map((item) => ({
      claimId: item.artifact.claimId,
      dir: item.dir,
      entitySlug: canonicalSlug(item.artifact.entitySlug),
      missing: item.artifact.evidenceIds.filter(
        (evidenceId) => !evidenceByKey.has(scoped(item.artifact.runId, evidenceId))
      ),
      runId: item.artifact.runId
    }))
    .filter((entry) => entry.missing.length > 0);
  findings.push({
    check: "integrity.claim_evidence_ids_unresolved",
    count: claimsMissingEvidence.length,
    detail:
      "Claims referencing evidenceIds that do not exist in the same run. Claims that lose every evidence reference are dropped from the public dataset without any error.",
    samples: claimsMissingEvidence.slice(0, SAMPLE_LIMIT),
    severity: claimsMissingEvidence.length ? "high" : "info"
  });

  const orphanEvidence = evidences.filter(
    (item) => !claimByKey.has(scoped(item.artifact.runId, item.artifact.claimId))
  );
  findings.push({
    check: "integrity.evidence_orphaned",
    count: orphanEvidence.length,
    detail: "Evidence artifacts whose claimId does not resolve inside the same run.",
    samples: orphanEvidence.slice(0, SAMPLE_LIMIT).map((item) => ({
      claimId: item.artifact.claimId,
      dir: item.dir,
      evidenceId: item.artifact.evidenceId
    })),
    severity: orphanEvidence.length ? "medium" : "info"
  });

  const evidenceMissingSnapshot = evidences.filter(
    (item) => !snapshotByKey.has(scoped(item.artifact.runId, item.artifact.sourceSnapshotId))
  );
  findings.push({
    check: "integrity.evidence_snapshot_unresolved",
    count: evidenceMissingSnapshot.length,
    detail:
      "Evidence artifacts whose sourceSnapshotId does not resolve. These still publish, but their provenance chain to a fetched snapshot is broken.",
    samples: evidenceMissingSnapshot.slice(0, SAMPLE_LIMIT).map((item) => ({
      dir: item.dir,
      evidenceId: item.artifact.evidenceId,
      sourceSnapshotId: item.artifact.sourceSnapshotId,
      sourceUrl: item.artifact.sourceUrl
    })),
    severity: evidenceMissingSnapshot.length ? "medium" : "info"
  });

  const snapshotMissingSource = snapshots.filter(
    (item) =>
      item.artifact.sourceCandidateId &&
      !sourceByKey.has(scoped(item.artifact.runId, item.artifact.sourceCandidateId))
  );
  findings.push({
    check: "integrity.snapshot_source_candidate_unresolved",
    count: snapshotMissingSource.length,
    detail:
      "Snapshots pointing at a sourceCandidateId that does not resolve. buildOfficialSources cannot attach these, so the source can silently disappear from the public record.",
    samples: snapshotMissingSource.slice(0, SAMPLE_LIMIT).map((item) => ({
      dir: item.dir,
      sourceCandidateId: item.artifact.sourceCandidateId,
      sourceSnapshotId: item.artifact.sourceSnapshotId
    })),
    severity: snapshotMissingSource.length ? "medium" : "info"
  });

  const reviewsMissingClaim = reviews.filter(
    (item) => !claimByKey.has(scoped(item.artifact.runId, item.artifact.claimId))
  );
  findings.push({
    check: "integrity.review_decision_claim_unresolved",
    count: reviewsMissingClaim.length,
    detail: "Review decisions referencing a claimId that does not resolve in the same run.",
    samples: reviewsMissingClaim.slice(0, SAMPLE_LIMIT).map((item) => ({
      claimId: item.artifact.claimId,
      decision: item.artifact.decision,
      dir: item.dir
    })),
    severity: reviewsMissingClaim.length ? "low" : "info"
  });

  // ------------------------------------------------ publish drop-out reasons ---
  const publishedKeys = new Set<string>();
  const publishedClaimIds = new Map<string, number>();
  for (const summary of dataset.publicSummaries) {
    for (const claim of summary.claims) {
      publishedKeys.add(publishKey(summary.entity.slug, claim.claimText));
      publishedClaimIds.set(claim.id, (publishedClaimIds.get(claim.id) ?? 0) + 1);
    }
  }
  const publishedSlugs = new Set(dataset.publicSummaries.map((summary) => summary.entity.slug));
  const latestReviewByClaim = newestReviewByClaim(reviews);

  const dropouts = new Map<string, number>();
  const dropoutSamples: Array<Record<string, unknown>> = [];
  for (const item of claims) {
    const slug = canonicalSlug(item.artifact.entitySlug);
    if (publishedKeys.has(publishKey(slug, item.artifact.claimText))) continue;

    const review = latestReviewByClaim.get(scoped(item.artifact.runId, item.artifact.claimId));
    const resolvedEvidence = item.artifact.evidenceIds.filter((evidenceId) =>
      evidenceByKey.has(scoped(item.artifact.runId, evidenceId))
    );
    const reason =
      item.artifact.entityType !== "university"
        ? "non_university_entity"
        : review?.decision === "reject"
          ? "review_rejected"
          : resolvedEvidence.length === 0
            ? "no_resolvable_evidence"
            : !publishedSlugs.has(slug)
              ? "entity_absent_from_public_dataset"
              : "deduped_or_superseded";

    dropouts.set(reason, (dropouts.get(reason) ?? 0) + 1);
    if (dropoutSamples.length < 60) {
      dropoutSamples.push({
        claimId: item.artifact.claimId,
        claimType: item.artifact.claimType,
        dir: item.dir,
        entitySlug: slug,
        reason
      });
    }
  }

  const stagedClaimTotal = records.filter(
    (record) => record.artifact.artifactType === "claim_candidate"
  ).length;
  const publishedClaimTotal = dataset.publicSummaries.reduce(
    (total, summary) => total + summary.claims.length,
    0
  );

  const distinctStagedClaimTexts = new Set(
    claims.map((item) => publishKey(canonicalSlug(item.artifact.entitySlug), item.artifact.claimText))
  ).size;
  findings.push({
    check: "publish.duplicate_staged_claims_collapsed",
    count: claims.length - distinctStagedClaimTexts,
    detail: `In-release staged claim rows that repeat an entity + claim text already staged by another run. ${claims.length} staged rows carry ${distinctStagedClaimTexts} distinct entity/claim-text pairs, and the loader publishes ${publishedClaimTotal} rows. Re-emitting the same claim across runs is how the staged total drifts away from the published total.`,
    samples: [],
    severity: "info"
  });

  findings.push({
    check: "publish.dropout_reasons",
    count: Array.from(dropouts.values()).reduce((total, value) => total + value, 0),
    detail: `In-release staged claims that never reach the public dataset, by reason. Staged total on disk: ${stagedClaimTotal}; in-release staged claims: ${claims.length}; published claims: ${publishedClaimTotal}.`,
    samples: [Object.fromEntries(dropouts), ...dropoutSamples],
    severity: (dropouts.get("no_resolvable_evidence") ?? 0) > 0 ? "high" : "medium"
  });

  const collidingClaimIds = Array.from(publishedClaimIds.entries())
    .filter(([, count]) => count > 1)
    .map(([id, count]) => ({ claimId: id, publishedRows: count }));
  findings.push({
    check: "publish.claim_id_collisions",
    count: collidingClaimIds.length,
    detail:
      "Public claim ids that appear on more than one published row. Claim ids are not run-scoped in the public payload, so collisions make per-claim citation and change tracking ambiguous.",
    samples: collidingClaimIds.slice(0, SAMPLE_LIMIT),
    severity: collidingClaimIds.length ? "medium" : "info"
  });

  // ---------------------------------------------------- entity identity ---
  const byDisplayName = new Map<string, string[]>();
  const bySlugShape = new Map<string, string[]>();
  const summaryBySlug = new Map(
    dataset.publicSummaries.map((summary) => [summary.entity.slug, summary])
  );
  for (const summary of dataset.publicSummaries) {
    const nameKey = summary.entity.name.toLowerCase().replace(/[^a-z0-9]/g, "");
    byDisplayName.set(nameKey, [...(byDisplayName.get(nameKey) ?? []), summary.entity.slug]);
    const slugKey = normalizeSlugShape(summary.entity.slug);
    bySlugShape.set(slugKey, [...(bySlugShape.get(slugKey) ?? []), summary.entity.slug]);
  }
  const duplicateGroups = new Map<string, string[]>();
  for (const [, slugs] of [...byDisplayName, ...bySlugShape]) {
    if (slugs.length < 2) continue;
    duplicateGroups.set([...slugs].sort().join("|"), slugs);
  }
  const duplicateEntities = Array.from(duplicateGroups.values()).map((slugs) =>
    slugs
      .map((slug) => {
        const summary = summaryBySlug.get(slug);
        return {
          claims: summary?.claims.length ?? 0,
          entitySlug: slug,
          lastCheckedAt: summary?.lastCheckedAt,
          name: summary?.entity.name,
          sources: summary?.officialSources.length ?? 0
        };
      })
      .sort((left, right) => right.sources - left.sources || right.claims - left.claims)
  );
  findings.push({
    check: "identity.duplicate_entity_records",
    count: duplicateEntities.length,
    detail:
      "Groups of published records that describe the same university under more than one slug. Each group splits that university's claims across two public pages and inflates the entity count. Resolve by adding the non-canonical slug to data/entity-aliases.json.",
    samples: duplicateEntities.slice(0, SAMPLE_LIMIT),
    severity: duplicateEntities.length ? "high" : "info"
  });

  // ------------------------------------------- excluded directory coverage ---
  const excludedCoverage = buildExcludedCoverage(
    records.filter((record) => !inRelease(record.dir)),
    dataset,
    canonicalSlug
  );
  findings.push({
    check: "release.excluded_claims_without_published_counterpart",
    count: excludedCoverage.uncovered.length,
    detail: `Claims in excluded staged directories with no published claim on the same entity and source URL. Excluded staged claims: ${excludedCoverage.total}; superseded by a published claim on the same source: ${excludedCoverage.coveredCount}. Entities that exist only in excluded directories: ${excludedCoverage.entitiesAbsent.length}.`,
    samples: [
      { entitiesAbsentFromPublicDataset: excludedCoverage.entitiesAbsent },
      ...excludedCoverage.uncovered.slice(0, SAMPLE_LIMIT)
    ],
    severity: excludedCoverage.uncovered.length ? "medium" : "info"
  });

  // ------------------------------------------------ evidence anchor quality ---
  const publishedEvidence = dataset.publicSummaries.flatMap((summary) =>
    summary.claims.flatMap((claim) =>
      claim.evidence.map((evidence) => ({
        claimId: claim.id,
        entitySlug: summary.entity.slug,
        evidence
      }))
    )
  );
  const evidenceLanguageBySnippet = new Map<string, string>();
  for (const item of evidences) {
    evidenceLanguageBySnippet.set(
      item.artifact.evidenceSnippetOriginal,
      item.artifact.sourceLanguage
    );
  }

  const scriptMismatch: Array<Record<string, unknown>> = [];
  const shortSnippets: Array<Record<string, unknown>> = [];
  const truncatedSnippets: Array<Record<string, unknown>> = [];
  for (const item of publishedEvidence) {
    const snippet = item.evidence.evidenceSnippet;
    const language =
      item.evidence.sourceLanguage ?? evidenceLanguageBySnippet.get(snippet) ?? "unknown";
    const expectation = SCRIPT_EXPECTATIONS.find((entry) =>
      entry.prefixes.some((prefix) => language.toLowerCase().startsWith(prefix))
    );
    if (expectation && !expectation.pattern.test(snippet)) {
      scriptMismatch.push({
        entitySlug: item.entitySlug,
        language,
        snippetHead: snippet.slice(0, 90),
        sourceUrl: item.evidence.sourceUrl
      });
    }
    if (snippet.trim().length < 40) {
      shortSnippets.push({
        entitySlug: item.entitySlug,
        snippet,
        sourceUrl: item.evidence.sourceUrl
      });
    }
    if (/(\.\.\.|…)\s*$/.test(snippet.trim())) {
      truncatedSnippets.push({
        entitySlug: item.entitySlug,
        snippetTail: snippet.slice(-60),
        sourceUrl: item.evidence.sourceUrl
      });
    }
  }

  findings.push({
    check: "anchor.snippet_script_mismatch",
    count: scriptMismatch.length,
    detail:
      "Published evidence whose sourceLanguage implies a non-Latin script but whose snippet contains none. These snippets are probably translations, so they cannot be matched verbatim against the live page in L2.",
    samples: scriptMismatch.slice(0, SAMPLE_LIMIT),
    severity: scriptMismatch.length ? "high" : "info"
  });
  findings.push({
    check: "anchor.snippet_too_short",
    count: shortSnippets.length,
    detail:
      "Published evidence snippets under 40 characters. Short anchors produce false matches during live verification and need a fallback strategy.",
    samples: shortSnippets.slice(0, SAMPLE_LIMIT),
    severity: shortSnippets.length ? "medium" : "info"
  });
  findings.push({
    check: "anchor.snippet_truncated",
    count: truncatedSnippets.length,
    detail: "Published evidence snippets ending in an ellipsis; exact matching will fail on these.",
    samples: truncatedSnippets.slice(0, SAMPLE_LIMIT),
    severity: truncatedSnippets.length ? "medium" : "info"
  });

  // ---------------------------------------------- duplicates and conflicts ---
  const snippetToEntities = new Map<string, Set<string>>();
  for (const item of publishedEvidence) {
    const key = normalizeText(item.evidence.evidenceSnippet);
    const bucket = snippetToEntities.get(key) ?? new Set<string>();
    bucket.add(item.entitySlug);
    snippetToEntities.set(key, bucket);
  }
  const crossEntitySnippets = Array.from(snippetToEntities.entries())
    .filter(([, slugs]) => slugs.size > 1)
    .map(([key, slugs]) => ({ entitySlugs: Array.from(slugs), snippetHead: key.slice(0, 110) }));
  findings.push({
    check: "conflict.snippet_shared_across_entities",
    count: crossEntitySnippets.length,
    detail:
      "Identical evidence snippets published under more than one university. Usually copy-paste contamination or a mis-attributed source.",
    samples: crossEntitySnippets.slice(0, SAMPLE_LIMIT),
    severity: crossEntitySnippets.length ? "high" : "info"
  });

  const claimsByEntityTypeUrl = new Map<string, Set<string>>();
  for (const summary of dataset.publicSummaries) {
    for (const claim of summary.claims) {
      for (const evidence of claim.evidence) {
        const key = `${summary.entity.slug} ${claim.claimType} ${evidence.sourceUrl}`;
        const bucket = claimsByEntityTypeUrl.get(key) ?? new Set<string>();
        bucket.add(claim.claimText);
        claimsByEntityTypeUrl.set(key, bucket);
      }
    }
  }
  const multiClaimSurfaces = Array.from(claimsByEntityTypeUrl.entries())
    .filter(([, texts]) => texts.size > 1)
    .map(([key, texts]) => {
      const [entitySlug, claimType, sourceUrl] = key.split(" ");
      return { claimCount: texts.size, claimType, entitySlug, sourceUrl };
    })
    .sort((left, right) => right.claimCount - left.claimCount);
  findings.push({
    check: "conflict.same_type_multiple_claims_per_source",
    count: multiClaimSurfaces.length,
    detail:
      "Entity + claimType + source URL combinations carrying more than one published claim text. Not automatically wrong, but this is where contradictions and stale duplicates hide; feed the top of this list into L3 semantic review.",
    samples: multiClaimSurfaces.slice(0, SAMPLE_LIMIT),
    severity: "low"
  });

  const hostToEntities = new Map<string, Set<string>>();
  for (const summary of dataset.publicSummaries) {
    for (const source of summary.officialSources) {
      const host = safeHost(source.sourceUrl);
      if (!host) continue;
      const bucket = hostToEntities.get(host) ?? new Set<string>();
      bucket.add(summary.entity.slug);
      hostToEntities.set(host, bucket);
    }
  }
  const sharedHosts = Array.from(hostToEntities.entries())
    .filter(([, slugs]) => slugs.size > 1)
    .map(([host, slugs]) => ({ entitySlugs: Array.from(slugs).slice(0, 8), host }));
  findings.push({
    check: "conflict.source_host_shared_across_entities",
    count: sharedHosts.length,
    detail:
      "Source hosts cited by more than one university record. Legitimate for shared systems and national portals, suspicious for a university's own domain.",
    samples: sharedHosts.slice(0, SAMPLE_LIMIT),
    severity: sharedHosts.length ? "medium" : "info"
  });

  // ------------------------------------------------------- citation hygiene ---
  const citationHashMissing: Array<Record<string, unknown>> = [];
  const citationHashMismatch: Array<Record<string, unknown>> = [];
  const citationUrlMismatch: Array<Record<string, unknown>> = [];
  for (const item of claims) {
    const evidenceForClaim = item.artifact.evidenceIds
      .map((evidenceId) => evidenceByKey.get(scoped(item.artifact.runId, evidenceId)))
      .filter((entry): entry is RawRecord & { artifact: StagedEvidenceCandidate } =>
        Boolean(entry)
      );
    if (!evidenceForClaim.length) continue;

    const hashes = new Set(evidenceForClaim.map((entry) => entry.artifact.snapshotHash));
    const urls = new Set(evidenceForClaim.map((entry) => entry.artifact.sourceUrl));
    const citationHash = item.artifact.citation.snapshotHash;
    if (!citationHash) {
      citationHashMissing.push({
        claimId: item.artifact.claimId,
        dir: item.dir,
        entitySlug: canonicalSlug(item.artifact.entitySlug)
      });
    } else if (!hashes.has(citationHash)) {
      citationHashMismatch.push({
        citationHash,
        claimId: item.artifact.claimId,
        dir: item.dir,
        evidenceHashes: Array.from(hashes)
      });
    }
    if (!urls.has(item.artifact.citation.sourceUrl)) {
      citationUrlMismatch.push({
        citationUrl: item.artifact.citation.sourceUrl,
        claimId: item.artifact.claimId,
        dir: item.dir,
        evidenceUrls: Array.from(urls)
      });
    }
  }
  findings.push({
    check: "citation.hash_missing",
    count: citationHashMissing.length,
    detail:
      "Claims that carry no citation.snapshotHash at all. Their public citation has no snapshot identity, so release-to-release change detection cannot anchor on them.",
    samples: citationHashMissing.slice(0, SAMPLE_LIMIT),
    severity: citationHashMissing.length ? "medium" : "info"
  });
  findings.push({
    check: "citation.hash_not_in_evidence",
    count: citationHashMismatch.length,
    detail:
      "Claims whose citation.snapshotHash is set but matches none of their own evidence snapshot hashes. The public citation then points at a snapshot the evidence does not come from.",
    samples: citationHashMismatch.slice(0, SAMPLE_LIMIT),
    severity: citationHashMismatch.length ? "high" : "info"
  });
  findings.push({
    check: "citation.url_not_in_evidence",
    count: citationUrlMismatch.length,
    detail: "Claims whose citation.sourceUrl matches none of their own evidence source URLs.",
    samples: citationUrlMismatch.slice(0, SAMPLE_LIMIT),
    severity: citationUrlMismatch.length ? "high" : "info"
  });

  const fabricatedHashes: Array<Record<string, unknown>> = [];
  for (const item of records) {
    const pairs: Array<[string, string | undefined]> = [];
    if (item.artifact.artifactType === "claim_candidate") {
      pairs.push(["claim.citation.snapshotHash", item.artifact.citation.snapshotHash]);
    }
    if (item.artifact.artifactType === "evidence_candidate") {
      pairs.push(["evidence.snapshotHash", item.artifact.snapshotHash]);
    }
    if (item.artifact.artifactType === "source_snapshot") {
      pairs.push(["source_snapshot.contentHash", item.artifact.contentHash]);
    }
    for (const [field, value] of pairs) {
      if (!value || !looksFabricatedHash(value)) continue;
      fabricatedHashes.push({ dir: item.dir, field, hash: value, inRelease: inRelease(item.dir) });
    }
  }
  findings.push({
    check: "citation.fabricated_hash_pattern",
    count: fabricatedHashes.length,
    detail:
      "Snapshot hashes whose bytes step by a constant value (e.g. b2c3d4e5…), which no content digest produces. These are hand-written placeholders, so the claim's snapshot provenance is not real even when its source URL is.",
    samples: fabricatedHashes.slice(0, SAMPLE_LIMIT),
    severity: fabricatedHashes.length ? "high" : "info"
  });

  const publishedAt = Date.parse(manifest.publishedAt);
  const futureRetrievals = publishedEvidence
    .filter((item) => {
      const retrieved = item.evidence.retrievedAt ? Date.parse(item.evidence.retrievedAt) : NaN;
      return Number.isFinite(retrieved) && retrieved > publishedAt + 86_400_000;
    })
    .map((item) => ({
      entitySlug: item.entitySlug,
      retrievedAt: item.evidence.retrievedAt,
      sourceUrl: item.evidence.sourceUrl
    }));
  findings.push({
    check: "citation.retrieved_after_release",
    count: futureRetrievals.length,
    detail: "Published evidence claiming a retrievedAt later than the release publishedAt.",
    samples: futureRetrievals.slice(0, SAMPLE_LIMIT),
    severity: futureRetrievals.length ? "medium" : "info"
  });

  // ------------------------------------------------------------ url hygiene ---
  const publishedUrls = new Set<string>();
  for (const summary of dataset.publicSummaries) {
    for (const source of summary.officialSources) publishedUrls.add(source.sourceUrl);
    for (const claim of summary.claims) {
      for (const evidence of claim.evidence) publishedUrls.add(evidence.sourceUrl);
    }
  }
  const insecureUrls = Array.from(publishedUrls).filter((url) => url.startsWith("http://"));
  const normalizedUrlGroups = new Map<string, string[]>();
  for (const url of publishedUrls) {
    const key = normalizeUrl(url);
    normalizedUrlGroups.set(key, [...(normalizedUrlGroups.get(key) ?? []), url]);
  }
  const nearDuplicateUrls = Array.from(normalizedUrlGroups.values()).filter(
    (group) => group.length > 1
  );

  findings.push({
    check: "url.insecure_scheme",
    count: insecureUrls.length,
    detail: "Published source URLs still on http://.",
    samples: insecureUrls.slice(0, SAMPLE_LIMIT),
    severity: insecureUrls.length ? "low" : "info"
  });
  findings.push({
    check: "url.near_duplicates",
    count: nearDuplicateUrls.length,
    detail:
      "Published URL groups that collapse to the same target after normalizing scheme, www, case, and trailing slash. Each group costs a duplicate fetch in L1 and can produce contradictory verdicts.",
    samples: nearDuplicateUrls.slice(0, SAMPLE_LIMIT),
    severity: nearDuplicateUrls.length ? "medium" : "info"
  });

  // -------------------------------------------------------- release history ---
  const history = await readReleaseHistory(repoRoot);
  const regressions: Array<Record<string, unknown>> = [];
  for (let index = 1; index < history.length; index += 1) {
    const previous = new Set(history[index - 1].dirs);
    const current = new Set(history[index].dirs);
    const removed = Array.from(previous).filter((dir) => !current.has(dir));
    if (removed.length) {
      regressions.push({
        fromRelease: history[index - 1].releaseId,
        removedCount: removed.length,
        removedSample: removed.slice(0, 8),
        toRelease: history[index].releaseId
      });
    }
  }
  findings.push({
    check: "history.dirs_removed_between_releases",
    count: regressions.length,
    detail:
      "Release transitions that dropped previously included staged directories. Each one silently removed university records from the public dataset.",
    samples: regressions.slice(0, SAMPLE_LIMIT),
    severity: regressions.length ? "medium" : "info"
  });

  // ------------------------------------------------------- ranking coverage ---
  const qsRanks = new Set<number>();
  for (const university of dataset.catalogUniversities) {
    for (const ranking of university.rankings) {
      if (ranking.systemId === "qs" && ranking.rankingYear === 2026) {
        qsRanks.add(ranking.rankNumber);
      }
    }
  }
  const unmatchedEntities = dataset.catalogUniversities
    .filter(
      (university) =>
        !university.rankings.some(
          (ranking) => ranking.systemId === "qs" && ranking.rankingYear === 2026
        )
    )
    .map((university) => university.slug);
  findings.push({
    check: "coverage.entities_without_qs_2026_match",
    count: unmatchedEntities.length,
    detail:
      "Published universities with no QS 2026 ranking match. These fall outside every QS-sharded maintenance mode and would never be scanned by the existing scheduler.",
    samples: unmatchedEntities.slice(0, SAMPLE_LIMIT),
    severity: unmatchedEntities.length ? "medium" : "info"
  });

  // ------------------------------------------------------ repair candidates ---
  const aliasCandidates = duplicateEntities
    .filter((group) => group.length > 1)
    .map((group) => {
      const [canonical, ...rest] = group;
      return rest.map((duplicate) => ({
        alias: duplicate.entitySlug,
        aliasType: "slug" as const,
        // "tie" means both records carry the same source count, so which slug
        // survives is a human call rather than an evidence-weight call.
        canonicalChoice:
          canonical.sources === duplicate.sources && canonical.claims === duplicate.claims
            ? ("tie" as const)
            : canonical.sources === duplicate.sources
              ? ("weak" as const)
              : ("clear" as const),
        canonicalSlug: canonical.entitySlug,
        entityType: "university" as const,
        evidence: {
          aliasClaims: duplicate.claims,
          aliasName: duplicate.name,
          aliasSources: duplicate.sources,
          canonicalClaims: canonical.claims,
          canonicalName: canonical.name,
          canonicalSources: canonical.sources
        },
        matchConfidence:
          canonical.name && duplicate.name && canonical.name === duplicate.name ? 1 : 0.9,
        matchReason:
          canonical.name === duplicate.name
            ? `Both published records carry the identical entity name "${canonical.name ?? ""}". Canonical record holds ${canonical.sources} official sources vs ${duplicate.sources}.`
            : `Slug shapes normalise to the same identity (${duplicate.entitySlug} vs ${canonical.entitySlug}). Canonical record holds ${canonical.sources} official sources vs ${duplicate.sources}.`,
        reviewState: "agent_proposed" as const,
        sourceSystem: "uapt_staging" as const
      }));
    })
    .flat();

  const urlCandidates = nearDuplicateUrls.map((group) => {
    const sorted = [...group].sort((left, right) => {
      const secure = Number(right.startsWith("https://")) - Number(left.startsWith("https://"));
      return secure || left.length - right.length;
    });
    return { keep: sorted[0], retire: sorted.slice(1) };
  });

  const repairCandidates = {
    entityAliases: {
      appliesTo: "data/entity-aliases.json",
      candidates: aliasCandidates,
      count: aliasCandidates.length,
      note: "Proposed slug aliases only. Applying them merges the duplicate record into the canonical page; it never creates or edits a policy claim. Review before writing to the registry."
    },
    fabricatedCitationHashes: {
      appliesTo: "staged claim_candidate.citation.snapshotHash",
      candidates: fabricatedHashes,
      count: fabricatedHashes.length,
      note: "Placeholder digests. Re-fetch the cited URL in L1 and replace with the real snapshot hash, or drop the hash and treat the claim as URL-anchored only."
    },
    generatedAt,
    insecureSourceUrls: {
      appliesTo: "source URL normalisation (L1 fetch)",
      candidates: insecureUrls.map((url) => ({
        current: url,
        proposed: url.replace(/^http:\/\//, "https://")
      })),
      count: insecureUrls.length,
      note: "Upgrade only after L1 confirms the https origin returns the same document."
    },
    missingCitationHashes: {
      appliesTo: "staged claim_candidate.citation.snapshotHash",
      candidates: citationHashMissing.slice(0, 500),
      count: citationHashMissing.length,
      note: "Backfill from the claim's own evidence snapshotHash during the next OpenClaw run. Not repairable offline; listed so L2 can treat these claims as unanchored."
    },
    releaseCoverage: {
      appliesTo: "data/public-releases/current.json",
      candidates: excludedCoverage.uncovered.slice(0, 500),
      count: excludedCoverage.uncovered.length,
      entitiesAbsentFromPublicDataset: excludedCoverage.entitiesAbsent,
      note: "Claims that exist on disk but have no published counterpart on the same entity + source URL. Decide per directory whether the exclusion was intentional consolidation or an accidental drop."
    },
    releaseId: manifest.releaseId,
    runId,
    schemaVersion: "uapt-full-audit-l0-repair-v1",
    urlNearDuplicates: {
      appliesTo: "source URL canonicalisation",
      candidates: urlCandidates,
      count: urlCandidates.length,
      note: "Groups whose URLs differ only by trailing slash, scheme, or www prefix. Keeping one avoids double-counting the same document as two sources."
    }
  };

  // ---------------------------------------------------------------- outputs ---
  const targets = buildLiveVerificationTargets(dataset);
  const report = {
    checks: findings,
    counts: {
      inReleaseStagedClaims: claims.length,
      inReleaseStagedEvidence: evidences.length,
      parsedArtifacts: records.length,
      publishedClaims: publishedClaimTotal,
      publishedEntities: dataset.publicSummaries.length,
      publishedEvidence: publishedEvidence.length,
      publishedSourceUrls: targets.length,
      stagedClaimsOnDisk: stagedClaimTotal,
      stagedDirsOnDisk: dirsOnDisk.size
    },
    generatedAt,
    manifest: { publishedAt: manifest.publishedAt, releaseId: manifest.releaseId },
    runId,
    scanRoots,
    schemaVersion: "uapt-full-audit-l0-v1"
  };

  await writeFile(
    path.join(outputDir, "l0-report.json"),
    `${JSON.stringify(report, null, 2)}\n`,
    "utf8"
  );
  await writeFile(
    path.join(outputDir, "l1-targets.json"),
    `${JSON.stringify(
      {
        generatedAt,
        releaseId: manifest.releaseId,
        schemaVersion: "uapt-full-audit-l1-targets-v1",
        targets
      },
      null,
      2
    )}\n`,
    "utf8"
  );
  await writeFile(
    path.join(outputDir, "l0-repair-candidates.json"),
    `${JSON.stringify(repairCandidates, null, 2)}\n`,
    "utf8"
  );
  await writeFile(path.join(outputDir, "l0-summary.md"), renderMarkdown(report), "utf8");

  console.log(`L0 audit ${runId}`);
  console.log(JSON.stringify(report.counts, null, 2));
  for (const finding of findings) {
    console.log(`${finding.severity.padEnd(6)} ${finding.check}: ${finding.count}`);
  }
  console.log(`Output: ${path.relative(repoRoot, outputDir)}`);
}

async function loadRawArtifacts(
  repoRoot: string,
  scanRoots: string[]
): Promise<{ bundles: BundleMeta[]; failures: ParseFailure[]; records: RawRecord[] }> {
  const bundles: BundleMeta[] = [];
  const failures: ParseFailure[] = [];
  const records: RawRecord[] = [];

  for (const scanRoot of scanRoots) {
    const absoluteRoot = path.join(repoRoot, scanRoot);
    let entries;
    try {
      entries = await readdir(absoluteRoot, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const dir = `${scanRoot}/${entry.name}`;
      const files = await walkJsonFiles(path.join(absoluteRoot, entry.name));

      for (const file of files) {
        const relativeFile = path.relative(repoRoot, file);
        let parsed: unknown;
        try {
          parsed = JSON.parse(await readFile(file, "utf8"));
        } catch (error) {
          failures.push({
            artifactType: "unparsable_json",
            file: relativeFile,
            issue: error instanceof Error ? error.message : String(error),
            path: ""
          });
          continue;
        }

        if (isRecord(parsed) && Array.isArray(parsed.artifacts)) {
          bundles.push({
            dir,
            file: relativeFile,
            runId: typeof parsed.runId === "string" ? parsed.runId : undefined,
            runPurpose: typeof parsed.runPurpose === "string" ? parsed.runPurpose : undefined,
            snippetPolicy:
              typeof parsed.snippetPolicy === "string" ? parsed.snippetPolicy : undefined
          });
        }

        for (const candidate of extractCandidates(parsed)) {
          const result = openClawStagedArtifactSchema.safeParse(candidate);
          if (result.success) {
            records.push({ artifact: result.data, dir, file: relativeFile });
            continue;
          }
          const issue = result.error.issues[0];
          failures.push({
            artifactType:
              isRecord(candidate) && typeof candidate.artifactType === "string"
                ? candidate.artifactType
                : "unknown",
            file: relativeFile,
            issue: issue ? issue.message : "unknown schema error",
            path: issue ? issue.path.join(".") : ""
          });
        }
      }
    }
  }

  return { bundles, failures, records };
}

function buildLiveVerificationTargets(
  dataset: Awaited<ReturnType<typeof getStagedPublicDataset>>
): Array<{
  entitySlugs: string[];
  evidenceCount: number;
  host: string;
  isPdf: boolean;
  sourceUrl: string;
}> {
  const byUrl = new Map<
    string,
    { entitySlugs: Set<string>; evidenceCount: number; sourceUrl: string }
  >();

  for (const summary of dataset.publicSummaries) {
    const register = (url: string, evidenceDelta: number): void => {
      const existing = byUrl.get(url) ?? {
        entitySlugs: new Set<string>(),
        evidenceCount: 0,
        sourceUrl: url
      };
      existing.entitySlugs.add(summary.entity.slug);
      existing.evidenceCount += evidenceDelta;
      byUrl.set(url, existing);
    };

    for (const source of summary.officialSources) register(source.sourceUrl, 0);
    for (const claim of summary.claims) {
      for (const evidence of claim.evidence) register(evidence.sourceUrl, 1);
    }
  }

  return Array.from(byUrl.values())
    .map((entry) => ({
      entitySlugs: Array.from(entry.entitySlugs),
      evidenceCount: entry.evidenceCount,
      host: safeHost(entry.sourceUrl) ?? "",
      isPdf: /\.pdf($|\?)/i.test(entry.sourceUrl),
      sourceUrl: entry.sourceUrl
    }))
    .sort((left, right) => right.evidenceCount - left.evidenceCount);
}

async function readReleaseHistory(
  repoRoot: string
): Promise<Array<{ dirs: string[]; publishedAt: string; releaseId: string }>> {
  const historyDir = path.join(repoRoot, "data", "public-releases", "history");
  let files: string[] = [];
  try {
    files = (await readdir(historyDir)).filter((file) => file.endsWith(".json"));
  } catch {
    return [];
  }

  const releases: Array<{ dirs: string[]; publishedAt: string; releaseId: string }> = [];
  for (const file of [...files, "../current.json"]) {
    try {
      const parsed = JSON.parse(
        await readFile(path.join(historyDir, file), "utf8")
      ) as Record<string, unknown>;
      if (
        typeof parsed.releaseId === "string" &&
        typeof parsed.publishedAt === "string" &&
        Array.isArray(parsed.includeStagedArtifactDirectories)
      ) {
        releases.push({
          dirs: parsed.includeStagedArtifactDirectories as string[],
          publishedAt: parsed.publishedAt,
          releaseId: parsed.releaseId
        });
      }
    } catch {
      continue;
    }
  }

  return releases.sort((left, right) => left.publishedAt.localeCompare(right.publishedAt));
}

function renderMarkdown(report: {
  checks: Finding[];
  counts: Record<string, number>;
  generatedAt: string;
  manifest: { publishedAt: string; releaseId: string };
  runId: string;
}): string {
  const lines: string[] = [];
  lines.push(`# L0 offline consistency audit ${report.runId}`);
  lines.push("");
  lines.push(`- Generated: ${report.generatedAt}`);
  lines.push(`- Release: ${report.manifest.releaseId} (${report.manifest.publishedAt})`);
  lines.push("- Network access: none. This audit is offline and read-only.");
  lines.push("");
  lines.push("## Counts");
  lines.push("");
  for (const [key, value] of Object.entries(report.counts)) {
    lines.push(`- ${key}: ${value}`);
  }
  lines.push("");
  lines.push("## Findings");
  lines.push("");
  lines.push("| severity | check | count |");
  lines.push("| --- | --- | --- |");
  for (const finding of [...report.checks].sort(
    (left, right) => severityWeight(right.severity) - severityWeight(left.severity)
  )) {
    lines.push(`| ${finding.severity} | ${finding.check} | ${finding.count} |`);
  }
  lines.push("");
  for (const finding of report.checks) {
    lines.push(`### ${finding.check} (${finding.count})`);
    lines.push("");
    lines.push(finding.detail);
    lines.push("");
  }

  return `${lines.join("\n")}\n`;
}

function severityWeight(severity: Finding["severity"]): number {
  if (severity === "high") return 3;
  if (severity === "medium") return 2;
  if (severity === "low") return 1;
  return 0;
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

function extractCandidates(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (isRecord(value) && Array.isArray(value.artifacts)) return value.artifacts;
  if (isRecord(value)) return [value];
  return [];
}

function collect<T extends OpenClawStagedArtifact>(
  records: RawRecord[],
  artifactType: T["artifactType"]
): Array<RawRecord & { artifact: T }> {
  return records.filter(
    (record): record is RawRecord & { artifact: T } =>
      record.artifact.artifactType === artifactType
  );
}

function newestReviewByClaim(
  reviews: Array<RawRecord & { artifact: StagedReviewDecision }>
): Map<string, StagedReviewDecision> {
  const byClaim = new Map<string, StagedReviewDecision>();
  for (const item of reviews) {
    const key = scoped(item.artifact.runId, item.artifact.claimId);
    const existing = byClaim.get(key);
    if (!existing || existing.decidedAt < item.artifact.decidedAt) {
      byClaim.set(key, item.artifact);
    }
  }

  return byClaim;
}

function countBy<T>(values: T[], getKey: (value: T) => string): Map<string, number> {
  const counts = new Map<string, number>();
  for (const value of values) {
    const key = getKey(value);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  return counts;
}

function scoped(runId: string, id: string): string {
  return `${runId}:${id}`;
}

function publishKey(slug: string, claimText: string): string {
  return `${slug} ${claimText.toLowerCase()}`;
}

/** Collapses German/Nordic transliteration variants so slug twins group together. */
function normalizeSlugShape(slug: string): string {
  return slug
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .replace(/ae/g, "a")
    .replace(/oe/g, "o")
    .replace(/ue/g, "u");
}

function buildExcludedCoverage(
  excludedRecords: RawRecord[],
  dataset: Awaited<ReturnType<typeof getStagedPublicDataset>>,
  canonicalSlug: (slug: string) => string
): {
  coveredCount: number;
  entitiesAbsent: string[];
  total: number;
  uncovered: Array<Record<string, unknown>>;
} {
  const publishedEntityUrl = new Set<string>();
  const publishedSlugs = new Set<string>();
  for (const summary of dataset.publicSummaries) {
    publishedSlugs.add(summary.entity.slug);
    for (const claim of summary.claims) {
      for (const evidence of claim.evidence) {
        publishedEntityUrl.add(`${summary.entity.slug} ${evidence.sourceUrl}`);
      }
    }
  }

  const byDir = new Map<string, RawRecord[]>();
  for (const record of excludedRecords) {
    byDir.set(record.dir, [...(byDir.get(record.dir) ?? []), record]);
  }

  const entitiesAbsent = new Set<string>();
  const uncovered: Array<Record<string, unknown>> = [];
  let total = 0;
  let coveredCount = 0;

  for (const [dir, dirRecords] of byDir) {
    const evidenceUrlById = new Map<string, string>();
    for (const record of dirRecords) {
      if (record.artifact.artifactType === "evidence_candidate") {
        evidenceUrlById.set(record.artifact.evidenceId, record.artifact.sourceUrl);
      }
    }

    for (const record of dirRecords) {
      if (record.artifact.artifactType !== "claim_candidate") continue;
      total += 1;
      const slug = canonicalSlug(record.artifact.entitySlug);
      const urls = record.artifact.evidenceIds
        .map((evidenceId) => evidenceUrlById.get(evidenceId))
        .filter((url): url is string => Boolean(url));

      if (urls.some((url) => publishedEntityUrl.has(`${slug} ${url}`))) {
        coveredCount += 1;
        continue;
      }
      if (!publishedSlugs.has(slug)) entitiesAbsent.add(slug);
      uncovered.push({
        claimId: record.artifact.claimId,
        claimType: record.artifact.claimType,
        dir,
        entitySlug: slug,
        sourceUrl: urls[0]
      });
    }
  }

  return {
    coveredCount,
    entitiesAbsent: Array.from(entitiesAbsent),
    total,
    uncovered
  };
}

/**
 * True when a hex digest is an arithmetic sequence of bytes rather than a real
 * hash. Placeholder hashes written by hand look like b2c3d4e5f6a7…: every byte
 * is the previous one plus a fixed step. A genuine digest never does that.
 */
function looksFabricatedHash(value: string): boolean {
  if (!/^[0-9a-f]{40,}$/.test(value)) return false;
  const bytes: number[] = [];
  for (let index = 0; index + 1 < value.length; index += 2) {
    bytes.push(Number.parseInt(value.slice(index, index + 2), 16));
  }
  if (bytes.length < 8) return false;
  const steps = new Map<number, number>();
  for (let index = 1; index < bytes.length; index += 1) {
    const step = (bytes[index]! - bytes[index - 1]! + 256) % 256;
    steps.set(step, (steps.get(step) ?? 0) + 1);
  }
  const dominant = Math.max(...steps.values());

  return dominant / (bytes.length - 1) > 0.5;
}

function normalizeText(value: string): string {
  return value.replace(/\s+/g, " ").trim().toLowerCase();
}

function normalizeUrl(value: string): string {
  try {
    const url = new URL(value);
    const host = url.host.toLowerCase().replace(/^www\./, "");
    const pathname = url.pathname.replace(/\/+$/, "").toLowerCase();

    // The hash matters: SPA routers (e.g. #/index?searchWord=…) carry the whole
    // query there, so dropping it collapses genuinely different documents.
    return `${host}${pathname}${url.search}${url.hash}`;
  } catch {
    return value.toLowerCase();
  }
}

function safeHost(value: string): string | undefined {
  try {
    return new URL(value).host.toLowerCase();
  } catch {
    return undefined;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
