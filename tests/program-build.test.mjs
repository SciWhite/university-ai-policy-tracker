import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, symlinkSync, existsSync } from "node:fs";
import path from "node:path";
import { tmpdir } from "node:os";
import { contentMarkers, fileListDigest, forbiddenPath, programBuildEnv, prunePrerenderedContent, scanArtifactTree } from "../scripts/program-build.mjs";

function fixture() {
  const root = mkdtempSync(path.join(tmpdir(), "uapt-program-build-"));
  const put = (file, content = "x") => {
    const target = path.join(root, file);
    mkdirSync(path.dirname(target), { recursive: true });
    writeFileSync(target, content);
  };
  return { root, put, cleanup: () => rmSync(root, { recursive: true, force: true }) };
}

test("file list digest is shared with the server installer", () => {
  // Same fixture as tests/test_program_artifact_install.py.
  const digest = fileListDigest({ files: [["apps/web/server.js", "0".repeat(64), 3, 0o644]], symlinks: [["node_modules/next", ".pnpm/next/node_modules/next"]] });
  assert.equal(digest, "427ae6b2014151748edabcdb024c20e33c845da83ca94be325c84aa701143312");
});

test("content, evidence and secrets are excluded wherever tracing puts them", () => {
  for (const [rel, expected] of [
    ["data/public-v6-pages/current.json", /top-level data/],
    ["staging/uapt-runs/x.json", /top-level staging/],
    ["apps/web/data/x.json", /app data/],
    ["apps/web/.runtime-data/data/x.json", /\.runtime-data/],
    ["node_modules/pkg/.local/secret", /\.local/],
    ["apps/web/.env.production", /private file type/],
    ["apps/web/.local/secrets/gsc-service-account.json", /\.local/],
    ["node_modules/x/policy-inventory/a.json", /policy-inventory/],
    ["node_modules/x/screenshots/a.png", /screenshots/]
  ]) assert.match(forbiddenPath(rel), expected, rel);
  for (const rel of ["apps/web/server.js", "node_modules/caniuse-lite/data/agents.js", "apps/web/public/assets/university-marks/a.webp", "apps/web/.next/server/app/page.js"]) {
    assert.equal(forbiddenPath(rel), null, rel);
  }
});

test("every prerendered body except the framework pages is pruned", () => {
  const f = fixture();
  try {
    const dist = path.join(f.root, ".next");
    const routes = {
      "/": { dataRoute: "/index.rsc" },
      "/about": { dataRoute: "/about.rsc" },
      "/feeds/atom.xml": {},
      "/_not-found": { dataRoute: "/_not-found.rsc" },
      "/_global-error": {}
    };
    f.put(".next/prerender-manifest.json", JSON.stringify({ routes }));
    for (const base of ["index", "about", "_global-error"]) for (const ext of ["html", "rsc", "meta"]) f.put(`.next/server/app/${base}.${ext}`, "<title>Harvard</title>");
    f.put(".next/server/app/index.segments/_tree.segment.rsc");
    f.put(".next/server/app/feeds/atom.xml.body", "<feed/>");
    f.put(".next/server/app/feeds/atom.xml.meta", "{}");
    f.put(".next/server/app/feeds/atom.xml/route.js", "module.exports = {}");
    f.put(".next/server/app/_not-found.html", "<title>Page not found | University AI Policy Tracker</title>");
    f.put(".next/server/pages/404.html", "<title>Page not found | University AI Policy Tracker</title>");
    f.put(".next/server/pages/500.html", "<title>500</title>");
    const result = prunePrerenderedContent(dist);
    assert.deepEqual(result.pruned, ["/", "/about", "/feeds/atom.xml"]);
    assert.deepEqual(result.kept, ["/_global-error", "/_not-found"]);
    assert.ok(!existsSync(path.join(dist, "server/app/index.html")));
    assert.ok(!existsSync(path.join(dist, "server/app/index.segments")));
    assert.ok(!existsSync(path.join(dist, "server/app/feeds/atom.xml.body")));
    assert.ok(existsSync(path.join(dist, "server/app/feeds/atom.xml/route.js")), "route modules stay");
    assert.ok(existsSync(path.join(dist, "server/app/_not-found.html")));

    f.put(".next/server/app/reports.html", "<title>September report</title>");
    assert.throws(() => prunePrerenderedContent(dist), /left after pruning: reports\.html/);
    rmSync(path.join(dist, "server/app/reports.html"));
    f.put(".next/server/app/_not-found.html", "<title>Harvard University AI policy</title>");
    assert.throws(() => prunePrerenderedContent(dist), /content-free global not-found/);
  } finally { f.cleanup(); }
});

test("artifact scan lists files and in-tree links and rejects escapes", async () => {
  const f = fixture();
  try {
    f.put("apps/web/server.js", "abc");
    f.put("node_modules/.pnpm/next/index.js", "next");
    symlinkSync(".pnpm/next", path.join(f.root, "node_modules/next"));
    const clean = await scanArtifactTree(f.root);
    assert.deepEqual(clean.problems, []);
    assert.equal(clean.bytes, 7);
    assert.deepEqual(clean.symlinks, [["node_modules/next", ".pnpm/next"]]);
    assert.deepEqual(clean.files.map(([rel]) => rel), ["apps/web/server.js", "node_modules/.pnpm/next/index.js"]);

    symlinkSync("../../../etc", path.join(f.root, "node_modules/escape"));
    f.put("data/public-v6-pages/current.json", "{}");
    const dirty = await scanArtifactTree(f.root);
    assert.ok(dirty.problems.some(problem => problem.startsWith("node_modules/escape: symlink leaves")));
    assert.ok(dirty.problems.some(problem => problem.startsWith("data: top-level data")));
  } finally { f.cleanup(); }
});

test("build environment drops inherited content and public variables", () => {
  const { env, publicEnv } = programBuildEnv({ PATH: "/bin", UAPT_CONTENT_ROOT: "/srv/uapt/content", NEXT_PUBLIC_SITE_URL: "http://localhost:3000", NEXT_PUBLIC_DEBUG: "1" });
  assert.equal(env.UAPT_CONTENT_ROOT, undefined);
  assert.equal(env.NEXT_PUBLIC_DEBUG, undefined);
  assert.equal(env.NEXT_PUBLIC_SITE_URL, "https://eduaipolicy.org");
  assert.equal(env.UAPT_PROGRAM_BUILD, "1");
  assert.equal(env.NODE_ENV, "production");
  assert.deepEqual(Object.keys(publicEnv).sort(), ["NEXT_PUBLIC_MULTILINGUAL_PHASE_TWO", "NEXT_PUBLIC_SITE_URL", "NEXT_PUBLIC_UAPT_V6_PUBLISHED_PAGES"]);
});

test("content markers come from the frozen pointers", () => {
  const f = fixture();
  try {
    f.put("data/public-releases/current.json", JSON.stringify({ releaseId: "uapt-public-20261104-001", sha256: "f".repeat(64), short: "x" }));
    f.put("data/public-v6-pages/current.json", JSON.stringify({ revision: "v6-pages-20261104", slugs: ["harvard-university"] }));
    assert.deepEqual(contentMarkers(f.root).sort(), ["f".repeat(64), "uapt-public-20261104-001", "v6-pages-20261104"]);
  } finally { f.cleanup(); }
});
