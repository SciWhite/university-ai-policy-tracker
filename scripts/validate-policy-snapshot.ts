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
  loadPolicySnapshotFixture,
  validatePolicySnapshotAgainstPublicData
} from "../apps/web/lib/policy-snapshots";
import {
  getCurrentPublicReleaseManifest,
  getStagedPublicSummaryBySlug
} from "../apps/web/lib/staged-public-data";

void main();

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

  console.log(
    `Validated ${POLICY_SNAPSHOT_SCHEMA_VERSION} fixture ${fixture.universitySlug}: six dimensions, ${fixture.basis.claimIds.length} basis claims, ${fixture.basis.sources.length} source hashes, strong/stale fail-closed checks passed; public index entries=${index.entries.length}.`
  );
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}
