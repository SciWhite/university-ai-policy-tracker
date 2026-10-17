import { createHash } from "node:crypto";
import { readFileSync, realpathSync, statSync } from "node:fs";
import { resolve, sep } from "node:path";
import { ByteLru } from "./bounded-cache";

export type ShardNode =
  | {kind: "value"; value: unknown}
  | {kind: "object"; entries: [string, ShardNode][]}
  | {kind: "array"; items: ShardNode[]; keys?: string[]}
  | {kind: "blob"; sha256: string; bytes: number};
export interface ShardManifest {
  schemaVersion: "uapt-v6-shard-manifest-v1";
  family: string;
  revision: string;
  sourceSha256: string;
  scope: string[];
  schoolNames?: Record<string, Record<string, string>>;
  root: ShardNode;
}
export interface ShardIndex {
  schemaVersion: "uapt-v6-shard-index-v1";
  family: string;
  revisions: Record<string, {path: string; sha256: string; sourceSha256: string}>;
}

// Shared across page/record/history readers: budgets apply to their combined retention.
const cache = new ByteLru<unknown>(256, 24 * 1024 * 1024);
const reads = {files: 0, bytes: 0, largestFile: 0};
const hash = (value: Buffer) => createHash("sha256").update(value).digest("hex");
const validHash = (value: string) => /^[a-f0-9]{64}$/.test(value);

export function v6ArtifactStats() { return {...reads, cache: cache.stats()}; }
export function resetV6ArtifactCache() {
  cache.clear(); reads.files = 0; reads.bytes = 0; reads.largestFile = 0;
}

function safeFile(root: string, relative: string): string {
  const base = realpathSync(root);
  const file = realpathSync(resolve(base, relative));
  if (!file.startsWith(base + sep)) throw new Error("V6 artifact escapes its public root");
  return file;
}

export function readVerifiedArtifact<T>(root: string, relative: string, sha256: string, maxFileBytes: number, expectedBytes?: number): T {
  if (!validHash(sha256)) throw new Error("Invalid V6 artifact hash");
  const file = safeFile(root, relative);
  const key = file + ":" + sha256;
  const hit = cache.get(key);
  if (hit !== undefined) return hit as T;
  const size = statSync(file).size;
  if (size > maxFileBytes || (expectedBytes !== undefined && size !== expectedBytes)) throw new Error("V6 artifact size mismatch or limit exceeded");
  const raw = readFileSync(file);
  if (raw.length !== size || hash(raw) !== sha256) throw new Error("V6 artifact changed");
  reads.files++; reads.bytes += raw.length; reads.largestFile = Math.max(reads.largestFile, raw.length);
  const value: T = JSON.parse(raw.toString());
  cache.set(key, value, raw.length);
  return value;
}

function validateNode(node: ShardNode, depth = 0): void {
  if (!node || depth > 12) throw new Error("Invalid V6 shard tree");
  if (node.kind === "blob") {
    if (!validHash(node.sha256) || !Number.isSafeInteger(node.bytes) || node.bytes < 1 || node.bytes > 16 * 1024 * 1024) throw new Error("Invalid V6 shard reference");
  } else if (node.kind === "object") {
    if (!Array.isArray(node.entries) || new Set(node.entries.map(([key]) => key)).size !== node.entries.length) throw new Error("Duplicate V6 field");
    for (const [key, value] of node.entries) {
      if (["__proto__", "constructor", "prototype"].includes(key)) throw new Error("Invalid V6 field");
      validateNode(value, depth + 1);
    }
  } else if (node.kind === "array") {
    if (!Array.isArray(node.items) || (node.keys && (node.keys.length !== node.items.length || new Set(node.keys).size !== node.keys.length))) throw new Error("Invalid V6 collection keys");
    node.items.forEach(value => validateNode(value, depth + 1));
  } else if (node.kind !== "value") throw new Error("Unknown V6 shard node");
}

/** A normal enumerable object with non-memoizing getters; walking one field reads one shard.
 * Full JSON endpoints may enumerate the entire tree, without retaining a full revision.
 */
export class V6ArtifactStore {
  constructor(readonly root: string, readonly index: ShardIndex, private validate?: (value: unknown, path: string[]) => void) {
    if (index.schemaVersion !== "uapt-v6-shard-index-v1") throw new Error("Invalid V6 shard index");
  }
  manifest(revision: string, sourceSha256?: string): ShardManifest | undefined {
    const entry = this.index.revisions[revision];
    if (!entry) return undefined;
    if (!/^sharded\/revisions\/[a-z0-9-]+\.json$/.test(entry.path) || (sourceSha256 && sourceSha256 !== entry.sourceSha256)) throw new Error("V6 shard source identity mismatch");
    const manifest = readVerifiedArtifact<ShardManifest>(this.root, entry.path, entry.sha256, 2 * 1024 * 1024);
    if (manifest.schemaVersion !== "uapt-v6-shard-manifest-v1" || manifest.family !== this.index.family || manifest.revision !== revision || manifest.sourceSha256 !== entry.sourceSha256 || !Array.isArray(manifest.scope) || new Set(manifest.scope).size !== manifest.scope.length) throw new Error("Invalid V6 shard manifest identity");
    validateNode(manifest.root);
    return manifest;
  }
  view<T>(revision: string, sourceSha256?: string): T | undefined {
    const manifest = this.manifest(revision, sourceSha256);
    return manifest ? this.inflate(manifest.root) as T : undefined;
  }
  field<T>(revision: string, path: string[]): T | undefined {
    const manifest = this.manifest(revision);
    if (!manifest) return undefined;
    let node: ShardNode | undefined = manifest.root;
    for (const key of path) {
      if (node?.kind === "object") node = node.entries.find(([name]) => name === key)?.[1];
      else if (node?.kind === "array") node = node.items[node.keys ? node.keys.indexOf(key) : Number(key)];
      else return undefined;
    }
    return node ? this.inflate(node, path) as T : undefined;
  }
  private inflate(node: ShardNode, path: string[] = []): unknown {
    if (node.kind === "value") return structuredClone(node.value);
    if (node.kind === "blob") {
      // Clones isolate consumer mutation from all revisions sharing these bytes.
      const value = structuredClone(readVerifiedArtifact(this.root, `sharded/objects/${node.sha256}.json`, node.sha256, 16 * 1024 * 1024, node.bytes));
      this.validate?.(value, path);
      return value;
    }
    const target: unknown[] | Record<string, unknown> = node.kind === "array" ? [] : {};
    const entries: [string, ShardNode][] = node.kind === "array" ? node.items.map((item, i) => [String(i), item]) : node.entries;
    for (const [key, item] of entries) Object.defineProperty(target, key, {enumerable: true, configurable: true, get: () => this.inflate(item, [...path, key])});
    return target;
  }
}

export function v6PublicDataRoot(family: string): string {
  return resolve(process.cwd(), /\/apps\/(web|tulsa-zone)$/.test(process.cwd()) ? `../../data/${family}` : `data/${family}`);
}
