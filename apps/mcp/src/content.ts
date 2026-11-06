import { createHash } from "node:crypto";
import { lstatSync, readFileSync, realpathSync, statSync } from "node:fs";
import path from "node:path";
import { loadCatalog, type Catalog } from "./catalog.js";

/**
 * MCP side of the runtime content pointer (docs/content-release.md). The web
 * app and MCP read the same UAPT_CONTENT_ROOT/current.json; MCP serves the
 * catalog that release declares and swaps it on SIGHUP or when the pointer
 * changes, with no restart and no UAPT_MCP_EXPECTED_RELEASE_ID pin.
 */
export const MCP_CONTENT_API_VERSION = 1;
const sha256 = (value: Buffer | string) => createHash("sha256").update(value).digest("hex");

export interface CatalogSelection { catalog: Catalog; contentId?: string; source: string; catalogSha256: string; manifestSha256?: string }

interface Pointer { schemaVersion: string; contentId: string; manifestSha256: string; sync?: { contractVersion: string; eventId: string; eventSha256: string }; unsynchronizedLocalPreview?: true }
interface Manifest { schemaVersion: string; contentId: string; appCompatibility?: { contentApi?: number[] }; mcp?: { catalog: string; releaseId: string; sha256: string } }

export function contentPointerStamp(contentRoot: string): string {
  try {
    const info = statSync(path.join(contentRoot, "current.json"), { bigint: true });
    return `${info.ino}:${info.size}:${info.mtimeNs}`;
  } catch {
    return "missing";
  }
}

/** Resolve and fully verify the catalog of the active content release. */
export async function loadContentCatalog(contentRoot: string, env = process.env): Promise<CatalogSelection> {
  const pointerFile = path.join(contentRoot, "current.json");
  if (lstatSync(pointerFile).isSymbolicLink()) throw new Error("Content pointer must be a regular file");
  const pointer = JSON.parse(readFileSync(pointerFile, "utf8")) as Pointer;
  if (pointer.schemaVersion !== "uapt-content-pointer-v1" || !/^[a-z0-9][a-z0-9.-]{2,95}$/.test(pointer.contentId) || !/^[a-f0-9]{64}$/.test(pointer.manifestSha256)) throw new Error("Invalid content pointer");
  const synced = pointer.sync && ["2.0.0", "2.1.0"].includes(pointer.sync.contractVersion) && /^[a-f0-9]{64}$/.test(pointer.sync.eventSha256);
  if (!synced && !(pointer.unsynchronizedLocalPreview === true && env.UAPT_CONTENT_ALLOW_UNSYNCHRONIZED === "1")) throw new Error("Content pointer has no synchronization receipt");
  const releaseDir = path.join(contentRoot, "releases", pointer.contentId);
  const manifestBytes = readFileSync(path.join(releaseDir, "manifest.json"));
  if (sha256(manifestBytes) !== pointer.manifestSha256) throw new Error("Content manifest hash mismatch");
  const manifest = JSON.parse(manifestBytes.toString("utf8")) as Manifest;
  if (manifest.schemaVersion !== "uapt-content-release-v1" || manifest.contentId !== pointer.contentId || !manifest.appCompatibility?.contentApi?.includes(MCP_CONTENT_API_VERSION)) throw new Error("Incompatible content release");
  if (!manifest.mcp) throw new Error("Content release declares no MCP catalog");
  const tree = realpathSync(path.join(releaseDir, "tree"));
  const file = realpathSync(path.join(tree, manifest.mcp.catalog));
  if (!file.startsWith(tree + path.sep)) throw new Error("MCP catalog escapes its release");
  const catalogSha256 = sha256(readFileSync(file));
  if (catalogSha256 !== manifest.mcp.sha256) throw new Error("MCP catalog bytes changed");
  const catalog = await loadCatalog(file);
  // The release, not an environment pin, states which dataset release MCP serves.
  if (catalog.releaseId !== manifest.mcp.releaseId) throw new Error("MCP catalog release mismatch");
  return { catalog, contentId: pointer.contentId, source: file, catalogSha256, manifestSha256: pointer.manifestSha256 };
}

/** Pre-R1-b deployments: one catalog file pinned by UAPT_MCP_EXPECTED_RELEASE_ID. */
export async function loadPinnedCatalog(file: string, expectedReleaseId?: string): Promise<CatalogSelection> {
  const catalog = await loadCatalog(file);
  if (expectedReleaseId && catalog.releaseId !== expectedReleaseId) throw new Error("Pinned release mismatch");
  return { catalog, source: file, catalogSha256: sha256(readFileSync(file)) };
}
