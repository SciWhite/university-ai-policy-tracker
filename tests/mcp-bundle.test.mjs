// The MCP server ships in the program artifact as one bundled file
// (scripts/program-build.mjs bundleMcp). This starts that bundle the way
// production does: NODE_ENV=production, a runtime content root, no catalog pin.
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { bundleMcp, MCP_ENTRY } from "../scripts/program-build.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const catalogFile = process.env.UAPT_MCP_TEST_CATALOG ?? path.join(root, "apps/mcp/.runtime-data/catalog.json");
const sha = value => createHash("sha256").update(value).digest("hex");
const freePort = () => new Promise(resolve => { const s = createServer().listen(0, "127.0.0.1", () => { const { port } = s.address(); s.close(() => resolve(port)); }); });

function contentRoot(dir) {
  const bytes = readFileSync(catalogFile);
  const releaseId = JSON.parse(bytes).payload.releaseId;
  const release = contentId => {
    const tree = path.join(dir, "releases", contentId, "tree", "mcp");
    mkdirSync(tree, { recursive: true });
    copyFileSync(catalogFile, path.join(tree, "catalog.json"));
    const manifest = JSON.stringify({ schemaVersion: "uapt-content-release-v1", contentId, appCompatibility: { contentApi: [1] }, mcp: { catalog: "mcp/catalog.json", releaseId, sha256: sha(bytes) } });
    writeFileSync(path.join(dir, "releases", contentId, "manifest.json"), manifest);
    // Atomic rename, as content:switch writes the pointer.
    const tmp = path.join(dir, "current.json.tmp");
    writeFileSync(tmp, JSON.stringify({ schemaVersion: "uapt-content-pointer-v1", contentId, manifestSha256: sha(manifest), sync: { contractVersion: "2.1.0", eventId: "evt", eventSha256: "a".repeat(64) } }));
    return import("node:fs").then(fs => fs.renameSync(tmp, path.join(dir, "current.json")));
  };
  return { release, catalogSha256: sha(bytes), releaseId };
}

async function waitFor(fn, ms = 20000) {
  const end = Date.now() + ms;
  let last;
  while (Date.now() < end) {
    try { last = await fn(); if (last) return last; } catch (error) { last = error; }
    await new Promise(r => setTimeout(r, 200));
  }
  throw new Error(`timed out: ${last instanceof Error ? last.message : JSON.stringify(last)}`);
}

test("the bundled MCP server needs no node_modules and follows the runtime content pointer", { skip: !existsSync(catalogFile) && "no exported MCP catalog (pnpm mcp:export) for the fixture" }, async () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), "uapt-mcp-bundle-"));
  let child;
  try {
    // Outside the checkout, so nothing can resolve from the workspace node_modules.
    const outfile = path.join(dir, MCP_ENTRY);
    const bundle = await bundleMcp({ root, outfile });
    assert.ok(bundle.bytes > 10000);
    const external = readFileSync(outfile, "utf8").match(/^\s*import\s[^;]*from\s*["'](?!node:)[^"']+["']/gm) ?? [];
    assert.deepEqual(external, [], "the bundle imports only Node builtins");
    const content = path.join(dir, "content");
    const c = contentRoot(content);
    await c.release("demo-a");
    const port = await freePort();
    child = spawn(process.execPath, [path.basename(outfile)], { cwd: path.dirname(outfile), stdio: ["ignore", "pipe", "pipe"], env: {
      PATH: process.env.PATH, NODE_ENV: "production", UAPT_CONTENT_ROOT: content, UAPT_MCP_PORT: String(port),
      UAPT_MCP_TELEMETRY_FILE: path.join(dir, "telemetry.jsonl"), UAPT_MCP_CONTENT_POLL_MS: "1000" } });
    let stderr = "";
    child.stderr.on("data", d => { stderr += d; });
    const health = () => fetch(`http://127.0.0.1:${port}/healthz`).then(r => r.json());
    const first = await waitFor(health).catch(error => { throw new Error(`${error.message}; stderr: ${stderr}`); });
    assert.equal(first.contentId, "demo-a");
    assert.equal(first.releaseId, c.releaseId);
    assert.equal(first.catalogSha256, c.catalogSha256);

    const response = await fetch(`http://127.0.0.1:${port}/api/mcp`, { method: "POST", headers: { "content-type": "application/json", accept: "application/json, text/event-stream" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }) });
    assert.equal(response.status, 200);
    const tools = (await response.json()).result.tools.map(t => t.name).sort();
    assert.deepEqual(tools, ["get_policy_evidence", "get_student_policy", "resolve_university"]);

    // A content switch reaches MCP without a restart.
    await c.release("demo-b");
    const switched = await waitFor(async () => { const h = await health(); return h.contentId === "demo-b" && h; });
    assert.equal(switched.catalogSha256, c.catalogSha256);
    assert.equal(child.exitCode, null);
  } finally {
    child?.kill("SIGTERM");
    rmSync(dir, { recursive: true, force: true });
  }
});
