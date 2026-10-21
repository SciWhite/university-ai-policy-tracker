import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
  symlinkSync
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { validateFrozenHistory } from "../apps/web/lib/v6-history-cache";
import { prepareCandidateBuildInputs } from "../scripts/prepare-candidate-build-inputs";
import type { ShardIndex } from "../apps/web/lib/v6-artifact-store";

const digest = (buf: Buffer | string) => createHash("sha256").update(buf).digest("hex");

// =============================================================================
// 1. Strict Unit Tests for validateFrozenHistory
// =============================================================================

test("validateFrozenHistory: rejects legacy object envelope { baseline, revisions } with descriptive error", () => {
  const legacyEnvelope = {
    baseline: { schemaVersion: "v1", citationTitle: "Test University" },
    revisions: []
  };
  assert.throws(
    () => validateFrozenHistory("anu", legacyEnvelope),
    /Invalid frozen history payload for anu: expected ChangeRecord array, got object/
  );
});

test("validateFrozenHistory: rejects non-array primitives and null/undefined", () => {
  assert.throws(
    () => validateFrozenHistory("anu", null),
    /Invalid frozen history payload for anu: expected ChangeRecord array, got object/
  );
  assert.throws(
    () => validateFrozenHistory("anu", undefined),
    /Invalid frozen history payload for anu: expected ChangeRecord array, got undefined/
  );
  assert.throws(
    () => validateFrozenHistory("anu", "string-history"),
    /Invalid frozen history payload for anu: expected ChangeRecord array, got string/
  );
  assert.throws(
    () => validateFrozenHistory("anu", 12345),
    /Invalid frozen history payload for anu: expected ChangeRecord array, got number/
  );
});

test("validateFrozenHistory: rejects missing slug or foreign slug on row 0", () => {
  assert.throws(
    () => validateFrozenHistory("anu", [{ releaseId: "x", diffRows: [] }]),
    /Missing or invalid slug in frozen history row at index 0 for anu: expected "anu"/
  );
  assert.throws(
    () => validateFrozenHistory("anu", [{ slug: "foreign-school", releaseId: "x", diffRows: [] }]),
    /Foreign slug in frozen history row at index 0 for anu: got "foreign-school"/
  );
  assert.throws(
    () => validateFrozenHistory("anu", [null]),
    /Invalid frozen history row at index 0 for anu: expected object/
  );
});

test("validateFrozenHistory: rejects missing or blank releaseId", () => {
  assert.throws(
    () => validateFrozenHistory("anu", [{ slug: "anu", releaseId: "", diffRows: [] }]),
    /Missing or invalid releaseId in frozen history row at index 0 for anu/
  );
  assert.throws(
    () => validateFrozenHistory("anu", [{ slug: "anu", releaseId: "   ", diffRows: [] }]),
    /Missing or invalid releaseId in frozen history row at index 0 for anu/
  );
  assert.throws(
    () => validateFrozenHistory("anu", [{ slug: "anu", diffRows: [] }]),
    /Missing or invalid releaseId in frozen history row at index 0 for anu/
  );
});

test("validateFrozenHistory: rejects missing or non-array diffRows on row 0 and historical rows", () => {
  // Non-array object on row 0
  assert.throws(
    () => validateFrozenHistory("anu", [{ slug: "anu", releaseId: "x", diffRows: {} }]),
    /Missing or invalid diffRows in frozen history row at index 0 for anu: expected array/
  );
  // Missing diffRows on row 0
  assert.throws(
    () => validateFrozenHistory("anu", [{ slug: "anu", releaseId: "x" }]),
    /Missing or invalid diffRows in frozen history row at index 0 for anu: expected array/
  );
  // Non-array string on row 0
  assert.throws(
    () => validateFrozenHistory("anu", [{ slug: "anu", releaseId: "x", diffRows: "not-array" }]),
    /Missing or invalid diffRows in frozen history row at index 0 for anu: expected array/
  );
  // Non-array diffRows on historical row (index 1)
  assert.throws(
    () => validateFrozenHistory("anu", [
      { slug: "anu", releaseId: "x", diffRows: [] },
      { slug: "anu", releaseId: "y", diffRows: {} }
    ]),
    /Missing or invalid diffRows in frozen history row at index 1 for anu: expected array/
  );
});

test("validateFrozenHistory: accepts valid ChangeRecord arrays and preserves scoped historical rows unchanged", () => {
  const validRows = [
    { slug: "anu", releaseId: "rel-candidate", diffRows: [] },
    { slug: "anu", releaseId: "rel-historical-1", diffRows: [] },
    { releaseId: "rel-historical-2", diffRows: [] } // historical row omitting slug like baseline older releases
  ];
  const priorRows = structuredClone(validRows);
  Object.freeze(validRows[2]);
  const validated = validateFrozenHistory("anu", validRows);
  assert.deepEqual(validRows, priorRows, "validation must preserve every input row");
  assert.equal(validated.length, 3);
  assert.equal(validated[0].slug, "anu");
  assert.equal(validated[0].releaseId, "rel-candidate");
  assert.equal(validated[1].slug, "anu");
  assert.equal(validated[1].releaseId, "rel-historical-1");
  assert.equal(validated[2].slug, undefined); // original scoped historical row stays unchanged
  assert.equal(validated[2].releaseId, "rel-historical-2");
  assert.deepEqual(validated[2].diffRows, []);
});

test("validateFrozenHistory: rejects foreign slug on historical rows", () => {
  assert.throws(
    () => validateFrozenHistory("anu", [
      { slug: "anu", releaseId: "rel-candidate", diffRows: [] },
      { slug: "cuhk", releaseId: "rel-historical", diffRows: [] }
    ]),
    /Foreign slug in frozen history row at index 1 for anu: got "cuhk"/
  );
});

// =============================================================================
// 2. Self-Contained Tracked Fixture Helper
// =============================================================================

function createTrackedDerivedPackages(targetDir: string, newRev = "v6-consumer-test-candidate-r2"): string {
  const families = ["public-v6-pages", "public-v6-records", "public-v6-history"] as const;
  const targetSlugs = ["massachusetts-institute-of-technology", "imperial-college-london", "stanford-university"];

  for (const fam of families) {
    const srcDir = path.resolve("data", fam);
    const dstDir = path.join(targetDir, fam);
    cpSync(path.join(srcDir, "sharded", "objects"), path.join(dstDir, "sharded", "objects"), { recursive: true });

    const srcIdx = JSON.parse(readFileSync(path.join(srcDir, "sharded", "index.json"), "utf8"));
    const baseRev = "qs20-24-v6-r7-20261020";
    const baseEntry = srcIdx.revisions[baseRev];
    const manifest = JSON.parse(readFileSync(path.join(srcDir, baseEntry.path), "utf8"));

    manifest.revision = newRev;

    function findEntry(entries: [string, any][], key: string) {
      return entries.find(([k]) => k === key);
    }

    if (fam === "public-v6-pages") {
      const relNode = findEntry(manifest.root.entries, "releaseId");
      if (relNode) relNode[1].value = newRev;
      const parentEntry = findEntry(manifest.root.entries, "parentRevisionId");
      if (parentEntry) parentEntry[1].value = baseRev;
    } else if (fam === "public-v6-records") {
      const revNode = findEntry(manifest.root.entries, "revision");
      if (revNode) revNode[1].value = newRev;
      const parentEntry = findEntry(manifest.root.entries, "parentRevisionId");
      if (parentEntry) parentEntry[1].value = baseRev;

      // Update recordRevisions for target slugs
      const recRevsNode = findEntry(manifest.root.entries, "recordRevisions")![1];
      for (const slug of targetSlugs) {
        const rec = recRevsNode.entries.find(([k]: [string, any]) => k === slug);
        if (rec) {
          const urev = rec[1].entries.find(([k]: [string, any]) => k === "universityRevisionId");
          if (urev) urev[1].value = newRev;
          const prev = rec[1].entries.find(([k]: [string, any]) => k === "previousRevisionId");
          if (prev) {
            prev[1].value = baseRev;
          } else {
            rec[1].entries.push(["previousRevisionId", { kind: "value", value: baseRev }]);
          }
        }
      }
    } else if (fam === "public-v6-history") {
      const basisNode = findEntry(manifest.root.entries, "basisRevision");
      if (basisNode) basisNode[1].value = newRev;

      // Update history blobs for target slugs to prepend a candidate row
      const recsNode = findEntry(manifest.root.entries, "records")![1];
      for (const slug of targetSlugs) {
        const recEntry = recsNode.entries.find(([k]: [string, any]) => k === slug);
        if (recEntry) {
          const oldSha = recEntry[1].sha256;
          const oldRows = JSON.parse(readFileSync(path.join(dstDir, "sharded", "objects", `${oldSha}.json`), "utf8"));
          const candidateRow = {
            slug,
            releaseId: newRev,
            previousReleaseId: baseRev,
            diffRows: [],
            diffLines: [],
            name: slug,
            summary: "Candidate change",
            canonicalUrl: `https://eduaipolicy.org/changes/${newRev}/${slug}`,
            universityUrl: `/universities/${slug}`,
            changeUrl: `/changes/${newRev}/${slug}`,
            publicJsonUrl: `https://eduaipolicy.org/api/public/v1/universities/${slug}.json`,
            claimCount: 10,
            reviewedClaimCount: 10,
            candidateClaimCount: 0,
            sourceCount: 5,
            reviewState: "agent_reviewed",
            added: 0,
            modified: 0,
            removed: 0,
            unchanged: 10,
            newlyExtractedClaims: 0,
            trackerRemovedClaims: 0,
            claimMetadataChanged: 0,
            evidenceChanged: 0,
            policyTextChanged: 0,
            sourceAdded: 0,
            sourceRemoved: 0,
            sourceSnapshotChanged: 0,
            sourceTextChanged: 0,
            claimChanges: [],
            sourceChanges: [],
            releaseCount: oldRows.length + 1
          };
          const newRows = [candidateRow, ...oldRows];
          const newRaw = Buffer.from(JSON.stringify(newRows) + "\n");
          const newSha = digest(newRaw);
          writeFileSync(path.join(dstDir, "sharded", "objects", `${newSha}.json`), newRaw);
          recEntry[1].sha256 = newSha;
          recEntry[1].bytes = newRaw.length;
        }
      }
    }

    const sourceSha = digest(`source-${fam}-${newRev}`);
    manifest.sourceSha256 = sourceSha;

    const manifestRaw = Buffer.from(JSON.stringify(manifest) + "\n");
    const manifestSha = digest(manifestRaw);
    const manifestRelPath = `sharded/revisions/${newRev}-${manifestSha}.json`;
    cpSync(path.join(srcDir, "sharded", "revisions"), path.join(dstDir, "sharded", "revisions"), { recursive: true });
    writeFileSync(path.join(dstDir, manifestRelPath), manifestRaw);

    const dstIdx = {
      schemaVersion: "uapt-v6-shard-index-v1",
      family: fam,
      revisions: {
        ...srcIdx.revisions,
        [newRev]: {
          path: manifestRelPath,
          sha256: manifestSha,
          sourceSha256: sourceSha
        }
      }
    };
    writeFileSync(path.join(dstDir, "sharded", "index.json"), JSON.stringify(dstIdx, null, 2) + "\n");

    const curr = {
      path: `revisions/${newRev}.json`,
      sha256: sourceSha,
      ...(fam === "public-v6-pages" ? { releaseId: newRev, slugs: manifest.scope, v5Slugs: [] } : {}),
      ...(fam === "public-v6-records" ? { revision: newRev, slugs: manifest.scope } : {}),
      ...(fam === "public-v6-history" ? { basisRevision: newRev } : {})
    };
    writeFileSync(path.join(dstDir, "current.json"), JSON.stringify(curr, null, 2) + "\n");
  }

  return targetDir;
}

// =============================================================================
// 3. Self-Contained Preflight Rejection Tests (No .local Dependencies)
// =============================================================================

test("prepareCandidateBuildInputs: preflight rejects packages with object envelope before staging", async () => {
  const tmpPackages = mkdtempSync(path.join(tmpdir(), "uapt-malformed-packages-"));
  try {
    createTrackedDerivedPackages(tmpPackages, "v6-preflight-test-candidate");

    const histObjDir = path.join(tmpPackages, "public-v6-history", "sharded", "objects");
    const histIdx = JSON.parse(readFileSync(path.join(tmpPackages, "public-v6-history", "sharded", "index.json"), "utf8")) as ShardIndex;
    const revEntry = histIdx.revisions["v6-preflight-test-candidate"];
    const manifest = JSON.parse(readFileSync(path.join(tmpPackages, "public-v6-history", revEntry.path), "utf8"));
    const recordsEntry = manifest.root.entries.find((e: any) => e[0] === "records")[1].entries;
    const targetBlobDesc = recordsEntry[0][1];
    const targetSlug = recordsEntry[0][0];

    // Overwrite target blob with legacy object envelope
    const envelopeRaw = Buffer.from(JSON.stringify({ baseline: { title: "Target School" }, revisions: [] }) + "\n");
    const newHash = digest(envelopeRaw);
    targetBlobDesc.sha256 = newHash;
    targetBlobDesc.bytes = envelopeRaw.length;
    writeFileSync(path.join(histObjDir, `${newHash}.json`), envelopeRaw);

    // Recompute manifest hash and update manifest file and index.json so manifest integrity passes
    const newManifestRaw = Buffer.from(JSON.stringify(manifest) + "\n");
    const newManifestHash = digest(newManifestRaw);
    const newManifestRelPath = `sharded/revisions/v6-preflight-test-candidate-${newManifestHash}.json`;
    writeFileSync(path.join(tmpPackages, "public-v6-history", newManifestRelPath), newManifestRaw);
    histIdx.revisions["v6-preflight-test-candidate"].path = newManifestRelPath;
    histIdx.revisions["v6-preflight-test-candidate"].sha256 = newManifestHash;
    writeFileSync(path.join(tmpPackages, "public-v6-history", "sharded", "index.json"), JSON.stringify(histIdx, null, 2) + "\n");

    await assert.rejects(
      async () => {
        await prepareCandidateBuildInputs({ packagesDir: tmpPackages, dryRun: true });
      },
      new RegExp(`Invalid frozen history payload for ${targetSlug}: expected ChangeRecord array, got object`)
    );
  } finally {
    rmSync(tmpPackages, { recursive: true, force: true });
  }
});

test("prepareCandidateBuildInputs: preflight rejects packages with foreign slug in history before staging", async () => {
  const tmpPackages = mkdtempSync(path.join(tmpdir(), "uapt-foreign-slug-packages-"));
  try {
    createTrackedDerivedPackages(tmpPackages, "v6-preflight-foreign-slug");

    const histObjDir = path.join(tmpPackages, "public-v6-history", "sharded", "objects");
    const histIdx = JSON.parse(readFileSync(path.join(tmpPackages, "public-v6-history", "sharded", "index.json"), "utf8")) as ShardIndex;
    const revEntry = histIdx.revisions["v6-preflight-foreign-slug"];
    const manifest = JSON.parse(readFileSync(path.join(tmpPackages, "public-v6-history", revEntry.path), "utf8"));
    const recordsEntry = manifest.root.entries.find((e: any) => e[0] === "records")[1].entries;
    const targetBlobDesc = recordsEntry[0][1];
    const targetSlug = recordsEntry[0][0];

    const foreignRaw = Buffer.from(JSON.stringify([{ slug: "foreign-school", releaseId: "rel-1", diffRows: [] }]) + "\n");
    const newHash = digest(foreignRaw);
    targetBlobDesc.sha256 = newHash;
    targetBlobDesc.bytes = foreignRaw.length;
    writeFileSync(path.join(histObjDir, `${newHash}.json`), foreignRaw);

    const newManifestRaw = Buffer.from(JSON.stringify(manifest) + "\n");
    const newManifestHash = digest(newManifestRaw);
    const newManifestRelPath = `sharded/revisions/v6-preflight-foreign-slug-${newManifestHash}.json`;
    writeFileSync(path.join(tmpPackages, "public-v6-history", newManifestRelPath), newManifestRaw);
    histIdx.revisions["v6-preflight-foreign-slug"].path = newManifestRelPath;
    histIdx.revisions["v6-preflight-foreign-slug"].sha256 = newManifestHash;
    writeFileSync(path.join(tmpPackages, "public-v6-history", "sharded", "index.json"), JSON.stringify(histIdx, null, 2) + "\n");

    await assert.rejects(
      async () => {
        await prepareCandidateBuildInputs({ packagesDir: tmpPackages, dryRun: true });
      },
      new RegExp(`Foreign slug in frozen history row at index 0 for ${targetSlug}: got "foreign-school"`)
    );
  } finally {
    rmSync(tmpPackages, { recursive: true, force: true });
  }
});

test("prepareCandidateBuildInputs: preflight rejects packages with non-array diffRows before staging", async () => {
  const tmpPackages = mkdtempSync(path.join(tmpdir(), "uapt-non-array-diffrows-"));
  try {
    createTrackedDerivedPackages(tmpPackages, "v6-preflight-non-array-diffrows");

    const histObjDir = path.join(tmpPackages, "public-v6-history", "sharded", "objects");
    const histIdx = JSON.parse(readFileSync(path.join(tmpPackages, "public-v6-history", "sharded", "index.json"), "utf8")) as ShardIndex;
    const revEntry = histIdx.revisions["v6-preflight-non-array-diffrows"];
    const manifest = JSON.parse(readFileSync(path.join(tmpPackages, "public-v6-history", revEntry.path), "utf8"));
    const recordsEntry = manifest.root.entries.find((e: any) => e[0] === "records")[1].entries;
    const targetBlobDesc = recordsEntry[0][1];
    const targetSlug = recordsEntry[0][0];

    const malformedRaw = Buffer.from(JSON.stringify([{ slug: targetSlug, releaseId: "rel-1", diffRows: {} }]) + "\n");
    const newHash = digest(malformedRaw);
    targetBlobDesc.sha256 = newHash;
    targetBlobDesc.bytes = malformedRaw.length;
    writeFileSync(path.join(histObjDir, `${newHash}.json`), malformedRaw);

    const newManifestRaw = Buffer.from(JSON.stringify(manifest) + "\n");
    const newManifestHash = digest(newManifestRaw);
    const newManifestRelPath = `sharded/revisions/v6-preflight-non-array-diffrows-${newManifestHash}.json`;
    writeFileSync(path.join(tmpPackages, "public-v6-history", newManifestRelPath), newManifestRaw);
    histIdx.revisions["v6-preflight-non-array-diffrows"].path = newManifestRelPath;
    histIdx.revisions["v6-preflight-non-array-diffrows"].sha256 = newManifestHash;
    writeFileSync(path.join(tmpPackages, "public-v6-history", "sharded", "index.json"), JSON.stringify(histIdx, null, 2) + "\n");

    await assert.rejects(
      async () => {
        await prepareCandidateBuildInputs({ packagesDir: tmpPackages, dryRun: true });
      },
      new RegExp(`Missing or invalid diffRows in frozen history row at index 0 for ${targetSlug}: expected array`)
    );
  } finally {
    rmSync(tmpPackages, { recursive: true, force: true });
  }
});

// =============================================================================
// 4. Self-Contained End-to-End Runtime Consumer Integration Test
// =============================================================================

test("getEntityChangeHistory: stages derived candidate packages and resolves target & baseline histories accurately without private dependencies", async () => {
  const repoRoot = path.resolve(".");
  const tmpPackages = mkdtempSync(path.join(tmpdir(), "uapt-e2e-packages-"));
  const tmp = mkdtempSync(path.join(tmpdir(), "uapt-history-consumer-test-"));

  try {
    createTrackedDerivedPackages(tmpPackages, "v6-consumer-e2e-candidate");

    cpSync(path.join(repoRoot, "data"), path.join(tmp, "data"), { recursive: true });
    for (const item of ["package.json", "tsconfig.base.json", "pnpm-workspace.yaml", "pnpm-lock.yaml"]) {
      cpSync(path.join(repoRoot, item), path.join(tmp, item));
    }
    for (const item of ["apps", "packages", "scripts"]) {
      cpSync(path.join(repoRoot, item), path.join(tmp, item), {
        recursive: true,
        filter: (src) => !src.includes(".next")
      });
    }
    symlinkSync(path.join(repoRoot, "node_modules"), path.join(tmp, "node_modules"));
    symlinkSync(path.join(repoRoot, "staging"), path.join(tmp, "staging"));

    const prep = await prepareCandidateBuildInputs({ packagesDir: tmpPackages, repoRoot: tmp });
    assert.equal(prep.status, "prepared");
    assert.ok(prep.basisSha256);
    assert.equal(prep.prebuildGuardPassed, true);

    const runnerScript = `
      import { getEntityChangeHistory } from "./apps/web/lib/change-records.ts";
      import assert from "node:assert/strict";

      async function run() {
        // 1. Target School (MIT)
        const mit = await getEntityChangeHistory("massachusetts-institute-of-technology");
        assert.ok(mit, "MIT history must exist");
        assert.equal(mit.record.releaseId, "v6-consumer-e2e-candidate");
        assert.equal(mit.record.slug, "massachusetts-institute-of-technology");
        assert.ok(Array.isArray(mit.record.diffRows), "MIT diffRows must be an array");
        assert.ok(mit.releaseRecords.length >= 2, "MIT must have at least candidate + baseline records");
        assert.equal(mit.releaseRecords[0].releaseId, "v6-consumer-e2e-candidate");
        assert.equal(mit.releaseRecords[0].slug, "massachusetts-institute-of-technology");

        // 2. Target School (Stanford)
        const stanford = await getEntityChangeHistory("stanford-university");
        assert.ok(stanford, "Stanford history must exist");
        assert.equal(stanford.record.releaseId, "v6-consumer-e2e-candidate");
        assert.equal(stanford.record.slug, "stanford-university");
        assert.ok(Array.isArray(stanford.record.diffRows), "Stanford diffRows must be an array");

        // 3. Baseline School (Harvard - not modified in this candidate)
        const harvard = await getEntityChangeHistory("harvard-university");
        assert.ok(harvard, "Harvard history must exist");
        assert.equal(harvard.record.releaseId, "v6-audit-fix-20261014");
        assert.ok(harvard.releaseRecords.length >= 1, "Harvard must have release records");
        assert.ok(Array.isArray(harvard.record.diffRows), "Harvard diffRows must be an array");

        console.log("ALL getEntityChangeHistory VERIFICATIONS PASSED");
      }
      run().catch((err) => {
        console.error(err);
        process.exit(1);
      });
    `;

    writeFileSync(path.join(tmp, "test-runner.ts"), runnerScript);
    const tsxCli = path.resolve(repoRoot, "node_modules/tsx/dist/cli.mjs");
    const res = spawnSync(process.execPath, [tsxCli, "test-runner.ts"], {
      cwd: tmp,
      encoding: "utf8",
      env: { ...process.env, UAPT_V6_PUBLISHED_PAGES: "1", NEXT_PUBLIC_UAPT_V6_PUBLISHED_PAGES: "1" }
    });

    if (res.status !== 0) {
      console.error(res.stderr);
      console.log(res.stdout);
      throw new Error(`Integration runner failed with exit code ${res.status}`);
    }
    assert.ok(res.stdout.includes("ALL getEntityChangeHistory VERIFICATIONS PASSED"));
  } finally {
    rmSync(tmpPackages, { recursive: true, force: true });
    rmSync(tmp, { recursive: true, force: true });
  }
});
