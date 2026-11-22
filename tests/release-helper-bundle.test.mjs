// The release helper shipped in every program artifact (scripts/program-build.mjs
// bundleReleaseHelper): the host runs the content switch from the ACTIVE program root, so a
// content release can no longer use a stale helper copy (2026-11-19..21, ff3d8218 missing).
import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, realpathSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { CLI_GUARD, RELEASE_HELPER_BUNDLES, RELEASE_HELPER_FILES, bundleDataReferences, bundleReleaseHelper } from "../scripts/program-build.mjs";

test("release helper bundles the switch and validator and pins every file", async () => {
  // Real path: the CLI guard compares import.meta.url (resolved) with argv[1] (macOS /var is a link).
  const out = realpathSync(mkdtempSync(path.join(tmpdir(), "uapt-helper-")));
  try {
    const result = await bundleReleaseHelper({ out, codeSha: "a".repeat(40) });
    const info = JSON.parse(readFileSync(path.join(out, "HELPER.json"), "utf8"));
    assert.equal(info.schemaVersion, "uapt-release-helper-v1");
    assert.equal(info.codeSha, "a".repeat(40));
    const expected = [...RELEASE_HELPER_BUNDLES.map(([, target]) => target), ...RELEASE_HELPER_FILES];
    assert.deepEqual(Object.keys(info.files).sort(), expected.sort());
    for (const [file, digest] of Object.entries(info.files)) assert.equal(createHash("sha256").update(readFileSync(path.join(out, file))).digest("hex"), digest, file);
    assert.equal(result.files, expected.length);
    // Only the entry's own CLI runs: an imported module's guard (validate.ts) must not fire.
    const run = spawnSync(process.execPath, [path.join(out, "scripts/content-release/switch.mjs")], { cwd: out, encoding: "utf8" });
    assert.equal(run.status, 2);
    assert.match(run.stderr, /^usage: content:switch/);
    assert.doesNotMatch(run.stdout + run.stderr, /content:validate/);
    const validator = spawnSync(process.execPath, [path.join(out, "scripts/validate-change-event-projection.mjs")], { cwd: out, encoding: "utf8" });
    assert.match(validator.stderr, /Use <changes-receipt\.json>/);
    // Every data file a bundle reads next to itself ships with it (6edae12c lacked the
    // source-metadata legacy list, and the host switch failed with ENOENT on 2026-11-22).
    const references = RELEASE_HELPER_BUNDLES.flatMap(([, target]) => bundleDataReferences(readFileSync(path.join(out, target), "utf8"), target));
    assert.ok(references.includes("scripts/content-release/v6-source-metadata-legacy-unprocessed.json"), references.join(", "));
    for (const file of references) assert.ok(existsSync(path.join(out, file)), `${file} missing from the release helper`);
  } finally {
    rmSync(out, { recursive: true, force: true });
  }
});

test("CLI guard pattern matches the repository's main guards", () => {
  for (const source of ["if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {", "if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){"]) {
    CLI_GUARD.lastIndex = 0;
    assert.ok(CLI_GUARD.test(source), source);
  }
});
