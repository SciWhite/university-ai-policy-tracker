import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

interface Target {
  slug: string;
  url: string;
}

interface Options {
  agent: string;
  artifactDate: string;
  dryRun: boolean;
  maintenanceRoot: string;
  repo: string;
  runId: string;
  targets: Target[];
  thinking: string;
  timeoutSeconds: number;
}

const DEFAULT_MAINTENANCE_ROOT =
  "/home/openclaw/workspace/staging/uapt-maintenance";

function main() {
  const options = parseArgs(process.argv.slice(2));
  const runRoot = path.join(options.maintenanceRoot, options.runId);
  const promptDir = path.join(runRoot, "prompts");
  const logDir = path.join(runRoot, "logs");
  const notesDir = path.join(runRoot, "notes");

  ensureDir(promptDir, options.dryRun);
  ensureDir(logDir, options.dryRun);
  ensureDir(notesDir, options.dryRun);

  for (const target of options.targets) {
    const unit = `uapt-light-review-${sanitizeId(target.slug)}`;
    const sessionId = `${sanitizeId(options.runId)}-light-${sanitizeId(target.slug)}`;
    const promptFile = path.join(promptDir, `${target.slug}.md`);
    const logFile = path.join(logDir, `${target.slug}.log`);
    const noteFile = path.join(notesDir, `${target.slug}.md`);
    const artifactDir = path.join(
      options.repo,
      "staging",
      "uapt-runs",
      `uapt-maintenance-light-${target.slug}-${options.artifactDate}`
    );
    const prompt = buildPrompt({
      artifactDir,
      noteFile,
      options,
      target
    });

    writeOwnedFile(promptFile, prompt, options.dryRun);

    const command = [
      "openclaw",
      "agent",
      "--agent",
      shellQuote(options.agent),
      "--session-id",
      shellQuote(sessionId),
      "--message",
      `"$(cat ${shellQuote(promptFile)})"`,
      "--thinking",
      shellQuote(options.thinking),
      "--timeout",
      String(options.timeoutSeconds),
      "--json",
      ">",
      shellQuote(logFile),
      "2>&1"
    ].join(" ");

    const args = [
      "systemd-run",
      `--unit=${unit}`,
      `--description=UAPT lightweight OpenClaw maintenance review ${target.slug}`,
      "--uid=openclaw",
      "--setenv=HOME=/home/openclaw",
      `--working-directory=${options.repo}`,
      "/usr/bin/bash",
      "-lc",
      command
    ];

    if (options.dryRun) {
      console.log(
        [
          `target=${target.slug}`,
          `unit=${unit}`,
          `session=${sessionId}`,
          `prompt=${promptFile}`,
          `log=${logFile}`,
          `note=${noteFile}`,
          `artifactDir=${artifactDir}`,
          `command=sudo ${args.map(shellQuote).join(" ")}`
        ].join("\n")
      );
      console.log("");
      continue;
    }

    run("sudo", args);
    console.log(
      `${unit} | ${sessionId} | note=${noteFile} | artifacts=${artifactDir} | log=${logFile}`
    );
  }
}

function buildPrompt(input: {
  artifactDir: string;
  noteFile: string;
  options: Options;
  target: Target;
}) {
  const { artifactDir, noteFile, options, target } = input;

  return `You are running a lightweight University AI Policy Tracker maintenance review for one source only.

Do NOT call policy-manager. Do NOT run the full crawl-designer to crawl-worker to policy-extractor to policy-reviewer to report-writer pipeline. Do NOT write production DB, push main, publish canonical claims, bypass robots/login/paywall, or treat source-health metadata as claim evidence.

Repository: ${options.repo}
Maintenance run: ${options.runId}
Target entity slug: ${target.slug}
Target source URL: ${target.url}
No-change note path: ${noteFile}
Artifact output directory, only if there is a real policy-content update: ${artifactDir}
Run purpose: source_health_maintenance review, not public release

Task:
1. Refresh repo main with git pull --ff-only if needed.
2. Inspect the existing public/staged data for this entity and source URL.
3. Read only this public official source URL, using compliant HTTP/browser-like access if normally public. Do not bypass access controls.
4. Decide whether the maintenance signal reflects a real policy-content update, source relocation, or only metadata/chrome/noise.
5. If there is no clear policy-content update, write a concise maintenance note only to ${noteFile}. Do not create ${artifactDir}. Do not create any directory under staging/uapt-runs/.
6. If there is a clear policy-content update or source repair candidate, create the smallest valid openclaw-artifact-v1 staged artifact bundle in ${artifactDir}. Include source lineage, short original-language evidence snippets only, claim/evidence candidates only when supported by the source, and review decisions as openclaw_agent/agent_reviewed or needs_review as appropriate.
7. Run pnpm validate:openclaw-artifacts "${artifactDir}" only if artifacts are written. If validation cannot pass, leave a clear blocker note in ${noteFile}.

Keep raw HTML, full PDF text, screenshots, secrets, and long source text out of artifacts. Original-language evidence snippets are canonical; translations may only be helper/display notes.
`;
}

function parseArgs(args: string[]): Options {
  const options: Options = {
    agent: "crawl-worker",
    artifactDate: toDateStamp(new Date()),
    dryRun: false,
    maintenanceRoot: DEFAULT_MAINTENANCE_ROOT,
    repo: process.cwd(),
    runId: "",
    targets: [],
    thinking: "medium",
    timeoutSeconds: 2400
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    const next = () => {
      const value = args[index + 1];
      if (!value) {
        throw new Error(`Missing value for ${arg}`);
      }
      index += 1;
      return value;
    };

    if (arg === "--agent") {
      options.agent = next();
    } else if (arg === "--artifact-date") {
      options.artifactDate = next();
    } else if (arg === "--dry-run") {
      options.dryRun = true;
    } else if (arg === "--maintenance-root") {
      options.maintenanceRoot = next();
    } else if (arg === "--repo") {
      options.repo = next();
    } else if (arg === "--run-id") {
      options.runId = next();
    } else if (arg === "--target") {
      options.targets.push(parseTarget(next()));
    } else if (arg === "--thinking") {
      options.thinking = next();
    } else if (arg === "--timeout") {
      options.timeoutSeconds = Number(next());
    } else if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  if (!options.runId) {
    throw new Error("Missing required --run-id");
  }

  if (options.targets.length === 0) {
    throw new Error("At least one --target slug=url is required");
  }

  if (!Number.isFinite(options.timeoutSeconds) || options.timeoutSeconds <= 0) {
    throw new Error("--timeout must be a positive number of seconds");
  }

  return options;
}

function parseTarget(value: string): Target {
  const separatorIndex = value.indexOf("=");

  if (separatorIndex <= 0 || separatorIndex === value.length - 1) {
    throw new Error(`Invalid target "${value}". Use --target entity-slug=https://...`);
  }

  const slug = value.slice(0, separatorIndex).trim();
  const url = value.slice(separatorIndex + 1).trim();

  if (!/^[a-z0-9][a-z0-9-]*$/.test(slug)) {
    throw new Error(`Invalid target slug "${slug}"`);
  }

  if (!/^https?:\/\//.test(url)) {
    throw new Error(`Invalid target URL "${url}"`);
  }

  return { slug, url };
}

function ensureDir(dir: string, dryRun: boolean) {
  if (dryRun) {
    return;
  }

  try {
    mkdirSync(dir, { recursive: true });
  } catch (error) {
    if (!isPermissionError(error)) {
      throw error;
    }

    run("sudo", ["install", "-d", "-o", "openclaw", "-g", "openclaw", dir]);
  }
}

function writeOwnedFile(file: string, content: string, dryRun: boolean) {
  if (dryRun) {
    return;
  }

  try {
    writeFileSync(file, content, "utf8");
  } catch (error) {
    if (!isPermissionError(error)) {
      throw error;
    }

    const tmpDir = mkdtempSync(path.join(os.tmpdir(), "uapt-light-review-"));
    const tmpFile = path.join(tmpDir, path.basename(file));

    try {
      writeFileSync(tmpFile, content, "utf8");
      run("sudo", [
        "install",
        "-o",
        "openclaw",
        "-g",
        "openclaw",
        "-m",
        "0644",
        tmpFile,
        file
      ]);
    } finally {
      rmSync(tmpDir, { force: true, recursive: true });
    }
  }
}

function run(command: string, args: string[]) {
  const result = spawnSync(command, args, {
    encoding: "utf8",
    stdio: "pipe"
  });

  if (result.status !== 0) {
    const output = [result.stdout, result.stderr].filter(Boolean).join("\n");
    throw new Error(`${command} ${args.join(" ")} failed\n${output}`);
  }

  const output = [result.stdout, result.stderr].filter(Boolean).join("\n").trim();

  if (output) {
    console.log(output);
  }
}

function shellQuote(value: string) {
  return `'${value.replaceAll("'", "'\\''")}'`;
}

function sanitizeId(value: string) {
  return value.replace(/[^a-zA-Z0-9-]/g, "-").replace(/-+/g, "-");
}

function toDateStamp(date: Date) {
  return [
    date.getUTCFullYear(),
    String(date.getUTCMonth() + 1).padStart(2, "0"),
    String(date.getUTCDate()).padStart(2, "0")
  ].join("");
}

function isPermissionError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "EACCES"
  );
}

function printHelp() {
  console.log(`Start lightweight OpenClaw maintenance reviews.

Usage:
  pnpm maintenance:start-light-review \\
    --run-id maintenance-2026-05-19T05-18-08-939Z \\
    --target maastricht-university=https://example.edu/policy

Options:
  --target slug=url              Repeat for each source/page.
  --run-id id                    Maintenance run id. Required.
  --repo path                    Tracker repo path. Defaults to cwd.
  --maintenance-root path         Defaults to /home/openclaw/workspace/staging/uapt-maintenance.
  --artifact-date YYYYMMDD        Defaults to today's UTC date.
  --agent id                     Defaults to crawl-worker.
  --thinking level               Defaults to medium.
  --timeout seconds              Defaults to 2400.
  --dry-run                      Print units, paths, and commands without writing or starting.
`);
}

main();
