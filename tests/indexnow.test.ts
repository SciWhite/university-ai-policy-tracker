import assert from "node:assert/strict";
import test from "node:test";
import { spawn, spawnSync } from "node:child_process";
import http from "node:http";
import type { AddressInfo } from "node:net";
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
  intersectIndexNowUrlsWithPublishedSitemap,
  frozenScopeIndexNowUrls,
  partitionIndexNowUrlsByScope
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

function contentRootFixture(options: { sync?: boolean; firstSelection?: boolean; paths?: string[] } = {}) {
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
  const plan = { schemaVersion: "uapt-content-switch-v1", contentId, previousContentId: pointer.previousContentId, switchedAt, tags: ["school:university-of-bristol"], paths: options.paths ?? ["/", "/universities/university-of-bristol", "/zh/universities/university-of-bristol", "/changes/university-of-bristol", "/universities/"] };
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

test("frozen scope paths and candidate URLs are compared after the same normalization", () => {
  const scope = frozenScopeIndexNowUrls(["/universities/bristol", "/zh/universities/bristol/", "/api/public/v1/universities/bristol.json", "/zh"], DEFAULT_INDEXNOW_BASE_URL);
  assert.ok(scope.has("https://eduaipolicy.org/universities/bristol"));
  assert.ok(scope.has("https://eduaipolicy.org/zh/universities/bristol"));
  assert.ok(scope.has("https://eduaipolicy.org/zh"));
  assert.deepEqual(
    partitionIndexNowUrlsByScope([
      "https://eduaipolicy.org/universities/bristol",
      "/zh/universities/bristol?x=1",
      "https://eduaipolicy.org/de/universities/bristol",
      "/"
    ], scope, DEFAULT_INDEXNOW_BASE_URL),
    {
      inScope: ["https://eduaipolicy.org/universities/bristol", "https://eduaipolicy.org/zh/universities/bristol"],
      outOfScope: ["https://eduaipolicy.org/de/universities/bristol", "https://eduaipolicy.org/"]
    }
  );
  assert.throws(() => frozenScopeIndexNowUrls(undefined), /no valid changedUrls/);
  assert.throws(() => frozenScopeIndexNowUrls([]), /no valid changedUrls/);
});

/**
 * A live run end to end, offline: a local server plays the published sitemap and the
 * IndexNow endpoint, and a stub stands in for policy-inventory.py so the test can see
 * which gate phase the script asks for (the real gate has its own tests).
 */
async function liveRunFixture(scopePaths: string[]) {
  const slug = "university-of-bristol";
  const content = contentRootFixture({ paths: [
    "/", `/universities/${slug}`, `/zh/universities/${slug}`, `/es/universities/${slug}`,
    `/de/universities/${slug}`, `/ja/universities/${slug}`, `/api/public/v1/universities/${slug}.json`
  ] });
  const sync = fs.mkdtempSync(path.join(os.tmpdir(), "uapt-indexnow-sync-"));
  const scopeBytes = JSON.stringify({ schemaVersion: "uapt-policy-sync-scope-v1", universities: [{ slug, publicClaimIds: ["c1"] }], changedUrls: scopePaths });
  fs.writeFileSync(path.join(sync, "scope.json"), scopeBytes);
  const manifestSha = createHash("sha256").update(fs.readFileSync(path.join(content.release, "manifest.json"))).digest("hex");
  const ledger = path.join(sync, "event-complete.json");
  fs.writeFileSync(ledger, JSON.stringify({
    syncContractVersion: "2.1.0", eventType: "policy_release", eventId: "uapt-c-20261110-002-complete", phase: "complete", basisSha256: manifestSha,
    scopeArtifact: { path: "scope.json", sha256: createHash("sha256").update(scopeBytes).digest("hex"), basisSha256: manifestSha },
    surfaces: { public_readback: { status: "updated", evidence: [] }, notifications: { status: "not_required_with_reason", reason: "set by the notification step" } }
  }));
  const gateLog = path.join(sync, "gate.log");
  const gate = path.join(sync, "fake-inventory-python.sh");
  fs.writeFileSync(gate, `#!/bin/sh\nprintf '%s\\n' "$*" >> "${gateLog}"\nexit 0\n`, { mode: 0o755 });
  const posts: Array<{ urlList: string[]; host: string }> = [];
  const server = http.createServer((req, res) => {
    const origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    if (req.method === "POST" && req.url === "/indexnow") {
      let body = "";
      req.on("data", (c) => { body += c; });
      req.on("end", () => { posts.push(JSON.parse(body)); res.writeHead(202).end(); });
      return;
    }
    if (req.url === "/sitemap.xml") return res.end(`<sitemapindex><sitemap><loc>${origin}/sitemaps/universities.xml</loc></sitemap></sitemapindex>`);
    // Bristol has no accepted Spanish prose, so /es is not published; UI-only locales never are.
    if (req.url === "/sitemaps/universities.xml") return res.end(`<urlset><url><loc>${origin}/</loc></url><url><loc>${origin}/universities/${slug}</loc></url><url><loc>${origin}/zh/universities/${slug}</loc></url></urlset>`);
    res.writeHead(404).end();
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const run = (...args: string[]) => new Promise<{ status: number | null; stdout: string; stderr: string }>((resolve) => {
    const child = spawn(process.execPath, ["--import", "tsx", "scripts/submit-indexnow.ts", "--content-root", content.root, ...(args.includes("--sync-ledger") ? [] : ["--sync-ledger", ledger]), "--base-url", origin, "--endpoint", `${origin}/indexnow`, ...args], { env: { ...process.env, UAPT_CONTENT_ROOT: "", UAPT_INVENTORY_PYTHON: gate } });
    let stdout = ""; let stderr = "";
    child.stdout.on("data", (c) => { stdout += c; });
    child.stderr.on("data", (c) => { stderr += c; });
    child.on("close", (status) => resolve({ status, stdout, stderr }));
  });
  const gateCalls = () => fs.existsSync(gateLog) ? fs.readFileSync(gateLog, "utf8").trim().split("\n") : [];
  const cleanup = () => { server.close(); content.cleanup(); fs.rmSync(sync, { recursive: true, force: true }); };
  return { slug, sync, ledger, origin, posts, run, gateCalls, cleanup };
}

const releaseScope = (slug: string) => [
  `/universities/${slug}`, `/zh/universities/${slug}`, `/es/universities/${slug}`, `/api/public/v1/universities/${slug}.json`
];

test("live --latest announces plan ∩ relative frozen scope ∩ published sitemap under the complete gate", async () => {
  const f = await liveRunFixture(releaseScope("university-of-bristol"));
  try {
    const missing = await f.run("--latest");
    assert.match(missing.stderr, /needs --authorization/);
    assert.equal(f.posts.length, 0);
    const result = await f.run("--latest", "--authorization", "Owner, 2026-11-22, test fixture");
    assert.equal(result.status, 0, result.stderr + result.stdout);
    assert.match(result.stdout, /Frozen scope filter: 7 plan URLs -> 4 in scope \(3 not announced\)/);
    assert.match(result.stdout, /Published sitemap filter: 4 candidate URLs -> 2 published URLs/);
    assert.equal(f.posts.length, 1);
    assert.equal(f.posts[0].host, "eduaipolicy.org");
    assert.deepEqual(f.posts[0].urlList, [
      `https://eduaipolicy.org/universities/${f.slug}`,
      `https://eduaipolicy.org/zh/universities/${f.slug}`
    ]);
    // Pre-send gate and completion gate both run the complete phase (the first call
    // belongs to the refused run without --authorization).
    const calls = f.gateCalls().slice(1);
    assert.equal(calls.length, 2);
    assert.match(calls[0], new RegExp(`sync-gate ${f.ledger.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")} --phase complete$`));
    assert.match(calls[1], /completion-indexnow-\d+\.json --phase complete$/);
    const completionFile = fs.readdirSync(f.sync).find((name) => name.startsWith("completion-indexnow-"))!;
    const completion = JSON.parse(fs.readFileSync(path.join(f.sync, completionFile), "utf8"));
    assert.equal(completion.surfaces.notifications.status, "updated");
    const notification = JSON.parse(fs.readFileSync(path.join(f.sync, completion.surfaces.notifications.evidence[0].path), "utf8"));
    assert.equal(notification.status, "accepted");
    assert.deepEqual(notification.checkedSlugs, [f.slug]);
    assert.equal(notification.indexingConfirmed, false);
    assert.equal(notification.authorization, "Owner, 2026-11-22, test fixture");
    assert.equal(completion.notificationAuthorization, "Owner, 2026-11-22, test fixture");
    // One announcement per ledger: neither the same ledger nor the completion event re-sends.
    const again = await f.run("--latest", "--authorization", "Owner, 2026-11-22, test fixture");
    assert.match(again.stderr, /already sent or is pending/);
    const fresh = path.join(f.sync, "chained");
    fs.mkdirSync(fresh);
    for (const name of ["scope.json", completionFile]) fs.copyFileSync(path.join(f.sync, name), path.join(fresh, name));
    const chained = await f.run("--latest", "--authorization", "Owner, 2026-11-22, test fixture", "--sync-ledger", path.join(fresh, completionFile));
    assert.match(chained.stderr, /already records a sent notification/);
    assert.equal(f.posts.length, 1);
    // The input ledger is never rewritten.
    assert.equal(JSON.parse(fs.readFileSync(f.ledger, "utf8")).eventId, "uapt-c-20261110-002-complete");
  } finally { f.cleanup(); }
});

test("explicit --urls outside the frozen scope still fail closed before any network request", async () => {
  const f = await liveRunFixture(releaseScope("university-of-bristol"));
  try {
    const result = await f.run("--urls", "/universities/university-of-bristol,/universities/university-of-oxford", "--authorization", "Owner, test fixture");
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /exceed the frozen synchronization scope/);
    assert.equal(f.posts.length, 0);
    assert.equal(fs.readdirSync(f.sync).some((name) => name.startsWith("notification-")), false);
  } finally { f.cleanup(); }
});

test("a dry run with --sync-ledger is a preflight: complete gate and scope filter, no request, no receipts", async () => {
  const f = await liveRunFixture(releaseScope("university-of-bristol"));
  try {
    const result = await f.run("--latest", "--dry-run");
    assert.equal(result.status, 0, result.stderr + result.stdout);
    assert.match(result.stdout, /4 in scope/);
    assert.match(result.stdout, /Total unique URLs in preview: 4/);
    assert.deepEqual(f.gateCalls().map((c) => c.endsWith("--phase complete")), [true]);
    assert.equal(f.posts.length, 0);
    assert.equal(fs.readdirSync(f.sync).some((name) => /^(notification|completion)-/.test(name)), false);
  } finally { f.cleanup(); }
});
