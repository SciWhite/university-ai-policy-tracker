import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  CONTENT_API_VERSION, activeContent, contentScoped, readContentJson, refreshContentPointer, resetContentRuntimeForTests,
  type ContentPointer, type ContentReleaseManifest
} from "../apps/web/lib/content-runtime";
import { readingCohortSlugs } from "../apps/web/lib/reading-cohort";
import { validateMonthlyReportRegistry } from "../apps/web/lib/monthly-report-registry";
import { CHANGE_RENDERER_IDENTITIES, publicHistoryBasisV2 } from "../apps/web/lib/public-history-basis";
import { isContentTag } from "../apps/web/lib/content-cache-tags";
import { privateFieldViolations, privatePathViolation } from "../scripts/content-release/file-set";
import { compareClaimSets, type ClaimSets } from "../scripts/content-release/lib";
import { awaitMcpRelease, changedSurface, readingDigests } from "../scripts/content-release/switch";
import { createServer } from "node:http";
import { POST as refreshPost } from "../apps/web/app/api/internal/content/refresh/route";

const sha = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");
const repoRoot = process.cwd();

/** A minimal content root: two releases whose trees differ in the V6 cohort pointer. */
function contentRoot() {
  const root = mkdtempSync(path.join(tmpdir(), "uapt-content-"));
  const release = (contentId: string, slugs: string[], extra: Partial<ContentReleaseManifest> = {}) => {
    const tree = path.join(root, "releases", contentId, "tree");
    mkdirSync(path.join(tree, "data/public-v6-pages"), { recursive: true });
    writeFileSync(path.join(tree, "data/public-v6-pages/current.json"), JSON.stringify({ releaseId: contentId, slugs }));
    const manifest = {
      schemaVersion: "uapt-content-release-v1", contentId, parentContentId: null, createdAt: "2026-11-04T00:00:00.000Z",
      appCompatibility: { contentApi: [CONTENT_API_VERSION], schemas: ["uapt-v6-published-pages-v1"] }, requiredSyncContract: "2.1.0",
      families: {}, claimSets: { schools: 0, claims: 0, held: 0, sha256: "0".repeat(64) }, files: [], ...extra
    };
    const bytes = JSON.stringify(manifest);
    writeFileSync(path.join(root, "releases", contentId, "manifest.json"), bytes);
    return sha(bytes);
  };
  const point = (contentId: string, manifestSha256: string, extra: Partial<ContentPointer> = {}) =>
    writeFileSync(path.join(root, "current.json"), JSON.stringify({ schemaVersion: "uapt-content-pointer-v1", contentId, manifestSha256, sync: { contractVersion: "2.1.0", eventId: "evt-test", eventSha256: "a".repeat(64) }, ...extra }));
  return { root, release, point, cleanup: () => rmSync(root, { recursive: true, force: true }) };
}

function withContentRoot<T>(root: string, fn: () => T): T {
  const previous = { root: process.env.UAPT_CONTENT_ROOT, check: process.env.UAPT_CONTENT_POINTER_CHECK_MS };
  process.env.UAPT_CONTENT_ROOT = root;
  resetContentRuntimeForTests();
  try { return fn(); } finally {
    if (previous.root === undefined) delete process.env.UAPT_CONTENT_ROOT; else process.env.UAPT_CONTENT_ROOT = previous.root;
    resetContentRuntimeForTests();
  }
}

test("a pointer switch changes the content every loader sees, without a rebuild", () => {
  const f = contentRoot();
  try {
    const a = f.release("demo-a", ["harvard-university"]);
    const b = f.release("demo-b", ["harvard-university", "rice-university"]);
    f.point("demo-a", a);
    withContentRoot(f.root, () => {
      assert.equal(activeContent().contentId, "demo-a");
      assert.deepEqual(readingCohortSlugs(), ["harvard-university"]);
      const derived = () => contentScoped("test-cohort-size", () => readContentJson<{ slugs: string[] }>("data/public-v6-pages/current.json").slugs.length);
      assert.equal(derived(), 1);
      f.point("demo-b", b);
      assert.equal(refreshContentPointer().contentId, "demo-b");
      assert.deepEqual(readingCohortSlugs(), ["harvard-university", "rice-university"]);
      assert.equal(derived(), 2, "content-scoped caches are rebuilt for the new release");
    });
  } finally { f.cleanup(); }
});

test("a rejected switch keeps serving the last verified release; first selection fails closed", () => {
  const f = contentRoot();
  try {
    const a = f.release("demo-a", ["harvard-university"]);
    f.point("demo-a", "f".repeat(64));
    withContentRoot(f.root, () => assert.throws(() => activeContent(), /manifest hash mismatch/));
    f.point("demo-a", a);
    withContentRoot(f.root, () => {
      assert.equal(activeContent().contentId, "demo-a");
      const incompatible = f.release("demo-c", ["x"], { appCompatibility: { contentApi: [CONTENT_API_VERSION + 1], schemas: [] } });
      f.point("demo-c", incompatible);
      const result = refreshContentPointer();
      assert.equal(result.contentId, "demo-a");
      assert.match(result.error ?? "", /not compatible with content API/);
      const unknownSchema = f.release("demo-d", ["x"], { appCompatibility: { contentApi: [CONTENT_API_VERSION], schemas: ["uapt-future-v9"] } });
      f.point("demo-d", unknownSchema);
      assert.match(refreshContentPointer().error ?? "", /unsupported schemas/);
      const weakSync = f.release("demo-e", ["x"]);
      f.point("demo-e", weakSync, { sync: { contractVersion: "2.0.0", eventId: "evt", eventSha256: "b".repeat(64) } });
      assert.match(refreshContentPointer().error ?? "", /requires synchronization contract 2.1.0/);
    });
  } finally { f.cleanup(); }
});

test("unsynchronized pointers are local previews only", () => {
  const f = contentRoot();
  try {
    const a = f.release("demo-a", ["harvard-university"]);
    writeFileSync(path.join(f.root, "current.json"), JSON.stringify({ schemaVersion: "uapt-content-pointer-v1", contentId: "demo-a", manifestSha256: a, unsynchronizedLocalPreview: true }));
    withContentRoot(f.root, () => assert.throws(() => activeContent(), /no synchronization receipt/));
    process.env.UAPT_CONTENT_ALLOW_UNSYNCHRONIZED = "1";
    try { withContentRoot(f.root, () => assert.equal(activeContent().contentId, "demo-a")); }
    finally { delete process.env.UAPT_CONTENT_ALLOW_UNSYNCHRONIZED; }
  } finally { f.cleanup(); }
});

test("a content-free program build reads no content while Next prerenders", () => {
  const previous = { phase: process.env.NEXT_PHASE, build: process.env.UAPT_PROGRAM_BUILD };
  process.env.UAPT_PROGRAM_BUILD = "1";
  process.env.NEXT_PHASE = "phase-production-build";
  try {
    resetContentRuntimeForTests();
    // notFound() aborts the render; the packager then drops the build-time body.
    assert.throws(() => refreshContentPointer(), /NEXT_HTTP_ERROR_FALLBACK;404/);
    process.env.NEXT_PHASE = "phase-production-server";
    assert.equal(refreshContentPointer().mode, "workspace");
  } finally {
    for (const [key, value] of [["NEXT_PHASE", previous.phase], ["UAPT_PROGRAM_BUILD", previous.build]] as const) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
    resetContentRuntimeForTests();
  }
});

test("the monthly report registry is data with a required current report", () => {
  const registry = JSON.parse(readFileSync(path.join(repoRoot, "data/monthly-reports/registry.json"), "utf8"));
  assert.equal(validateMonthlyReportRegistry(registry).current, "2026-09");
  assert.throws(() => validateMonthlyReportRegistry({ ...registry, current: "2026-12" }), /Current monthly report/);
  const broken = structuredClone(registry);
  broken.reports["2026-09"].month = "2026-08";
  assert.throws(() => validateMonthlyReportRegistry(broken), /Invalid monthly report spec: 2026-09/);
  const outside = structuredClone(registry);
  outside.reports["2026-09"].releaseManifestPath = "../../etc/passwd";
  assert.throws(() => validateMonthlyReportRegistry(outside), /Invalid monthly report spec/);
});

test("history basis binds a frozen renderer identity, reproducing the published basis", async () => {
  const pointer = JSON.parse(readFileSync(path.join(repoRoot, "data/public-change-history/current.json"), "utf8"));
  const manifest = JSON.parse(readFileSync(path.join(repoRoot, "data/public-change-history", pointer.path), "utf8"));
  assert.equal(await publicHistoryBasisV2(repoRoot, manifest.rulesVersion), manifest.basisSha256);
  for (const identity of Object.values(CHANGE_RENDERER_IDENTITIES)) for (const hash of Object.values(identity)) assert.match(hash, /^[a-f0-9]{64}$/);
  await assert.rejects(() => publicHistoryBasisV2(repoRoot, "tracker-events-9.9.9"), /No frozen renderer identity/);
});

test("private fields and paths are rejected", () => {
  assert.deepEqual(privateFieldViolations({ a: [{ normalizedTextPath: "x" }] }), ["$.a[0].normalizedTextPath: private key"]);
  assert.deepEqual(privateFieldViolations({ note: "see /Users/someone/file" }), ["$.note: local path"]);
  assert.deepEqual(privateFieldViolations({ evidenceSnippet: "Students must disclose AI use." }), []);
  assert.ok(privatePathViolation("data/public-releases/candidates/x.json"));
  assert.ok(privatePathViolation(".local/policy-inventory/a.json"));
  assert.equal(privatePathViolation("data/public-v6-pages/current.json"), undefined);
});

const claims = (entries: Record<string, { published?: Record<string, string>; held?: string[] }>): ClaimSets =>
  new Map(Object.entries(entries).map(([slug, value]) => [slug, { published: new Map(Object.entries(value.published ?? {})), held: new Set(value.held ?? []) }]));

test("Claim IDs, holds and original quotes never change without a declared decision", () => {
  const manifest = { decisions: {} } as ContentReleaseManifest;
  const parent = claims({ mit: { published: { c1: "q1", c2: "q2" }, held: ["h1"] } });
  assert.deepEqual(compareClaimSets(parent, claims({ mit: { published: { c1: "q1", c2: "q2" }, held: ["h1"] } }), manifest).errors, []);
  const errors = compareClaimSets(parent, claims({ mit: { published: { c1: "q1-edited", h1: "qh" } } }), manifest).errors;
  assert.ok(errors.some(e => /mit\/c1: original quote or locator changed/.test(e)));
  assert.ok(errors.some(e => /mit\/c2: Claim ID removed/.test(e)));
  assert.ok(errors.some(e => /mit\/h1: held claim published without a recorded decision/.test(e)));
  const declared = { decisions: { correctedClaimIds: { mit: ["c1"] }, removedClaimIds: { mit: ["c2"] }, releasedHeldClaimIds: { mit: ["h1"] } } } as unknown as ContentReleaseManifest;
  assert.deepEqual(compareClaimSets(parent, claims({ mit: { published: { c1: "q1-edited", h1: "qh" } } }), declared).errors, []);
  assert.ok(compareClaimSets(parent, claims({}), manifest).errors.some(e => /mit\/h1: held decision dropped/.test(e)));
  const added = compareClaimSets(parent, claims({ mit: { published: { c1: "q1", c2: "q2" }, held: ["h1"] }, rice: { published: { r1: "r" } } }), manifest);
  assert.deepEqual(added.errors, []);
  assert.deepEqual(added.notes, ["rice: new school (1 claims, 0 held)"]);
});

test("a switch lists exact changed tags and URLs for refresh and the Cloudflare hook", () => {
  const files = (registry: string) => [["data/monthly-reports/registry.json", registry, 1]] as ContentReleaseManifest["files"];
  const base = { families: {}, files: files("r1"), reports: { registry: "data/monthly-reports/registry.json", current: "2026-09" } } as unknown as ContentReleaseManifest;
  const next = { ...base, files: files("r2"), reports: { registry: "data/monthly-reports/registry.json", current: "2026-10" } } as ContentReleaseManifest;
  const surface = changedSurface({ manifest: base, digests: { mit: "1" } }, { manifest: next, digests: { mit: "1", rice: "2" }, cohort: ["rice"] });
  assert.deepEqual(surface.changedSchools, ["rice"]);
  for (const tag of ["school:rice", "catalog", "home", "sitemap", "reports", "report:2026-10"]) assert.ok(surface.tags.includes(tag), tag);
  for (const p of ["/universities/rice", "/zh/universities/rice", "/ja/universities/rice", "/reports/monthly/2026-10", "/api/public/v1/reports/monthly/2026-10/chart-data.json"]) assert.ok(surface.paths.includes(p), p);
  assert.ok(surface.tags.includes("report:2026-09") && surface.paths.includes("/llms.txt"), "the replaced month and llms.txt are refreshed too");
  assert.ok(!surface.tags.includes("school:mit"));
  assert.ok(surface.tags.every(isContentTag));
  const quiet = changedSurface({ manifest: base, digests: { mit: "1" } }, { manifest: base, digests: { mit: "1" }, cohort: [] });
  assert.deepEqual(quiet.tags, []);
});

test("a locale-index or translation change refreshes the school and sitemap without a record change", () => {
  const manifest = { families: {}, files: [] } as unknown as ContentReleaseManifest;
  const surface = changedSurface({ manifest, digests: { yale: "1", mit: "1" }, reading: { yale: "a", mit: "m" } }, { manifest, digests: { yale: "1", mit: "1" }, cohort: ["yale"], reading: { yale: "b", mit: "m" } });
  assert.deepEqual(surface.changedSchools, []);
  assert.deepEqual(surface.readingChangedSchools, ["yale"]);
  for (const tag of ["school:yale", "sitemap"]) assert.ok(surface.tags.includes(tag), tag);
  for (const p of ["/universities/yale", "/ja/universities/yale", "/sitemaps/universities.xml"]) assert.ok(surface.paths.includes(p), p);
  assert.ok(!surface.tags.includes("school:mit"));
});

test("the switch reads back that MCP serves the new release, without a restart", async () => {
  let served = { contentId: "c-old", catalogSha256: "1".repeat(64) };
  const server = createServer((_req, res) => { res.setHeader("content-type", "application/json"); res.end(JSON.stringify({ ok: true, ...served })); });
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  try {
    const url = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
    assert.equal((await awaitMcpRelease(url, { contentId: "c-new", catalogSha256: "2".repeat(64) }, 50, 10)).status, "not_updated");
    setTimeout(() => { served = { contentId: "c-new", catalogSha256: "2".repeat(64) }; }, 30);
    const updated = await awaitMcpRelease(url, { contentId: "c-new", catalogSha256: "2".repeat(64) }, 2000, 10);
    assert.equal(updated.status, "updated");
    await assert.rejects(awaitMcpRelease("http://example.org", { contentId: "c-new" }, 10, 10), /loopback-only/);
  } finally { await new Promise(resolve => server.close(resolve)); }
});

test("the refresh endpoint is loopback-only, authenticated and fails closed on the wrong release", async () => {
  const call = (headers: Record<string, string>, body: unknown = { expectedContentId: "demo-b", tags: ["content"] }) =>
    refreshPost(new Request("http://127.0.0.1:3100/api/internal/content/refresh", { method: "POST", headers: { host: "127.0.0.1:3100", "content-type": "application/json", ...headers }, body: JSON.stringify(body) }));
  delete process.env.UAPT_CONTENT_REFRESH_TOKEN;
  assert.equal((await call({})).status, 404, "disabled without a token");
  process.env.UAPT_CONTENT_REFRESH_TOKEN = "t".repeat(40);
  try {
    const auth = { authorization: `Bearer ${"t".repeat(40)}` };
    assert.equal((await call({ ...auth, "x-forwarded-for": "203.0.113.9" })).status, 403);
    assert.equal((await call({ ...auth, "x-forwarded-for": "127.0.0.1, 203.0.113.9" })).status, 403);
    assert.equal((await call({ ...auth, "x-real-ip": "198.51.100.4" })).status, 403);
    assert.equal((await call({ ...auth, "cf-connecting-ip": "127.0.0.1" })).status, 403);
    assert.equal((await call({ ...auth, "x-forwarded-host": "eduaipolicy.org" })).status, 403);
    assert.equal((await call({ ...auth, host: "eduaipolicy.org" })).status, 403);
    assert.equal((await call({ authorization: "Bearer wrong" })).status, 401);
    assert.equal((await call(auth, { expectedContentId: "demo-b", tags: ["bogus tag"] })).status, 400);
    const f = contentRoot();
    try {
      f.point("demo-a", f.release("demo-a", ["harvard-university"]));
      process.env.UAPT_CONTENT_ROOT = f.root;
      resetContentRuntimeForTests();
      const response = await call(auth);
      assert.equal(response.status, 409, "never expires pages for a release this process does not serve");
      assert.equal((await response.json()).contentId, "demo-a");
    } finally { delete process.env.UAPT_CONTENT_ROOT; resetContentRuntimeForTests(); f.cleanup(); }
  } finally { delete process.env.UAPT_CONTENT_REFRESH_TOKEN; }
});

test("reading digests change only for schools whose policy entry, refs or deltas change", () => {
  const root = mkdtempSync(path.join(tmpdir(), "uapt-reading-digest-"));
  try {
    const write = (rel: string, value: unknown) => { mkdirSync(path.dirname(path.join(root, rel)), { recursive: true }); const bytes = JSON.stringify(value); writeFileSync(path.join(root, rel), bytes); return sha(bytes); };
    const release = (name: string, selection: unknown, policy: unknown) => {
      const selectionSha = write(`${name}/translations/selection.json`, selection);
      write(`${name}/translations/current.json`, { path: "selection.json", sha256: selectionSha });
      write(`${name}/locale-index/p.json`, policy);
      return { manifest: { translations: { pointer: "translations/current.json", sampledPublication: { acceptanceSha256: "f".repeat(64), selectionSha256: selectionSha } }, localeIndexPolicy: { path: "locale-index/p.json", sha256: "0" } } as unknown as ContentReleaseManifest, tree: path.join(root, name) };
    };
    const refs = { yale: { ja: { path: "y.json", sha256: "1" } }, mit: { ja: { path: "m.json", sha256: "2" } } };
    const policy = { schools: { yale: { recordSha256: "old" }, mit: { recordSha256: "m" } } };
    const a = release("a", { schools: refs }, policy);
    const b = release("b", { schools: refs, supplemental: { recordDeltas: [{ receipt: { sha256: "9" }, schools: { yale: {} } }] } }, { schools: { ...policy.schools, yale: { recordSha256: "new" } } });
    const before = readingDigests(a.manifest, a.tree), after = readingDigests(b.manifest, b.tree);
    assert.notEqual(before.yale, after.yale);
    assert.equal(before.mit, after.mit, "another school's delta and the new selection pin leave mit alone");
  } finally { rmSync(root, { recursive: true, force: true }); }
});
