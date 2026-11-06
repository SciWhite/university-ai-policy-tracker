import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { loadContentCatalog, loadPinnedCatalog } from "../src/content.js";
import { HotCatalog } from "../src/server.js";

const catalogFile = path.resolve(import.meta.dirname, "../.runtime-data/catalog.json");
const sha = (value: Buffer | string) => createHash("sha256").update(value).digest("hex");

/** Two content releases sharing one exported catalog, as the web content root lays them out. */
function contentRoot() {
  const root = mkdtempSync(path.join(os.tmpdir(), "uapt-mcp-content-"));
  const releaseId = JSON.parse(readFileSync(catalogFile, "utf8")).payload.releaseId as string;
  const release = (contentId: string, mcp: { releaseId?: string; sha256?: string } = {}) => {
    const tree = path.join(root, "releases", contentId, "tree", "mcp");
    mkdirSync(tree, { recursive: true });
    copyFileSync(catalogFile, path.join(tree, "catalog.json"));
    const manifest = JSON.stringify({ schemaVersion: "uapt-content-release-v1", contentId, appCompatibility: { contentApi: [1] },
      mcp: { catalog: "mcp/catalog.json", releaseId: mcp.releaseId ?? releaseId, sha256: mcp.sha256 ?? sha(readFileSync(catalogFile)) } });
    writeFileSync(path.join(root, "releases", contentId, "manifest.json"), manifest);
    return sha(manifest);
  };
  const point = (contentId: string, manifestSha256: string) => writeFileSync(path.join(root, "current.json"), JSON.stringify({
    schemaVersion: "uapt-content-pointer-v1", contentId, manifestSha256, sync: { contractVersion: "2.1.0", eventId: "evt", eventSha256: "a".repeat(64) }
  }));
  return { root, release, point, releaseId, cleanup: () => rmSync(root, { recursive: true, force: true }) };
}

test("MCP follows the content pointer without a restart or release pin", async () => {
  const f = contentRoot();
  try {
    f.point("demo-a", f.release("demo-a"));
    const hot = new HotCatalog(await loadContentCatalog(f.root), () => loadContentCatalog(f.root));
    assert.equal(hot.contentId, "demo-a");
    assert.equal(hot.current().catalog.releaseId, f.releaseId);
    f.point("demo-b", f.release("demo-b"));
    assert.deepEqual(await hot.reload(), { ok: true, contentId: "demo-b", releaseId: f.releaseId, catalogSha256: sha(readFileSync(catalogFile)) });
    assert.equal(hot.contentId, "demo-b");
    assert.equal(hot.identity().manifestSha256, sha(readFileSync(path.join(f.root, "releases/demo-b/manifest.json"))));
  } finally { f.cleanup(); }
});

test("a rejected catalog switch keeps serving the last verified catalog", async () => {
  const f = contentRoot();
  try {
    f.point("demo-a", f.release("demo-a"));
    const hot = new HotCatalog(await loadContentCatalog(f.root), () => loadContentCatalog(f.root));
    const before = hot.current();
    f.point("demo-bad-hash", f.release("demo-bad-hash", { sha256: "0".repeat(64) }));
    const hash = await hot.reload();
    assert.equal(hash.ok, false);
    assert.match(hash.error ?? "", /catalog bytes changed/);
    f.point("demo-bad-release", f.release("demo-bad-release", { releaseId: "public-release-19990101-001" }));
    assert.match((await hot.reload()).error ?? "", /release mismatch/);
    f.point("demo-a", "f".repeat(64));
    assert.match((await hot.reload()).error ?? "", /manifest hash mismatch/);
    assert.equal(hot.current(), before);
    assert.equal(hot.contentId, "demo-a");
  } finally { f.cleanup(); }
});

test("legacy single-file deployments keep the release pin", async () => {
  const catalog = await loadPinnedCatalog(catalogFile);
  await assert.rejects(() => loadPinnedCatalog(catalogFile, "public-release-19990101-001"), /Pinned release mismatch/);
  assert.equal((await loadPinnedCatalog(catalogFile, catalog.catalog.releaseId)).catalog.releaseId, catalog.catalog.releaseId);
});

test("overlapping reloads apply in order, so a slow older read never replaces a newer selection", async () => {
  const f = contentRoot();
  try {
    f.point("demo-a", f.release("demo-a"));
    let calls = 0;
    const slowFirst = async () => {
      const call = ++calls;
      const selection = await loadContentCatalog(f.root);
      // The first reload reads demo-a, then stalls past the second reload's read of demo-b.
      if (call === 2) await new Promise(resolve => setTimeout(resolve, 50));
      return selection;
    };
    const hot = new HotCatalog(await slowFirst(), slowFirst);
    const first = hot.reload();
    await new Promise(resolve => setImmediate(resolve)); // the first reload has read pointer demo-a
    f.point("demo-b", f.release("demo-b"));
    const second = hot.reload();
    assert.equal((await first).contentId, "demo-a");
    assert.equal((await second).contentId, "demo-b");
    assert.equal(hot.contentId, "demo-b");
  } finally { f.cleanup(); }
});

test("/healthz reports the served content release and catalog hash for readback", async () => {
  const f = contentRoot();
  try {
    f.point("demo-a", f.release("demo-a"));
    const hot = new HotCatalog(await loadContentCatalog(f.root), () => loadContentCatalog(f.root));
    const { createMcpHttpServer } = await import("../src/server.js");
    const { DailyTelemetry } = await import("../src/telemetry.js");
    const server = createMcpHttpServer(hot, new DailyTelemetry(undefined));
    await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
    try {
      const port = (server.address() as { port: number }).port;
      const read = async () => (await fetch(`http://127.0.0.1:${port}/healthz`)).json() as Promise<Record<string, unknown>>;
      assert.deepEqual({ contentId: (await read()).contentId, catalogSha256: (await read()).catalogSha256 }, { contentId: "demo-a", catalogSha256: sha(readFileSync(catalogFile)) });
      f.point("demo-b", f.release("demo-b"));
      await hot.reload();
      const after = await read();
      assert.equal(after.contentId, "demo-b");
      assert.equal(after.manifestSha256, sha(readFileSync(path.join(f.root, "releases/demo-b/manifest.json"))));
    } finally { await new Promise(resolve => server.close(resolve)); }
  } finally { f.cleanup(); }
});
