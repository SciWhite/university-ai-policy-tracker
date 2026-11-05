import assert from "node:assert/strict";
import test from "node:test";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  DEFAULT_INDEXNOW_KEY,
  DEFAULT_INDEXNOW_HOST,
  DEFAULT_INDEXNOW_BASE_URL,
  normalizeIndexNowUrl,
  chunkUrls,
  submitToIndexNow,
  activeContentReleaseIndexNowBasis,
  getLatestReleaseIndexNowUrls,
  getPublishedSitemapIndexNowUrls,
  intersectIndexNowUrlsWithPublishedSitemap
} from "../apps/web/lib/indexnow";

test("IndexNow key verification file exists in public directory", () => {
  const keyFilePath = path.join(
    process.cwd(),
    "apps/web/public",
    `${DEFAULT_INDEXNOW_KEY}.txt`
  );
  assert.ok(fs.existsSync(keyFilePath), `File ${keyFilePath} should exist`);
  const content = fs.readFileSync(keyFilePath, "utf8").trim();
  assert.equal(content, DEFAULT_INDEXNOW_KEY);
});

test("normalizeIndexNowUrl standardizes URLs", () => {
  const base = "https://eduaipolicy.org";

  // Relative path
  assert.equal(
    normalizeIndexNowUrl("/universities/oxford", base),
    "https://eduaipolicy.org/universities/oxford"
  );

  // Trailing slash stripping
  assert.equal(
    normalizeIndexNowUrl("/universities/oxford/", base),
    "https://eduaipolicy.org/universities/oxford"
  );

  // Root trailing slash preserved
  assert.equal(
    normalizeIndexNowUrl("/", base),
    "https://eduaipolicy.org/"
  );

  // Host and protocol override if different
  assert.equal(
    normalizeIndexNowUrl("http://localhost:3000/changes/release-1", base),
    "https://eduaipolicy.org/changes/release-1"
  );

  // Query and hash stripped
  assert.equal(
    normalizeIndexNowUrl("/universities/oxford?search=ai#section1", base),
    "https://eduaipolicy.org/universities/oxford"
  );
});

test("chunkUrls splits correctly", () => {
  const urls = ["url1", "url2", "url3", "url4", "url5"];
  const chunks = chunkUrls(urls, 2);
  assert.equal(chunks.length, 3);
  assert.deepEqual(chunks[0], ["url1", "url2"]);
  assert.deepEqual(chunks[1], ["url3", "url4"]);
  assert.deepEqual(chunks[2], ["url5"]);
});

test("submitToIndexNow dryRun behaves predictably", async () => {
  const results = await submitToIndexNow({
    urls: ["https://eduaipolicy.org/universities/oxford"],
    dryRun: true
  });

  assert.equal(results.length, 1);
  assert.equal(results[0].ok, true);
  assert.equal(results[0].status, 200);
  assert.equal(results[0].submittedCount, 1);
});

function contentRootFixture(options: { sync?: boolean; firstSelection?: boolean } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "uapt-indexnow-content-"));
  const contentId = "c-20261110-002";
  const switchedAt = "2026-11-10T12:00:00.000Z";
  const release = path.join(root, "releases", contentId);
  fs.mkdirSync(release, { recursive: true });
  const manifest = `${JSON.stringify({ schemaVersion: "uapt-content-release-v1", contentId })}\n`;
  fs.writeFileSync(path.join(release, "manifest.json"), manifest);
  const pointer = {
    schemaVersion: "uapt-content-pointer-v1", contentId,
    manifestSha256: createHash("sha256").update(manifest).digest("hex"),
    switchedAt, previousContentId: options.firstSelection ? null : "c-20261103-001",
    ...(options.sync === false ? { unsynchronizedLocalPreview: true } : { sync: { contractVersion: "2.1.0", eventId: "evt-1", eventSha256: "e".repeat(64) } })
  };
  fs.writeFileSync(path.join(root, "current.json"), JSON.stringify(pointer));
  const plan = { schemaVersion: "uapt-content-switch-v1", contentId, previousContentId: pointer.previousContentId, switchedAt, tags: ["school:university-of-bristol"], paths: ["/", "/universities/university-of-bristol", "/zh/universities/university-of-bristol", "/changes/university-of-bristol", "/universities/"] };
  fs.writeFileSync(path.join(release, `switch-${switchedAt.replace(/[:.]/g, "-")}.json`), JSON.stringify(plan));
  return { root, release, pointer, cleanup: () => fs.rmSync(root, { recursive: true, force: true }) };
}

test("latest URLs come from the selected content release's switch plan", () => {
  const f = contentRootFixture();
  try {
    const basis = activeContentReleaseIndexNowBasis(f.root);
    assert.equal(basis.contentId, "c-20261110-002");
    assert.equal(basis.manifestFile, path.join(f.release, "manifest.json"));
    assert.equal(basis.synchronized, true);
    assert.deepEqual(getLatestReleaseIndexNowUrls(basis, DEFAULT_INDEXNOW_BASE_URL), [
      "https://eduaipolicy.org/",
      "https://eduaipolicy.org/universities/university-of-bristol",
      "https://eduaipolicy.org/zh/universities/university-of-bristol",
      "https://eduaipolicy.org/changes/university-of-bristol",
      "https://eduaipolicy.org/universities"
    ]);
  } finally { f.cleanup(); }
});

test("content basis fails closed when pointer, manifest and plan disagree", () => {
  const f = contentRootFixture();
  try {
    fs.writeFileSync(path.join(f.release, "manifest.json"), "{}\n");
    assert.throws(() => activeContentReleaseIndexNowBasis(f.root), /manifest hash differs/);
  } finally { f.cleanup(); }
  const g = contentRootFixture();
  try {
    const planFile = fs.readdirSync(g.release).find((name) => name.startsWith("switch-"))!;
    const plan = JSON.parse(fs.readFileSync(path.join(g.release, planFile), "utf8"));
    fs.writeFileSync(path.join(g.release, planFile), JSON.stringify({ ...plan, contentId: "c-20261103-001" }));
    assert.throws(() => activeContentReleaseIndexNowBasis(g.root), /does not describe the selected release/);
  } finally { g.cleanup(); }
  const first = contentRootFixture({ firstSelection: true });
  try {
    // A first selection has no changed-URL list; nothing is announced from it.
    assert.deepEqual(activeContentReleaseIndexNowBasis(first.root).paths, []);
  } finally { first.cleanup(); }
});

test("live submission keeps --sync-ledger enforcement against the content basis", () => {
  const run = (...args: string[]) => spawnSync(process.execPath, ["--import", "tsx", "scripts/submit-indexnow.ts", ...args], { encoding: "utf8", env: { ...process.env, UAPT_CONTENT_ROOT: "" } });
  assert.match(run("--latest").stderr, /needs --content-root/);
  const preview = contentRootFixture({ sync: false });
  try {
    assert.match(run("--latest", "--content-root", preview.root).stderr, /unsynchronized local preview/);
  } finally { preview.cleanup(); }
  const f = contentRootFixture();
  try {
    assert.match(run("--latest", "--content-root", f.root).stderr, /without --sync-ledger/);
    const ledger = path.join(f.root, "event.json");
    fs.writeFileSync(ledger, JSON.stringify({ syncContractVersion: "2.1.0", eventType: "policy_release", basisSha256: "0".repeat(64) }));
    assert.match(run("--latest", "--content-root", f.root, "--sync-ledger", ledger).stderr, /bound to this exact basis/);
    const dry = run("--latest", "--dry-run", "--content-root", f.root);
    assert.equal(dry.status, 0, dry.stderr);
    assert.match(dry.stdout, /Total unique URLs in preview: 5/);
  } finally { f.cleanup(); }
});

test("published sitemap URLs are read from the index and same-origin child files", async () => {
  const responses = new Map([
    ["https://eduaipolicy.org/sitemap.xml", `<?xml version="1.0"?><sitemapindex><sitemap><loc>https://eduaipolicy.org/sitemaps/core.xml</loc></sitemap><sitemap><loc>https://eduaipolicy.org/sitemaps/universities.xml</loc></sitemap></sitemapindex>`],
    ["https://eduaipolicy.org/sitemaps/core.xml", `<?xml version="1.0"?><urlset><url><loc>https://eduaipolicy.org/</loc></url><url><loc>https://eduaipolicy.org/changes?from=2026&amp;lang=en</loc></url></urlset>`],
    ["https://eduaipolicy.org/sitemaps/universities.xml", `<?xml version="1.0"?><urlset><url><loc>https://eduaipolicy.org/universities/bristol</loc></url></urlset>`]
  ]);
  const fetcher: typeof fetch = async (input) => {
    const xml = responses.get(String(input));
    assert.ok(xml, `Unexpected sitemap request: ${String(input)}`);
    return new Response(xml, { status: 200, headers: { "content-type": "application/xml" } });
  };

  assert.deepEqual(
    await getPublishedSitemapIndexNowUrls(DEFAULT_INDEXNOW_BASE_URL, fetcher),
    [
      "https://eduaipolicy.org/",
      "https://eduaipolicy.org/changes",
      "https://eduaipolicy.org/universities/bristol"
    ]
  );
});

test("custom URL submissions are restricted to the published sitemap intersection", async () => {
  const fetcher: typeof fetch = async (input) => {
    const url = String(input);
    const xml = url.endsWith("/sitemap.xml")
      ? `<sitemapindex><sitemap><loc>https://eduaipolicy.org/sitemaps/universities.xml</loc></sitemap></sitemapindex>`
      : `<urlset><url><loc>https://eduaipolicy.org/universities/bristol</loc></url><url><loc>https://eduaipolicy.org/zh/universities/bristol</loc></url></urlset>`;
    return new Response(xml, { status: 200 });
  };

  assert.deepEqual(
    await intersectIndexNowUrlsWithPublishedSitemap(
      [
        "/universities/bristol?source=release",
        "https://eduaipolicy.org/zh/universities/bristol",
        "/es/universities/bristol",
        "/universities/bristol"
      ],
      DEFAULT_INDEXNOW_BASE_URL,
      fetcher
    ),
    ["https://eduaipolicy.org/universities/bristol", "https://eduaipolicy.org/zh/universities/bristol"]
  );
});

test("combined latest, all-sitemap, and custom candidates are deduplicated and sitemap-filtered", async () => {
  const fetcher: typeof fetch = async (input) => {
    const url = String(input);
    const xml = url.endsWith("/sitemap.xml")
      ? `<sitemapindex><sitemap><loc>https://eduaipolicy.org/sitemaps/universities.xml</loc></sitemap></sitemapindex>`
      : `<urlset><url><loc>https://eduaipolicy.org/universities/bristol</loc></url><url><loc>https://eduaipolicy.org/zh/universities/bristol</loc></url></urlset>`;
    return new Response(xml, { status: 200 });
  };
  const latestCandidates = ["/universities/bristol", "/es/universities/bristol"];
  const allSitemapCandidates = ["/universities/bristol", "/zh/universities/bristol"];
  const customCandidates = ["/nl/universities/bristol", "/zh/universities/bristol"];

  assert.deepEqual(
    await intersectIndexNowUrlsWithPublishedSitemap(
      [...latestCandidates, ...allSitemapCandidates, ...customCandidates],
      DEFAULT_INDEXNOW_BASE_URL,
      fetcher
    ),
    ["https://eduaipolicy.org/universities/bristol", "https://eduaipolicy.org/zh/universities/bristol"]
  );
});

test("published sitemap collection fails closed on cross-origin entries", async () => {
  const fetcher: typeof fetch = async () => new Response(
    `<urlset><url><loc>https://example.org/universities/bristol</loc></url></urlset>`,
    { status: 200 }
  );
  await assert.rejects(
    () => getPublishedSitemapIndexNowUrls(DEFAULT_INDEXNOW_BASE_URL, fetcher),
    /outside https:\/\/eduaipolicy\.org/
  );
});
