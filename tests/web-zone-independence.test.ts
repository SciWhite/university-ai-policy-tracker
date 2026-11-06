import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import test from "node:test";

// R1-c: apps/web renders everything the runtime zone rendered, so nothing in
// the single app may import from apps/tulsa-zone or depend on its 178-slug
// routing list. The zone directory itself is retired at cutover (P3); release
// scripts and their tests are checked separately by the release pipeline.

const repoRoot = process.cwd(); // tests run from the repository root
const CODE = /\.(?:[cm]?[jt]sx?)$/;
const SKIP_DIRS = new Set(["node_modules", ".next", ".runtime-data", "public", ".turbo"]);
const ZONE_IMPORT = /\b(?:from|import|require)\s*\(?\s*["'`]([^"'`]*(?:tulsa-zone|@zone\/)[^"'`]*)["'`]/g;
const SLUG_LIST = /\b(?:runtimeUniversitySlugs|newRuntimeUniversitySlugs|previouslyPublishedRuntimeUniversitySlugs|isRuntimeUniversity)\b|lib\/schools["'`]/g;
// Release-pipeline tests are owned by the release lifecycle and still build the zone until P3.
const RELEASE_TESTS = new Set(["tests/release-build-pipeline.test.mjs"]);

function codeFiles(dir: string): string[] {
  return readdirSync(path.join(repoRoot, dir), { withFileTypes: true }).flatMap((entry) => {
    const rel = `${dir}/${entry.name}`;
    if (entry.isDirectory()) return SKIP_DIRS.has(entry.name) ? [] : codeFiles(rel);
    return entry.isFile() && CODE.test(entry.name) ? [rel] : [];
  });
}

function matches(files: string[], pattern: RegExp) {
  return files.flatMap((file) => [...readFileSync(path.join(repoRoot, file), "utf8").matchAll(pattern)].map((m) => `${file}: ${m[0]}`));
}

test("no apps/web, packages or non-release test module imports from apps/tulsa-zone", () => {
  const files = [...codeFiles("apps/web"), ...codeFiles("packages"), ...codeFiles("tests")]
    .filter((file) => !RELEASE_TESTS.has(file) && file !== "tests/web-zone-independence.test.ts");
  assert.ok(files.some((file) => file.startsWith("apps/web/app/")), "scan must cover the web routes");
  assert.deepEqual(matches(files, ZONE_IMPORT), []);
});

test("apps/web code does not reference the runtime-zone slug list", () => {
  const files = [...codeFiles("apps/web"), ...codeFiles("packages")];
  assert.deepEqual(matches(files, SLUG_LIST), []);
  const tsconfig = readFileSync(path.join(repoRoot, "apps/web/tsconfig.json"), "utf8");
  assert.doesNotMatch(tsconfig, /tulsa-zone|@zone\//);
});

test("components moved from the zone live in apps/web", () => {
  for (const name of [
    "v6-change-detail", "v6-change-note", "v6-correction-diff",
    "v6-compact-change-note", "imperial-ux-change-note", "mit-student-guide-change-note"
  ]) {
    assert.ok(codeFiles("apps/web/components").includes(`apps/web/components/${name}.tsx`), name);
  }
});
