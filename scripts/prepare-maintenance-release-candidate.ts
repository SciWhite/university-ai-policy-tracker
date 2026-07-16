import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import path from "node:path";

type ReviewResults = {
  results?: Array<{
    artifactDir?: string;
    classification?: string;
  }>;
  runningUnits?: string[];
};

type PublicReleaseManifest = {
  releaseId: string;
  includeStagedArtifactDirectories: string[];
  [key: string]: unknown;
};

async function main(): Promise<void> {
  const runId = required("--run-id");
  const root = value("--maintenance-root") ?? "staging/uapt-maintenance";
  const resultsPath = path.join(root, runId, "review-results.json");
  const results = JSON.parse(await readFile(resultsPath, "utf8")) as ReviewResults;

  if (results.runningUnits?.length) {
    throw Error(
      `Review units are still running (${results.runningUnits.length}); candidate not created.`,
    );
  }

  const baseline = JSON.parse(
    await readFile("data/public-releases/current.json", "utf8"),
  ) as PublicReleaseManifest;
  const validArtifactDirs = unique(
    (results.results ?? [])
      .filter(
        (result) =>
          result.classification === "valid_artifact" && typeof result.artifactDir === "string",
      )
      .map((result) => result.artifactDir as string),
  );

  if (!validArtifactDirs.length) {
    throw Error("No valid artifacts: candidate not created.");
  }

  for (const directory of validArtifactDirs) {
    must("pnpm", ["validate:openclaw-artifacts", directory]);
  }

  const candidate = nextCandidatePath();
  const manifest = {
    ...baseline,
    releaseId: path.basename(candidate, ".json"),
    publishedAt: new Date().toISOString(),
    description: `Maintenance release candidate from ${runId}; awaiting explicit Codex promotion confirmation.`,
    previousReleaseId: baseline.releaseId,
    includeStagedArtifactDirectories: unique([
      ...baseline.includeStagedArtifactDirectories,
      ...validArtifactDirs,
    ]),
  };

  await mkdir(path.dirname(candidate), { recursive: true });
  await writeFile(candidate, `${JSON.stringify(manifest, null, 2)}\n`);

  for (const args of [
    ["pnpm", "validate:dataset-release"],
    ["pnpm", "validate:public-contract"],
    ["pnpm", "audit:public-data"],
  ]) {
    withManifest(candidate, args);
  }
  must("git", ["diff", "--check"]);

  await writeFile(
    path.join(root, runId, "release-candidate-summary.md"),
    [
      "# Maintenance release candidate",
      "",
      `Candidate: \`${candidate}\``,
      "",
      `Baseline: \`${baseline.releaseId}\``,
      "",
      `Valid staged bundles: ${validArtifactDirs.length}`,
      "",
      "This has not modified `data/public-releases/current.json`. Promotion requires explicit Codex/human confirmation.",
      "",
    ].join("\n"),
  );
  console.log(candidate);
}

function nextCandidatePath(): string {
  const stamp = new Date().toISOString().slice(0, 10).replaceAll("-", "");
  let index = 1;
  let candidate: string;
  do {
    candidate = `data/public-releases/candidates/public-release-${stamp}-${String(
      index,
    ).padStart(3, "0")}.json`;
    index += 1;
  } while (existsSync(candidate));
  return candidate;
}

function value(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index < 0 ? undefined : process.argv[index + 1];
}

function required(name: string): string {
  const found = value(name);
  if (!found) throw Error(`Missing ${name}`);
  return found;
}

function must(command: string, args: string[]): void {
  const result = spawnSync(command, args, { stdio: "inherit", encoding: "utf8" });
  if (result.status !== 0) throw Error(`${command} failed`);
}

function withManifest(manifest: string, args: string[]): void {
  const result = spawnSync(args[0], args.slice(1), {
    stdio: "inherit",
    encoding: "utf8",
    env: {
      ...process.env,
      UAPT_PUBLIC_RELEASE_MANIFEST: manifest,
    },
  });
  if (result.status !== 0) throw Error(`${args[0]} failed for candidate`);
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

void main();
