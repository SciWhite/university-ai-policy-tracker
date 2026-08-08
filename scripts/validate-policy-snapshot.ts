import { readFile, readdir } from "node:fs/promises";
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

const COHORT_SLUGS = [
  "unsw-sydney",
  "cornell-university",
  "university-of-sydney",
  "de-la-salle-university",
  "university-of-auckland",
  "imperial-college-london",
  "university-of-melbourne",
  "utrecht-university",
  "adelaide-university",
  "ubc"
] as const;

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

const ALL_COHORT_SLUGS = [...RISK_COHORT_SLUGS, ...COHORT_SLUGS] as const;

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
  await validateCandidateCohort(index, release.releaseId);

  console.log(
    `Validated ${POLICY_SNAPSHOT_SCHEMA_VERSION} fixture ${fixture.universitySlug}: six dimensions, ${fixture.basis.claimIds.length} basis claims, ${fixture.basis.sources.length} source hashes, strong/stale fail-closed checks passed; candidate cohort entries=${ALL_COHORT_SLUGS.length}, schema/basis/index checks passed.`
  );
}

async function validateCandidateCohort(
  index: ReturnType<typeof policySnapshotIndexSchema.parse>,
  releaseId: string
): Promise<void> {
  const snapshotRoot = path.join(
    process.cwd(),
    "data",
    "policy-snapshots",
    "v1"
  );
  const universityRoot = path.join(snapshotRoot, "universities");
  const expectedFiles = ALL_COHORT_SLUGS.map((slug) => `${slug}.json`);
  const actualFiles = (await readdir(universityRoot)).sort();
  assert(
    JSON.stringify(actualFiles) === JSON.stringify(expectedFiles.slice().sort()),
    `Candidate university files must be exactly ${expectedFiles.join(", ")}; found ${actualFiles.join(", ")}`
  );
  assert(
    index.releaseId === releaseId,
    `Candidate index release ${index.releaseId} does not match current release ${releaseId}`
  );
  assert(
    index.entries.length === ALL_COHORT_SLUGS.length,
    `Candidate index must contain exactly ${ALL_COHORT_SLUGS.length} entries`
  );

  for (const [position, slug] of ALL_COHORT_SLUGS.entries()) {
    const entry = index.entries[position];
    assert(entry, `Missing candidate index entry ${slug}`);
    assert(
      entry.universitySlug === slug,
      `Candidate index order/slug mismatch at ${position}: expected ${slug}, got ${entry.universitySlug}`
    );
    assert(
      entry.file === `universities/${slug}.json`,
      `Candidate ${slug} has an unexpected file path ${entry.file}`
    );

    const snapshot = policySnapshotSchema.parse(
      JSON.parse(await readFile(path.join(snapshotRoot, entry.file), "utf8"))
    );
    const summary = await getStagedPublicSummaryBySlug(slug);
    assert(summary, `Missing current public summary for candidate ${slug}`);
    assert(snapshot.universitySlug === summary.entity.slug, `${slug} slug mismatch`);
    assert(
      snapshot.universityName === summary.entity.name,
      `${slug} name ${snapshot.universityName} does not match staged name ${summary.entity.name}`
    );
    assert(snapshot.releaseId === releaseId, `${slug} release mismatch`);
    assert(snapshot.overallStatus === "needs_review", `${slug} must remain needs_review`);
    assert(
      snapshot.statusReasons.includes("review_incomplete"),
      `${slug} must include review_incomplete`
    );
    assert(
      snapshot.review.reviewState === "needs_review" &&
        snapshot.review.secondary.agentId === "pending-independent-review" &&
        snapshot.review.secondary.decision === "needs_review",
      `${slug} must retain an explicit pending independent review placeholder`
    );
    assert(snapshot.translations.length === 0, `${slug} must not include translations`);
    assert(
      entry.universityName === snapshot.universityName &&
        entry.publicJsonUrl === snapshot.publicJsonUrl &&
        entry.releaseId === snapshot.releaseId &&
        entry.generatedAt === snapshot.generatedAt &&
        entry.basisFingerprint === snapshot.basisFingerprint &&
        JSON.stringify(entry.locales) ===
          JSON.stringify(snapshot.translations.map((translation) => translation.locale)),
      `${slug} index metadata does not match its snapshot`
    );

    const validation = validatePolicySnapshotAgainstPublicData(
      snapshot,
      summary,
      releaseId
    );
    assert(
      validation.effectiveStatus === "needs_review",
      `${slug} candidate validation unexpectedly resolved to ${validation.effectiveStatus}`
    );
    assert(
      validation.expectedBasisFingerprint === snapshot.basisFingerprint,
      `${slug} basis fingerprint does not match current public claims, source URLs, and hashes`
    );
    assert(
      validation.issues.length >= 1 &&
        validation.issues.every((issue) => issue.code === "review_incomplete"),
      `${slug} has unexpected public-data validation issues: ${validation.issues.map((issue) => issue.code).join(", ")}`
    );
  }
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}
