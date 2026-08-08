import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";
import test from "node:test";
import path from "node:path";
import {
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

test("strong fixture matches current public claims, source hashes, and release", async () => {
  const fixture = policySnapshotSchema.parse(
    JSON.parse(await readFile(fixturePath, "utf8"))
  );
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
