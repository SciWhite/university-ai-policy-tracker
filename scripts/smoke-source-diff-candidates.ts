import { createHash } from "node:crypto";
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync
} from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

interface CandidateDocument {
  candidates: Array<{
    diffClass: string;
    hunks: unknown[];
    sourceLastModified?: string;
    trackerCheckedAt?: string;
  }>;
  summary: Record<string, number>;
}

interface OpenClawQueueDocument {
  items: unknown[];
  recommendedCommand: string;
  schemaVersion: string;
}

const tmpRoot = mkdtempSync(path.join(os.tmpdir(), "uapt-source-diff-smoke-"));

try {
  const sourceRoot = path.join(tmpRoot, "source-snapshots");
  const oldRoot = path.join(sourceRoot, "old", "snapshots", "harvard__source");
  const newRoot = path.join(sourceRoot, "new", "snapshots", "harvard__source");
  const diffRoot = path.join(sourceRoot, "diffs");
  const outputRoot = path.join(tmpRoot, "out");

  mkdirSync(oldRoot, { recursive: true });
  mkdirSync(newRoot, { recursive: true });
  mkdirSync(diffRoot, { recursive: true });
  mkdirSync(outputRoot, { recursive: true });

  const oldText =
    "Students may use AI only with written instructor permission in coursework.\n";
  const newText =
    "Students may use generative AI for brainstorming when instructors allow it, but AI use must be disclosed in submitted assignments.\n";
  const oldPath = path.join(oldRoot, "normalized.md");
  const newPath = path.join(newRoot, "normalized.md");
  const oldHash = sha256(oldText);
  const newHash = sha256(newText);

  writeFileSync(oldPath, oldText, "utf8");
  writeFileSync(newPath, newText, "utf8");
  writeJson(path.join(sourceRoot, "old", "manifest.json"), {
    schemaVersion: "uapt-private-source-snapshot-manifest-v1",
    releaseId: "old",
    records: [
      {
        citationTitle: "Harvard AI guidance",
        entityName: "Harvard University",
        entitySlug: "harvard-university",
        fetchedAt: "2026-05-25T00:00:00.000Z",
        fetchStatus: "fetched",
        normalizedTextHash: oldHash,
        normalizedTextPath: oldPath,
        publicSnapshotHash:
          "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        sourceLastModified: "2026-05-24T00:00:00.000Z",
        sourceType: "official_policy_page",
        sourceUrl: "https://example.edu/ai"
      }
    ]
  });
  writeJson(path.join(sourceRoot, "new", "manifest.json"), {
    schemaVersion: "uapt-private-source-snapshot-manifest-v1",
    releaseId: "new",
    records: [
      {
        citationTitle: "Harvard AI guidance",
        entityName: "Harvard University",
        entitySlug: "harvard-university",
        fetchedAt: "2026-05-26T00:00:00.000Z",
        fetchStatus: "fetched",
        normalizedTextHash: newHash,
        normalizedTextPath: newPath,
        publicSnapshotHash:
          "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
        sourceLastModified: "2026-05-25T00:00:00.000Z",
        sourceType: "official_policy_page",
        sourceUrl: "https://example.edu/ai"
      }
    ]
  });
  writeJson(path.join(diffRoot, "old__new.json"), {
    schemaVersion: "uapt-private-source-snapshot-diff-v1",
    previousReleaseId: "old",
    currentReleaseId: "new",
    rows: [
      {
        previousReleaseId: "old",
        currentReleaseId: "new",
        entityName: "Harvard University",
        entitySlug: "harvard-university",
        sourceUrl: "https://example.edu/ai",
        status: "normalized_text_changed",
        summary: "Private normalized source text hash changed.",
        oldPublicSnapshotHash:
          "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        newPublicSnapshotHash:
          "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
        oldNormalizedTextHash: oldHash,
        newNormalizedTextHash: newHash
      }
    ]
  });

  const result = spawnSync(
    "pnpm",
    [
      "exec",
      "tsx",
      "scripts/build-source-diff-candidates.ts",
      "--output-root",
      sourceRoot,
      "--output-dir",
      outputRoot,
      "--previous-release-id",
      "old",
      "--current-release-id",
      "new"
    ],
    {
      cwd: findRepoRoot(),
      encoding: "utf8"
    }
  );

  if (result.status !== 0) {
    throw new Error(
      `source diff builder failed\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`
    );
  }

  const outputDir = path.join(outputRoot, "old__new");
  const candidates = JSON.parse(
    readFileSync(path.join(outputDir, "candidates.json"), "utf8")
  ) as CandidateDocument;
  const queue = JSON.parse(
    readFileSync(path.join(outputDir, "openclaw-queue.json"), "utf8")
  ) as OpenClawQueueDocument;
  const report = readFileSync(path.join(outputDir, "review-report.md"), "utf8");

  assert(candidates.candidates.length === 1, "expected one candidate");
  assert(
    candidates.candidates[0]?.diffClass === "content_policy_delta",
    "expected content_policy_delta"
  );
  assert(candidates.candidates[0]?.hunks.length > 0, "expected diff hunks");
  assert(
    candidates.candidates[0]?.sourceLastModified === "2026-05-25T00:00:00.000Z",
    "expected sourceLastModified to come from source metadata"
  );
  assert(queue.schemaVersion === "uapt-source-diff-openclaw-queue-v1", "bad queue schema");
  assert(queue.items.length === 1, "expected one OpenClaw queue item");
  assert(
    queue.recommendedCommand.includes("maintenance:start-light-review"),
    "missing OpenClaw review command"
  );
  assert(!report.includes(oldPath), "review report leaked old private path");
  assert(!report.includes(newPath), "review report leaked new private path");
  assert(!JSON.stringify(candidates).includes("normalized.md"), "candidate JSON leaked paths");

  console.log("Source diff candidate smoke passed.");
} finally {
  rmSync(tmpRoot, { force: true, recursive: true });
}

function writeJson(file: string, value: unknown): void {
  writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

function findRepoRoot(): string {
  let current = process.cwd();

  for (;;) {
    try {
      readFileSync(path.join(current, "package.json"), "utf8");
      return current;
    } catch {
      const parent = path.dirname(current);
      if (parent === current) return process.cwd();
      current = parent;
    }
  }
}
