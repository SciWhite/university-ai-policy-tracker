import { chmodSync, constants, copyFileSync, existsSync, linkSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import type { ContentReleaseManifest, ContentFileEntry } from "../../apps/web/lib/content-runtime";
import { loadCatalog } from "../../apps/mcp/src/catalog";
import { collectContentFiles, privatePathViolation } from "./file-set";
import { CONTENT_ID_PATTERN, CONTENT_RELEASE_SCHEMA, computeClaimSets, defaultCompatibility, detectSchemas, objectRelPath, releaseDir, selectTree, sha256, sha256File } from "./lib";
import { validateContentRelease } from "./validate";

/**
 * Build one immutable content release from a checkout (or a prepared source
 * tree) into UAPT_CONTENT_ROOT:
 *   objects/<aa>/<sha256>        content-addressed bytes, shared by releases
 *   releases/<id>/tree/<path>    hard links to those objects (repository layout)
 *   releases/<id>/manifest.json  identity, compatibility, Claim ID sets, file list
 * Unchanged files cost no new bytes; on APFS even new objects are clones.
 * Nothing is switched or published here.
 */
export interface BuildOptions {
  contentRoot: string;
  contentId: string;
  source: string;
  /** Prepared files (repository layout) that replace or add to the source, e.g. a new report spec. */
  overlay?: string;
  parentContentId?: string | null;
  mcpCatalog?: string;
  translationsPointer?: string;
  decisions?: ContentReleaseManifest["decisions"];
}

function walkFiles(root: string, rel = ""): string[] {
  return readdirSync(path.join(root, rel), { withFileTypes: true }).flatMap(entry => {
    const child = rel ? `${rel}/${entry.name}` : entry.name;
    if (entry.isSymbolicLink()) throw new Error(`Overlay contains a symlink: ${child}`);
    return entry.isDirectory() ? walkFiles(root, child) : entry.isFile() ? [child] : [];
  });
}

function storeObject(contentRoot: string, source: string, sha: string): boolean {
  const object = path.join(contentRoot, objectRelPath(sha));
  if (existsSync(object)) return false;
  mkdirSync(path.dirname(object), { recursive: true });
  const temp = `${object}.tmp-${process.pid}`;
  // Copy (clone where the filesystem allows), never hard-link the source: publishers
  // rewrite checkout files in place, and that must not alter a stored release.
  copyFileSync(source, temp, constants.COPYFILE_FICLONE);
  if (sha256File(temp) !== sha) { rmSync(temp, { force: true }); throw new Error(`Source changed while packaging: ${source}`); }
  chmodSync(temp, 0o444);
  renameSync(temp, object);
  return true;
}

/** Reading package: the pointer, its selection and every {path, sha256} it references. */
function translationFiles(pointerFile: string): { rel: string; abs: string }[] {
  const root = path.dirname(path.resolve(pointerFile));
  const out = new Map<string, string>([["current.json", path.resolve(pointerFile)]]);
  const visit = (value: unknown) => {
    if (Array.isArray(value)) return value.forEach(visit);
    if (!value || typeof value !== "object") return;
    const ref = value as { path?: unknown; sha256?: unknown };
    if (typeof ref.path === "string" && typeof ref.sha256 === "string" && /^[a-f0-9]{64}$/.test(ref.sha256)) {
      if (path.isAbsolute(ref.path) || ref.path.split(/[\\/]/).includes("..")) throw new Error(`Unsafe translation reference: ${ref.path}`);
      const abs = path.join(root, ref.path);
      if (sha256File(abs) !== ref.sha256) throw new Error(`Translation artifact changed: ${ref.path}`);
      out.set(ref.path.split(path.sep).join("/"), abs);
      if (abs.endsWith(".json") && !abs.endsWith("current.json")) visit(JSON.parse(readFileSync(abs, "utf8")));
    }
    Object.values(value).forEach(visit);
  };
  visit(JSON.parse(readFileSync(pointerFile, "utf8")));
  return [...out].map(([rel, abs]) => ({ rel: `translations/${rel}`, abs }));
}

export async function buildContentRelease(options: BuildOptions) {
  const { contentRoot, contentId, source } = options;
  if (!CONTENT_ID_PATTERN.test(contentId)) throw new Error("Content id must match [a-z0-9][a-z0-9.-]{2,95}");
  const dir = releaseDir(contentRoot, contentId);
  if (existsSync(dir)) throw new Error(`Release ${contentId} already exists; releases are immutable`);
  const currentPointer = path.join(contentRoot, "current.json");
  const parentContentId = options.parentContentId !== undefined ? options.parentContentId
    : existsSync(currentPointer) ? JSON.parse(readFileSync(currentPointer, "utf8")).contentId as string : null;

  const { files } = collectContentFiles(source);
  const byPath = new Map(files.map(rel => [rel, path.join(source, rel)]));
  if (options.overlay) {
    for (const rel of walkFiles(options.overlay)) {
      const privatePath = privatePathViolation(rel);
      if (privatePath || !/^(data|staging)\//.test(rel)) throw new Error(`Overlay file outside public content: ${rel}`);
      byPath.set(rel, path.join(options.overlay, rel));
    }
  }
  const entries: { rel: string; abs: string }[] = [...byPath].map(([rel, abs]) => ({ rel, abs }));
  let mcp: ContentReleaseManifest["mcp"];
  if (options.mcpCatalog) {
    const catalog = await loadCatalog(path.resolve(options.mcpCatalog));
    entries.push({ rel: "mcp/catalog.json", abs: path.resolve(options.mcpCatalog) });
    mcp = { catalog: "mcp/catalog.json", releaseId: catalog.releaseId, sha256: sha256File(path.resolve(options.mcpCatalog)) };
  }
  let translations: ContentReleaseManifest["translations"];
  if (options.translationsPointer) {
    entries.push(...translationFiles(options.translationsPointer));
    translations = {
      pointer: "translations/current.json",
      ...(process.env.UAPT_READING_SAMPLED_PUBLICATION_ACCEPTANCE_SHA256 && process.env.UAPT_READING_SAMPLED_PUBLICATION_SELECTION_SHA256
        ? { sampledPublication: { acceptanceSha256: process.env.UAPT_READING_SAMPLED_PUBLICATION_ACCEPTANCE_SHA256, selectionSha256: process.env.UAPT_READING_SAMPLED_PUBLICATION_SELECTION_SHA256 } }
        : {})
    };
  }
  entries.sort((a, b) => (a.rel < b.rel ? -1 : a.rel > b.rel ? 1 : 0));

  const staging = `${dir}.building-${process.pid}`;
  const tree = path.join(staging, "tree");
  let newObjects = 0, newBytes = 0;
  const list: ContentFileEntry[] = [];
  try {
    for (const { rel, abs } of entries) {
      const sha = sha256File(abs);
      if (storeObject(contentRoot, abs, sha)) { newObjects++; newBytes += statSync(abs).size; }
      const target = path.join(tree, rel);
      mkdirSync(path.dirname(target), { recursive: true });
      linkSync(path.join(contentRoot, objectRelPath(sha)), target);
      list.push([rel, sha, statSync(target).size]);
    }
    const detected = detectSchemas(tree);
    const hasRegistry = existsSync(path.join(tree, "data/monthly-reports/registry.json"));
    const registry = hasRegistry ? JSON.parse(readFileSync(path.join(tree, "data/monthly-reports/registry.json"), "utf8")) : undefined;
    selectTree(contentId, tree);
    const claims = await computeClaimSets();
    if (claims.evidenceProblems.length) throw new Error(`Evidence problems: ${claims.evidenceProblems.slice(0, 5).join("; ")}`);
    const manifest: ContentReleaseManifest = {
      schemaVersion: CONTENT_RELEASE_SCHEMA,
      contentId,
      parentContentId,
      createdAt: new Date().toISOString(),
      appCompatibility: defaultCompatibility([...detected.schemas, ...(mcp ? ["uapt-mcp-catalog-v1"] : []), ...(translations ? ["uapt-reading-translations-v1"] : [])].sort()),
      requiredSyncContract: detected.requiredSyncContract,
      families: detected.families,
      ...(registry ? { reports: { registry: "data/monthly-reports/registry.json", current: registry.current } } : {}),
      ...(translations ? { translations } : {}),
      ...(mcp ? { mcp } : {}),
      ...(options.decisions ? { decisions: options.decisions } : {}),
      claimSets: claims.summary,
      files: list
    };
    writeFileSync(path.join(staging, "manifest.json"), JSON.stringify(manifest) + "\n", { mode: 0o444 });
    renameSync(staging, dir);
  } catch (error) {
    rmSync(staging, { recursive: true, force: true });
    throw error;
  }
  const manifestSha256 = sha256(readFileSync(path.join(dir, "manifest.json")));
  const validation = await validateContentRelease(contentRoot, contentId);
  return { contentId, parentContentId, manifestSha256, files: list.length, newObjects, newBytes, validation };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const arg = (name: string) => { const i = process.argv.indexOf(name); return i < 0 ? undefined : process.argv[i + 1]; };
  const contentRoot = arg("--content-root") ?? process.env.UAPT_CONTENT_ROOT;
  const contentId = arg("--content-id");
  if (!contentRoot || !contentId) {
    console.error("usage: content:build --content-root <dir> --content-id <id> [--source <checkout>] [--overlay <dir>] [--parent <id>|--no-parent] [--mcp-catalog <file>] [--translations-pointer <file>] [--decisions <json>]");
    process.exit(2);
  }
  buildContentRelease({
    contentRoot: path.resolve(contentRoot), contentId,
    source: path.resolve(arg("--source") ?? process.cwd()),
    overlay: arg("--overlay") ? path.resolve(arg("--overlay")!) : undefined,
    parentContentId: process.argv.includes("--no-parent") ? null : arg("--parent"),
    mcpCatalog: arg("--mcp-catalog"), translationsPointer: arg("--translations-pointer"),
    decisions: arg("--decisions") ? JSON.parse(readFileSync(arg("--decisions")!, "utf8")) : undefined
  }).then(result => {
    const { schoolDigests: _a, parentSchoolDigests: _b, ...validation } = result.validation;
    console.log(JSON.stringify({ ...result, validation }, null, 2));
    process.exitCode = result.validation.ok ? 0 : 1;
  }).catch(error => { console.error(error); process.exitCode = 1; });
}
