import { createHash } from "node:crypto";
import { existsSync, lstatSync, readFileSync, realpathSync, statSync } from "node:fs";
import path from "node:path";
import { cache } from "react";
import { ByteLru } from "./bounded-cache";
import { registerServerReadingCohort } from "./reading-cohort";

// Every filesystem path below is chosen at runtime by the content pointer.
// `turbopackIgnore` keeps output tracing from copying content into the program.

/**
 * Runtime content selection (R1-b). Program builds carry no content pointers:
 * every loader resolves its files through the active content release, so a
 * new school, changes release or monthly report is a pointer switch.
 *
 * - Release mode: UAPT_CONTENT_ROOT holds current.json, releases/<id>/ and the
 *   content-addressed objects/ those release trees hard-link to.
 * - Workspace mode (no UAPT_CONTENT_ROOT): the checkout's data/ files, read at
 *   runtime with the same layout. Used by local development and tests.
 *
 * The format and operator steps are in docs/content-release.md.
 */

/** Content package API this program reads. Bump only with a loader change. */
export const CONTENT_API_VERSION = 1;
/** Family schema versions this program can render. */
export const SUPPORTED_CONTENT_SCHEMAS = [
  "uapt-public-release-manifest-v1",
  "uapt-v6-published-pages-v1",
  "uapt-v6-effective-records-v1",
  "uapt-bounded-public-history-v1",
  "uapt-public-change-history-v1",
  "uapt-public-change-history-v2",
  "uapt-v6-change-overviews-v1",
  "uapt-monthly-report-registry-v1",
  "uapt-mcp-catalog-v1",
  "uapt-reading-translations-v1"
] as const;

export const CONTENT_POINTER_SCHEMA = "uapt-content-pointer-v1";
export const CONTENT_RELEASE_SCHEMA = "uapt-content-release-v1";
const CONTENT_ID = /^[a-z0-9][a-z0-9.-]{2,95}$/;
const SHA256 = /^[a-f0-9]{64}$/;

export type ContentFileEntry = [path: string, sha256: string, bytes: number];
export interface ContentSyncReceipt {
  contractVersion: "2.0.0" | "2.1.0";
  eventId: string;
  eventSha256: string;
}
export interface ContentPointer {
  schemaVersion: typeof CONTENT_POINTER_SCHEMA;
  contentId: string;
  manifestSha256: string;
  switchedAt?: string;
  previousContentId?: string | null;
  /** Synchronization candidate event bound to this manifest. */
  sync?: ContentSyncReceipt;
  /** Local-only demos; refused unless UAPT_CONTENT_ALLOW_UNSYNCHRONIZED=1. */
  unsynchronizedLocalPreview?: true;
}
export interface ContentReleaseManifest {
  schemaVersion: typeof CONTENT_RELEASE_SCHEMA;
  contentId: string;
  parentContentId: string | null;
  createdAt: string;
  appCompatibility: { contentApi: number[]; schemas: string[] };
  /** Strictest synchronization contract this content needs (2.1.0 for change-history v2/overviews). */
  requiredSyncContract: "2.0.0" | "2.1.0";
  families: Record<string, { schemaVersion?: string; revision?: string; sha256?: string }>;
  reports?: { registry: string; current: string };
  translations?: { pointer: string; sampledPublication?: { acceptanceSha256: string; selectionSha256: string } };
  mcp?: { catalog: string; releaseId: string; sha256: string };
  decisions?: {
    removedClaimIds?: Record<string, string[]>;
    releasedHeldClaimIds?: Record<string, string[]>;
    correctedClaimIds?: Record<string, string[]>;
  };
  claimSets: { schools: number; claims: number; held: number; sha256: string };
  files: ContentFileEntry[];
}
export interface ActiveContent {
  mode: "release" | "workspace";
  contentId: string;
  /** Root with the repository layout (data/, staging/); release tree or checkout. */
  root: string;
  manifest?: ContentReleaseManifest;
  pointer?: ContentPointer;
}

const POINTER_CHECK_MS = Math.max(0, Number(process.env.UAPT_CONTENT_POINTER_CHECK_MS ?? 1000));
let active: ActiveContent | undefined;
let checkedAt = 0;
let pointerStamp = "";
let lastError: string | undefined;
const listeners = new Set<(next: ActiveContent, previous: ActiveContent | undefined) => void>();
const jsonCache = new ByteLru<unknown>(64, 24 * 1024 * 1024);
const scoped = new Map<string, { contentId: string; value: unknown }>();

export const sha256Hex = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");

export function contentStoreRoot(): string | undefined {
  const configured = process.env.UAPT_CONTENT_ROOT?.trim();
  return configured ? path.resolve(/* turbopackIgnore: true */ configured) : undefined;
}

function readPointer(storeRoot: string): ActiveContent {
  const pointerFile = path.join(/* turbopackIgnore: true */ storeRoot, "current.json");
  if (lstatSync(/* turbopackIgnore: true */ pointerFile).isSymbolicLink()) throw new Error("Content pointer must be a regular file");
  const pointer = JSON.parse(readFileSync(/* turbopackIgnore: true */ pointerFile, "utf8")) as ContentPointer;
  if (pointer.schemaVersion !== CONTENT_POINTER_SCHEMA || !CONTENT_ID.test(pointer.contentId) || !SHA256.test(pointer.manifestSha256)) {
    throw new Error("Invalid content pointer");
  }
  const syncAccepted = pointer.sync && ["2.0.0", "2.1.0"].includes(pointer.sync.contractVersion) && SHA256.test(pointer.sync.eventSha256) && Boolean(pointer.sync.eventId);
  const previewAllowed = pointer.unsynchronizedLocalPreview === true && process.env.UAPT_CONTENT_ALLOW_UNSYNCHRONIZED === "1";
  if (!syncAccepted && !previewAllowed) throw new Error("Content pointer has no synchronization receipt");
  const releaseDir = path.join(/* turbopackIgnore: true */ storeRoot, "releases", pointer.contentId);
  const manifestBytes = readFileSync(/* turbopackIgnore: true */ path.join(/* turbopackIgnore: true */ releaseDir, "manifest.json"));
  if (sha256Hex(manifestBytes) !== pointer.manifestSha256) throw new Error("Content manifest hash mismatch");
  const manifest = JSON.parse(manifestBytes.toString("utf8")) as ContentReleaseManifest;
  assertContentCompatible(manifest);
  if (manifest.contentId !== pointer.contentId) throw new Error("Content manifest identity mismatch");
  if (syncAccepted && compareContract(pointer.sync!.contractVersion, manifest.requiredSyncContract) < 0) {
    throw new Error(`Content requires synchronization contract ${manifest.requiredSyncContract}`);
  }
  const root = realpathSync(/* turbopackIgnore: true */ path.join(/* turbopackIgnore: true */ releaseDir, "tree"));
  return { mode: "release", contentId: pointer.contentId, root, manifest, pointer };
}

export function assertContentCompatible(manifest: Pick<ContentReleaseManifest, "schemaVersion" | "appCompatibility">) {
  if (manifest.schemaVersion !== CONTENT_RELEASE_SCHEMA) throw new Error("Unknown content release schema");
  const compat = manifest.appCompatibility;
  if (!compat || !Array.isArray(compat.contentApi) || !compat.contentApi.includes(CONTENT_API_VERSION)) {
    throw new Error(`Content release is not compatible with content API ${CONTENT_API_VERSION}`);
  }
  const unsupported = (compat.schemas ?? []).filter(schema => !(SUPPORTED_CONTENT_SCHEMAS as readonly string[]).includes(schema));
  if (unsupported.length) throw new Error(`Content release needs unsupported schemas: ${unsupported.join(", ")}`);
}

const compareContract = (a: string, b: string) => {
  const [x, y] = [a, b].map(v => v.split(".").map(Number));
  for (let i = 0; i < 3; i++) if ((x[i] ?? 0) !== (y[i] ?? 0)) return (x[i] ?? 0) - (y[i] ?? 0);
  return 0;
};

/** Checkout used before R1-b: `.runtime-data` when bundled, else the repository root. */
function workspaceRoot(): string {
  const runtimeDataRoot = path.join(/* turbopackIgnore: true */ process.cwd(), ".runtime-data");
  if (existsSync(/* turbopackIgnore: true */ path.join(/* turbopackIgnore: true */ runtimeDataRoot, "data", "public-releases", "current.json"))) return runtimeDataRoot;
  let current = process.cwd();
  for (;;) {
    if (existsSync(/* turbopackIgnore: true */ path.join(/* turbopackIgnore: true */ current, "package.json")) && existsSync(/* turbopackIgnore: true */ path.join(/* turbopackIgnore: true */ current, "apps"))) return current;
    const parent = path.dirname(current);
    if (parent === current) return process.cwd();
    current = parent;
  }
}

/** Pointer files whose bytes identify the workspace content selection. */
export const WORKSPACE_POINTER_FILES = [
  "data/public-releases/current.json",
  "data/public-v6-pages/current.json",
  "data/public-v6-records/current.json",
  "data/public-v6-history/current.json",
  "data/public-change-history/current.json",
  "data/public-v6-change-overviews/current.json",
  "data/public-record-repairs/current.json",
  "data/monthly-reports/registry.json"
] as const;

function readWorkspace(): ActiveContent {
  const root = workspaceRoot();
  // The root is part of the identity: `.runtime-data` and the checkout carry identical pointers.
  const hash = createHash("sha256").update(root).update("\0");
  for (const file of WORKSPACE_POINTER_FILES) {
    // V6 families are traced from the checkout even when `.runtime-data` exists.
    const candidates = [path.join(/* turbopackIgnore: true */ root, file), path.join(/* turbopackIgnore: true */ v6WorkspaceDataRoot(), file.slice("data/".length))];
    const found = candidates.find(existsSync);
    hash.update(file).update("\0").update(found ? readFileSync(/* turbopackIgnore: true */ found) : "missing").update("\0");
  }
  return { mode: "workspace", contentId: `workspace-${hash.digest("hex").slice(0, 16)}`, root };
}

function v6WorkspaceDataRoot(): string {
  return path.resolve(/* turbopackIgnore: true */ process.cwd(), /\/apps\/(web|tulsa-zone)$/.test(process.cwd()) ? "../../data" : "data");
}

function stampFor(storeRoot: string | undefined): string {
  if (!storeRoot) return "workspace";
  try {
    const info = statSync(/* turbopackIgnore: true */ path.join(/* turbopackIgnore: true */ storeRoot, "current.json"), { bigint: true });
    return `${storeRoot}:${info.ino}:${info.size}:${info.mtimeNs}`;
  } catch {
    return `${storeRoot}:missing`;
  }
}

let pinnedForTools = false;
let selectedCwd = "";

/**
 * Offline tools (content validator/builder) evaluate a release tree with the
 * production loaders. Never called by the web server: it bypasses the pointer.
 */
export function selectContentForTools(content: ActiveContent): void {
  const previous = active;
  active = content; pinnedForTools = true; lastError = undefined;
  if (!previous || previous.contentId !== content.contentId || previous.root !== content.root) {
    for (const listener of listeners) listener(content, previous);
  }
}

function load(force: boolean): ActiveContent {
  const now = Date.now();
  if (pinnedForTools && active) return active;
  // Workspace mode resolves from the working directory; tools that chdir must not see a stale root.
  const cwdChanged = active?.mode === "workspace" && selectedCwd !== process.cwd();
  if (!force && !cwdChanged && active && now - checkedAt < POINTER_CHECK_MS) return active;
  selectedCwd = process.cwd();
  checkedAt = now;
  const storeRoot = contentStoreRoot();
  const stamp = stampFor(storeRoot);
  // Workspace pointers are plain files that local publishers edit in place.
  if (!force && active && stamp === pointerStamp && storeRoot) return active;
  let next: ActiveContent;
  try {
    next = storeRoot ? readPointer(storeRoot) : readWorkspace();
    lastError = undefined;
  } catch (error) {
    lastError = error instanceof Error ? error.message : String(error);
    // A bad switch keeps serving the last verified release; it never fails open to the workspace.
    if (active) {
      console.error(JSON.stringify({ message: "Content pointer rejected; keeping active release", contentId: active.contentId, error: lastError }));
      pointerStamp = stamp;
      return active;
    }
    throw error;
  }
  pointerStamp = stamp;
  if (!active || active.contentId !== next.contentId || active.root !== next.root) {
    const previous = active;
    active = next;
    for (const listener of listeners) listener(next, previous);
  }
  return active;
}

/** One content selection per server request, so a render never mixes releases. */
const requestContent = cache(() => load(false));

export function activeContent(): ActiveContent {
  return requestContent();
}

/** Re-read the pointer now (refresh endpoint, SIGHUP, tests). */
export function refreshContentPointer(): ActiveContent & { error?: string } {
  const selected = load(true);
  return lastError ? { ...selected, error: lastError } : selected;
}

export function onContentSwitch(listener: (next: ActiveContent, previous: ActiveContent | undefined) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Absolute path inside the active content root; rejects escapes. */
export function contentPath(relative: string, content = activeContent()): string {
  const normalized = path.posix.normalize(relative.replaceAll("\\", "/"));
  if (path.posix.isAbsolute(normalized) || normalized.startsWith("../") || normalized === "..") throw new Error("Content path escapes its root");
  return path.join(/* turbopackIgnore: true */ content.root, normalized);
}

/** Root directory for one public data family (formerly a build-relative path). */
export function contentDataRoot(family: string, content = activeContent()): string {
  if (!/^[a-z0-9-]+$/.test(family)) throw new Error("Invalid content family");
  if (content.mode === "workspace") {
    const checkout = v6WorkspaceDataRoot();
    return existsSync(/* turbopackIgnore: true */ path.join(/* turbopackIgnore: true */ checkout, family)) ? path.join(/* turbopackIgnore: true */ checkout, family) : path.join(/* turbopackIgnore: true */ content.root, "data", family);
  }
  return path.join(/* turbopackIgnore: true */ content.root, "data", family);
}

/**
 * JSON content that used to be a build-time `import x from "...json"`.
 * Cached per content release in a bounded LRU; callers must not mutate it.
 */
export function readContentJson<T>(relative: string, options: { maxBytes?: number; optional?: boolean } = {}): T {
  const content = activeContent();
  const familyMatch = /^data\/([a-z0-9-]+)\/(.+)$/.exec(relative);
  let file = familyMatch ? path.join(/* turbopackIgnore: true */ contentDataRoot(familyMatch[1], content), familyMatch[2]) : contentPath(relative, content);
  // Workspace `.runtime-data` copies only part of data/; the rest is traced from the checkout.
  if (content.mode === "workspace" && !existsSync(/* turbopackIgnore: true */ file) && relative.startsWith("data/")) {
    file = path.join(/* turbopackIgnore: true */ v6WorkspaceDataRoot(), relative.slice("data/".length));
  }
  const key = `${content.contentId}\0${file}`;
  const hit = jsonCache.get(key);
  if (hit !== undefined) return hit as T;
  if (options.optional && !existsSync(/* turbopackIgnore: true */ file)) return undefined as T;
  const raw = readFileSync(/* turbopackIgnore: true */ file);
  if (raw.length > (options.maxBytes ?? 4 * 1024 * 1024)) throw new Error(`Content file exceeds limit: ${relative}`);
  const value = JSON.parse(raw.toString("utf8")) as T;
  jsonCache.set(key, value, raw.length);
  return value;
}

/** Memoize a derived value (Maps, Sets, indexes) for the active content release. */
export function contentScoped<T>(key: string, build: (content: ActiveContent) => T): T {
  const content = activeContent();
  const hit = scoped.get(key);
  if (hit && hit.contentId === content.contentId) return hit.value as T;
  const value = build(content);
  scoped.set(key, { contentId: content.contentId, value });
  return value;
}

/**
 * Reading translation package for the active release. A release that carries
 * translations pins its own pointer and sampled-publication acceptance; older
 * deployments keep the UAPT_READING_* environment configuration.
 */
export function readingPackageSelection(): { pointer?: string; acceptanceSha256?: string; selectionSha256?: string } {
  const content = activeContent();
  const declared = content.manifest?.translations;
  if (declared) {
    return {
      pointer: contentPath(declared.pointer, content),
      acceptanceSha256: declared.sampledPublication?.acceptanceSha256,
      selectionSha256: declared.sampledPublication?.selectionSha256
    };
  }
  return {
    pointer: process.env.UAPT_READING_PACKAGE_POINTER,
    acceptanceSha256: process.env.UAPT_READING_SAMPLED_PUBLICATION_ACCEPTANCE_SHA256,
    selectionSha256: process.env.UAPT_READING_SAMPLED_PUBLICATION_SELECTION_SHA256
  };
}

export function clearContentScoped(key: string) {
  scoped.delete(key);
}

/** Cache key bound to the active release, for keyed caches whose entries outlive a request. */
export function contentCacheKey(key: string): string {
  return `${activeContent().contentId}:${key}`;
}

export function contentRuntimeStatus() {
  const selected = active;
  return {
    mode: selected?.mode,
    contentId: selected?.contentId,
    manifestSha256: selected?.pointer?.manifestSha256,
    sync: selected?.pointer?.sync ? { contractVersion: selected.pointer.sync.contractVersion, eventId: selected.pointer.sync.eventId } : selected?.pointer?.unsynchronizedLocalPreview ? "unsynchronized-local-preview" : undefined,
    lastError,
    jsonCache: jsonCache.stats()
  };
}

export function resetContentRuntimeForTests() {
  pinnedForTools = false;
  active = undefined; checkedAt = 0; pointerStamp = ""; lastError = undefined;
  jsonCache.clear(); scoped.clear();
}

registerServerReadingCohort(() => {
  const pointer = readContentJson<{ slugs?: string[] }>("data/public-v6-pages/current.json");
  return pointer.slugs ?? [];
});
