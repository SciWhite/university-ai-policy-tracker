import { lstatSync, readFileSync, readdirSync, existsSync } from "node:fs";
import path from "node:path";

/**
 * Public files a content release carries, in repository layout. This is the
 * former `.runtime-data` set (scripts/prepare-web-runtime-data.mjs) plus the V6
 * families, change history and the data files that used to be compiled in.
 * Only reachable artifacts are listed: legacy whole-revision files, candidate
 * manifests and unreferenced change-history objects stay out.
 */
const JSON_DIRECTORIES = [
  "data/public-releases/history", "data/rankings", "data/ranking-browser", "data/policy-snapshots",
  "data/public-record-repairs", "data/public-v6-history/repairs", "data/public-v6-change-overviews",
  "data/public-change-summaries", "data/monthly-reports", "data/public-analysis-repairs"
];
const SINGLE_FILES = ["data/public-releases/current.json", "DATA_DICTIONARY.md"];
const V6_FAMILIES = ["public-v6-pages", "public-v6-records", "public-v6-history"];
const STAGED_PREFIXES = ["data/openclaw-staging/", "staging/uapt-runs/"];

export interface FileSetResult { files: string[]; stagedDirectories: string[] }

const posix = (value: string) => value.split(path.sep).join("/");
const readJson = (root: string, rel: string) => JSON.parse(readFileSync(path.join(root, rel), "utf8"));

function walk(root: string, rel: string, filter: (rel: string) => boolean, out: Set<string>) {
  const dir = path.join(root, rel);
  if (!existsSync(dir)) return;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const child = posix(path.join(rel, entry.name));
    if (entry.isSymbolicLink()) throw new Error(`Content source is a symlink: ${child}`);
    if (entry.isDirectory()) walk(root, child, filter, out);
    else if (entry.isFile() && filter(child)) out.add(child);
  }
}

function safeStagedDirectory(directory: unknown): directory is string {
  return typeof directory === "string" && !directory.includes("\\") && !path.posix.isAbsolute(directory) &&
    directory.split("/").every(part => part && part !== "." && part !== "..") &&
    STAGED_PREFIXES.some(prefix => directory.startsWith(prefix));
}

type ShardNode = { kind: "value" } | { kind: "object"; entries: [string, ShardNode][] } | { kind: "array"; items: ShardNode[] } | { kind: "blob"; sha256: string };
function shardBlobs(node: ShardNode, out: Set<string>) {
  if (node.kind === "blob") out.add(node.sha256);
  else if (node.kind === "object") node.entries.forEach(([, child]) => shardBlobs(child, out));
  else if (node.kind === "array") node.items.forEach(child => shardBlobs(child, out));
}

export function collectContentFiles(root: string): FileSetResult {
  const files = new Set<string>();
  const json = (rel: string) => rel.endsWith(".json");
  for (const dir of JSON_DIRECTORIES) walk(root, dir, json, files);
  for (const file of SINGLE_FILES) if (existsSync(path.join(root, file))) files.add(file);
  // Top-level data/*.json: the files that were build-time imports before R1-b.
  for (const name of readdirSync(path.join(root, "data"))) {
    if (name.endsWith(".json") && lstatSync(path.join(root, "data", name)).isFile()) files.add(`data/${name}`);
  }
  // Published release manifests name the staged artifact directories the catalog reads.
  const manifests = [...files].filter(file => file === "data/public-releases/current.json" || file.startsWith("data/public-releases/history/"));
  const staged = new Set<string>();
  for (const file of manifests) {
    const manifest = readJson(root, file);
    if (manifest.schemaVersion !== "uapt-public-release-manifest-v1" || manifest.candidateOnly === true) throw new Error(`Unpublished release manifest in content set: ${file}`);
    for (const directory of manifest.includeStagedArtifactDirectories ?? []) {
      if (!safeStagedDirectory(directory)) throw new Error(`Unsafe staged artifact directory in ${file}`);
      staged.add(directory);
    }
  }
  for (const directory of staged) walk(root, directory, json, files);
  // V6 families: pointers, registries and every shard reachable from an indexed revision.
  for (const family of V6_FAMILIES) {
    const base = `data/${family}`;
    for (const file of ["current.json", "revisions.json", "sharded/index.json"]) files.add(`${base}/${file}`);
    const index = readJson(root, `${base}/sharded/index.json`);
    const revisions = readJson(root, `${base}/revisions.json`) as Record<string, unknown>;
    for (const revision of Object.keys(revisions)) {
      if (!Object.hasOwn(index.revisions, revision)) throw new Error(`${family} revision ${revision} has no shards; legacy whole files are not packaged`);
    }
    const blobs = new Set<string>();
    for (const entry of Object.values(index.revisions) as { path: string }[]) {
      files.add(`${base}/${entry.path}`);
      shardBlobs(readJson(root, `${base}/${entry.path}`).root, blobs);
    }
    for (const sha of blobs) files.add(`${base}/sharded/objects/${sha}.json`);
  }
  // Change history: the current projection and every registered one, with the files they reference.
  const history = "data/public-change-history";
  const refs = [readJson(root, `${history}/current.json`), ...Object.values(readJson(root, `${history}/revisions.json`) as Record<string, { path: string }>)];
  files.add(`${history}/current.json`); files.add(`${history}/revisions.json`);
  for (const ref of refs) {
    files.add(`${history}/${ref.path}`);
    const manifest = readJson(root, `${history}/${ref.path}`);
    for (const key of ["entries", "releases", "eventHistories"]) for (const item of Object.values(manifest[key] ?? {}) as { file: string }[]) files.add(`${history}/${item.file}`);
    for (const key of ["projectionInput", "eventIndex"]) if (manifest[key]) files.add(`${history}/${manifest[key].file}`);
  }
  for (const file of files) if (!existsSync(path.join(root, file))) throw new Error(`Referenced content file is missing: ${file}`);
  return { files: [...files].sort(), stagedDirectories: [...staged].sort() };
}

/** Same rule as scripts/pack-v6-release.ts: private keys and local paths never enter public content. */
const PRIVATE_KEY = /^(rawPath|textPath|normalizedTextPath|sourceTextArtifact|privateKey|accessToken|apiKey|password|reviewerNotes|privateNotes|inventoryPath)$/i;
const LOCAL_PATH = /(^|\s)(\.local\/|\/Users\/|\/home\/)/;
const PRIVATE_PATH = /(^|\/)(\.local|private|candidates|review-cache|policy-inventory)(\/|$)/;

export function privatePathViolation(rel: string): string | undefined {
  if (PRIVATE_PATH.test(rel)) return `private path: ${rel}`;
  return undefined;
}

export function privateFieldViolations(value: unknown, where = "$", out: string[] = [], limit = 20): string[] {
  if (out.length >= limit) return out;
  if (typeof value === "string") { if (LOCAL_PATH.test(value)) out.push(`${where}: local path`); return out; }
  if (Array.isArray(value)) { value.forEach((item, i) => privateFieldViolations(item, `${where}[${i}]`, out, limit)); return out; }
  if (!value || typeof value !== "object") return out;
  for (const [key, item] of Object.entries(value)) {
    if (PRIVATE_KEY.test(key)) out.push(`${where}.${key}: private key`);
    privateFieldViolations(item, `${where}.${key}`, out, limit);
  }
  return out;
}
