import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import {
  NO_ADVICE_BOUNDARY,
  OFFICIAL_SOURCE_RIGHTS_CAVEAT,
  OPENCLAW_ARTIFACT_SCHEMA_VERSION,
  openClawStagedArtifactSchema,
  type OpenClawStagedArtifact
} from "@uapt/shared";

type LegacySnapshotMeta = {
  sourceSnapshotId?: string;
  canonicalEntitySlug?: string;
  sourceUrl?: string;
  finalUrl?: string;
  statusCode?: number;
  httpStatus?: number;
  fetchedAt?: string;
  sourceLanguage?: string | null;
  contentHash: string;
  title?: string;
  normalizedTextPath?: string;
  robotsNotes?: string;
  accessNotes?: string;
};

type LegacyCrawlPlan = {
  runId?: string;
  universitySlug?: string;
  generatedAt?: string;
  generator?: string;
  sources?: Array<{
    url?: string;
    title?: string;
    documentStatus?: string;
    policyAuthority?: string;
    fetchModeRecommendation?: string;
    priority?: number;
  }>;
};

type LegacyCrawlRun = {
  runId?: string;
  universitySlug?: string;
  fetchedAt?: string;
  urls?: Array<{
    requestedUrl?: string;
    finalUrl?: string;
    httpStatus?: number;
    status?: string;
    fetchMode?: string;
    sourceLanguage?: string | null;
    contentHash?: string | null;
  }>;
};

type LegacyExtraction = {
  runId?: string;
  universitySlug?: string;
  universityName?: string;
  sourceUrl?: string;
  contentHash?: string;
  claims?: LegacyClaim[];
};

type LegacyClaim = {
  claimId?: string;
  claimType?: string;
  claimText?: string;
  confidence?: number;
  reviewState?: string;
  evidence?: {
    sourceUrl?: string;
    snapshotHash?: string;
    originalQuote?: string;
    quoteLocation?: string;
    sourceLanguage?: string;
    displaySummary?: string;
  };
};

type LegacyReviewDecision = {
  runId?: string;
  reviewer?: string;
  reviewedAt?: string;
  claimReviews?: Array<{
    claimId?: string;
    decision?: string;
    confidence?: number;
    notes?: string;
    issues?: string[];
    suggestedFix?: string | null;
  }>;
};

type ConversionSummary = {
  runId: string;
  artifacts: Record<string, number>;
  convertedClaims: number;
  downgradedApprovedClaims: number;
  warnings: string[];
  outputDir: string;
};

const DEFAULT_SITE_BASE_URL = "https://eduaipolicy.org";
const DEFAULT_INPUT_DIR = "tmp/openclaw-p3-legacy/staging";
const DEFAULT_OUTPUT_DIR = "tmp/openclaw-p3-converted";
const MAX_EVIDENCE_LENGTH = 700;

async function main() {
  const inputDir = process.argv[2] ?? DEFAULT_INPUT_DIR;
  const outputDir = process.argv[3] ?? DEFAULT_OUTPUT_DIR;
  const preserveReviewDecisions = process.argv.includes("--preserve-review-decisions");

  const context = await readLegacyContext(inputDir);
  const runIds = Array.from(context.runIds)
    .filter((runId) =>
      context.extractions.some(
        (extraction) => extraction.runId === runId && (extraction.claims?.length ?? 0) > 0
      )
    )
    .sort();

  if (!runIds.length) {
    throw new Error(`No legacy OpenClaw run IDs found in ${inputDir}`);
  }

  await rm(outputDir, { recursive: true, force: true });
  await mkdir(outputDir, { recursive: true });

  const summaries: ConversionSummary[] = [];

  for (const runId of runIds) {
    summaries.push(
      await convertRun({
        context,
        inputDir,
        outputDir,
        runId,
        preserveReviewDecisions
      })
    );
  }

  await writeJson(path.join(outputDir, "_conversion-summary.json"), {
    generatedAt: new Date().toISOString(),
    inputDir,
    outputDir,
    preserveReviewDecisions,
    skippedRunIds: Array.from(context.runIds)
      .filter((runId) => !runIds.includes(runId))
      .sort(),
    summaries
  });

  for (const summary of summaries) {
    console.log(
      [
        `Converted ${summary.runId}`,
        `claims=${summary.convertedClaims}`,
        `downgraded=${summary.downgradedApprovedClaims}`,
        `output=${summary.outputDir}`
      ].join(" ")
    );
  }
}

async function readLegacyContext(inputDir: string) {
  const jsonFiles = await collectFiles(inputDir, ".json");
  const markdownFiles = await collectFiles(inputDir, ".md");
  const runIds = new Set<string>();
  const snapshotsByLegacyHash = new Map<string, LegacySnapshotMeta & { file: string }>();
  const snapshotTextByLegacyHash = new Map<string, string>();
  const snapshotSha256ByLegacyHash = new Map<string, string>();
  const crawlPlans: Array<LegacyCrawlPlan & { file: string }> = [];
  const crawlRuns: Array<LegacyCrawlRun & { file: string }> = [];
  const extractions: Array<LegacyExtraction & { file: string }> = [];
  const reviews: Array<LegacyReviewDecision & { file: string }> = [];

  for (const file of jsonFiles) {
    const parsed = await readJson<unknown>(file);
    if (!isRecord(parsed)) continue;

    if (file.includes(`${path.sep}snapshots${path.sep}`) && file.endsWith(".meta.json")) {
      const meta = parsed as LegacySnapshotMeta;
      if (meta.contentHash) {
        snapshotsByLegacyHash.set(path.basename(file, ".meta.json"), { ...meta, file });
        snapshotsByLegacyHash.set(meta.contentHash, { ...meta, file });
      }
      continue;
    }

    if (file.includes(`${path.sep}crawl-plans${path.sep}`)) {
      const plan = parsed as LegacyCrawlPlan;
      if (plan.runId) runIds.add(plan.runId);
      crawlPlans.push({ ...plan, file });
      continue;
    }

    if (file.includes(`${path.sep}crawl-runs${path.sep}`)) {
      const crawlRun = parsed as LegacyCrawlRun;
      if (crawlRun.runId?.startsWith("run-")) runIds.add(crawlRun.runId);
      crawlRuns.push({ ...crawlRun, file });
      continue;
    }

    if (file.includes(`${path.sep}extraction-candidates${path.sep}`)) {
      const extraction = parsed as LegacyExtraction;
      if (extraction.runId?.startsWith("run-")) {
        runIds.add(extraction.runId);
        extractions.push({ ...extraction, file });
      }
      continue;
    }

    if (file.includes(`${path.sep}review-decisions${path.sep}`)) {
      const review = parsed as LegacyReviewDecision;
      if (review.runId?.startsWith("run-")) {
        runIds.add(review.runId);
        reviews.push({ ...review, file });
      }
    }
  }

  for (const file of markdownFiles) {
    if (!file.includes(`${path.sep}snapshots${path.sep}`)) continue;
    const legacyHash = path.basename(file, ".md");
    const text = await readFile(file, "utf8");
    snapshotTextByLegacyHash.set(legacyHash, text);
    snapshotSha256ByLegacyHash.set(legacyHash, sha256(text));

    const meta = snapshotsByLegacyHash.get(legacyHash);
    if (meta?.contentHash) {
      snapshotTextByLegacyHash.set(meta.contentHash, text);
      snapshotSha256ByLegacyHash.set(meta.contentHash, sha256(text));
    }
  }

  return {
    runIds,
    snapshotsByLegacyHash,
    snapshotTextByLegacyHash,
    snapshotSha256ByLegacyHash,
    crawlPlans,
    crawlRuns,
    extractions,
    reviews
  };
}

async function convertRun({
  context,
  outputDir,
  runId,
  preserveReviewDecisions
}: {
  context: Awaited<ReturnType<typeof readLegacyContext>>;
  inputDir: string;
  outputDir: string;
  runId: string;
  preserveReviewDecisions: boolean;
}): Promise<ConversionSummary> {
  const runDir = path.join(outputDir, runId);
  const warnings: string[] = [];
  const artifacts: OpenClawStagedArtifact[] = [];
  const runExtractions = context.extractions.filter((item) => item.runId === runId);
  const runReviews = context.reviews.filter((item) => item.runId === runId);
  const runCrawlRuns = context.crawlRuns.filter((item) => item.runId === runId);
  const runPlans = context.crawlPlans.filter((item) => item.runId === runId);
  const claimReviews = buildClaimReviewMap(runReviews);
  const referencedLegacyHashes = new Set<string>();
  const sourceUrlByLegacyHash = new Map<string, string>();

  for (const crawlRun of runCrawlRuns) {
    for (const url of crawlRun.urls ?? []) {
      if (url.contentHash) referencedLegacyHashes.add(url.contentHash);
      if (url.contentHash && (url.finalUrl ?? url.requestedUrl)) {
        sourceUrlByLegacyHash.set(url.contentHash, url.finalUrl ?? url.requestedUrl!);
      }
    }
  }

  for (const extraction of runExtractions) {
    if (extraction.contentHash) referencedLegacyHashes.add(extraction.contentHash);
    if (extraction.contentHash && extraction.sourceUrl) {
      sourceUrlByLegacyHash.set(extraction.contentHash, extraction.sourceUrl);
    }
    for (const claim of extraction.claims ?? []) {
      const snapshotHash = claim.evidence?.snapshotHash;
      if (snapshotHash) referencedLegacyHashes.add(snapshotHash);
      if (snapshotHash && claim.evidence?.sourceUrl) {
        sourceUrlByLegacyHash.set(snapshotHash, claim.evidence.sourceUrl);
      }
    }
  }

  artifacts.push(
    ...convertCrawlPlans({
      runId,
      runPlans,
      runCrawlRuns,
      context,
      referencedLegacyHashes,
      sourceUrlByLegacyHash,
      warnings
    })
  );

  artifacts.push(
    ...convertSourceSnapshots({
      runId,
      context,
      referencedLegacyHashes,
      sourceUrlByLegacyHash,
      warnings
    })
  );

  let convertedClaims = 0;
  let downgradedApprovedClaims = 0;

  for (const extraction of runExtractions) {
    for (const claim of extraction.claims ?? []) {
      const converted = convertClaimAndEvidence({
        runId,
        extraction,
        claim,
        review: claim.claimId ? claimReviews.get(claim.claimId) : undefined,
        context,
        preserveReviewDecisions,
        warnings
      });

      if (!converted) continue;
      convertedClaims += 1;
      downgradedApprovedClaims += converted.downgraded ? 1 : 0;
      artifacts.push(converted.claimArtifact, converted.evidenceArtifact, converted.reviewArtifact);
    }
  }

  artifacts.push(
    makeReportDraft({
      runId,
      claimIds: artifacts
        .filter((artifact) => artifact.artifactType === "claim_candidate")
        .map((artifact) => artifact.claimId),
      summary:
        runId.endsWith("-retry")
          ? "Converted metadata for the OpenClaw Playwright retry crawl. This is a staged artifact bundle, not a published report."
          : "Converted metadata for the OpenClaw P3 pilot crawl. This is a staged artifact bundle, not a published report."
    })
  );

  await writeArtifacts(runDir, artifacts);

  const counts = countArtifacts(artifacts);
  return {
    runId,
    artifacts: counts,
    convertedClaims,
    downgradedApprovedClaims,
    warnings,
    outputDir: runDir
  };
}

function convertCrawlPlans({
  runId,
  runPlans,
  runCrawlRuns,
  context,
  referencedLegacyHashes,
  sourceUrlByLegacyHash,
  warnings
}: {
  runId: string;
  runPlans: Array<LegacyCrawlPlan & { file: string }>;
  runCrawlRuns: Array<LegacyCrawlRun & { file: string }>;
  context: Awaited<ReturnType<typeof readLegacyContext>>;
  referencedLegacyHashes: Set<string>;
  sourceUrlByLegacyHash: Map<string, string>;
  warnings: string[];
}): OpenClawStagedArtifact[] {
  const artifacts: OpenClawStagedArtifact[] = [];

  if (runPlans.length) {
    for (const plan of runPlans) {
      const targets = (plan.sources ?? [])
        .filter((source) => source.url)
        .map((source) => ({
          entityType: "university" as const,
          entitySlug: plan.universitySlug ?? inferSlugFromFile(plan.file),
          sourceUrl: source.url!,
          sourceTitle: source.title,
          sourceLanguage: inferLanguage(plan.universitySlug ?? "", source.url),
          allowedFetchModes: [mapFetchMode(source.fetchModeRecommendation)],
          expectedThemes: compact([source.documentStatus, source.policyAuthority]).map(slugify),
          maxUrls: 1,
          robotsPolicy: "respect" as const
        }));

      if (!targets.length) continue;

      artifacts.push(
        parseArtifact({
          artifactType: "crawl_plan",
          schemaVersion: OPENCLAW_ARTIFACT_SCHEMA_VERSION,
          runId,
          planId: `${runId}-${plan.universitySlug ?? inferSlugFromFile(plan.file)}-plan`,
          createdAt: toIso(plan.generatedAt),
          createdBy: plan.generator ?? "openclaw-legacy-converter",
          targets,
          stopConditions: [
            "Respect robots.txt and site-specific crawl rules.",
            "Stop on login walls, paywalls, CAPTCHA, 403, or 429 access controls.",
            "Do not publish canonical claims from OpenClaw output."
          ]
        })
      );
    }
  }

  if (!artifacts.length) {
    const targets = Array.from(referencedLegacyHashes)
      .map((legacyHash) => context.snapshotsByLegacyHash.get(legacyHash))
      .filter(isDefined)
      .filter((meta) => meta.sourceUrl ?? sourceUrlByLegacyHash.get(meta.contentHash))
      .map((meta) => ({
        entityType: "university" as const,
        entitySlug: meta.canonicalEntitySlug ?? inferSlugFromFile(meta.file),
        sourceUrl: meta.sourceUrl ?? sourceUrlByLegacyHash.get(meta.contentHash)!,
        sourceTitle: meta.title,
        sourceLanguage: normalizeLanguage(meta.sourceLanguage, meta.canonicalEntitySlug),
        allowedFetchModes: [inferFetchMode(meta.accessNotes)],
        expectedThemes: [],
        maxUrls: 1,
        robotsPolicy: "respect" as const
      }));

    if (targets.length) {
      artifacts.push(
        parseArtifact({
          artifactType: "crawl_plan",
          schemaVersion: OPENCLAW_ARTIFACT_SCHEMA_VERSION,
          runId,
          planId: `${runId}-generated-plan`,
          createdAt: toIso(undefined),
          createdBy: "openclaw-legacy-converter",
          targets,
          stopConditions: [
            "Generated from legacy retry snapshots because no crawl-designer plan was present.",
            "Respect robots.txt and site-specific crawl rules.",
            "Stop on login walls, paywalls, CAPTCHA, 403, or 429 access controls."
          ]
        })
      );
    } else {
      warnings.push(`${runId}: no crawl plan targets could be generated`);
    }
  }

  for (const crawlRun of runCrawlRuns) {
    for (const url of crawlRun.urls ?? []) {
      if (url.status !== "SUCCEEDED" && url.requestedUrl) {
        warnings.push(
          `${runId}: skipped ${url.requestedUrl} status=${url.status ?? "unknown"}`
        );
      }
    }
  }

  return artifacts;
}

function convertSourceSnapshots({
  runId,
  context,
  referencedLegacyHashes,
  sourceUrlByLegacyHash,
  warnings
}: {
  runId: string;
  context: Awaited<ReturnType<typeof readLegacyContext>>;
  referencedLegacyHashes: Set<string>;
  sourceUrlByLegacyHash: Map<string, string>;
  warnings: string[];
}): OpenClawStagedArtifact[] {
  const artifacts: OpenClawStagedArtifact[] = [];
  const seenContentHashes = new Set<string>();

  for (const legacyHash of Array.from(referencedLegacyHashes).sort()) {
    const meta = context.snapshotsByLegacyHash.get(legacyHash);
    const contentHash = context.snapshotSha256ByLegacyHash.get(legacyHash);

    if (!meta || !contentHash) {
      warnings.push(`${runId}: missing snapshot metadata or markdown for ${legacyHash}`);
      continue;
    }

    const sourceUrl =
      meta.sourceUrl ??
      sourceUrlByLegacyHash.get(legacyHash) ??
      sourceUrlByLegacyHash.get(meta.contentHash);
    if (!sourceUrl) {
      warnings.push(`${runId}: missing source URL for snapshot ${legacyHash}`);
      continue;
    }

    if (seenContentHashes.has(contentHash)) continue;
    seenContentHashes.add(contentHash);

    artifacts.push(
      parseArtifact({
        artifactType: "source_snapshot",
        schemaVersion: OPENCLAW_ARTIFACT_SCHEMA_VERSION,
        runId,
        sourceSnapshotId: meta.sourceSnapshotId ?? `${inferSlugFromFile(meta.file)}-${legacyHash}`,
        sourceUrl,
        finalUrl: meta.finalUrl ?? sourceUrl,
        sourceTitle: meta.title,
        sourceLanguage: normalizeLanguage(meta.sourceLanguage, meta.canonicalEntitySlug),
        contentHash,
        fetchedAt: toIso(meta.fetchedAt),
        httpStatus: meta.statusCode ?? meta.httpStatus,
        robotsAllowed: !/disallow/i.test(meta.robotsNotes ?? ""),
        normalizedTextStorageKey:
          meta.normalizedTextPath ?? `staging/snapshots/${inferSlugFromFile(meta.file)}/${legacyHash}.md`,
        rawArtifactPaths: []
      })
    );
  }

  return artifacts;
}

function convertClaimAndEvidence({
  runId,
  extraction,
  claim,
  review,
  context,
  preserveReviewDecisions,
  warnings
}: {
  runId: string;
  extraction: LegacyExtraction & { file: string };
  claim: LegacyClaim;
  review?: {
    decision?: string;
    confidence?: number;
    notes?: string;
    issues?: string[];
    suggestedFix?: string | null;
    reviewer?: string;
    reviewedAt?: string;
  };
  context: Awaited<ReturnType<typeof readLegacyContext>>;
  preserveReviewDecisions: boolean;
  warnings: string[];
}):
  | {
      claimArtifact: OpenClawStagedArtifact;
      evidenceArtifact: OpenClawStagedArtifact;
      reviewArtifact: OpenClawStagedArtifact;
      downgraded: boolean;
    }
  | null {
  if (!claim.claimId || !claim.claimText || !claim.evidence?.sourceUrl) {
    warnings.push(`${runId}: skipped malformed claim in ${extraction.file}`);
    return null;
  }

  const legacyHash = claim.evidence.snapshotHash ?? extraction.contentHash;
  const snapshotMeta = legacyHash
    ? context.snapshotsByLegacyHash.get(legacyHash)
    : undefined;
  const snapshotContentHash = legacyHash
    ? context.snapshotSha256ByLegacyHash.get(legacyHash)
    : undefined;
  const snapshotText = legacyHash
    ? context.snapshotTextByLegacyHash.get(legacyHash) ?? ""
    : "";
  const quote = claim.evidence.originalQuote ?? "";
  const exactQuoteFound = quote ? normalizeText(snapshotText).includes(normalizeText(quote)) : false;
  const quoteHasEllipsis = quote.includes("...");
  const quoteTooLong = quote.length > MAX_EVIDENCE_LENGTH;
  const evidenceSnippetOriginal = truncateEvidence(quote || claim.claimText);
  const legacyDecision = review?.decision ?? "NEEDS_CHANGES";
  let decision = mapDecision(legacyDecision);
  let reviewState = mapReviewState(decision);
  let downgraded = false;

  if (
    !preserveReviewDecisions &&
    decision === "approve" &&
    (!exactQuoteFound || quoteHasEllipsis || quoteTooLong)
  ) {
    decision = "needs_changes";
    reviewState = "needs_review";
    downgraded = true;
    warnings.push(
      `${runId}: downgraded ${claim.claimId} because evidence exact=${exactQuoteFound} ellipsis=${quoteHasEllipsis} tooLong=${quoteTooLong}`
    );
  }

  const entitySlug = extraction.universitySlug ?? inferSlugFromFile(extraction.file);
  const sourceLanguage = normalizeLanguage(
    claim.evidence.sourceLanguage ?? snapshotMeta?.sourceLanguage,
    entitySlug
  );
  const evidenceId = `${claim.claimId}-evidence-1`;
  const sourceSnapshotId =
    snapshotMeta?.sourceSnapshotId ?? `${entitySlug}-${legacyHash ?? "unknown"}`;
  const sourceTitle =
    snapshotMeta?.title ??
    `${extraction.universityName ?? entitySlug} source ${legacyHash ?? ""}`.trim();
  const sourceUrl = claim.evidence.sourceUrl;
  const finalUrl = snapshotMeta?.finalUrl ?? sourceUrl;
  const retrievedAt = toIso(snapshotMeta?.fetchedAt);
  const snapshotHash = snapshotContentHash ?? sha256(snapshotText || sourceUrl);
  const confidence = clampConfidence(review?.confidence ?? claim.confidence);
  const citation = makeCitation({
    citationTitle: sourceTitle,
    sourceUrl,
    canonicalUrl: `${DEFAULT_SITE_BASE_URL}/universities/${entitySlug}`,
    publicJsonUrl: `${DEFAULT_SITE_BASE_URL}/api/public/v1/universities/${entitySlug}.json`,
    publisher: extraction.universityName ?? entitySlug,
    retrievedAt,
    snapshotHash
  });

  const claimArtifact = parseArtifact({
    artifactType: "claim_candidate",
    schemaVersion: OPENCLAW_ARTIFACT_SCHEMA_VERSION,
    runId,
    claimId: claim.claimId,
    entityType: "university",
    entitySlug,
    claimType: mapClaimType(claim.claimType),
    claimText: claim.claimText,
    normalizedValue: claim.claimType ? slugify(claim.claimType) : undefined,
    sourceLanguage,
    confidence,
    reviewState,
    evidenceIds: [evidenceId],
    citation,
    publishAsCanonical: false,
    isCanonical: false
  });

  const evidenceArtifact = parseArtifact({
    artifactType: "evidence_candidate",
    schemaVersion: OPENCLAW_ARTIFACT_SCHEMA_VERSION,
    runId,
    evidenceId,
    claimId: claim.claimId,
    sourceSnapshotId,
    sourceUrl,
    finalUrl,
    sourceTitle,
    sourceLanguage,
    snapshotHash,
    evidenceSnippetOriginal,
    evidenceSnippetDisplay: claim.evidence.displaySummary
      ? truncateEvidence(claim.evidence.displaySummary)
      : undefined,
    evidenceLocator: claim.evidence.quoteLocation,
    evidenceType: "official_source",
    relevance: confidence,
    rightsNote: OFFICIAL_SOURCE_RIGHTS_CAVEAT,
    citation
  });

  const notes = compact([
    review?.notes,
    review?.issues?.length ? `Issues: ${review.issues.join("; ")}` : undefined,
    review?.suggestedFix ? `Suggested fix: ${review.suggestedFix}` : undefined,
    downgraded
      ? "Converter downgraded this legacy approval because the evidence snippet was not an exact short quote in the snapshot."
      : undefined
  ]).join(" ");

  const reviewArtifact = parseArtifact({
    artifactType: "review_decision",
    schemaVersion: OPENCLAW_ARTIFACT_SCHEMA_VERSION,
    runId,
    decisionId: `${claim.claimId}-review-1`,
    claimId: claim.claimId,
    decision,
    reviewState,
    reviewerType: "openclaw_agent",
    reviewer: review?.reviewer ?? "policy-reviewer",
    notes: notes || "Converted from legacy OpenClaw review output.",
    decidedAt: toIso(review?.reviewedAt)
  });

  return { claimArtifact, evidenceArtifact, reviewArtifact, downgraded };
}

function makeReportDraft({
  runId,
  claimIds,
  summary
}: {
  runId: string;
  claimIds: string[];
  summary: string;
}): OpenClawStagedArtifact {
  return parseArtifact({
    artifactType: "report_draft",
    schemaVersion: OPENCLAW_ARTIFACT_SCHEMA_VERSION,
    runId,
    reportId: `${runId}-converted-report`,
    title: `Converted OpenClaw Run ${runId}`,
    generatedAt: new Date().toISOString(),
    draftPath: `content/reports/${runId}-converted.mdx`,
    summary,
    referencedClaimIds: claimIds,
    publicJsonLinks: [],
    limitations: [
      NO_ADVICE_BOUNDARY,
      "Converted from legacy OpenClaw staging output. It must be reviewed before publication."
    ],
    trackerMetadataLicense: "CC-BY-4.0",
    sourceRightsPolicy: OFFICIAL_SOURCE_RIGHTS_CAVEAT,
    rawArtifactPaths: []
  });
}

async function writeArtifacts(
  runDir: string,
  artifacts: OpenClawStagedArtifact[]
): Promise<void> {
  for (const artifact of artifacts) {
    const directory = path.join(runDir, artifact.artifactType.replaceAll("_", "-"));
    await mkdir(directory, { recursive: true });
    const id = artifactId(artifact);
    await writeJson(path.join(directory, `${slugify(id)}.json`), artifact);
  }
}

function buildClaimReviewMap(reviews: Array<LegacyReviewDecision & { file: string }>) {
  const map = new Map<
    string,
    {
      decision?: string;
      confidence?: number;
      notes?: string;
      issues?: string[];
      suggestedFix?: string | null;
      reviewer?: string;
      reviewedAt?: string;
    }
  >();

  for (const review of reviews) {
    for (const claimReview of review.claimReviews ?? []) {
      if (!claimReview.claimId) continue;
      map.set(claimReview.claimId, {
        ...claimReview,
        reviewer: review.reviewer,
        reviewedAt: review.reviewedAt
      });
    }
  }

  return map;
}

function parseArtifact(value: unknown): OpenClawStagedArtifact {
  return openClawStagedArtifactSchema.parse(value);
}

function mapClaimType(value: string | undefined) {
  const key = (value ?? "").toUpperCase();
  switch (key) {
    case "AI_TOOL_PERMISSION":
    case "TOOL_CATALOG":
    case "SERVICE_ANNOUNCEMENT":
      return "ai_tool_treatment";
    case "ACADEMIC_INTEGRITY":
      return "academic_integrity";
    case "DATA_RESTRICTION":
    case "PRIVACY":
      return "privacy";
    case "TEACHING_GUIDANCE":
      return "teaching";
    case "RESEARCH":
      return "research";
    case "SECURITY_REVIEW":
    case "SECURITY":
      return "security_review";
    case "PROCUREMENT":
      return "procurement";
    case "DOCUMENT_STATUS":
    case "SOURCE_STATUS":
      return "source_status";
    default:
      return "other";
  }
}

function mapDecision(value: string): "approve" | "reject" | "needs_changes" {
  switch (value.toUpperCase()) {
    case "APPROVED":
    case "APPROVE":
      return "approve";
    case "REJECTED":
    case "REJECT":
      return "reject";
    default:
      return "needs_changes";
  }
}

function mapReviewState(
  decision: "approve" | "reject" | "needs_changes"
): "agent_reviewed" | "needs_review" | "rejected" {
  if (decision === "approve") return "agent_reviewed";
  if (decision === "reject") return "rejected";
  return "needs_review";
}

function mapFetchMode(value: string | undefined): "http" | "playwright" | "opencli" | "firecrawl" {
  const normalized = (value ?? "http").toLowerCase();
  if (normalized.includes("playwright") || normalized.includes("browser")) {
    return "playwright";
  }
  if (normalized.includes("firecrawl")) return "firecrawl";
  if (normalized.includes("opencli")) return "opencli";
  return "http";
}

function inferFetchMode(accessNotes: string | undefined) {
  return /playwright|browser|chromium/i.test(accessNotes ?? "") ? "playwright" : "http";
}

function makeCitation({
  citationTitle,
  sourceUrl,
  publicJsonUrl,
  canonicalUrl,
  publisher,
  retrievedAt,
  snapshotHash
}: {
  citationTitle: string;
  sourceUrl: string;
  publicJsonUrl: string;
  canonicalUrl: string;
  publisher: string;
  retrievedAt: string;
  snapshotHash: string;
}) {
  return {
    citationTitle,
    sourceUrl,
    publicJsonUrl,
    canonicalUrl,
    publisher,
    retrievedAt,
    snapshotHash,
    sourceRights: OFFICIAL_SOURCE_RIGHTS_CAVEAT
  };
}

function artifactId(artifact: OpenClawStagedArtifact): string {
  switch (artifact.artifactType) {
    case "crawl_plan":
      return artifact.planId;
    case "source_candidate":
      return artifact.sourceCandidateId;
    case "source_discovery_trace":
      return artifact.traceId;
    case "source_rejection":
      return artifact.sourceRejectionId;
    case "fetch_attempt":
      return artifact.fetchAttemptId;
    case "source_snapshot":
      return artifact.sourceSnapshotId;
    case "claim_candidate":
      return artifact.claimId;
    case "evidence_candidate":
      return artifact.evidenceId;
    case "review_decision":
      return artifact.decisionId;
    case "report_draft":
      return artifact.reportId;
  }
}

function countArtifacts(artifacts: OpenClawStagedArtifact[]): Record<string, number> {
  return artifacts.reduce<Record<string, number>>((counts, artifact) => {
    counts[artifact.artifactType] = (counts[artifact.artifactType] ?? 0) + 1;
    return counts;
  }, {});
}

async function collectFiles(directory: string, extension: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const entryPath = path.join(directory, entry.name);
      if (entry.isDirectory()) return collectFiles(entryPath, extension);
      if (entry.isFile() && entry.name.endsWith(extension)) return [entryPath];
      return [];
    })
  );

  return files.flat().sort();
}

async function readJson<T>(file: string): Promise<T> {
  return JSON.parse(await readFile(file, "utf8")) as T;
}

async function writeJson(file: string, value: unknown): Promise<void> {
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, `${JSON.stringify(value, null, 2)}\n`);
}

function inferSlugFromFile(file: string): string {
  const parts = file.split(path.sep);
  const stagingIndex = parts.lastIndexOf("staging");
  if (stagingIndex >= 0 && parts[stagingIndex + 2]) return parts[stagingIndex + 2];
  return "unknown";
}

function inferLanguage(slug: string, url: string | undefined): string {
  if (slug === "umontreal" || /umontreal|mila\.quebec/.test(url ?? "")) return "fr";
  return "en";
}

function normalizeLanguage(value: string | null | undefined, slug?: string): string {
  if (value && /^[a-z]{2,3}(-[A-Za-z0-9]+)*$/.test(value)) return value;
  return inferLanguage(slug ?? "", undefined);
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120) || "artifact";
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function normalizeText(value: string): string {
  return value.replace(/\s+/g, " ").trim().toLowerCase();
}

function truncateEvidence(value: string): string {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= MAX_EVIDENCE_LENGTH) return normalized;
  return normalized.slice(0, MAX_EVIDENCE_LENGTH - 1).trimEnd();
}

function clampConfidence(value: number | undefined): number {
  if (typeof value !== "number" || Number.isNaN(value)) return 0.5;
  return Math.max(0, Math.min(1, value));
}

function toIso(value: string | undefined): string {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) return new Date().toISOString();
  return date.toISOString();
}

function compact<T>(values: Array<T | null | undefined | "">): T[] {
  return values.filter((value): value is T => Boolean(value));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isDefined<T>(value: T | undefined): value is T {
  return value !== undefined;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
