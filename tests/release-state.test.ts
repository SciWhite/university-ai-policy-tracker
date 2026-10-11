import assert from "node:assert/strict";
import test from "node:test";
import { validatePublishedReleaseChain } from "../scripts/lib/release-state";

const first = { releaseId: "a", publishedAt: "2026-09-21", description: "Published", includeStagedArtifactDirectories: ["one"] };
const current = { ...first, releaseId: "b", publishedAt: "2026-09-24", previousReleaseId: "a" };
const history = [{ manifest: first, path: "a.json" }];

test("identical current/archive copy does not make a release its own predecessor", () => {
  const result = validatePublishedReleaseChain(current, [...history, { manifest: { ...current }, path: "b.json" }]);
  assert.deepEqual(result.published.map((m) => m.releaseId), ["a", "b"]);
  assert.equal(result.identicalCopies, 1);
});
test("object key ordering does not change an otherwise identical release", () => {
  const reordered = { previousReleaseId: "a", publishedAt: current.publishedAt, releaseId: "b", description: first.description, includeStagedArtifactDirectories: ["one"] };
  assert.equal(validatePublishedReleaseChain(current, [...history, { manifest: reordered, path: "b.json" }]).identicalCopies, 1);
});
test("same ID with different staged inputs or metadata is rejected", () => {
  for (const changed of [{ ...current, includeStagedArtifactDirectories: ["other"] }, { ...current, description: "Different" }]) {
    assert.throws(() => validatePublishedReleaseChain(current, [...history, { manifest: changed, path: "conflict.json" }]), /Conflicting manifests/);
  }
});
test("deduplication retains unknown, self, skipped and latest-release guards", () => {
  assert.throws(() => validatePublishedReleaseChain({ ...current, previousReleaseId: "missing" }, history), /unknown previous/);
  assert.throws(() => validatePublishedReleaseChain({ ...current, previousReleaseId: "b" }, history), /itself/);
  const middle = { ...first, releaseId: "middle", publishedAt: "2026-09-23", previousReleaseId: "a" };
  assert.throws(() => validatePublishedReleaseChain(current, [...history, { manifest: middle, path: "middle.json" }]), /chronological previous/);
  assert.throws(() => validatePublishedReleaseChain(first, [{ manifest: current, path: "b.json" }]), /not the latest/);
});
