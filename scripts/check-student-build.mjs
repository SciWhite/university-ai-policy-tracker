import { readFile, mkdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
const readJson = async file => JSON.parse(await readFile(file,"utf8"));
const [source, web, envelope, prerender, buildId] = await Promise.all([
  readJson("data/public-releases/current.json"),
  readJson("apps/web/.runtime-data/data/public-releases/current.json"),
  readJson("apps/mcp/.runtime-data/catalog.json"),
  readJson("apps/web/.next/prerender-manifest.json"),
  readFile("apps/web/.next/BUILD_ID","utf8")
]);
if (JSON.stringify(source) !== JSON.stringify(web)) throw new Error("Web runtime manifest differs from committed public data");
if (web.releaseId !== envelope.payload.releaseId || web.publishedAt !== envelope.payload.releasePublishedAt) throw new Error("Web and MCP data versions differ");
const digest = createHash("sha256").update(JSON.stringify(envelope.payload)).digest("hex");
if (digest !== envelope.sha256) throw new Error("MCP catalog digest mismatch");
if (!prerender.routes["/reports/monthly/2026-09"]) throw new Error("September report is missing from the production build");
const sha = execFileSync("git",["rev-parse","HEAD"],{encoding:"utf8"}).trim();
const receipt = { schemaVersion:"uapt-student-build-v1", gitSha:sha, buildId:buildId.trim(), releaseId:web.releaseId,
  catalogSha256:digest, universities:envelope.payload.records.length, builtAt:new Date().toISOString(),
  acceptance:"Production artifacts checked; public HTTPS and ChatGPT Directory acceptance remain separate" };
await mkdir(".local/student-release",{recursive:true});
await writeFile(".local/student-release/build-receipt.json",JSON.stringify(receipt,null,2));
console.log(JSON.stringify(receipt));
