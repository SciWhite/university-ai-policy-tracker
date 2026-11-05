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
    assert.deepEqual(await hot.reload(), { ok: true, contentId: "demo-b", releaseId: f.releaseId });
    assert.equal(hot.contentId, "demo-b");
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
