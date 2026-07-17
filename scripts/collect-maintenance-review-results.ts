import { existsSync } from "node:fs";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import path from "node:path";

type Classification =
  | "valid_artifact"
  | "invalid_artifact"
  | "no_promote"
  | "timeout"
  | "blocked"
  | "needs_human_review";

type Result = {
  artifactDir?: string;
  classification: Classification;
  detail: string;
  item: string;
};

type PendingResult = Result & {
  priority: number;
};

async function main(): Promise<void> {
  const [runId, root = "staging/uapt-maintenance", runsRoot = "staging/uapt-runs"] =
    process.argv.slice(2).filter((arg) => arg !== "--");
  if (!runId) {
    throw Error(
      "Usage: tsx scripts/collect-maintenance-review-results.ts <run-id> [maintenance-root] [runs-root]",
    );
  }

  const base = path.join(root, runId);
  const prefix = `uapt-maintenance-light-${sanitize(runId)}-`;
  const byItem = new Map<string, PendingResult>();

  for (const file of await files(path.join(base, "logs"))) {
    const text = await readFile(file, "utf8");
    const item = path.basename(file, path.extname(file));
    mergeResult(byItem, {
      item,
      classification: classifyNoteOrLog(text),
      detail: "Note/log only; no publishable conclusion inferred.",
      priority: 10,
    });
  }

  for (const file of await files(path.join(base, "notes"))) {
    const text = await readFile(file, "utf8");
    const item = path.basename(file, path.extname(file));
    mergeResult(byItem, {
      item,
      classification: classifyNoteOrLog(text),
      detail: "Maintenance note only; no publishable conclusion inferred.",
      priority: 20,
    });
  }

  if (existsSync(runsRoot)) {
    for (const entry of await readdir(runsRoot, { withFileTypes: true })) {
      if (!entry.isDirectory() || !entry.name.startsWith(prefix)) continue;

      const item = entry.name.slice(prefix.length);
      const artifactDir = path.join(runsRoot, entry.name);
      const artifactFile = path.join(artifactDir, "artifacts.json");
      if (!existsSync(artifactFile)) continue;

      const validation = spawnSync(
        "pnpm",
        ["validate:openclaw-artifacts", artifactDir],
        {
          cwd: process.cwd(),
          encoding: "utf8",
        },
      );
      mergeResult(byItem, {
        item,
        artifactDir,
        classification: validation.status === 0 ? "valid_artifact" : "invalid_artifact",
        detail:
          validation.status === 0
            ? "Artifact validator passed."
            : (validation.stderr || validation.stdout || "Artifact validator failed.").slice(
                0,
                600,
              ),
        priority: validation.status === 0 ? 100 : 90,
      });
    }
  }

  const results = [...byItem.values()]
    .sort((left, right) => left.item.localeCompare(right.item))
    .map(({ priority: _priority, ...result }) => result);
  const counts = results.reduce(
    (out, result) => {
      out[result.classification] = (out[result.classification] || 0) + 1;
      return out;
    },
    {} as Record<string, number>,
  );
  const runningUnits = activeReviewUnits();
  const payload = {
    schemaVersion: "uapt-maintenance-review-results-v1",
    runId,
    generatedAt: new Date().toISOString(),
    runningUnits,
    results,
  };

  await mkdir(base, { recursive: true });
  await writeFile(
    path.join(base, "review-results.json"),
    `${JSON.stringify(payload, null, 2)}\n`,
  );
  await writeFile(
    path.join(base, "operator-summary.md"),
    [
      "# Maintenance operator summary",
      "",
      `Run: ${runId}`,
      "",
      ...summaryLines(counts),
      "",
      runningUnits.length
        ? `Running review units still active: ${runningUnits.length}. Re-run collection after they finish.`
        : "No active lightweight review units detected.",
      "",
      "Only valid_artifact entries are eligible for a release candidate.",
      "",
    ].join("\n"),
  );
  console.log(JSON.stringify({ ...counts, runningUnits: runningUnits.length }));
}

function mergeResult(results: Map<string, PendingResult>, result: PendingResult): void {
  const current = results.get(result.item);
  if (!current || result.priority > current.priority) {
    results.set(result.item, result);
  }
}

function classifyNoteOrLog(text: string): Classification {
  if (/timeout/i.test(text)) return "timeout";
  if (/blocked|robots|access denied/i.test(text)) return "blocked";
  if (/human review|needs_review/i.test(text)) return "needs_human_review";
  return "no_promote";
}

async function files(directory: string): Promise<string[]> {
  try {
    return (await readdir(directory, { withFileTypes: true }))
      .filter((entry) => entry.isFile())
      .map((entry) => path.join(directory, entry.name));
  } catch {
    return [];
  }
}

function activeReviewUnits(): string[] {
  const result = spawnSync(
    "systemctl",
    [
      "list-units",
      "uapt-light-review-*.service",
      "--state=running",
      "--plain",
      "--no-legend",
    ],
    { encoding: "utf8" },
  );
  if (result.status !== 0) return [];
  return result.stdout
    .split("\n")
    .map((line) => line.trim().split(/\s+/)[0])
    .filter(Boolean);
}

function summaryLines(counts: Record<string, number>): string[] {
  const entries = Object.entries(counts);
  if (!entries.length) return ["- no review output found"];
  return entries.map(([classification, count]) => `- ${classification}: ${count}`);
}

function sanitize(value: string): string {
  return value.replace(/[^a-zA-Z0-9-]/g, "-").replace(/-+/g, "-");
}

void main();
