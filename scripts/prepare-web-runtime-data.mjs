import { cp, mkdir, readFile, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const targetRoot = path.join(repoRoot, "apps", "web", ".runtime-data");
const currentManifestPath = path.join(
  repoRoot,
  "data",
  "public-releases",
  "current.json"
);

await rm(targetRoot, { force: true, recursive: true });
await mkdir(targetRoot, { recursive: true });

await copyPath("DATA_DICTIONARY.md");
await copyPath(path.join("data", "public-releases"));
await copyPath(path.join("data", "rankings"));

const manifest = JSON.parse(await readFile(currentManifestPath, "utf8"));

for (const directory of manifest.includeStagedArtifactDirectories ?? []) {
  if (!isAllowedArtifactDirectory(directory)) continue;
  await copyPath(directory, { jsonOnly: true });
}

async function copyPath(relativePath, options = {}) {
  const source = path.join(repoRoot, relativePath);
  const target = path.join(targetRoot, relativePath);

  await mkdir(path.dirname(target), { recursive: true });
  await cp(source, target, {
    filter: options.jsonOnly
      ? (sourcePath) =>
          sourcePath === source ||
          path.extname(sourcePath) === "" ||
          sourcePath.endsWith(".json")
      : undefined,
    force: true,
    recursive: true
  });
}

function isAllowedArtifactDirectory(directory) {
  return (
    typeof directory === "string" &&
    (directory.startsWith("data/openclaw-staging/") ||
      directory.startsWith("staging/uapt-runs/"))
  );
}
