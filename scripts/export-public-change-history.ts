import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, statSync, linkSync, copyFileSync, symlinkSync, rmSync, unlinkSync } from "node:fs";
import { mkdir, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { buildPublicHistoryProjection } from "../apps/web/lib/change-records";
import { publicHistoryBasis } from "../apps/web/lib/public-history-basis";
import { findRepoRoot } from "../apps/web/lib/repo-root";

const hash = (bytes: string | Buffer) => createHash("sha256").update(bytes).digest("hex");

export interface ExportPublicChangeHistoryResult {
  universitiesWithHistoricalChanges: number;
  records: number;
  releases: number;
  bytes: number;
  basisSha256: string;
  sha256: string;
  manifestFile: string;
}

function hardlinkTree(src: string, dst: string, filter?: (p: string) => boolean) {
  const stat = statSync(src);
  if (stat.isDirectory()) {
    mkdirSync(dst, { recursive: true });
    for (const entry of readdirSync(src)) {
      const full = path.join(src, entry);
      if (filter && !filter(full)) continue;
      hardlinkTree(full, path.join(dst, entry), filter);
    }
  } else {
    try {
      linkSync(src, dst);
    } catch {
      copyFileSync(src, dst);
    }
  }
}

export function ensureIsolatedCheckout(sourceRoot: string, targetRoot: string): () => void {
  const cleanupPaths: { path: string; isDir: boolean }[] = [];
  const ignoreNames = new Set([".next", ".turbo", "dist", "out", "node_modules", ".git"]);
  const filter = (p: string) => !ignoreNames.has(path.basename(p));

  const rootFiles = ["package.json", "tsconfig.base.json", "pnpm-workspace.yaml", "pnpm-lock.yaml"];
  for (const f of rootFiles) {
    const srcFile = path.join(sourceRoot, f);
    const dstFile = path.join(targetRoot, f);
    if (!existsSync(dstFile) && existsSync(srcFile)) {
      try { linkSync(srcFile, dstFile); } catch { copyFileSync(srcFile, dstFile); }
      cleanupPaths.push({ path: dstFile, isDir: false });
    }
  }

  const trees = ["apps", "packages", "scripts"];
  for (const dir of trees) {
    const srcDir = path.join(sourceRoot, dir);
    const dstDir = path.join(targetRoot, dir);
    if (!existsSync(dstDir) && existsSync(srcDir)) {
      hardlinkTree(srcDir, dstDir, filter);
      cleanupPaths.push({ path: dstDir, isDir: true });
    }
  }

  const symlinks = ["staging", "node_modules"];
  for (const dir of symlinks) {
    const srcDir = path.join(sourceRoot, dir);
    const dstDir = path.join(targetRoot, dir);
    if (!existsSync(dstDir) && existsSync(srcDir)) {
      symlinkSync(srcDir, dstDir);
      cleanupPaths.push({ path: dstDir, isDir: false });
    }
  }

  const workspaceDirs = [
    "apps/web",
    "apps/mcp",
    "apps/api",
    "apps/worker",
    "apps/tulsa-zone",
    "packages/shared",
    "packages/db",
    "packages/crawler-core"
  ];
  for (const rel of workspaceDirs) {
    const srcMod = path.join(sourceRoot, rel, "node_modules");
    const dstMod = path.join(targetRoot, rel, "node_modules");
    if (!existsSync(dstMod) && existsSync(srcMod)) {
      mkdirSync(path.dirname(dstMod), { recursive: true });
      symlinkSync(srcMod, dstMod);
      cleanupPaths.push({ path: dstMod, isDir: false });
    }
  }

  return () => {
    for (let i = cleanupPaths.length - 1; i >= 0; i--) {
      const { path: p, isDir } = cleanupPaths[i];
      try {
        if (isDir) {
          rmSync(p, { recursive: true, force: true });
        } else {
          unlinkSync(p);
        }
      } catch {
        // ignore cleanup error
      }
    }
  };
}

async function runIsolatedExport(
  targetRoot: string,
  options?: { repoRoot?: string; historyDir?: string; siteUrl?: string }
): Promise<ExportPublicChangeHistoryResult> {
  const sourceRoot = path.resolve(await findRepoRoot());
  const cleanup = ensureIsolatedCheckout(sourceRoot, targetRoot);
  try {
    const tsxCli = path.resolve(sourceRoot, "node_modules/tsx/dist/cli.mjs");
    const output = execFileSync(
      process.execPath,
      [tsxCli, "--tsconfig", "apps/web/tsconfig.json", "scripts/export-public-change-history.ts"],
      {
        cwd: targetRoot,
        encoding: "utf8",
        env: {
          ...process.env,
          NEXT_PUBLIC_SITE_URL: options?.siteUrl ?? "https://eduaipolicy.org",
          UAPT_V6_PUBLISHED_PAGES: "1",
          NEXT_PUBLIC_UAPT_V6_PUBLISHED_PAGES: "1"
        },
        maxBuffer: 64 * 1024 * 1024
      }
    );
    const lines = output.trim().split("\n");
    for (let i = lines.length - 1; i >= 0; i--) {
      const line = lines[i].trim();
      if (line.startsWith("{") && line.endsWith("}")) {
        try {
          const parsed = JSON.parse(line);
          if (parsed.universitiesWithHistoricalChanges !== undefined && parsed.basisSha256) {
            return parsed as ExportPublicChangeHistoryResult;
          }
        } catch {
          // continue searching backwards
        }
      }
    }
    throw new Error(`Isolated export completed but returned no valid result line. Output:\n${output}`);
  } finally {
    cleanup();
  }
}

export async function exportPublicChangeHistory(options?: {
  repoRoot?: string;
  historyDir?: string;
  siteUrl?: string;
  eventsOutput?: string;
}): Promise<ExportPublicChangeHistoryResult> {
  if (options?.eventsOutput) {
    const repoRoot=await findRepoRoot();
    if (options.repoRoot && path.resolve(options.repoRoot)!==path.resolve(repoRoot)) throw Error("Run the v2 exporter from its isolated target checkout");
    const {exportChangeHistoryV2}=await import("./lib/export-change-events");
    return await exportChangeHistoryV2(repoRoot,options.eventsOutput) as unknown as ExportPublicChangeHistoryResult;
  }
  const targetRoot = options?.repoRoot ? path.resolve(options.repoRoot) : await findRepoRoot();
  const currentRoot = path.resolve(process.cwd());

  if (targetRoot !== currentRoot) {
    return runIsolatedExport(targetRoot, options);
  }

  if (process.env.UAPT_PUBLIC_RELEASE_MANIFEST || process.env.UAPT_CANDIDATE_REPAIR_SLUG || process.env.UAPT_PRIVATE_SNAPSHOT_DIFF_ROOT) {
    throw Error("Public history export requires the current published inputs, without private candidate overrides");
  }

  // All payloads come from the existing public diff builder, never raw inventory.
  process.env.NEXT_PUBLIC_SITE_URL = options?.siteUrl ?? "https://eduaipolicy.org";
  process.env.UAPT_V6_PUBLISHED_PAGES = "1";
  process.env.NEXT_PUBLIC_UAPT_V6_PUBLISHED_PAGES = "1";
  const repoRoot = targetRoot;
  const basisSha256 = await publicHistoryBasis(repoRoot);
  const { histories: rows, releases } = await buildPublicHistoryProjection();
  const root = options?.historyDir ?? path.join(repoRoot, "data/public-change-history");
  const entries: Record<string, { file: string; sha256: string; bytes: number }> = {};
  await mkdir(path.join(root, "objects"), { recursive: true });

  for (const [slug, records] of Object.entries(rows).sort(([a], [b]) => a.localeCompare(b))) {
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || records.some(record => record.slug !== slug)) {
      throw Error("History scope mismatch");
    }
    const raw = JSON.stringify(records);
    const sha256 = hash(raw);
    const bytes = Buffer.byteLength(raw);
    if (bytes > 4 * 1024 * 1024) throw Error(`History shard too large: ${slug}`);
    const file = `objects/${sha256}.json`;
    await writeFile(path.join(root, file), raw);
    entries[slug] = { file, sha256, bytes };
  }

  const releaseEntries: Record<string, { file: string; sha256: string; bytes: number }> = {};
  for (const [releaseId, diff] of Object.entries(releases).sort(([a], [b]) => a.localeCompare(b))) {
    const raw = JSON.stringify(diff);
    const sha256 = hash(raw);
    const bytes = Buffer.byteLength(raw);
    if (bytes > 32 * 1024 * 1024) throw Error(`Release shard too large: ${releaseId}`);
    const file = `objects/${sha256}.json`;
    await writeFile(path.join(root, file), raw);
    releaseEntries[releaseId] = { file, sha256, bytes };
  }

  if (await publicHistoryBasis(repoRoot) !== basisSha256) throw Error("History inputs changed during export");

  const manifest = JSON.stringify({
    schemaVersion: "uapt-public-change-history-v1",
    basisSha256,
    entries,
    releases: releaseEntries
  });
  const sha256 = hash(manifest);
  const file = `manifest-${sha256}.json`;
  await writeFile(path.join(root, file), manifest);
  await writeFile(path.join(root, "current.json.next"), JSON.stringify({ path: file, sha256 }, null, 2) + "\n");
  await rename(path.join(root, "current.json.next"), path.join(root, "current.json"));

  const result: ExportPublicChangeHistoryResult = {
    universitiesWithHistoricalChanges: Object.keys(entries).length,
    records: Object.values(rows).reduce((n, r) => n + r.length, 0),
    releases: Object.keys(releaseEntries).length,
    bytes: [...Object.values(entries), ...Object.values(releaseEntries)].reduce((n, r) => n + r.bytes, 0),
    basisSha256,
    sha256,
    manifestFile: file
  };
  return result;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args=process.argv.slice(2);
  if(args.length && (args.length!==2||args[0]!=="--events-output"))throw Error("Use --events-output <NEW isolated directory>, or no arguments for the legacy v1 exporter");
  exportPublicChangeHistory(args.length?{eventsOutput:args[1]}:undefined).then(res => {
    console.log(JSON.stringify(res));
  }).catch(error => {
    console.error(error);
    process.exitCode = 1;
  });
}
