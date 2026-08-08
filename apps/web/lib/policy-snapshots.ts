import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  NO_ADVICE_BOUNDARY,
  OFFICIAL_SOURCE_RIGHTS_CAVEAT,
  POLICY_SNAPSHOT_SCHEMA_VERSION,
  PUBLIC_API_VERSION,
  TRACKER_METADATA_LICENSE,
  buildPublicApiCitation,
  policySnapshotIndexSchema,
  policySnapshotResponseSchema,
  policySnapshotSchema,
  publicUniversityPolicySnapshotLinkSchema,
  type PolicyClaim,
  type PolicySnapshot,
  type PolicySnapshotBasis,
  type PolicySnapshotIndex,
  type PolicySnapshotIndexEntry,
  type PolicySnapshotOverallStatus,
  type PolicySnapshotResponse,
  type PolicySnapshotSourceRef,
  type PolicySnapshotStatusReason,
  type PublicEntitySummary,
  type PublicUniversityPolicySnapshotLink
} from "@uapt/shared";
import {
  getCurrentPublicReleaseManifest,
  getStagedPublicSummaryBySlug
} from "./staged-public-data";
import { findRepoRoot } from "./repo-root";
import { getSiteBaseUrl } from "./site-url";

const SNAPSHOT_DATA_ROOT = ["data", "policy-snapshots", "v1"];

export interface PolicySnapshotValidation {
  effectiveStatus: PolicySnapshotOverallStatus;
  expectedBasisFingerprint?: string;
  issues: Array<{
    code: PolicySnapshotStatusReason;
    message: string;
  }>;
}

export interface LoadedPolicySnapshot {
  snapshot: PolicySnapshot;
  validation: PolicySnapshotValidation;
}

interface PolicySnapshotIndexEntryWithLoaded extends PolicySnapshotIndexEntry {
  loaded: LoadedPolicySnapshot;
}

export interface LoadedPolicySnapshotIndex
  extends Omit<PolicySnapshotIndex, "entries"> {
  entries: PolicySnapshotIndexEntryWithLoaded[];
}

let indexPromise: Promise<PolicySnapshotIndex> | undefined;

export async function getPolicySnapshotIndexManifest(): Promise<PolicySnapshotIndex> {
  indexPromise ??= readPolicySnapshotIndexManifest();
  return indexPromise;
}

export async function getLoadedPolicySnapshotIndex(): Promise<LoadedPolicySnapshotIndex> {
  const index = await getPolicySnapshotIndexManifest();
  const entries: PolicySnapshotIndexEntryWithLoaded[] = [];

  for (const entry of index.entries) {
    const loaded = await loadPolicySnapshotBySlug(entry.universitySlug, entry.file);
    if (!loaded) continue;

    const indexedMismatch =
      loaded.snapshot.universityName !== entry.universityName ||
      loaded.snapshot.releaseId !== entry.releaseId ||
      loaded.snapshot.generatedAt !== entry.generatedAt ||
      loaded.snapshot.basisFingerprint !== entry.basisFingerprint ||
      loaded.snapshot.publicJsonUrl !== entry.publicJsonUrl;
    const indexedLoaded = indexedMismatch
      ? withIndexMismatch(loaded, entry)
      : loaded;

    entries.push({
      ...entry,
      overallStatus: indexedLoaded.validation.effectiveStatus,
      releaseId: indexedLoaded.snapshot.releaseId,
      generatedAt: indexedLoaded.snapshot.generatedAt,
      basisFingerprint: indexedLoaded.snapshot.basisFingerprint,
      locales: indexedLoaded.snapshot.translations.map(
        (translation) => translation.locale
      ),
      loaded: indexedLoaded
    });
  }

  return { ...index, entries };
}

export async function getLoadedPolicySnapshotBySlug(
  slug: string
): Promise<LoadedPolicySnapshot | undefined> {
  const index = await getPolicySnapshotIndexManifest();
  const entry = index.entries.find((item) => item.universitySlug === slug);
  if (!entry) return undefined;

  const loaded = await loadPolicySnapshotBySlug(slug, entry.file);
  if (!loaded) return undefined;

  return loaded.snapshot.universityName === entry.universityName &&
    loaded.snapshot.releaseId === entry.releaseId &&
    loaded.snapshot.generatedAt === entry.generatedAt &&
    loaded.snapshot.basisFingerprint === entry.basisFingerprint &&
    loaded.snapshot.publicJsonUrl === entry.publicJsonUrl
      ? loaded
      : withIndexMismatch(loaded, entry);
}

export async function getPublicUniversityPolicySnapshotLink(
  slug: string,
  siteBaseUrl = getSiteBaseUrl()
): Promise<PublicUniversityPolicySnapshotLink | undefined> {
  const loaded = await getLoadedPolicySnapshotBySlug(slug);
  if (!loaded) return undefined;

  return publicUniversityPolicySnapshotLinkSchema.parse({
    publicJsonUrl: new URL(
      `/api/public/${PUBLIC_API_VERSION}/policy-snapshots/universities/${slug}.json`,
      siteBaseUrl
    ).toString(),
    overallStatus: loaded.validation.effectiveStatus,
    releaseId: loaded.snapshot.releaseId,
    basisFingerprint: loaded.snapshot.basisFingerprint
  });
}

export function buildPolicySnapshotResponse(
  loaded: LoadedPolicySnapshot,
  siteBaseUrl = getSiteBaseUrl(),
  generatedAt = new Date().toISOString()
): PolicySnapshotResponse {
  const snapshot = loaded.snapshot;
  const canonicalUrl = new URL(
    `/universities/${snapshot.universitySlug}`,
    siteBaseUrl
  ).toString();
  const publicJsonUrl = new URL(
    `/api/public/${PUBLIC_API_VERSION}/policy-snapshots/universities/${snapshot.universitySlug}.json`,
    siteBaseUrl
  ).toString();
  const data = policySnapshotSchema.parse({
    ...snapshot,
    canonicalUrl,
    overallStatus: loaded.validation.effectiveStatus,
    statusReasons:
      loaded.validation.effectiveStatus === "strong"
        ? []
        : uniqueReasons([
            ...snapshot.statusReasons,
            ...loaded.validation.issues.map((issue) => issue.code)
          ])
  });

  return policySnapshotResponseSchema.parse({
    apiVersion: PUBLIC_API_VERSION,
    generatedAt,
    canonicalUrl,
    license: TRACKER_METADATA_LICENSE,
    trackerMetadataLicense: TRACKER_METADATA_LICENSE,
    sourcePolicy: OFFICIAL_SOURCE_RIGHTS_CAVEAT,
    sourceRightsPolicy: OFFICIAL_SOURCE_RIGHTS_CAVEAT,
    limitations: snapshot.limitations.length
      ? snapshot.limitations
      : [NO_ADVICE_BOUNDARY],
    citation: buildPublicApiCitation({
      citationTitle: `${snapshot.universityName} student policy snapshot`,
      canonicalUrl,
      publicJsonUrl,
      suggestedCitation:
        `University AI Policy Tracker. "${snapshot.universityName} student policy snapshot." ` +
        `Version ${POLICY_SNAPSHOT_SCHEMA_VERSION}. ${canonicalUrl}`
    }),
    data
  });
}

export async function loadPolicySnapshotFixture(
  filePath: string,
  summary: PublicEntitySummary,
  releaseId: string
): Promise<LoadedPolicySnapshot> {
  const parsed = policySnapshotSchema.parse(
    JSON.parse(await readFile(filePath, "utf8"))
  );
  return {
    snapshot: parsed,
    validation: validatePolicySnapshotAgainstPublicData(
      parsed,
      summary,
      releaseId
    )
  };
}

export function validatePolicySnapshotAgainstPublicData(
  snapshot: PolicySnapshot,
  summary: PublicEntitySummary,
  currentReleaseId: string
): PolicySnapshotValidation {
  const issues: PolicySnapshotValidation["issues"] = [];
  const claimMap = new Map<string, PolicyClaim>();
  for (const claim of summary.claims) {
    if (claim.id) claimMap.set(claim.id, claim);
  }

  const expectedSources = new Map<string, PolicySnapshotSourceRef>();
  const fingerprintClaims: PolicyClaim[] = [];

  if (
    snapshot.review.reviewState !== "dual_agent_reviewed" ||
    snapshot.review.primary.decision !== "approve" ||
    snapshot.review.secondary.decision !== "approve" ||
    snapshot.review.agreement !== "agree"
  ) {
    issues.push({
      code: "review_incomplete",
      message: "Snapshot does not have two agreeing approving agent reviews."
    });
  }

  for (const translation of snapshot.translations) {
    if (translation.review.status !== "reviewed") {
      issues.push({
        code: "translation_needs_review",
        message: `Translation ${translation.locale} is not marked reviewed.`
      });
    }
  }

  if (snapshot.releaseId !== currentReleaseId) {
    issues.push({
      code: "release_changed",
      message: `Snapshot release ${snapshot.releaseId} does not match current release ${currentReleaseId}.`
    });
  }

  if (snapshot.universitySlug !== summary.entity.slug) {
    issues.push({
      code: "basis_claim_missing",
      message: `Snapshot university ${snapshot.universitySlug} does not match public summary ${summary.entity.slug}.`
    });
  }

  for (const claimId of snapshot.basis.claimIds) {
    const claim = claimMap.get(claimId);
    if (!claim) {
      issues.push({
        code: "basis_claim_missing",
        message: `Basis claim ${claimId} is not present in the current public summary.`
      });
      continue;
    }

    fingerprintClaims.push(claim);
    if (
      claim.reviewState !== "agent_reviewed" &&
      claim.reviewState !== "human_reviewed"
    ) {
      issues.push({
        code: "review_incomplete",
        message: `Basis claim ${claimId} is currently ${claim.reviewState}.`
      });
    }

    for (const evidence of claim.evidence) {
      const sourceRef = {
        sourceUrl: evidence.sourceUrl,
        sourceSnapshotHash: evidence.sourceSnapshotHash
      } satisfies PolicySnapshotSourceRef;
      expectedSources.set(sourceRef.sourceUrl, sourceRef);
    }
  }

  const actualSources = sortSources(snapshot.basis.sources);
  const expectedSourceList = sortSources([...expectedSources.values()]);
  if (!sameSourceSet(actualSources, expectedSourceList)) {
    const actualByUrl = new Map(
      actualSources.map((source) => [source.sourceUrl, source.sourceSnapshotHash])
    );
    for (const expected of expectedSourceList) {
      if (!actualByUrl.has(expected.sourceUrl)) {
        issues.push({
          code: "basis_source_missing",
          message: `Basis source ${expected.sourceUrl} is missing from the snapshot.`
        });
      } else if (actualByUrl.get(expected.sourceUrl) !== expected.sourceSnapshotHash) {
        issues.push({
          code: "source_hash_changed",
          message: `Basis source hash changed for ${expected.sourceUrl}.`
        });
      }
    }
  }

  let expectedBasisFingerprint: string | undefined;
  if (fingerprintClaims.length === snapshot.basis.claimIds.length) {
    expectedBasisFingerprint = computePolicySnapshotBasisFingerprint(
      currentReleaseId,
      snapshot.basis,
      fingerprintClaims
    );
    if (expectedBasisFingerprint !== snapshot.basisFingerprint) {
      const hasSourceIssue = issues.some(
        (issue) =>
          issue.code === "source_hash_changed" || issue.code === "basis_source_missing"
      );
      issues.push({
        code: hasSourceIssue ? "basis_fingerprint_mismatch" : "claim_changed",
        message: "Snapshot basisFingerprint does not match current public claims, sources, and release."
      });
    }
  }

  const needsReview = issues.some((issue) =>
    [
      "basis_claim_missing",
      "basis_source_missing",
      "review_incomplete",
      "schema_invalid",
      "translation_needs_review",
      "index_mismatch"
    ].includes(issue.code)
  );
  const isStale = issues.some((issue) =>
    ["release_changed", "claim_changed", "source_hash_changed", "basis_fingerprint_mismatch"].includes(
      issue.code
    )
  );

  let effectiveStatus: PolicySnapshotOverallStatus = snapshot.overallStatus;
  if (snapshot.overallStatus === "needs_review" || needsReview) {
    effectiveStatus = "needs_review";
  } else if (snapshot.overallStatus === "stale" || isStale) {
    effectiveStatus = "stale";
  } else {
    effectiveStatus = "strong";
  }

  return {
    effectiveStatus,
    expectedBasisFingerprint,
    issues: dedupeIssues(issues)
  };
}

export function computePolicySnapshotBasisFingerprint(
  releaseId: string,
  basis: PolicySnapshotBasis,
  claims: PolicyClaim[]
): string {
  const claimMap = new Map(claims.map((claim) => [claim.id, claim]));
  const fingerprintClaims = basis.claimIds
    .slice()
    .sort()
    .map((claimId) => {
      const claim = claimMap.get(claimId);
      if (!claim?.id) {
        throw new Error(`Cannot fingerprint missing claim ${claimId}`);
      }
      return {
        id: claim.id,
        claimType: claim.claimType,
        claimText: claim.claimText,
        claimValue: claim.claimValue ?? null,
        reviewState: claim.reviewState,
        evidence: claim.evidence
          .map((evidence) => ({
            sourceUrl: evidence.sourceUrl,
            sourceSnapshotHash: evidence.sourceSnapshotHash
          }))
          .sort(compareSources)
      };
    });

  const canonical = JSON.stringify({
    releaseId,
    claims: fingerprintClaims,
    sources: sortSources(basis.sources)
  });
  return createHash("sha256").update(canonical, "utf8").digest("hex");
}

async function readPolicySnapshotIndexManifest(): Promise<PolicySnapshotIndex> {
  const repoRoot = await findRepoRoot();
  const indexPath = path.join(repoRoot, ...SNAPSHOT_DATA_ROOT, "index.json");
  const index = policySnapshotIndexSchema.parse(
    JSON.parse(await readFile(indexPath, "utf8"))
  );

  return index;
}

async function loadPolicySnapshotBySlug(
  slug: string,
  relativeFile?: string
): Promise<LoadedPolicySnapshot | undefined> {
  const repoRoot = await findRepoRoot();
  const file = relativeFile ?? `universities/${slug}.json`;
  if (!isSafeSnapshotFile(slug, file)) return undefined;

  let raw: unknown;
  try {
    raw = JSON.parse(
      await readFile(path.join(repoRoot, ...SNAPSHOT_DATA_ROOT, file), "utf8")
    );
  } catch {
    return undefined;
  }

  const snapshot = policySnapshotSchema.safeParse(raw);
  if (!snapshot.success) return undefined;

  const [summary, currentRelease] = await Promise.all([
    getStagedPublicSummaryBySlug(snapshot.data.universitySlug),
    getCurrentPublicReleaseManifest()
  ]);
  if (!summary || !currentRelease) return undefined;

  return {
    snapshot: snapshot.data,
    validation: validatePolicySnapshotAgainstPublicData(
      snapshot.data,
      summary,
      currentRelease.releaseId
    )
  };
}

function isSafeSnapshotFile(slug: string, file: string): boolean {
  return (
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) &&
    file === `universities/${slug}.json`
  );
}

function withIndexMismatch(
  loaded: LoadedPolicySnapshot,
  entry: PolicySnapshotIndexEntry
): LoadedPolicySnapshot {
  return {
    snapshot: loaded.snapshot,
    validation: {
      ...loaded.validation,
      effectiveStatus: "needs_review",
      issues: dedupeIssues([
        ...loaded.validation.issues,
        {
          code: "index_mismatch",
          message: `Snapshot file metadata does not match index entry for ${entry.universitySlug}.`
        }
      ])
    }
  };
}

function sortSources(sources: PolicySnapshotSourceRef[]): PolicySnapshotSourceRef[] {
  return sources.slice().sort(
    (left, right) =>
      left.sourceUrl.localeCompare(right.sourceUrl) ||
      left.sourceSnapshotHash.localeCompare(right.sourceSnapshotHash)
  );
}

function compareSources(
  left: { sourceUrl: string; sourceSnapshotHash: string },
  right: { sourceUrl: string; sourceSnapshotHash: string }
): number {
  return (
    left.sourceUrl.localeCompare(right.sourceUrl) ||
    left.sourceSnapshotHash.localeCompare(right.sourceSnapshotHash)
  );
}

function sameSourceSet(
  left: PolicySnapshotSourceRef[],
  right: PolicySnapshotSourceRef[]
): boolean {
  return JSON.stringify(sortSources(left)) === JSON.stringify(sortSources(right));
}

function uniqueReasons(
  reasons: PolicySnapshotStatusReason[]
): PolicySnapshotStatusReason[] {
  return [...new Set(reasons)];
}

function dedupeIssues(
  issues: PolicySnapshotValidation["issues"]
): PolicySnapshotValidation["issues"] {
  const seen = new Set<string>();
  return issues.filter((issue) => {
    const key = `${issue.code}:${issue.message}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
