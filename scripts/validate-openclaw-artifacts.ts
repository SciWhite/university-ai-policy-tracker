import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import {
  OFFICIAL_SOURCE_RIGHTS_CAVEAT,
  PUBLIC_API_VERSION,
  openClawArtifactBundleSchema,
  openClawStagedArtifactSchema,
  type OpenClawStagedArtifact
} from "@uapt/shared";
import { ZodError } from "zod";

const DEFAULT_STAGING_DIR = "examples/openclaw-staging/valid";
const REQUIRED_ARTIFACT_TYPES = [
  "crawl_plan",
  "source_snapshot",
  "claim_candidate",
  "evidence_candidate",
  "review_decision",
  "report_draft"
] as const;

type ValidationIssue = {
  file?: string;
  message: string;
};

async function main() {
  const targetDir = process.argv[2] ?? DEFAULT_STAGING_DIR;
  const issues: ValidationIssue[] = [];
  const artifacts = await loadArtifacts(targetDir, issues);

  validateArtifactSet(artifacts, issues);

  if (issues.length) {
    console.error(`OpenClaw artifact validation failed for ${targetDir}`);
    for (const issue of issues) {
      console.error(`- ${issue.file ? `${issue.file}: ` : ""}${issue.message}`);
    }
    process.exitCode = 1;
    return;
  }

  const counts = countByArtifactType(artifacts);
  console.log(
    [
      `Validated ${artifacts.length} OpenClaw staged artifacts from ${targetDir}.`,
      ...REQUIRED_ARTIFACT_TYPES.map(
        (artifactType) => `${artifactType}: ${counts.get(artifactType) ?? 0}`
      )
    ].join(" ")
  );
}

async function loadArtifacts(
  targetDir: string,
  issues: ValidationIssue[]
): Promise<OpenClawStagedArtifact[]> {
  const files = await collectJsonFiles(targetDir, issues);
  const artifacts: OpenClawStagedArtifact[] = [];

  for (const file of files) {
    try {
      const parsed = JSON.parse(await readFile(file, "utf8")) as unknown;
      const values = extractArtifactValues(parsed);

      for (const value of values) {
        const result = openClawStagedArtifactSchema.safeParse(value);

        if (result.success) {
          artifacts.push(result.data);
        } else {
          issues.push(...formatZodIssues(file, result.error));
        }
      }
    } catch (error) {
      issues.push({
        file,
        message: error instanceof Error ? error.message : "Invalid JSON artifact"
      });
    }
  }

  return artifacts;
}

async function collectJsonFiles(
  targetDir: string,
  issues: ValidationIssue[]
): Promise<string[]> {
  try {
    const targetStat = await stat(targetDir);

    if (targetStat.isFile()) {
      return targetDir.endsWith(".json") ? [targetDir] : [];
    }
  } catch {
    issues.push({ message: `Staging path does not exist: ${targetDir}` });
    return [];
  }

  const entries = await readdir(targetDir, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const entryPath = path.join(targetDir, entry.name);
      if (entry.isDirectory()) return collectJsonFiles(entryPath, issues);
      if (entry.isFile() && entry.name.endsWith(".json")) return [entryPath];
      return [];
    })
  );

  return files.flat().sort();
}

function extractArtifactValues(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;

  const bundle = openClawArtifactBundleSchema.safeParse(value);
  if (bundle.success) return bundle.data.artifacts;

  return [value];
}

function validateArtifactSet(
  artifacts: OpenClawStagedArtifact[],
  issues: ValidationIssue[]
): void {
  if (!artifacts.length) {
    issues.push({ message: "No JSON artifacts found" });
    return;
  }

  const counts = countByArtifactType(artifacts);
  for (const artifactType of REQUIRED_ARTIFACT_TYPES) {
    if (!counts.get(artifactType)) {
      issues.push({ message: `Missing required artifact type: ${artifactType}` });
    }
  }

  validateRunIds(artifacts, issues);
  validateClaimsAndEvidence(artifacts, issues);
  validateReviewDecisions(artifacts, issues);

  for (const artifact of artifacts) {
    validateVersionedPublicLinks(artifact, issues);
    validateRawArtifactPaths(artifact, issues);
    validateRightsCaveat(artifact, issues);
  }
}

function validateRunIds(
  artifacts: OpenClawStagedArtifact[],
  issues: ValidationIssue[]
): void {
  const runIds = new Set(artifacts.map((artifact) => artifact.runId));
  if (runIds.size > 1) {
    issues.push({
      message: `Artifacts in one staging directory must share one runId; found ${Array.from(runIds).join(", ")}`
    });
  }
}

function validateClaimsAndEvidence(
  artifacts: OpenClawStagedArtifact[],
  issues: ValidationIssue[]
): void {
  const claims = artifacts.filter(
    (artifact): artifact is Extract<OpenClawStagedArtifact, { artifactType: "claim_candidate" }> =>
      artifact.artifactType === "claim_candidate"
  );
  const evidence = artifacts.filter(
    (artifact): artifact is Extract<OpenClawStagedArtifact, { artifactType: "evidence_candidate" }> =>
      artifact.artifactType === "evidence_candidate"
  );
  const snapshots = artifacts.filter(
    (artifact): artifact is Extract<OpenClawStagedArtifact, { artifactType: "source_snapshot" }> =>
      artifact.artifactType === "source_snapshot"
  );
  const evidenceById = new Map(
    evidence.map((evidenceArtifact) => [evidenceArtifact.evidenceId, evidenceArtifact])
  );
  const claimsById = new Map(claims.map((claim) => [claim.claimId, claim]));
  const snapshotHashes = new Set(snapshots.map((snapshot) => snapshot.contentHash));

  for (const claim of claims) {
    if (claim.publishAsCanonical || claim.isCanonical) {
      issues.push({
        message: `Claim ${claim.claimId} attempts to publish a canonical claim; OpenClaw PRs may stage candidates only`
      });
    }

    if (claim.reviewState === "human_reviewed") {
      issues.push({
        message: `Claim ${claim.claimId} uses human_reviewed; OpenClaw artifacts must not self-assert human review`
      });
    }

    for (const evidenceId of claim.evidenceIds) {
      const linkedEvidence = evidenceById.get(evidenceId);
      if (!linkedEvidence) {
        issues.push({
          message: `Claim ${claim.claimId} references missing evidence ${evidenceId}`
        });
      } else if (linkedEvidence.claimId !== claim.claimId) {
        issues.push({
          message: `Evidence ${evidenceId} is linked to ${linkedEvidence.claimId}, not ${claim.claimId}`
        });
      }
    }
  }

  for (const evidenceArtifact of evidence) {
    if (!claimsById.has(evidenceArtifact.claimId)) {
      issues.push({
        message: `Evidence ${evidenceArtifact.evidenceId} references missing claim ${evidenceArtifact.claimId}`
      });
    }

    if (snapshotHashes.size && !snapshotHashes.has(evidenceArtifact.snapshotHash)) {
      issues.push({
        message: `Evidence ${evidenceArtifact.evidenceId} snapshotHash does not match a staged source snapshot`
      });
    }
  }
}

function validateReviewDecisions(
  artifacts: OpenClawStagedArtifact[],
  issues: ValidationIssue[]
): void {
  const decisions = artifacts.filter(
    (artifact): artifact is Extract<OpenClawStagedArtifact, { artifactType: "review_decision" }> =>
      artifact.artifactType === "review_decision"
  );

  for (const decision of decisions) {
    if (
      decision.reviewState === "human_reviewed" &&
      decision.reviewerType !== "human"
    ) {
      issues.push({
        message: `Review decision ${decision.decisionId} marks human_reviewed without a human reviewer`
      });
    }
  }
}

function validateVersionedPublicLinks(
  value: unknown,
  issues: ValidationIssue[],
  pathParts: string[] = []
): void {
  if (typeof value === "string") {
    if (value.includes("/api/public/") && !value.includes(`/api/public/${PUBLIC_API_VERSION}/`)) {
      issues.push({
        message: `${pathParts.join(".") || "value"} contains unversioned /api/public link: ${value}`
      });
    }
    return;
  }

  if (!value || typeof value !== "object") return;

  if (Array.isArray(value)) {
    value.forEach((item, index) =>
      validateVersionedPublicLinks(item, issues, [...pathParts, String(index)])
    );
    return;
  }

  Object.entries(value as Record<string, unknown>).forEach(([key, item]) =>
    validateVersionedPublicLinks(item, issues, [...pathParts, key])
  );
}

function validateRawArtifactPaths(
  value: unknown,
  issues: ValidationIssue[],
  pathParts: string[] = []
): void {
  if (Array.isArray(value)) {
    if (
      pathParts.at(-1) === "rawArtifactPaths" &&
      value.some((item) => typeof item === "string")
    ) {
      issues.push({
        message: `${pathParts.join(".")} must be empty; raw HTML/PDF/screenshots must not be staged for Git`
      });
    }

    value.forEach((item, index) =>
      validateRawArtifactPaths(item, issues, [...pathParts, String(index)])
    );
    return;
  }

  if (typeof value === "string") {
    if (looksLikeRawLocalArtifactPath(value)) {
      issues.push({
        message: `${pathParts.join(".") || "value"} looks like a raw local artifact path intended for Git: ${value}`
      });
    }
    return;
  }

  if (!value || typeof value !== "object") return;

  Object.entries(value as Record<string, unknown>).forEach(([key, item]) =>
    validateRawArtifactPaths(item, issues, [...pathParts, key])
  );
}

function validateRightsCaveat(
  artifact: OpenClawStagedArtifact,
  issues: ValidationIssue[]
): void {
  if (artifact.artifactType === "evidence_candidate") {
    assertRightsCaveat(artifact.rightsNote, `Evidence ${artifact.evidenceId} rightsNote`, issues);
    assertRightsCaveat(
      artifact.citation.sourceRights,
      `Evidence ${artifact.evidenceId} citation.sourceRights`,
      issues
    );
  }

  if (artifact.artifactType === "report_draft") {
    assertRightsCaveat(
      artifact.sourceRightsPolicy,
      `Report ${artifact.reportId} sourceRightsPolicy`,
      issues
    );
  }
}

function assertRightsCaveat(
  value: string,
  label: string,
  issues: ValidationIssue[]
): void {
  if (value !== OFFICIAL_SOURCE_RIGHTS_CAVEAT && !value.toLowerCase().includes("rights")) {
    issues.push({
      message: `${label} must include the official source rights caveat`
    });
  }
}

function looksLikeRawLocalArtifactPath(value: string): boolean {
  if (/^https?:\/\//.test(value)) return false;

  return /\.(html?|pdf|png|jpe?g|webp)$/i.test(value);
}

function countByArtifactType(
  artifacts: OpenClawStagedArtifact[]
): Map<OpenClawStagedArtifact["artifactType"], number> {
  const counts = new Map<OpenClawStagedArtifact["artifactType"], number>();

  for (const artifact of artifacts) {
    counts.set(artifact.artifactType, (counts.get(artifact.artifactType) ?? 0) + 1);
  }

  return counts;
}

function formatZodIssues(file: string, error: ZodError): ValidationIssue[] {
  return error.issues.map((issue) => ({
    file,
    message: `${issue.path.join(".") || "artifact"}: ${issue.message}`
  }));
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
