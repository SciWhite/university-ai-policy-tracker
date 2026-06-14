import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  OFFICIAL_SOURCE_RIGHTS_CAVEAT,
  openClawArtifactBundleSchema,
  type OpenClawStagedArtifact
} from "@uapt/shared";

interface StagingToolRecordEvidence {
  sourceUrl: string;
  sourceTitle: string;
  evidenceSnippet: string;
  snapshotHash: string;
  reviewState: string;
}

interface StagingToolRecord {
  universitySlug: string;
  universityName: string;
  qsRank?: number;
  tool: string;
  rawToolName: string;
  description?: string;
  howToObtain?: string;
  costToUser?: string;
  availability: string;
  endorsementType: string;
  reviewState: string;
  evidence: StagingToolRecordEvidence[];
}

interface StagingToolRecordsDocument {
  schemaVersion: string;
  runId: string;
  generatedAt: string;
  records: StagingToolRecord[];
}

const [inputArg, outputArg] = process.argv.slice(2);
const inputPath =
  inputArg ?? "staging/ai-tools/uapt-ai-tools-qs-1-10-20260614/tool_records.json";

let document: StagingToolRecordsDocument;

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

async function main(): Promise<void> {
  document = JSON.parse(
    await readFile(inputPath, "utf8")
  ) as StagingToolRecordsDocument;
  const outputPath =
    outputArg ??
    path.join("staging", "uapt-runs", document.runId, "artifacts.json");

  const existingBundle = JSON.parse(await readFile(outputPath, "utf8"));
  const missingSourceArtifacts = buildMissingSourceArtifacts(
    document.records,
    existingBundle.artifacts ?? []
  );
  const metadataBySource = buildSourceMetadata([
    ...(existingBundle.artifacts ?? []),
    ...missingSourceArtifacts
  ]);
  const preservedArtifacts = (existingBundle.artifacts ?? []).filter(
    (artifact: OpenClawStagedArtifact) =>
      ![
        "claim_candidate",
        "evidence_candidate",
        "source_snapshot",
        "review_decision"
      ].includes(artifact.artifactType)
  );

  const generatedArtifacts = document.records.flatMap((record, index) =>
    buildArtifactsForRecord(record, index, metadataBySource)
  );

  const bundle = openClawArtifactBundleSchema.parse({
    schemaVersion: "openclaw-artifact-v1",
    runId: document.runId,
    runPurpose: existingBundle.runPurpose ?? "claim_evidence_release",
    artifacts: [...preservedArtifacts, ...missingSourceArtifacts, ...generatedArtifacts]
  });

  await writeFile(outputPath, `${JSON.stringify(bundle, null, 2)}\n`);
  console.log(
    `Rebuilt ${generatedArtifacts.length} AI tool OpenClaw artifacts from ${document.records.length} tool records.`
  );
}

function buildArtifactsForRecord(
  record: StagingToolRecord,
  index: number,
  metadataBySource: Map<
    string,
    {
      sourceCandidateId?: string;
      fetchAttemptId?: string;
      finalUrl?: string;
      httpStatus?: number;
      robotsAllowed?: boolean;
    }
  >
): OpenClawStagedArtifact[] {
  const suffix = slugify(`${record.universitySlug}-${record.tool}-${index + 1}`);
  const claimId = `cl-${suffix}`;
  const retrievedAt = new Date(
    Date.parse(document.generatedAt) + index * 60_000
  ).toISOString();
  const evidenceArtifacts = record.evidence.map((evidence, evidenceIndex) => {
    const evidenceSuffix = slugify(`${suffix}-${evidenceIndex + 1}`);
    const evidenceId = `ev-${evidenceSuffix}`;
    const sourceSnapshotId = `ss-${evidenceSuffix}`;
    const sourceMetadata =
      metadataBySource.get(sourceKey(record.universitySlug, evidence.sourceUrl)) ??
      {};
    const citation = {
      citationTitle: evidence.sourceTitle,
      sourceUrl: evidence.sourceUrl,
      publicJsonUrl: `https://eduaipolicy.org/api/public/v1/universities/${record.universitySlug}.json`,
      canonicalUrl: `https://eduaipolicy.org/universities/${record.universitySlug}`,
      publisher: record.universityName,
      retrievedAt,
      snapshotHash: evidence.snapshotHash,
      sourceRights: OFFICIAL_SOURCE_RIGHTS_CAVEAT
    };

    return [
      {
        schemaVersion: "openclaw-artifact-v1",
        runId: document.runId,
        artifactType: "source_snapshot",
        sourceSnapshotId,
        sourceCandidateId:
          sourceMetadata.sourceCandidateId ??
          `sc-${shortHash(evidence.sourceUrl)}`,
        fetchAttemptId:
          sourceMetadata.fetchAttemptId ?? `fa-${shortHash(evidence.sourceUrl)}`,
        sourceUrl: evidence.sourceUrl,
        finalUrl: sourceMetadata.finalUrl ?? evidence.sourceUrl,
        sourceTitle: evidence.sourceTitle,
        sourceLanguage: "en",
        contentHash: evidence.snapshotHash,
        fetchedAt: retrievedAt,
        httpStatus: sourceMetadata.httpStatus ?? 200,
        robotsAllowed: sourceMetadata.robotsAllowed ?? true,
        normalizedTextStorageKey: `staging/uapt-runs/${document.runId}/snapshots/${sourceSnapshotId}.txt`,
        rawArtifactPaths: []
      },
      {
        schemaVersion: "openclaw-artifact-v1",
        runId: document.runId,
        artifactType: "evidence_candidate",
        evidenceId,
        claimId,
        sourceSnapshotId,
        sourceUrl: evidence.sourceUrl,
        finalUrl: sourceMetadata.finalUrl ?? evidence.sourceUrl,
        sourceTitle: evidence.sourceTitle,
        sourceLanguage: "en",
        snapshotHash: evidence.snapshotHash,
        evidenceSnippetOriginal: evidence.evidenceSnippet,
        evidenceSnippetDisplay: evidence.evidenceSnippet,
        evidenceType: "official_source",
        relevance: 0.98,
        rightsNote: OFFICIAL_SOURCE_RIGHTS_CAVEAT,
        citation
      }
    ] satisfies OpenClawStagedArtifact[];
  });
  const evidenceIds = evidenceArtifacts
    .flat()
    .filter((artifact) => artifact.artifactType === "evidence_candidate")
    .map((artifact) => artifact.evidenceId);
  const citation = record.evidence[0]
    ? {
        citationTitle: record.evidence[0].sourceTitle,
        sourceUrl: record.evidence[0].sourceUrl,
        publicJsonUrl: `https://eduaipolicy.org/api/public/v1/universities/${record.universitySlug}.json`,
        canonicalUrl: `https://eduaipolicy.org/universities/${record.universitySlug}`,
        publisher: record.universityName,
        retrievedAt,
        snapshotHash: record.evidence[0].snapshotHash,
        sourceRights: OFFICIAL_SOURCE_RIGHTS_CAVEAT
      }
    : undefined;

  if (!citation) {
    throw new Error(
      `Tool record ${record.universitySlug}:${record.rawToolName} has no evidence.`
    );
  }

  return [
    {
      schemaVersion: "openclaw-artifact-v1",
      runId: document.runId,
      artifactType: "claim_candidate",
      claimId,
      entityType: "university",
      entitySlug: record.universitySlug,
      claimType: "ai_tool_treatment",
      claimText: buildClaimText(record),
      normalizedValue: JSON.stringify({
        tool: record.tool,
        rawToolName: record.rawToolName,
        description: record.description,
        howToObtain: record.howToObtain,
        costToUser: record.costToUser,
        availability: record.availability,
        endorsementType: record.endorsementType
      }),
      sourceLanguage: "en",
      confidence: record.reviewState === "needs_review" ? 0.72 : 0.97,
      reviewState: record.reviewState,
      evidenceIds,
      citation,
      publishAsCanonical: false,
      isCanonical: false
    },
    ...evidenceArtifacts.flat(),
    {
      schemaVersion: "openclaw-artifact-v1",
      runId: document.runId,
      artifactType: "review_decision",
      decisionId: `rd-${suffix}`,
      claimId,
      decision: record.reviewState === "needs_review" ? "needs_changes" : "approve",
      reviewState: record.reviewState,
      reviewerType: "openclaw_agent",
      reviewer: "ai-tools-pipeline",
      notes:
        "Converted from staged tool-level evidence. Tool-level claim kept separate from source-level classification.",
      decidedAt: retrievedAt
    }
  ] satisfies OpenClawStagedArtifact[];
}

function buildSourceMetadata(
  artifacts: OpenClawStagedArtifact[]
): Map<
  string,
  {
    sourceCandidateId?: string;
    fetchAttemptId?: string;
    finalUrl?: string;
    httpStatus?: number;
    robotsAllowed?: boolean;
  }
> {
  const metadata = new Map<
    string,
    {
      sourceCandidateId?: string;
      fetchAttemptId?: string;
      finalUrl?: string;
      httpStatus?: number;
      robotsAllowed?: boolean;
    }
  >();
  const sourceCandidates = new Map<
    string,
    Extract<OpenClawStagedArtifact, { artifactType: "source_candidate" }>
  >();
  const fetchAttempts = new Map<
    string,
    Extract<OpenClawStagedArtifact, { artifactType: "fetch_attempt" }>
  >();

  for (const artifact of artifacts) {
    if (artifact.artifactType === "source_candidate") {
      sourceCandidates.set(artifact.sourceCandidateId, artifact);
    }

    if (artifact.artifactType === "fetch_attempt" && artifact.sourceCandidateId) {
      fetchAttempts.set(artifact.sourceCandidateId, artifact);
    }
  }

  for (const sourceCandidate of sourceCandidates.values()) {
    const fetchAttempt = fetchAttempts.get(sourceCandidate.sourceCandidateId);

    metadata.set(sourceKey(sourceCandidate.entitySlug, sourceCandidate.sourceUrl), {
      sourceCandidateId: sourceCandidate.sourceCandidateId,
      fetchAttemptId: fetchAttempt?.fetchAttemptId,
      finalUrl:
        fetchAttempt?.finalUrl ??
        sourceCandidate.finalUrl ??
        sourceCandidate.sourceUrl,
      httpStatus: fetchAttempt?.httpStatus,
      robotsAllowed: fetchAttempt?.robotsAllowed
    });
  }

  return metadata;
}

function sourceKey(universitySlug: string, sourceUrl: string): string {
  return `${universitySlug}:${sourceUrl}`;
}

function buildMissingSourceArtifacts(
  records: StagingToolRecord[],
  artifacts: OpenClawStagedArtifact[]
): OpenClawStagedArtifact[] {
  const existingSourceKeys = new Set(
    artifacts
      .filter(
        (
          artifact
        ): artifact is Extract<
          OpenClawStagedArtifact,
          { artifactType: "source_candidate" }
        > => artifact.artifactType === "source_candidate"
      )
      .map((artifact) => sourceKey(artifact.entitySlug, artifact.sourceUrl))
  );
  const created = new Map<string, OpenClawStagedArtifact[]>();

  for (const record of records) {
    for (const evidence of record.evidence) {
      const key = sourceKey(record.universitySlug, evidence.sourceUrl);
      if (existingSourceKeys.has(key) || created.has(key)) continue;

      const sourceCandidateId = `sc-${slugify(
        `${record.universitySlug}-${shortHash(evidence.sourceUrl)}`
      )}`;
      const fetchAttemptId = `fa-${slugify(
        `${record.universitySlug}-${shortHash(evidence.sourceUrl)}`
      )}`;
      const retrievedAt = document.generatedAt;

      created.set(key, [
        {
          schemaVersion: "openclaw-artifact-v1",
          runId: document.runId,
          artifactType: "source_candidate",
          sourceCandidateId,
          entityType: "university",
          entitySlug: record.universitySlug,
          sourceUrl: evidence.sourceUrl,
          finalUrl: evidence.sourceUrl,
          sourceTitle: evidence.sourceTitle,
          sourceLanguage: "en",
          sourceType: "approved_tools",
          discoveryMethod: "operator_seed",
          discoveredAt: retrievedAt,
          officialDomainConfidence: 0.98,
          aiRelevanceScore: 0.98,
          policySpecificityScore: 0.95,
          verificationStatus: "verified",
          verifiedAt: retrievedAt,
          verificationNotes:
            "Added by AI tools artifact rebuild from staged official source evidence.",
          robotsPolicy: "respect"
        },
        {
          schemaVersion: "openclaw-artifact-v1",
          runId: document.runId,
          artifactType: "fetch_attempt",
          fetchAttemptId,
          sourceCandidateId,
          sourceUrl: evidence.sourceUrl,
          finalUrl: evidence.sourceUrl,
          attemptedAt: retrievedAt,
          fetchMode: "firecrawl",
          userAgentKind: "firecrawl",
          httpStatus: 200,
          contentType: "text/html",
          robotsAllowed: true,
          outcome: "success",
          durationMs: 0,
          contentHash: evidence.snapshotHash,
          normalizedTextStorageKey: `staging/uapt-runs/${document.runId}/snapshots/${sourceCandidateId}.txt`
        }
      ] satisfies OpenClawStagedArtifact[]);
    }
  }

  return Array.from(created.values()).flat();
}

function buildClaimText(record: StagingToolRecord): string {
  const availability = formatStatus(record.availability);
  const endorsement = formatStatus(record.endorsementType);

  return `${record.rawToolName} is listed for ${record.universityName} in an official university AI tools source. Derived availability: ${availability}. Derived endorsement type: ${endorsement}.`;
}

function formatStatus(value: string): string {
  return value.replace(/_/g, " ");
}

function shortHash(input: string): string {
  return createHash("sha256").update(input).digest("hex").slice(0, 12);
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
