import { cp, lstat, mkdir, mkdtemp, readFile, readdir, rename, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const defaultRepoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
// Only public loader dependencies: never .local, private inventories or review caches.
const publicDirectories = [
  "data/public-releases", "data/rankings", "data/ranking-browser", "data/policy-snapshots",
  "data/public-record-repairs", "data/public-change-history", "data/public-v6-history/repairs"
];
const identityFiles = [
  "DATA_DICTIONARY.md", "data/entity-aliases.json",
  ...["pages", "records", "history"].flatMap(family => [
    `data/public-v6-${family}/current.json`, `data/public-v6-${family}/revisions.json`,
    `data/public-v6-${family}/sharded/index.json`
  ]),
  // publicHistoryBasisV2 hashes these original bytes, even in a compiled runtime.
  "apps/web/lib/change-events.ts", "apps/web/lib/change-event-rules.ts",
  "apps/tulsa-zone/components/v6-compact-change-note.tsx",
  "apps/tulsa-zone/components/mit-student-guide-change-note.tsx",
  "apps/tulsa-zone/components/imperial-ux-change-note.tsx"
];

export async function prepareWebRuntimeData({repoRoot = defaultRepoRoot, targetRoot = path.join(repoRoot, "apps/web/.runtime-data")} = {}) {
  const manifests = ["data/public-releases/current.json", ...(await readdir(path.join(repoRoot, "data/public-releases/history"))).filter(f => f.endsWith(".json")).map(f => `data/public-releases/history/${f}`)];
  const artifacts = new Set();
  for (const file of manifests) {
    const manifestFile = path.join(repoRoot, file);
    if ((await lstat(manifestFile)).isSymbolicLink()) throw new Error(`Public runtime manifest is a symlink: ${file}`);
    const manifest = JSON.parse(await readFile(manifestFile, "utf8"));
    // Legacy published history predates candidateOnly; match the release validator.
    if (manifest.schemaVersion !== "uapt-public-release-manifest-v1" || manifest.candidateOnly === true) throw new Error(`Unpublished runtime manifest: ${file}`);
    for (const directory of manifest.includeStagedArtifactDirectories ?? []) {
      if (!isAllowedArtifactDirectory(directory)) throw new Error(`Unsafe public artifact directory in ${file}`);
      artifacts.add(directory);
    }
  }
  await mkdir(path.dirname(targetRoot), {recursive: true});
  const staging = await mkdtemp(path.join(path.dirname(targetRoot), ".runtime-data-prepare-"));
  let backup;
  try {
    for (const directory of [...publicDirectories, ...artifacts]) await copyPath(directory, true);
    for (const file of identityFiles) await copyPath(file, false);
    // A copy failure must leave the previous complete package intact.
    try { await lstat(targetRoot); backup = `${staging}-previous`; await rename(targetRoot, backup); } catch (error) { if (error.code !== "ENOENT") throw error; }
    try { await rename(staging, targetRoot); } catch (error) { if (backup) await rename(backup, targetRoot); throw error; }
    if (backup) await rm(backup, {force: true, recursive: true});
    return {targetRoot, publishedManifests: manifests.length, artifactDirectories: artifacts.size};
  } finally {
    await rm(staging, {force: true, recursive: true});
  }
  async function copyPath(relativePath, jsonOnly) {
    const source = path.join(repoRoot, relativePath), target = path.join(staging, relativePath);
    await mkdir(path.dirname(target), {recursive: true});
    await cp(source, target, {recursive: true, force: true, filter: async file => {
      const entry = await lstat(file);
      if (entry.isSymbolicLink()) throw new Error(`Public runtime source is a symlink: ${relativePath}`);
      return !jsonOnly || entry.isDirectory() || file.endsWith(".json");
    }});
  }
}

function isAllowedArtifactDirectory(directory) {
  return typeof directory === "string" && !directory.includes("\\") && !path.posix.isAbsolute(directory) &&
    directory.split("/").every(part => part && part !== "." && part !== "..") &&
    (directory.startsWith("data/openclaw-staging/") || directory.startsWith("staging/uapt-runs/"));
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  console.log(JSON.stringify(await prepareWebRuntimeData()));
}
