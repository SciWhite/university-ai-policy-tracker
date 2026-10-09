import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import {
  DEFAULT_INDEXNOW_KEY,
  DEFAULT_INDEXNOW_HOST,
  DEFAULT_INDEXNOW_BASE_URL,
  normalizeIndexNowUrl,
  chunkUrls,
  submitToIndexNow,
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

test("getLatestReleaseIndexNowUrls extracts changed URLs from current release", async () => {
  const urls = await getLatestReleaseIndexNowUrls(DEFAULT_INDEXNOW_BASE_URL);

  assert.ok(urls.length > 0, "Should contain at least 1 URL");
  assert.ok(urls.includes("https://eduaipolicy.org/"), "Should include root");
  assert.ok(urls.includes("https://eduaipolicy.org/changes"), "Should include /changes");
  assert.ok(urls.includes("https://eduaipolicy.org/universities"), "Should include /universities");

  // Every URL should start with canonical base URL
  for (const url of urls) {
    assert.ok(
      url.startsWith("https://eduaipolicy.org"),
      `URL ${url} should start with https://eduaipolicy.org`
    );
  }
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
