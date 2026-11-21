/**
 * Build the operation bundle for one content release (docs/content-release.md §5.1). Runs on the
 * operator machine after the local candidate readback and candidate sync event; writes nothing to
 * a server. The result is the whole input of scripts/release/content-release.py on the host:
 *
 *   <out>/bundle.json                  identity, parent, changed schools, hold reason, quoted request
 *   <out>/objects/<aa>/<sha>           only the objects the parent release does not have
 *   <out>/sync/content-candidate/      the candidate sync package, proofs as proof-manifest.json
 *   <out>/isr-expiry-request.json      page-only expiry (school tags + every reading-locale path)
 *   <out>/changed-urls.json            warm/refresh list (uapt-changed-urls-v1), readback set first
 *
 *   pnpm content:bundle --content-root <local-root> --content-id <id> --op-id <op> \
 *     --sync-dir <candidate-sync-dir> --schools <slugs.json> --changes-revision <rev> \
 *     --authorization "<quoted request>" --hold-reason "<why>" --out <dir>
 *
 * The bundle's SHA256 is what the owner approves; activate refuses any other bytes.
 */
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { existsSync, linkSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { READING_LOCALES } from "../../apps/web/lib/language-catalog";
import { CONTENT_ID_PATTERN } from "./lib";

export const BUNDLE_SCHEMA = "uapt-content-release-bundle-v1";
export const CHANGED_URLS_SCHEMA = "uapt-changed-urls-v1";
const SLUG = /^[a-z0-9][a-z0-9-]{1,120}$/;
const OP_ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$/;
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const sha = (bytes: Buffer | string) => createHash("sha256").update(bytes).digest("hex");

const localePath = (locale: string, rest: string) => (locale === "en" ? "" : `/${locale}`) + rest;

/** Tags and paths a page-only change of these schools must expire (matches the batch 2/3 requests). */
export function isrExpiryRequest(contentId: string, slugs: string[], changesRevision: string, locales: readonly string[] = READING_LOCALES) {
  const paths = new Set<string>(["/changes", "/sitemaps/changes.xml"]);
  for (const locale of locales) if (locale !== "en") paths.add(`/${locale}/changes`);
  for (const slug of slugs) {
    paths.add(`/changes/${slug}`);
    for (const locale of locales) paths.add(localePath(locale, `/universities/${slug}`));
  }
  return { expectedContentId: contentId, tags: [...slugs.map(s => `school:${s}`), "changes", `changes:${changesRevision}`], paths: [...paths].sort() };
}

/** Warm order: en and zh school pages first (the readback set), then every other changed path. */
export function changedUrls(contentId: string, slugs: string[], expiry: { paths: string[] }) {
  const readbackFirst = slugs.flatMap(slug => [`/universities/${slug}`, `/zh/universities/${slug}`]);
  const apis = slugs.map(slug => `/api/public/v1/universities/${slug}.json`);
  const rest = expiry.paths.filter(p => !readbackFirst.includes(p));
  return { schemaVersion: CHANGED_URLS_SCHEMA, contentId, readbackFirst, paths: [...readbackFirst, ...rest, ...apis] };
}

/** Objects of `manifest` that `parent` does not reference. */
export function deltaObjects(manifest: { files: [string, string, number][] }, parent: { files: [string, string, number][] }) {
  const have = new Set(parent.files.map(([, digest]) => digest));
  const out = new Map<string, number>();
  for (const [, digest, size] of manifest.files) if (!have.has(digest)) out.set(digest, size);
  return out;
}

function linkTree(from: string, to: string, skip: (rel: string) => boolean, rel = "") {
  mkdirSync(path.join(to, rel), { recursive: true });
  for (const name of readdirSync(path.join(from, rel))) {
    const child = rel ? `${rel}/${name}` : name;
    if (skip(child)) continue;
    const stats = statSync(path.join(from, child));
    if (stats.isDirectory()) linkTree(from, to, skip, child);
    else linkSync(path.join(from, child), path.join(to, child));
  }
}

export interface BundleOptions {
  contentRoot: string; contentId: string; opId: string; syncDir: string; schools: string[];
  changesRevision: string; authorization: string; holdReason: string; out: string;
}

export function buildBundle(o: BundleOptions) {
  if (!CONTENT_ID_PATTERN.test(o.contentId)) throw Error("Invalid --content-id");
  if (!OP_ID.test(o.opId)) throw Error("Invalid --op-id");
  if (!o.schools.length || !o.schools.every(s => SLUG.test(s))) throw Error("--schools must list at least one slug");
  if (!o.authorization.trim() || !o.holdReason.trim() || !o.changesRevision.trim()) throw Error("--authorization, --hold-reason and --changes-revision are required");
  if (existsSync(o.out)) throw Error(`${o.out} exists; a bundle is written once`);
  const releaseFile = path.join(o.contentRoot, "releases", o.contentId, "manifest.json");
  const manifestBytes = readFileSync(releaseFile);
  const manifest = JSON.parse(manifestBytes.toString("utf8"));
  if (manifest.contentId !== o.contentId || !manifest.parentContentId) throw Error("Release manifest identity mismatch");
  if (manifest.requiredSyncContract !== "2.1.0") throw Error("Content releases require synchronization contract 2.1.0");
  const parentBytes = readFileSync(path.join(o.contentRoot, "releases", manifest.parentContentId, "manifest.json"));
  const parent = JSON.parse(parentBytes.toString("utf8"));
  const manifestSha256 = sha(manifestBytes);
  const basis = path.join(o.syncDir, "basis.json"), event = path.join(o.syncDir, "event.json");
  if (sha(readFileSync(basis)) !== manifestSha256) throw Error("sync-dir/basis.json is not this release's manifest");
  const ledger = JSON.parse(readFileSync(event, "utf8"));
  if (ledger.basisSha256 !== manifestSha256 || ledger.syncContractVersion !== "2.1.0" || ledger.phase !== "candidate") throw Error("sync-dir/event.json is not the 2.1.0 candidate event of this manifest");

  mkdirSync(o.out, { recursive: true, mode: 0o750 });
  const delta = deltaObjects(manifest, parent);
  let bytes = 0;
  for (const [digest, size] of delta) {
    const from = path.join(o.contentRoot, "objects", digest.slice(0, 2), digest);
    if (statSync(from).size !== size || sha(readFileSync(from)) !== digest) throw Error(`Local object ${digest} does not match the manifest`);
    mkdirSync(path.join(o.out, "objects", digest.slice(0, 2)), { recursive: true });
    linkSync(from, path.join(o.out, "objects", digest.slice(0, 2), digest));
    bytes += size;
  }
  const syncOut = path.join(o.out, "sync", "content-candidate");
  linkTree(o.syncDir, syncOut, () => false);
  if (existsSync(path.join(syncOut, "proof"))) {
    const result = spawnSync("python3", [path.join(repoRoot, "scripts/content-release/sync-proof.py"), "dehydrate", syncOut], { encoding: "utf8" });
    if (result.status !== 0) throw Error("sync-proof dehydrate failed: " + result.stderr);
  }
  const slugs = [...new Set(o.schools)].sort();
  const expiry = isrExpiryRequest(o.contentId, slugs, o.changesRevision);
  writeFileSync(path.join(o.out, "isr-expiry-request.json"), JSON.stringify(expiry, null, 1) + "\n");
  writeFileSync(path.join(o.out, "changed-urls.json"), JSON.stringify(changedUrls(o.contentId, slugs, expiry), null, 1) + "\n");
  const head = spawnSync("git", ["rev-parse", "HEAD"], { cwd: repoRoot, encoding: "utf8" }).stdout.trim();
  const bundle = {
    schemaVersion: BUNDLE_SCHEMA, opId: o.opId, contentId: o.contentId, parentContentId: manifest.parentContentId,
    manifestSha256, parentManifestSha256: sha(parentBytes), requiredSyncContract: "2.1.0",
    changedSchools: slugs, changesRevision: o.changesRevision,
    objects: { count: delta.size, bytes },
    files: { syncCandidate: "sync/content-candidate/event.json", isrExpiry: "isr-expiry-request.json", changedUrls: "changed-urls.json" },
    hold: { reason: o.holdReason },
    authorization: o.authorization,
    createdAt: new Date().toISOString(), toolCommit: head,
    hostSteps: ["check", "activate (gates, install, switch, ISR expiry, refresh)", "operator: Cloudflare purge + public readback (1 worker) + complete event", "complete (gate, register, classify, rescan, hold status)"],
  };
  const raw = JSON.stringify(bundle, null, 2) + "\n";
  writeFileSync(path.join(o.out, "bundle.json"), raw);
  return { out: o.out, bundleSha256: sha(raw), objects: delta.size, objectBytes: bytes, schools: slugs.length, paths: expiry.paths.length };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const arg = (name: string) => { const i = process.argv.indexOf(name); return i < 0 ? undefined : process.argv[i + 1]; };
  try {
    const schoolsFile = arg("--schools");
    const result = buildBundle({
      contentRoot: path.resolve(arg("--content-root") ?? ""), contentId: arg("--content-id") ?? "", opId: arg("--op-id") ?? "",
      syncDir: path.resolve(arg("--sync-dir") ?? ""), schools: schoolsFile ? JSON.parse(readFileSync(schoolsFile, "utf8")) : [],
      changesRevision: arg("--changes-revision") ?? "", authorization: arg("--authorization") ?? "", holdReason: arg("--hold-reason") ?? "",
      out: path.resolve(arg("--out") ?? ""),
    });
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
