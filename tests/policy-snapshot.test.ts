import { readFile, readdir } from "node:fs/promises";
import assert from "node:assert/strict";
import test from "node:test";
import path from "node:path";
import {
  policySnapshotIndependentReviewSchema,
  policySnapshotIndexSchema,
  policySnapshotSchema
} from "@uapt/shared";
import {
  loadPolicySnapshotFixture,
  validatePolicySnapshotAgainstPublicData
} from "../apps/web/lib/policy-snapshots";
import {
  getCurrentPublicReleaseManifest,
  getStagedPublicSummaryBySlug
} from "../apps/web/lib/staged-public-data";

const fixturePath = path.join(
  process.cwd(),
  "examples",
  "fixtures",
  "policy-snapshot-v1-bristol.json"
);

const riskCohortSlugs = [
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

const trafficCohortSlugs = [
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

const cohortSlugs = [...riskCohortSlugs, ...trafficCohortSlugs] as const;

test("strong fixture matches current public claims, source hashes, and release", async () => {
  const fixture = policySnapshotSchema.parse(
    JSON.parse(await readFile(fixturePath, "utf8"))
  );
  assert.equal(fixture.review.reviewMethod, "dual_agent");
  const [summary, release] = await Promise.all([
    getStagedPublicSummaryBySlug(fixture.universitySlug),
    getCurrentPublicReleaseManifest()
  ]);
  assert(summary);
  assert(release);

  const loaded = await loadPolicySnapshotFixture(
    fixturePath,
    summary,
    release.releaseId
  );
  assert.equal(loaded.validation.effectiveStatus, "strong");
  assert.equal(loaded.validation.expectedBasisFingerprint, fixture.basisFingerprint);
  assert.deepEqual(
    fixture.dimensions.map((dimension) => dimension.key),
    [
      "coursework",
      "exams",
      "disclosure",
      "privacy_data",
      "approved_tools",
      "research_publication"
    ]
  );
});

test("a release change downgrades a strong snapshot to stale", async () => {
  const fixture = policySnapshotSchema.parse(
    JSON.parse(await readFile(fixturePath, "utf8"))
  );
  const summary = await getStagedPublicSummaryBySlug(fixture.universitySlug);
  assert(summary);

  const validation = validatePolicySnapshotAgainstPublicData(
    fixture,
    summary,
    `${fixture.releaseId}-next`
  );
  assert.equal(validation.effectiveStatus, "stale");
  assert(validation.issues.some((issue) => issue.code === "release_changed"));
});

test("a referenced source hash change downgrades a snapshot to stale", async () => {
  const fixture = policySnapshotSchema.parse(
    JSON.parse(await readFile(fixturePath, "utf8"))
  );
  const summary = await getStagedPublicSummaryBySlug(fixture.universitySlug);
  assert(summary);
  const changedHash = "a".repeat(64);
  const changedSourceUrl = fixture.basis.sources[0].sourceUrl;
  const changed = structuredClone(fixture);
  changed.basis.sources = changed.basis.sources.map((source) =>
    source.sourceUrl === changedSourceUrl
      ? { ...source, sourceSnapshotHash: changedHash }
      : source
  );
  changed.dimensions = changed.dimensions.map((dimension) => ({
    ...dimension,
    basis: {
      ...dimension.basis,
      sources: dimension.basis.sources.map((source) =>
        source.sourceUrl === changedSourceUrl
          ? { ...source, sourceSnapshotHash: changedHash }
          : source
      )
    }
  }));

  const validation = validatePolicySnapshotAgainstPublicData(
    changed,
    summary,
    fixture.releaseId
  );
  assert.equal(validation.effectiveStatus, "stale");
  assert(validation.issues.some((issue) => issue.code === "source_hash_changed"));
});

test("needs_review snapshots remain explicit and never become strong", async () => {
  const fixture = policySnapshotSchema.parse(
    JSON.parse(await readFile(fixturePath, "utf8"))
  );
  const needsReview = policySnapshotSchema.parse({
    ...fixture,
    overallStatus: "needs_review",
    statusReasons: ["review_incomplete"]
  });
  assert.equal(needsReview.overallStatus, "needs_review");
});

test("strong schema rejects an incomplete dual-agent review", async () => {
  const fixture = policySnapshotSchema.parse(
    JSON.parse(await readFile(fixturePath, "utf8"))
  );
  assert.throws(() =>
    policySnapshotSchema.parse({
      ...fixture,
      review: {
        ...fixture.review,
        secondary: { ...fixture.review.secondary, decision: "needs_review" }
      }
    })
  );
});

test("all indexed snapshots are schema-valid and evidence-bound", async () => {
  const root = path.join(process.cwd(), "data", "policy-snapshots", "v1");
  const index = policySnapshotIndexSchema.parse(
    JSON.parse(await readFile(path.join(root, "index.json"), "utf8"))
  );
  const release = await getCurrentPublicReleaseManifest();
  assert(release);
  const review = policySnapshotIndependentReviewSchema.parse(
    JSON.parse(
      await readFile(
        path.join(root, "reviews", "uapt-6-independent-review.json"),
        "utf8"
      )
    )
  );
  assert.deepEqual(
    index.entries.map((entry) => entry.universitySlug),
    cohortSlugs
  );
  assert.deepEqual(
    (await readdir(path.join(root, "universities"))).sort(),
    cohortSlugs.map((slug) => `${slug}.json`).sort()
  );

  for (const entry of index.entries) {
    const snapshot = policySnapshotSchema.parse(
      JSON.parse(await readFile(path.join(root, entry.file), "utf8"))
    );
    const summary = await getStagedPublicSummaryBySlug(entry.universitySlug);
    assert(summary);
    const validation = validatePolicySnapshotAgainstPublicData(
      snapshot,
      summary,
      release.releaseId
    );
    const decision = review.decisions.find(
      (item) => item.universitySlug === entry.universitySlug
    );
    assert(decision);
    const expectedStatus = decision.decision === "pass" ? "strong" : "needs_review";

    assert.equal(snapshot.overallStatus, expectedStatus);
    assert.equal(snapshot.review.reviewMethod, "dual_agent");
    assert.equal(
      snapshot.review.secondary.agentId,
      "uapt-6-secondary-reviewer"
    );
    assert.equal(
      snapshot.review.secondary.decision,
      expectedStatus === "strong" ? "approve" : "needs_review"
    );
    assert.deepEqual(snapshot.translations, []);
    assert.equal(validation.effectiveStatus, expectedStatus);
    if (expectedStatus === "strong") {
      assert.equal(validation.expectedBasisFingerprint, snapshot.basisFingerprint);
      assert.deepEqual(validation.issues, []);
    } else {
      assert(validation.issues.length >= 1);
    }
    assert.equal(entry.basisFingerprint, snapshot.basisFingerprint);
    assert.equal(entry.releaseId, release.releaseId);
  }
});
