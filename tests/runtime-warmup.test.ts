import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { PAGE_STORE_PATTERN, planWarmup } from "../apps/web/lib/runtime-warmup";
import { READING_LOCALES } from "../apps/web/lib/language-catalog";

const root = process.cwd();

test("the warm-up and the nginx page store agree on which pages the tree serves", () => {
  const python = execFileSync("python3", ["-c", [
    "import importlib.util, json",
    `spec = importlib.util.spec_from_file_location('ro', ${JSON.stringify(path.join(root, "scripts/release/render-once.py"))})`,
    "ro = importlib.util.module_from_spec(spec); spec.loader.exec_module(ro)",
    "print(json.dumps({'pattern': ro.PAGE_STORE_PATTERN, 'locales': ro.READING_LOCALES}))"
  ].join("\n")], { encoding: "utf8" });
  const { pattern, locales } = JSON.parse(python) as { pattern: string; locales: string[] };
  assert.equal(PAGE_STORE_PATTERN.source, pattern.replaceAll("/", "\\/"));
  assert.deepEqual(locales, [...READING_LOCALES]);
  assert.match(readFileSync(path.join(root, "infra/nginx/uapt-page-store.conf"), "utf8"), /uapt_page_tree_kind/);
});

test("with a page tree only a small sample of school and changes pages is rendered", () => {
  const schools = Array.from({ length: 40 }, (_, i) => `/universities/school-${i}`);
  const sitemap = ["/", "/about", ...schools, "/zh/universities/school-1", "/changes/school-1", "/reports/monthly/2026-10", "/de/universities"];
  const full = planWarmup(sitemap, { pageTree: false });
  assert.equal(full.paths.length, sitemap.length - 1); // "/" is a core path
  assert.equal(full.skippedForPageTree, 0);
  const scoped = planWarmup(sitemap, { pageTree: true });
  assert.deepEqual(scoped.paths.filter(p => !PAGE_STORE_PATTERN.test(p)), ["/about", "/reports/monthly/2026-10", "/de/universities"]);
  assert.equal(scoped.paths.filter(p => PAGE_STORE_PATTERN.test(p)).length, 12);
  assert.equal(scoped.skippedForPageTree, 42 - 12);
});
