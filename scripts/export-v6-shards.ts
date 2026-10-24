import { CHANGE_RULES_VERSION, OVERVIEW_MAX_BYTES, type ChangeOverviewPackage } from "../apps/web/lib/change-events";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { publicEntitySummarySchema, policySnapshotSchema, universityToolRecordSchema } from "@uapt/shared";
import legacy from "../data/v6-legacy-package-baseline.json";
import type { ShardIndex, ShardManifest, ShardNode } from "../apps/web/lib/v6-artifact-store";

export const digest = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex");
const bytes = (value: unknown) => Buffer.from(JSON.stringify(value) + "\n");
const families = ["public-v6-pages", "public-v6-records", "public-v6-history", "public-v6-change-overviews"];

/** Only converts already-public packages. Does not select a current content pointer. */
export function exportV6Revision(root: string, family: string, revision: string, raw: Buffer): ShardManifest {
  if (!families.includes(family) || !/^[a-z0-9-]+$/.test(revision)) throw new Error("Invalid V6 export identity");
  const value = JSON.parse(raw.toString());
  let scope: string[];
  if (family === "public-v6-pages") {
    if (value.schemaVersion !== "uapt-v6-published-pages-v1" || value.releaseId !== revision || value.publicationApproved !== true) throw new Error("Expected approved public page package");
    scope = [...value.slugs, ...(value.v5Slugs ?? [])];
  } else if (family === "public-v6-records") {
    if (value.schemaVersion !== "uapt-v6-effective-records-v1" || value.revision !== revision || value.publicationApproved !== true) throw new Error("Expected approved effective record package");
    value.summaries.forEach((s: unknown) => publicEntitySummarySchema.parse(s));
    Object.values(value.snapshots).forEach(s => policySnapshotSchema.parse(s));
    Object.values(value.toolsBySlug).forEach(list => (list as unknown[]).forEach(t => universityToolRecordSchema.parse(t)));
    scope = value.summaries.map((s: {entity: {slug: string}}) => s.entity.slug);
  } else if (family === "public-v6-change-overviews") {
    const pkg=value as ChangeOverviewPackage;
    if(pkg.schemaVersion!=="uapt-v6-change-overviews-v1"||pkg.revision!==revision||pkg.rulesVersion!==CHANGE_RULES_VERSION||!/^[a-f0-9]{64}$/.test(pkg.projectionSha256)||!/^[a-f0-9]{64}$/.test(pkg.basisSha256))throw Error("Invalid change overview package");
    scope=Object.keys(pkg.schools);
    for(const [slug,o] of Object.entries(pkg.schools)){
      if(o.slug!==slug||o.revision!==revision||o.projectionSha256!==pkg.projectionSha256||o.basisSha256!==pkg.basisSha256||o.rulesVersion!==CHANGE_RULES_VERSION||Buffer.byteLength(JSON.stringify(o),'utf8')+1>OVERVIEW_MAX_BYTES)throw Error("Invalid or oversized change overview");
    }
  } else {
    if (value.schemaVersion !== "uapt-bounded-public-history-v1" || value.basisRevision !== revision) throw new Error("Expected frozen public history");
    scope = Object.keys(value.records);
  }
  if (new Set(scope).size !== scope.length || !scope.length || scope.some(s => !/^[a-z0-9-]+$/.test(s))) throw new Error("Invalid public scope");
  const put = (relative: string, content: Buffer) => {
    const file = resolve(root, relative);
    mkdirSync(resolve(file, ".."), {recursive: true});
    if (existsSync(file)) {
      if (!readFileSync(file).equals(content)) throw new Error("Refusing to rewrite immutable V6 artifact: " + relative);
    } else writeFileSync(file, content, {flag: "wx"});
  };
  const leaf = (item: unknown): ShardNode => {
    const raw = bytes(item), sha256 = digest(raw);
    put(`sharded/objects/${sha256}.json`, raw);
    return {kind: "blob", sha256, bytes: raw.length};
  };
  const split = (item: unknown, path: string[]): ShardNode => {
    // Split exactly at public school/object boundaries; keep all unknown fields.
    if (family === "public-v6-pages" && path[0] === "locales" && path.length === 4) return leaf(item);
    if (family === "public-v6-records" && path.length === 2 && ["summaries", "historical", "heldBySlug", "toolsBySlug", "snapshots", "analysisOverrides"].includes(path[0])) return leaf(item);
    if (family === "public-v6-change-overviews" && path[0] === "schools" && path.length === 2) return leaf(item);
    if (family === "public-v6-history" && path[0] === "records" && path.length === 2) return leaf(item);
    if (Array.isArray(item)) {
      const keys = path.at(-1) === "schools" ? item.map(s => s.slug) : path.join(".") === "summaries" ? item.map(s => s.entity.slug) : undefined;
      return {kind: "array", items: item.map((s, i) => split(s, [...path, String(i)])), ...(keys ? {keys} : {})};
    }
    if (item && typeof item === "object") return {kind: "object", entries: Object.entries(item).map(([key, child]) => [key, split(child, [...path, key])])};
    return {kind: "value", value: item};
  };
  const schoolNames = family === "public-v6-pages" ? Object.fromEntries(Object.entries(value.locales).map(([locale, data]) => [locale, Object.fromEntries((data as {schools: {slug: string; name: string}[]}).schools.map(s => [s.slug, s.name]))])) : undefined;
  const manifest: ShardManifest = {schemaVersion: "uapt-v6-shard-manifest-v1", family, revision, sourceSha256: digest(raw), scope, ...(schoolNames ? {schoolNames} : {}), root: split(value, [])};
  const manifestHash = digest(bytes(manifest));
  const manifestPath = `sharded/revisions/${revision}-${manifestHash}.json`;
  put(manifestPath, bytes(manifest));
  const indexPath = resolve(root, "sharded/index.json");
  const index: ShardIndex = existsSync(indexPath) ? JSON.parse(readFileSync(indexPath, "utf8")) : {schemaVersion: "uapt-v6-shard-index-v1", family, revisions: {}};
  if (index.schemaVersion !== "uapt-v6-shard-index-v1" || index.family !== family) throw new Error("Invalid shard registry");
  const entry = {path: manifestPath, sha256: manifestHash, sourceSha256: manifest.sourceSha256};
  if (index.revisions[revision] && index.revisions[revision].sourceSha256 !== entry.sourceSha256) throw new Error("Revision already registered with different content");
  index.revisions[revision] = entry;
  // Registry selection is local only. Existing current/revisions pointers remain unchanged.
  const temporary = indexPath + ".tmp-" + process.pid;
  writeFileSync(temporary, bytes(index), {flag: "wx"});
  renameSync(temporary, indexPath);
  return manifest;
}

function main() {
  const args = process.argv.slice(2);
  if (args.length === 1 && args[0] === "--all-public") {
    for (const family of families.filter(f=>f!=="public-v6-change-overviews")) {
      const root = resolve("data", family);
      const registered = family === "public-v6-history"
        ? Object.fromEntries(readdirSync(resolve(root, "revisions")).filter(f => /^[a-z0-9-]+\.json$/.test(f)).map(f => [f.slice(0, -5), {path: `revisions/${f}`, sha256: digest(readFileSync(resolve(root, "revisions", f)))}]))
        : JSON.parse(readFileSync(resolve(root, "revisions.json"), "utf8"));
      for (const [revision, entry] of Object.entries(registered) as [string, {path: string; sha256: string}][]) {
        if (!/^revisions\/[a-z0-9-]+\.json$/.test(entry.path)) throw new Error("Invalid public input path");
        const raw = readFileSync(resolve(root, entry.path));
        if (digest(raw) !== entry.sha256) throw new Error("Frozen public package changed");
        exportV6Revision(root, family, revision, raw);
        process.stdout.write(`${family} ${revision}\n`);
      }
    }
    return;
  }
  const options = Object.fromEntries(args.reduce<string[][]>((pairs, item, i) => i % 2 === 0 ? [...pairs, [item, args[i + 1]]] : pairs, []));
  if (args.length !== 8 || !options["--family"] || !options["--revision"] || !options["--input"] || !options["--sha256"]) throw new Error("Use --all-public, or --family <public-v6-pages|public-v6-records|public-v6-history> --revision <id> --input <approved-public-package> --sha256 <frozen-byte-hash>");
  if (options["--family"] !== "public-v6-history" && !Object.hasOwn(legacy.files, `data/${options["--family"]}/revisions/${options["--revision"]}.json`)) throw Error("New page/record revisions require paired input and acceptance: use pnpm v6:pack");
  const raw = readFileSync(options["--input"]);
  if (digest(raw) !== options["--sha256"]) throw new Error("Export input changed");
  exportV6Revision(resolve("data", options["--family"]), options["--family"], options["--revision"], raw);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
