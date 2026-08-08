import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  POLICY_SNAPSHOT_SCHEMA_VERSION,
  policySnapshotIndexSchema,
  policySnapshotResponseSchema,
  policySnapshotSchema
} from "@uapt/shared";
import {
  buildPolicySnapshotResponse,
  getLoadedPolicySnapshotIndex,
  loadPolicySnapshotFixture,
  validatePolicySnapshotAgainstPublicData
} from "../apps/web/lib/policy-snapshots";
import {
  getCurrentPublicReleaseManifest,
  getStagedPublicSummaryBySlug
} from "../apps/web/lib/staged-public-data";

void main();

const RISK_COHORT_SLUGS = [
  "aalto-university",
  "harvard-university",
  "jagiellonian-university",
  "massachusetts-institute-of-technology",
  "national-university-of-singapore",
  "snu",
  "stanford-university",
  "sultan-qaboos-university",
  "tsinghua-university",
  "u-tokyo",
  "universitat-innsbruck",
  "university-of-cambridge",
  "university-of-oxford",
  "zhejiang-university"
] as const;

async function main(): Promise<void> {
  const fixturePath = path.join(
    process.cwd(),
    "examples",
    "fixtures",
    "policy-snapshot-v1-bristol.json"
  );
  const fixture = policySnapshotSchema.parse(
    JSON.parse(await readFile(fixturePath, "utf8"))
  );
  const [summary, release, indexText] = await Promise.all([
    getStagedPublicSummaryBySlug(fixture.universitySlug),
    getCurrentPublicReleaseManifest(),
    readFile(
      path.join(process.cwd(), "data", "policy-snapshots", "v1", "index.json"),
      "utf8"
    )
  ]);

  assert(summary, `Missing current public summary for ${fixture.universitySlug}`);
  assert(release, "Missing current public release manifest");
  assert(
    fixture.releaseId === release.releaseId,
    `Fixture release ${fixture.releaseId} does not match current release ${release.releaseId}`
  );

  const loaded = await loadPolicySnapshotFixture(
    fixturePath,
    summary,
    release.releaseId
  );
  assert(
    loaded.validation.effectiveStatus === "strong",
    `Expected strong fixture, got ${loaded.validation.effectiveStatus}: ${loaded.validation.issues.map((issue) => issue.message).join(" | ")}`
  );
  assert(
    loaded.validation.expectedBasisFingerprint === fixture.basisFingerprint,
    "Fixture basis fingerprint does not match the current public basis"
  );
  policySnapshotResponseSchema.parse(
    buildPolicySnapshotResponse(loaded, "https://eduaipolicy.org")
  );

  const stale = validatePolicySnapshotAgainstPublicData(
    fixture,
    summary,
    `${release.releaseId}-changed`
  );
  assert(stale.effectiveStatus === "stale", "Release mismatch must be stale");
  assert(
    stale.issues.some((issue) => issue.code === "release_changed"),
    "Release mismatch did not produce release_changed"
  );

  const index = policySnapshotIndexSchema.parse(JSON.parse(indexText));
  assert(
    index.schemaVersion === "uapt-policy-snapshot-index-v1" &&
      index.snapshotSchemaVersion === POLICY_SNAPSHOT_SCHEMA_VERSION,
    "Invalid policy snapshot index versions"
  );
  assert(
    index.releaseId === release.releaseId,
    `Snapshot index release ${index.releaseId} does not match current release ${release.releaseId}`
  );
  assert(
    JSON.stringify(index.entries.map((entry) => entry.universitySlug)) ===
      JSON.stringify(RISK_COHORT_SLUGS),
    "Risk cohort index entries must contain exactly the deterministic slug order"
  );

  const loadedIndex = await getLoadedPolicySnapshotIndex();
  assert(
    loadedIndex.entries.length === RISK_COHORT_SLUGS.length,
    `Expected ${RISK_COHORT_SLUGS.length} loaded cohort snapshots, got ${loadedIndex.entries.length}`
  );
  for (const entry of loadedIndex.entries) {
    assert(
      entry.overallStatus === "needs_review",
      `${entry.universitySlug} must remain needs_review at candidate stage`
    );
    assert(
      entry.loaded.validation.expectedBasisFingerprint ===
        entry.loaded.snapshot.basisFingerprint,
      `${entry.universitySlug} basis fingerprint does not match current claims and sources`
    );
    assert(
      entry.loaded.snapshot.review.primary.decision === "approve" &&
        entry.loaded.snapshot.review.secondary.agentId ===
          "pending-independent-review" &&
        entry.loaded.snapshot.review.secondary.decision === "needs_review",
      `${entry.universitySlug} must record primary authorship and pending independent review`
    );
    assert(
      entry.loaded.snapshot.statusReasons.includes("review_incomplete") &&
        entry.loaded.snapshot.translations.length === 0,
      `${entry.universitySlug} must be an English-only incomplete-review candidate`
    );
  }

  console.log(
    `Validated ${POLICY_SNAPSHOT_SCHEMA_VERSION} fixture ${fixture.universitySlug}: six dimensions, ${fixture.basis.claimIds.length} basis claims, ${fixture.basis.sources.length} source hashes, strong/stale fail-closed checks passed; risk cohort entries=${index.entries.length}, all needs_review fingerprints and review boundaries passed.`
  );
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}
