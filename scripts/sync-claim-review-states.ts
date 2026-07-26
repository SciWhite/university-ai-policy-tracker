import { readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";

// Syncs each staged claim_candidate's reviewState to the newest matching
// review_decision's reviewState. Review decisions are the authoritative record
// (the public merge layer already gives them precedence); this repairs claim
// records whose state field was never flipped after review, so raw artifacts
// stop contradicting the published dataset. Dry-run by default; pass --write
// to apply.

interface StagedArtifact {
  artifactType?: string;
  claimId?: string;
  runId?: string;
  reviewState?: string;
  decidedAt?: string;
  [key: string]: unknown;
}

interface FileEntry {
  filePath: string;
  container: "bundle" | "aggregate" | "single" | "list";
  raw: { artifacts?: StagedArtifact[] } | StagedArtifact | StagedArtifact[];
}

const write = process.argv.includes("--write");

async function main() {
  const repoRoot = process.cwd();
  const manifest = JSON.parse(
    await readFile(
      path.join(repoRoot, "data", "public-releases", "current.json"),
      "utf8"
    )
  ) as { includeStagedArtifactDirectories: string[] };

  let scannedClaims = 0;
  let driftingClaims = 0;
  const changedFiles = new Set<string>();
  const driftSummary = new Map<string, number>();

  for (const dir of manifest.includeStagedArtifactDirectories) {
    const dirPath = path.join(repoRoot, dir);
    const entries = await loadArtifactFiles(dirPath);
    if (!entries.length) continue;

    const decisionsByClaim = new Map<string, StagedArtifact>();
    for (const entry of entries) {
      for (const artifact of iterArtifacts(entry)) {
        if (artifact.artifactType !== "review_decision" || !artifact.claimId) {
          continue;
        }
        const previous = decisionsByClaim.get(artifact.claimId);
        if (
          !previous ||
          String(artifact.decidedAt ?? "") > String(previous.decidedAt ?? "")
        ) {
          decisionsByClaim.set(artifact.claimId, artifact);
        }
      }
    }
    if (!decisionsByClaim.size) continue;

    for (const entry of entries) {
      let entryChanged = false;
      for (const artifact of iterArtifacts(entry)) {
        if (artifact.artifactType !== "claim_candidate" || !artifact.claimId) {
          continue;
        }
        scannedClaims += 1;
        const decision = decisionsByClaim.get(artifact.claimId);
        if (!decision?.reviewState) continue;
        if (artifact.reviewState === decision.reviewState) continue;

        driftingClaims += 1;
        const key = `${dir}: ${artifact.reviewState} -> ${decision.reviewState}`;
        driftSummary.set(key, (driftSummary.get(key) ?? 0) + 1);
        if (write) {
          artifact.reviewState = decision.reviewState;
          entryChanged = true;
        }
      }
      if (entryChanged) {
        await writeFile(
          entry.filePath,
          `${JSON.stringify(entry.raw, null, 2)}\n`,
          "utf8"
        );
        changedFiles.add(entry.filePath);
      }
    }
  }

  for (const [key, count] of [...driftSummary.entries()].sort()) {
    console.log(`${count.toString().padStart(4)}  ${key}`);
  }
  console.log(
    `${write ? "Synced" : "Would sync"} ${driftingClaims} of ${scannedClaims} claims with decisions${
      write ? `; rewrote ${changedFiles.size} files` : ""
    }. ${write ? "" : "Run with --write to apply."}`
  );
}

function iterArtifacts(entry: FileEntry): StagedArtifact[] {
  if (entry.container === "single") {
    return [entry.raw as StagedArtifact];
  }
  if (entry.container === "list") {
    return entry.raw as StagedArtifact[];
  }
  const artifacts = (entry.raw as { artifacts?: StagedArtifact[] }).artifacts;
  return Array.isArray(artifacts) ? artifacts : [];
}

async function loadArtifactFiles(dirPath: string): Promise<FileEntry[]> {
  let files: string[];
  try {
    files = (await readdir(dirPath)).filter((file) => file.endsWith(".json"));
  } catch {
    return [];
  }

  const entries: FileEntry[] = [];
  for (const file of files) {
    const filePath = path.join(dirPath, file);
    let raw: unknown;
    try {
      raw = JSON.parse(await readFile(filePath, "utf8"));
    } catch {
      continue;
    }
    if (!raw || typeof raw !== "object") continue;
    if (Array.isArray(raw)) {
      if (raw.every((item) => item && typeof item === "object")) {
        entries.push({
          filePath,
          container: "list",
          raw: raw as StagedArtifact[]
        });
      }
      continue;
    }
    const record = raw as Record<string, unknown>;
    if (Array.isArray(record.artifacts)) {
      entries.push({
        filePath,
        container: file === "artifacts.json" ? "bundle" : "aggregate",
        raw: record as FileEntry["raw"]
      });
    } else if (typeof record.artifactType === "string") {
      entries.push({ filePath, container: "single", raw: record as StagedArtifact });
    }
  }
  return entries;
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
