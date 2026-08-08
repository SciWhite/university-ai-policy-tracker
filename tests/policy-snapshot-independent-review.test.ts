import { readFile, readdir } from "node:fs/promises";
import assert from "node:assert/strict";
import test from "node:test";
import path from "node:path";
import {
  policySnapshotIndependentReviewSchema,
  policySnapshotIndexSchema,
  policySnapshotSchema
} from "@uapt/shared";
import { getLoadedPolicySnapshotIndex } from "../apps/web/lib/policy-snapshots";

const root = path.join(process.cwd(), "data", "policy-snapshots", "v1");
const reviewPath = path.join(root, "reviews", "uapt-6-independent-review.json");

async function readReview() {
  return policySnapshotIndependentReviewSchema.parse(
    JSON.parse(await readFile(reviewPath, "utf8"))
  );
}

test("UAPT 6 review artifact covers exactly the indexed 24 snapshots", async () => {
  const index = policySnapshotIndexSchema.parse(
    JSON.parse(await readFile(path.join(root, "index.json"), "utf8"))
  );
  const review = await readReview();

  assert.equal(review.reviewMethod, "dual_agent");
  assert.equal(review.expectedEntryCount, 24);
  assert.deepEqual(
    review.decisions.map((decision) => decision.universitySlug),
    index.entries.map((entry) => entry.universitySlug)
  );
  assert.deepEqual(review.decisionCounts, {
    pass: 17,
    return_to_author: 0,
    needs_review: 7
  });
  assert.deepEqual(review.publicationStatusCounts, {
    strong: 17,
    needs_review: 7
  });
  assert.deepEqual(
    (await readdir(path.join(root, "universities"))).sort(),
    index.entries.map((entry) => entry.file.replace("universities/", "")).sort()
  );
});

test("second-round blockers remain fail-closed", async () => {
  const review = await readReview();
  const bySlug = new Map(
    review.decisions.map((decision) => [decision.universitySlug, decision])
  );

  for (const slug of [
    "jagiellonian-university",
    "snu",
    "tsinghua-university",
    "u-tokyo",
    "universitat-innsbruck",
    "zhejiang-university"
  ]) {
    assert.deepEqual(bySlug.get(slug)?.issueCodes, [
      "TRANSLATION_REVIEW_MISSING"
    ]);
    assert.equal(bySlug.get(slug)?.decision, "needs_review");
  }

  assert.deepEqual(bySlug.get("sultan-qaboos-university")?.issueCodes, [
    "BASIS_CLAIM_UNREVIEWED"
  ]);
  assert.equal(
    bySlug.get("sultan-qaboos-university")?.decision,
    "needs_review"
  );
  assert.equal(bySlug.get("unsw-sydney")?.decision, "pass");
});

test("UAPT 6 decisions preserve evidence pointers and fail-closed statuses", async () => {
  const index = policySnapshotIndexSchema.parse(
    JSON.parse(await readFile(path.join(root, "index.json"), "utf8"))
  );
  const review = await readReview();
  const decisions = new Map(
    review.decisions.map((decision) => [decision.universitySlug, decision])
  );

  for (const entry of index.entries) {
    const snapshot = policySnapshotSchema.parse(
      JSON.parse(await readFile(path.join(root, entry.file), "utf8"))
    );
    const decision = decisions.get(entry.universitySlug);
    assert(decision);
    assert.equal(snapshot.review.reviewMethod, "dual_agent");
    assert.equal(decision.evidence.basisFingerprint, snapshot.basisFingerprint);
    assert.deepEqual(decision.evidence.claimIds, snapshot.basis.claimIds);
    assert.deepEqual(decision.evidence.sourceRefs, snapshot.basis.sources);

    const expectedStatus = decision.decision === "pass" ? "strong" : "needs_review";
    assert.equal(snapshot.overallStatus, expectedStatus);
    assert.equal(entry.overallStatus, expectedStatus);
    if (expectedStatus === "strong") {
      assert.equal(snapshot.review.reviewState, "dual_agent_reviewed");
      assert.equal(snapshot.review.secondary.decision, "approve");
      assert.equal(snapshot.review.agreement, "agree");
      assert.deepEqual(snapshot.statusReasons, []);
    } else {
      assert.equal(snapshot.review.reviewState, "needs_review");
      assert.equal(snapshot.review.secondary.decision, "needs_review");
      assert.equal(snapshot.review.agreement, "disagree");
      assert(snapshot.statusReasons.includes("review_incomplete"));
    }
  }
});

test("API loader reports the reviewed strong and fail-closed counts", async () => {
  const loaded = await getLoadedPolicySnapshotIndex();
  assert.equal(loaded.entries.length, 24);
  assert.equal(
    loaded.entries.filter((entry) => entry.overallStatus === "strong").length,
    17
  );
  assert.equal(
    loaded.entries.filter((entry) => entry.overallStatus === "needs_review").length,
    7
  );
  assert.equal(
    loaded.entries.filter((entry) => entry.overallStatus === "stale").length,
    0
  );
  for (const entry of loaded.entries) {
    assert.equal(entry.overallStatus, entry.loaded.validation.effectiveStatus);
  }
});
