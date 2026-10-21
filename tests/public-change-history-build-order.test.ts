import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync, spawnSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  prepareCandidateBuildInputs,
  verifyPublicHistoryOnDisk
} from "../scripts/prepare-candidate-build-inputs";
import { ensureIsolatedCheckout } from "../scripts/export-public-change-history";
import type { ReleaseDiff } from "../apps/web/lib/release-diffs";

const digest = (buf: Buffer | string) => createHash("sha256").update(buf).digest("hex");

function computeDirectoryDigest(dir: string): string {
  if (!existsSync(dir)) return "none";
  const files: string[] = [];
  function scan(current: string) {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        scan(full);
      } else if (entry.isFile() && !entry.name.endsWith(".next")) {
        files.push(full);
      }
    }
  }
  scan(dir);
  files.sort();
  const hash = createHash("sha256");
  for (const file of files) {
    hash.update(path.relative(dir, file));
    hash.update(readFileSync(file));
  }
  return hash.digest("hex");
}

function createSelfContainedFixture(): { fixtureDir: string; cleanup: () => void } {
  const tmp = mkdtempSync(path.join(tmpdir(), "uapt-history-order-test-"));
  const repoRoot = path.resolve(".");
  cpSync(path.join(repoRoot, "data"), path.join(tmp, "data"), { recursive: true });

  return {
    fixtureDir: tmp,
    cleanup: () => rmSync(tmp, { recursive: true, force: true })
  };
}

const DEFAULT_TARGET_SLUGS = [
  "massachusetts-institute-of-technology",
  "imperial-college-london",
  "stanford-university"
] as const;

/** Derive valid, self-contained candidate packages directly from tracked baseline data without any .local dependencies */
function createTrackedDerivedPackages(
  targetDir: string,
  options?: {
    newRev?: string;
    targetSlugs?: readonly string[];
    mismatchHistoryRev?: string;
    tamperPayloadIdentity?: boolean;
  }
): string {
  const newRev = options?.newRev ?? "v6-order-test-candidate-r3";
  const targetSlugs = options?.targetSlugs ?? DEFAULT_TARGET_SLUGS;
  const families = ["public-v6-pages", "public-v6-records", "public-v6-history"] as const;

  for (const fam of families) {
    const srcDir = path.resolve("data", fam);
    const dstDir = path.join(targetDir, fam);
    cpSync(path.join(srcDir, "sharded", "objects"), path.join(dstDir, "sharded", "objects"), { recursive: true });

    const srcIdx = JSON.parse(readFileSync(path.join(srcDir, "sharded", "index.json"), "utf8"));
    const baseRev = "qs20-24-v6-r7-20261020";
    const baseEntry = srcIdx.revisions[baseRev];
    const manifest = JSON.parse(readFileSync(path.join(srcDir, baseEntry.path), "utf8"));

    const famRev = fam === "public-v6-history" && options?.mismatchHistoryRev ? options.mismatchHistoryRev : newRev;
    manifest.revision = famRev;

    function findEntry(entries: [string, any][], key: string) {
      return entries.find(([k]) => k === key);
    }

    if (fam === "public-v6-pages") {
      const relNode = findEntry(manifest.root.entries, "releaseId");
      if (relNode) relNode[1].value = options?.tamperPayloadIdentity ? "tampered-identity" : famRev;
      const parentEntry = findEntry(manifest.root.entries, "parentRevisionId");
      if (parentEntry) parentEntry[1].value = baseRev;
    } else if (fam === "public-v6-records") {
      const revNode = findEntry(manifest.root.entries, "revision");
      if (revNode) revNode[1].value = options?.tamperPayloadIdentity ? "tampered-identity" : famRev;
      const parentEntry = findEntry(manifest.root.entries, "parentRevisionId");
      if (parentEntry) parentEntry[1].value = baseRev;

      // Update recordRevisions for the 3 target slugs
      const recRevsNode = findEntry(manifest.root.entries, "recordRevisions")![1];
      for (const slug of targetSlugs) {
        const rec = recRevsNode.entries.find(([k]: [string, any]) => k === slug);
        if (rec) {
          const urev = rec[1].entries.find(([k]: [string, any]) => k === "universityRevisionId");
          if (urev) urev[1].value = famRev;
          const prev = rec[1].entries.find(([k]: [string, any]) => k === "previousRevisionId");
          if (prev) {
            prev[1].value = baseRev;
          } else {
            rec[1].entries.push(["previousRevisionId", { kind: "value", value: baseRev }]);
          }
        }
      }

      // Update summaries for the 3 target slugs with explicit fixture-only text
      const summariesNode = findEntry(manifest.root.entries, "summaries")![1];
      const keys = summariesNode.keys || manifest.scope;
      for (const slug of targetSlugs) {
        const idx = keys.indexOf(slug);
        if (idx !== -1) {
          const blobInfo = summariesNode.items[idx];
          const oldBlobPath = path.join(srcDir, "sharded", "objects", `${blobInfo.sha256}.json`);
          const summary = JSON.parse(readFileSync(oldBlobPath, "utf8"));
          if (summary.claims && summary.claims.length > 0) {
            summary.claims[0].claimText = summary.claims[0].claimText + " [Tracked test fixture claim modification]";
          }
          const newRaw = Buffer.from(JSON.stringify(summary) + "\n");
          const newSha = digest(newRaw);
          writeFileSync(path.join(dstDir, "sharded", "objects", `${newSha}.json`), newRaw);
          summariesNode.items[idx] = { kind: "blob", sha256: newSha, bytes: newRaw.length };
        }
      }
    } else if (fam === "public-v6-history") {
      const basisNode = findEntry(manifest.root.entries, "basisRevision");
      if (basisNode) basisNode[1].value = options?.tamperPayloadIdentity ? "tampered-identity" : famRev;
    }

    const sourceSha = digest(`source-${fam}-${famRev}`);
    manifest.sourceSha256 = sourceSha;

    const manifestRaw = Buffer.from(JSON.stringify(manifest) + "\n");
    const manifestSha = digest(manifestRaw);
    const manifestRelPath = `sharded/revisions/${famRev}-${manifestSha}.json`;
    cpSync(path.join(srcDir, "sharded", "revisions"), path.join(dstDir, "sharded", "revisions"), { recursive: true });
    writeFileSync(path.join(dstDir, manifestRelPath), manifestRaw);

    const dstIdx = {
      schemaVersion: "uapt-v6-shard-index-v1",
      family: fam,
      revisions: {
        ...srcIdx.revisions,
        [famRev]: {
          path: manifestRelPath,
          sha256: manifestSha,
          sourceSha256: sourceSha
        }
      }
    };
    writeFileSync(path.join(dstDir, "sharded", "index.json"), JSON.stringify(dstIdx, null, 2) + "\n");

    const curr = {
      path: `revisions/${famRev}.json`,
      sha256: sourceSha,
      ...(fam === "public-v6-pages" ? { releaseId: famRev, slugs: manifest.scope, v5Slugs: [] } : {}),
      ...(fam === "public-v6-records" ? { revision: famRev, slugs: manifest.scope } : {}),
      ...(fam === "public-v6-history" ? { basisRevision: famRev } : {})
    };
    writeFileSync(path.join(dstDir, "current.json"), JSON.stringify(curr, null, 2) + "\n");
  }

  return targetDir;
}

test("prepareCandidateBuildInputs: rejects corrupted shard object and fails closed without mutating destination", async () => {
  const { fixtureDir, cleanup } = createSelfContainedFixture();
  const corruptPackagesDir = mkdtempSync(path.join(tmpdir(), "uapt-corrupt-pkgs-"));
  try {
    createTrackedDerivedPackages(corruptPackagesDir);

    // Corrupt one shard object in public-v6-records
    const objDir = path.join(corruptPackagesDir, "public-v6-records", "sharded", "objects");
    const firstObj = readdirSync(objDir).find((f) => f.endsWith(".json"))!;
    const objPath = path.join(objDir, firstObj);
    writeFileSync(objPath, JSON.stringify({ corrupted: true }) + "\n");

    const baselineDataDigest = computeDirectoryDigest(path.join(fixtureDir, "data"));

    await assert.rejects(
      async () => {
        await prepareCandidateBuildInputs({
          repoRoot: fixtureDir,
          packagesDir: corruptPackagesDir
        });
      },
      (err: Error) => {
        assert.ok(
          err.message.includes("Object hash mismatch") || err.message.includes("Shard blob hash"),
          `Expected corruption error, got: ${err.message}`
        );
        return true;
      },
      "Rejects corrupted package before staging"
    );

    // Assert full data tree digest remained identical (zero mutation)
    const afterDataDigest = computeDirectoryDigest(path.join(fixtureDir, "data"));
    assert.equal(afterDataDigest, baselineDataDigest, "Destination data tree completely unmutated on corruption");
  } finally {
    cleanup();
    rmSync(corruptPackagesDir, { recursive: true, force: true });
  }
});

test("prepareCandidateBuildInputs: rejects historical revision mapping overwrite and fails closed without mutating destination", async () => {
  const { fixtureDir, cleanup } = createSelfContainedFixture();
  const tamperedPackagesDir = mkdtempSync(path.join(tmpdir(), "uapt-tamper-pkgs-"));
  try {
    createTrackedDerivedPackages(tamperedPackagesDir);

    // Tamper with index.json to overwrite a historical revision mapping
    const indexFile = path.join(tamperedPackagesDir, "public-v6-records", "sharded", "index.json");
    const indexData = JSON.parse(readFileSync(indexFile, "utf8"));
    indexData.revisions["qs20-24-v6-r7-20261020"] = {
      path: "sharded/revisions/tampered.json",
      sha256: "0000000000000000000000000000000000000000000000000000000000000000",
      sourceSha256: "0000000000000000000000000000000000000000000000000000000000000000"
    };
    writeFileSync(indexFile, JSON.stringify(indexData, null, 2) + "\n");

    const baselineDataDigest = computeDirectoryDigest(path.join(fixtureDir, "data"));

    await assert.rejects(
      async () => {
        await prepareCandidateBuildInputs({
          repoRoot: fixtureDir,
          packagesDir: tamperedPackagesDir
        });
      },
      (err: Error) => {
        assert.ok(
          err.message.includes("Historical revision mapping overwrite rejected"),
          `Expected historical overwrite rejection, got: ${err.message}`
        );
        return true;
      },
      "Rejects overwrite of existing historical revision mappings"
    );

    const afterDataDigest = computeDirectoryDigest(path.join(fixtureDir, "data"));
    assert.equal(afterDataDigest, baselineDataDigest, "Destination data tree completely unmutated on historical overwrite");
  } finally {
    cleanup();
    rmSync(tamperedPackagesDir, { recursive: true, force: true });
  }
});

test("prepareCandidateBuildInputs: rejects mismatched-family revisions and payload identities before any destination writes", async () => {
  const { fixtureDir, cleanup } = createSelfContainedFixture();
  const mixedPackagesDir = mkdtempSync(path.join(tmpdir(), "uapt-mixed-pkgs-"));
  const payloadMismatchDir = mkdtempSync(path.join(tmpdir(), "uapt-payload-mismatch-pkgs-"));
  try {
    // 1. Mixed revisions across families (pages/records v6-target vs history v6-other-rev)
    createTrackedDerivedPackages(mixedPackagesDir, {
      newRev: "v6-order-test-candidate-r3",
      mismatchHistoryRev: "v6-mismatch-history-rev"
    });

    const baselineDataDigest = computeDirectoryDigest(path.join(fixtureDir, "data"));

    // Assert rejection in dryRun mode
    await assert.rejects(
      async () => {
        await prepareCandidateBuildInputs({
          repoRoot: fixtureDir,
          packagesDir: mixedPackagesDir,
          dryRun: true
        });
      },
      (err: Error) => {
        assert.ok(
          err.message.includes("Candidate family revisions mismatch"),
          `Expected revisions mismatch error in dryRun, got: ${err.message}`
        );
        return true;
      }
    );

    // Assert rejection in real execution mode
    await assert.rejects(
      async () => {
        await prepareCandidateBuildInputs({
          repoRoot: fixtureDir,
          packagesDir: mixedPackagesDir
        });
      },
      (err: Error) => {
        assert.ok(
          err.message.includes("Candidate family revisions mismatch"),
          `Expected revisions mismatch error in real execution, got: ${err.message}`
        );
        return true;
      }
    );

    const afterMixedDigest = computeDirectoryDigest(path.join(fixtureDir, "data"));
    assert.equal(afterMixedDigest, baselineDataDigest, "Data tree unchanged after mismatched family rejection");

    // 2. Renamed manifest label but payload identity mismatch in root node
    createTrackedDerivedPackages(payloadMismatchDir, {
      newRev: "v6-order-test-candidate-r3",
      tamperPayloadIdentity: true
    });

    await assert.rejects(
      async () => {
        await prepareCandidateBuildInputs({
          repoRoot: fixtureDir,
          packagesDir: payloadMismatchDir
        });
      },
      (err: Error) => {
        assert.ok(
          err.message.includes("Root payload identity mismatch"),
          `Expected root payload identity mismatch, got: ${err.message}`
        );
        return true;
      }
    );

    const afterPayloadDigest = computeDirectoryDigest(path.join(fixtureDir, "data"));
    assert.equal(afterPayloadDigest, baselineDataDigest, "Data tree unchanged after payload identity rejection");
  } finally {
    cleanup();
    rmSync(mixedPackagesDir, { recursive: true, force: true });
    rmSync(payloadMismatchDir, { recursive: true, force: true });
  }
});

test("prepareCandidateBuildInputs: dryRun validates inputs without mutating and returns typed validated_only", async () => {
  const { fixtureDir, cleanup } = createSelfContainedFixture();
  const pkgsDir = mkdtempSync(path.join(tmpdir(), "uapt-dryrun-pkgs-"));
  try {
    createTrackedDerivedPackages(pkgsDir);
    const baselineDataDigest = computeDirectoryDigest(path.join(fixtureDir, "data"));

    const result = await prepareCandidateBuildInputs({
      repoRoot: fixtureDir,
      packagesDir: pkgsDir,
      dryRun: true
    });

    assert.equal(result.status, "validated_only");
    assert.equal(result.prebuildGuardPassed, false, "dryRun must not report prebuildGuardPassed: true");
    assert.equal(result.basisSha256, "dry-run");
    assert.equal(result.historyManifestSha256, "dry-run");
    assert.equal(result.stagedFamilies.length, 3);

    // Verify zero mutations on fixture
    const afterDataDigest = computeDirectoryDigest(path.join(fixtureDir, "data"));
    assert.equal(afterDataDigest, baselineDataDigest, "No destination files mutated during dryRun");
  } finally {
    cleanup();
    rmSync(pkgsDir, { recursive: true, force: true });
  }
});

test("prepareCandidateBuildInputs: stages candidate inputs, exports isolated history, produces new release with true parents, exact target slugs, and historical preservation", async () => {
  const { fixtureDir, cleanup } = createSelfContainedFixture();
  const pkgsDir = mkdtempSync(path.join(tmpdir(), "uapt-exec-pkgs-"));
  try {
    const candidateRev = "v6-order-test-candidate-r3";
    createTrackedDerivedPackages(pkgsDir, { newRev: candidateRev, targetSlugs: DEFAULT_TARGET_SLUGS });

    // Capture baseline state before staging
    const baselinePchCurr = JSON.parse(readFileSync(path.join(fixtureDir, "data/public-change-history/current.json"), "utf8"));
    const baselineManifest = JSON.parse(readFileSync(path.join(fixtureDir, "data/public-change-history", baselinePchCurr.path), "utf8"));
    const nonTargetSlugs = Object.keys(baselineManifest.entries).filter(s => !DEFAULT_TARGET_SLUGS.includes(s as any));
    const baselineNonTargetEntries: Record<string, string> = {};
    for (const slug of nonTargetSlugs.slice(0, 20)) {
      baselineNonTargetEntries[slug] = readFileSync(path.join(fixtureDir, "data/public-change-history", baselineManifest.entries[slug].file), "utf8");
    }

    const result = await prepareCandidateBuildInputs({
      repoRoot: fixtureDir,
      packagesDir: pkgsDir
    });

    assert.equal(result.status, "prepared");
    assert.equal(result.prebuildGuardPassed, true);
    assert.ok(result.basisSha256.length === 64);
    assert.ok(result.historyManifestSha256.length === 64);

    // 1. Verify candidate current pointers
    const pagesCurr = JSON.parse(readFileSync(path.join(fixtureDir, "data/public-v6-pages/current.json"), "utf8"));
    const recordsCurr = JSON.parse(readFileSync(path.join(fixtureDir, "data/public-v6-records/current.json"), "utf8"));
    const historyCurr = JSON.parse(readFileSync(path.join(fixtureDir, "data/public-v6-history/current.json"), "utf8"));

    assert.equal(pagesCurr.releaseId, candidateRev);
    assert.equal(recordsCurr.revision, candidateRev);
    assert.equal(historyCurr.basisRevision, candidateRev);

    // 2. Verify exported public-change-history current pointer and manifest
    const pchCurr = JSON.parse(readFileSync(path.join(fixtureDir, "data/public-change-history/current.json"), "utf8"));
    assert.equal(pchCurr.sha256, result.historyManifestSha256);
    assert.equal(pchCurr.path, result.historyManifestFile);

    const manifestPath = path.join(fixtureDir, "data/public-change-history", pchCurr.path);
    assert.ok(existsSync(manifestPath), "Manifest file exists on disk");
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));

    assert.equal(manifest.schemaVersion, "uapt-public-change-history-v1");
    assert.equal(manifest.basisSha256, result.basisSha256);

    // 3. Verify release diff for the new release exists and has correct parent
    assert.ok(manifest.releases[candidateRev], `Manifest contains new release ${candidateRev}`);
    const releaseDiffEntry = manifest.releases[candidateRev];
    const releaseDiffFile = path.join(fixtureDir, "data/public-change-history", releaseDiffEntry.file);
    assert.ok(existsSync(releaseDiffFile), "Release diff object file exists");
    const releaseDiff: ReleaseDiff = JSON.parse(readFileSync(releaseDiffFile, "utf8"));

    assert.equal(releaseDiff.releaseId, candidateRev);
    assert.equal(releaseDiff.previousReleaseId, "qs20-24-v6-r7-20261020", "Parent revision matches baseline");

    // 4. Verify exact THREE target slugs in release diff
    const entitySlugs = releaseDiff.entities.map((e) => e.entitySlug).sort();
    const expectedSlugs = [...DEFAULT_TARGET_SLUGS].sort();
    assert.deepEqual(entitySlugs, expectedSlugs, "Release diff must contain exact THREE target slugs");

    for (const entity of releaseDiff.entities) {
      assert.ok(entity.rows.length > 0, `${entity.entitySlug} has diff rows`);
      const modifiedRow = entity.rows.find((r) =>
        (r.newClaim?.claimText ?? "").includes("[Tracked test fixture claim modification]")
      );
      assert.ok(modifiedRow, `${entity.entitySlug} contains modified claim text`);
      assert.equal(entity.previousReleaseId, "qs20-24-v6-r7-20261020", `${entity.entitySlug} parent is qs20-24-v6-r7-20261020`);
    }

    // 5. Verify complete non-target historical record equality
    for (const slug of Object.keys(baselineNonTargetEntries)) {
      const currentEntry = manifest.entries[slug];
      assert.ok(currentEntry, `Non-target slug ${slug} preserved in manifest`);
      const currentContent = readFileSync(path.join(fixtureDir, "data/public-change-history", currentEntry.file), "utf8");
      assert.equal(currentContent, baselineNonTargetEntries[slug], `Historical records for non-target ${slug} are byte-identical`);
    }

    // 6. Verify all prior revisions preserved in manifest.releases
    for (const histRelId of Object.keys(baselineManifest.releases).filter(r => r !== "qs20-24-v6-r7-20261020")) {
      assert.ok(manifest.releases[histRelId], `Historical release ${histRelId} preserved`);
      assert.equal(manifest.releases[histRelId].sha256, baselineManifest.releases[histRelId].sha256, `Historical release ${histRelId} sha256 matches`);
    }
    assert.ok(manifest.releases["stanford-20261011-codex"], "stanford-20261011-codex preserved");
    assert.ok(manifest.releases["mit-20261010"], "mit-20261010 preserved");

    // 7. Verify script-local on-disk verification passes cleanly
    const verified = await verifyPublicHistoryOnDisk(fixtureDir, result.basisSha256);
    assert.equal(verified.manifest.basisSha256, result.basisSha256);
    assert.equal(verified.basis, result.basisSha256);

    // 8. Verify stale detection: if pages pointer changes, verification fails closed
    const pagesFile = path.join(fixtureDir, "data/public-v6-pages/current.json");
    const tampered = JSON.parse(readFileSync(pagesFile, "utf8"));
    tampered.releaseId = "tampered-release";
    writeFileSync(pagesFile, JSON.stringify(tampered, null, 2) + "\n");
    await assert.rejects(
      async () => {
        await verifyPublicHistoryOnDisk(fixtureDir, result.basisSha256);
      },
      (err: Error) => {
        assert.ok(err.message.includes("out of date") || err.message.includes("basis mismatch"));
        return true;
      }
    );
  } finally {
    cleanup();
    rmSync(pkgsDir, { recursive: true, force: true });
  }
});

test("prepareCandidateBuildInputs: CLI execution with cwd === repoRoot succeeds and fresh real reader reads exported history", async () => {
  const { fixtureDir, cleanup } = createSelfContainedFixture();
  const pkgsDir = mkdtempSync(path.join(tmpdir(), "uapt-cli-pkgs-"));
  const sourceRoot = path.resolve(".");
  let isolatedCleanup = () => {};
  try {
    const candidateRev = "v6-order-cli-candidate-r3";
    createTrackedDerivedPackages(pkgsDir, { newRev: candidateRev, targetSlugs: DEFAULT_TARGET_SLUGS });

    isolatedCleanup = ensureIsolatedCheckout(sourceRoot, fixtureDir);

    const tsxCli = path.resolve(sourceRoot, "node_modules/tsx/dist/cli.mjs");
    const cliResult = spawnSync(
      process.execPath,
      [
        tsxCli,
        "--tsconfig",
        "apps/web/tsconfig.json",
        "scripts/prepare-candidate-build-inputs.ts",
        "--packages",
        pkgsDir,
        "--repo-root",
        fixtureDir
      ],
      {
        cwd: fixtureDir,
        encoding: "utf8",
        timeout: 120000,
        env: {
          ...process.env,
          UAPT_V6_PUBLISHED_PAGES: "1",
          NEXT_PUBLIC_UAPT_V6_PUBLISHED_PAGES: "1"
        }
      }
    );

    assert.equal(cliResult.status, 0, `CLI failed with exit ${cliResult.status}, stderr: ${cliResult.stderr}`);
    const jsonStr = cliResult.stdout.slice(cliResult.stdout.indexOf("{"), cliResult.stdout.lastIndexOf("}") + 1);
    const receipt = JSON.parse(jsonStr);
    assert.equal(receipt.status, "prepared");
    assert.equal(receipt.prebuildGuardPassed, true);

    // Verify fresh real reader in child process reads the exported diff
    const readerFile = path.join(fixtureDir, "reader-check.ts");
    const readerScript = `
      import { readPublicReleaseDiff } from "./apps/web/lib/public-change-history";
      async function main() {
        const diff = await readPublicReleaseDiff("${candidateRev}");
        if (!diff || diff.releaseId !== "${candidateRev}") throw new Error("Reader failed to load candidate diff");
        console.log(JSON.stringify({ ok: true, entitiesCount: diff.entities.length }));
      }
      main().catch(err => {
        console.error(err);
        process.exit(1);
      });
    `;
    writeFileSync(readerFile, readerScript);
    const readerResult = spawnSync(
      process.execPath,
      [tsxCli, "--tsconfig", "apps/web/tsconfig.json", readerFile],
      {
        cwd: fixtureDir,
        encoding: "utf8",
        env: {
          ...process.env,
          UAPT_V6_PUBLISHED_PAGES: "1",
          NEXT_PUBLIC_UAPT_V6_PUBLISHED_PAGES: "1"
        }
      }
    );
    assert.equal(readerResult.status, 0, `Reader script failed with stderr: ${readerResult.stderr}`);
    const readerLines = readerResult.stdout.trim().split("\n");
    const readerJsonLine = readerLines.find(l => l.startsWith("{") && l.endsWith("}"));
    assert.ok(readerJsonLine, `Reader produced valid JSON line in output: ${readerResult.stdout}`);
    const readerJson = JSON.parse(readerJsonLine);
    assert.equal(readerJson.ok, true);
    assert.equal(readerJson.entitiesCount, 3);
  } finally {
    isolatedCleanup();
    cleanup();
    rmSync(pkgsDir, { recursive: true, force: true });
  }
});
