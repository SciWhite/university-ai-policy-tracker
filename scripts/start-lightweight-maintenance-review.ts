import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import {
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

type QueueItem = {
  entitySlug: string;
  itemId: string;
  sourceUrl: string;
};

type Options = {
  dryRun: boolean;
  fallbackModel?: string;
  maintenanceRoot: string;
  maxConcurrency: number;
  model: string;
  queue?: string;
  repo: string;
  retryAttempts: number;
  retryFailedOnly: boolean;
  retryBaseMs: number;
  runId: string;
  targets: QueueItem[];
  thinking: string;
  timeoutSeconds: number;
};

const DEFAULT_ROOT = "/home/openclaw/workspace/staging/uapt-maintenance";
const TRANSIENT_PATTERN = "429|5[0-9]{2}|timeout|temporar|gateway|rate limit";

function main(): void {
  const options = parseArgs(process.argv.slice(2));
  const runRoot = path.join(options.maintenanceRoot, options.runId);
  const prompts = path.join(runRoot, "prompts");
  const logs = path.join(runRoot, "logs");
  const notes = path.join(runRoot, "notes");

  const queue = options.queue ? readQueue(options.queue) : options.targets;
  const targets = options.retryFailedOnly
    ? queue.filter((item) => priorFailure(logs, item.itemId))
    : queue;

  if (!targets.length) {
    console.log("No eligible lightweight review targets.");
    return;
  }

  const active = options.dryRun ? 0 : activeReviewUnitCount();
  const availableSlots = Math.max(0, options.maxConcurrency - active);
  const batch = options.dryRun ? targets : targets.slice(0, availableSlots);

  if (!batch.length) {
    console.log(
      `No review started: ${active} active uapt-light-review unit(s), maxConcurrency=${options.maxConcurrency}.`,
    );
    return;
  }

  if (!options.dryRun) {
    ensureDir(prompts);
    ensureDir(logs);
    ensureDir(notes);
  }

  for (const target of batch) {
    startTarget(options, runRoot, target);
  }

  if (!options.dryRun && batch.length < targets.length) {
    console.log(
      `Started ${batch.length} review(s); ${targets.length - batch.length} queued item(s) left for a later launcher run.`,
    );
  }
}

function startTarget(
  options: Options,
  runRoot: string,
  target: QueueItem,
): void {
  const safeRunId = sanitize(options.runId);
  const safeItemId = sanitize(target.itemId);
  const promptFile = path.join(runRoot, "prompts", `${safeItemId}.md`);
  const logFile = path.join(runRoot, "logs", `${safeItemId}.log`);
  const noteFile = path.join(runRoot, "notes", `${safeItemId}.md`);
  const artifactDir = path.join(
    options.repo,
    "staging",
    "uapt-runs",
    `uapt-maintenance-light-${safeRunId}-${safeItemId}`,
  );
  const sessionId = `uapt-${safeRunId}-${safeItemId}`.slice(0, 120);
  const unit = `uapt-light-review-${safeRunId.slice(0, 40)}-${safeItemId.slice(0, 80)}`;

  if (!options.dryRun) {
    writeOwnedFile(
      promptFile,
      prompt(target, artifactDir, noteFile, options),
      "664",
    );
  }

  const command = retryCommand({
    ...options,
    artifactDir,
    logFile,
    noteFile,
    promptFile,
    sessionId,
  });
  const args = [
    "systemd-run",
    `--unit=${unit}`,
    `--description=UAPT lightweight review ${target.entitySlug}`,
    "--uid=openclaw",
    "--setenv=HOME=/home/openclaw",
    `--working-directory=${options.repo}`,
    "/usr/bin/bash",
    "-lc",
    command,
  ];

  if (options.dryRun) {
    console.log(
      JSON.stringify(
        {
          itemId: target.itemId,
          model: options.model,
          fallbackModel: options.fallbackModel,
          retries: options.retryAttempts,
          sessionId,
          timeoutSeconds: options.timeoutSeconds,
          unit,
          command: `sudo ${args.map(quote).join(" ")}`,
        },
        null,
        2,
      ),
    );
    return;
  }

  run("sudo", args);
  console.log(`started ${target.itemId} -> ${logFile}`);
}

function retryCommand(
  input: Options & {
    artifactDir: string;
    logFile: string;
    noteFile: string;
    promptFile: string;
    sessionId: string;
  },
): string {
  const models = unique([input.model, input.fallbackModel].filter(isString));
  const modelList = models.map(quote).join(" ");
  const retryBaseSeconds = Math.max(1, Math.round(input.retryBaseMs / 1000));

  return [
    "set -euo pipefail",
    `prompt=$(cat ${quote(input.promptFile)})`,
    `: > ${quote(input.logFile)}`,
    `for model in ${modelList}; do`,
    `  for attempt in $(seq 1 ${input.retryAttempts}); do`,
    `    echo "model=$model attempt=$attempt session=${input.sessionId}" >> ${quote(input.logFile)}`,
    `    if timeout --kill-after=30s ${input.timeoutSeconds}s openclaw agent --agent crawl-worker --model "$model" --session-id ${quote(input.sessionId)} --message "$prompt" --thinking ${quote(input.thinking)} --timeout ${input.timeoutSeconds} --json >> ${quote(input.logFile)} 2>&1; then`,
    "      exit 0",
    "    fi",
    "    code=$?",
    `    if [ -s ${quote(input.noteFile)} ] || [ -s ${quote(path.join(input.artifactDir, "artifacts.json"))} ]; then echo "model=$model attempt=$attempt result_written_after_nonzero_exit=$code" >> ${quote(input.logFile)}; exit 0; fi`,
    `    if tail -n 24 ${quote(input.logFile)} | grep -Eqi ${quote(TRANSIENT_PATTERN)}; then klass=transient; else klass=permanent; fi`,
    `    echo "model=$model attempt=$attempt error_class=$klass exit=$code" >> ${quote(input.logFile)}`,
    '    [ "$klass" = transient ] || break',
    `    if [ "$attempt" -lt ${input.retryAttempts} ]; then sleep_seconds=$(( ${retryBaseSeconds} * (2 ** (attempt - 1)) + RANDOM % 2 )); sleep "$sleep_seconds"; fi`,
    "  done",
    "done",
    "exit 1",
  ].join("\n");
}

function prompt(
  target: QueueItem,
  artifactDir: string,
  noteFile: string,
  options: Options,
): string {
  return [
    "You are conducting one lightweight University AI Policy Tracker review.",
    "Do NOT invoke policy-manager/full workflow, write production DB, push main, deploy, publish canonical claims, bypass access controls, or store raw HTML/PDF/screenshots/browser data/secrets.",
    "",
    `Run ${options.runId}; source item ${target.itemId}; entity ${target.entitySlug}; URL ${target.sourceUrl}.`,
    "",
    "First compare against the current repository public data and the latest source-health signal. Only a genuine policy-content update may create a publishable artifact bundle.",
    "",
    `If there is a genuine update, create ${artifactDir}/artifacts.json as valid openclaw-artifact-v1. It MUST contain crawl_plan, source_candidate, source_discovery_trace, fetch_attempt, source_snapshot, claim_candidate, evidence_candidate, review_decision, report_draft; top-level runPurpose is claim_evidence_release (or omitted), reviewState is agent_reviewed or needs_review, publishAsCanonical/isCanonical are false. Run pnpm validate:openclaw-artifacts ${artifactDir}.`,
    "",
    `For no change, blocked/inconclusive access, metadata/chrome/hash-only change, or invalid bundle: write only a concise note to ${noteFile}; do not create an artifact run. Never infer an update from HTTP/robots/Firecrawl failure alone.`,
  ].join("\n");
}

function parseArgs(args: string[]): Options {
  const options: Options = {
    dryRun: false,
    fallbackModel: process.env.UAPT_MAINTENANCE_FALLBACK_MODEL,
    maintenanceRoot: process.env.UAPT_MAINTENANCE_ROOT ?? DEFAULT_ROOT,
    maxConcurrency: 1,
    model: process.env.UAPT_MAINTENANCE_MODEL ?? "nvidia/z-ai/glm-5.2",
    queue: undefined,
    repo: process.cwd(),
    retryAttempts: Number(process.env.UAPT_MAINTENANCE_RETRY_ATTEMPTS ?? 3),
    retryBaseMs: Number(process.env.UAPT_MAINTENANCE_RETRY_BASE_MS ?? 1500),
    retryFailedOnly: false,
    runId: "",
    targets: [],
    thinking: "medium",
    timeoutSeconds: 2400,
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--") continue;

    const value = (): string => {
      const next = args[index + 1];
      if (!next) throw Error(`Missing value for ${arg}`);
      index += 1;
      return next;
    };

    if (arg === "--run-id") options.runId = value();
    else if (arg === "--queue") options.queue = value();
    else if (arg === "--target") options.targets.push(parseTarget(value()));
    else if (arg === "--model") options.model = value();
    else if (arg === "--fallback-model") options.fallbackModel = value();
    else if (arg === "--max-concurrency") options.maxConcurrency = Number(value());
    else if (arg === "--retry-attempts") options.retryAttempts = Number(value());
    else if (arg === "--retry-base-ms") options.retryBaseMs = Number(value());
    else if (arg === "--retry-failed-only") options.retryFailedOnly = true;
    else if (arg === "--timeout") options.timeoutSeconds = Number(value());
    else if (arg === "--maintenance-root") options.maintenanceRoot = value();
    else if (arg === "--repo") options.repo = path.resolve(value());
    else if (arg === "--thinking") options.thinking = value();
    else if (arg === "--dry-run") options.dryRun = true;
    else throw Error(`Unknown argument ${arg}`);
  }

  if (!options.runId || (!options.queue && !options.targets.length)) {
    throw Error("Require --run-id plus --queue or --target");
  }
  if (
    !Number.isInteger(options.retryAttempts) ||
    options.retryAttempts < 1 ||
    !Number.isFinite(options.retryBaseMs) ||
    options.retryBaseMs <= 0 ||
    !Number.isFinite(options.timeoutSeconds) ||
    options.timeoutSeconds <= 0 ||
    !Number.isInteger(options.maxConcurrency) ||
    options.maxConcurrency < 1
  ) {
    throw Error("Invalid numeric option");
  }

  return options;
}

function parseTarget(value: string): QueueItem {
  const separator = value.indexOf("=");
  if (separator <= 0 || separator === value.length - 1) {
    throw Error("--target must be formatted as entitySlug=https://source.url");
  }
  const entitySlug = value.slice(0, separator);
  const sourceUrl = value.slice(separator + 1);
  if (!/^https?:\/\//.test(sourceUrl)) {
    throw Error("--target URL must start with http:// or https://");
  }
  return {
    entitySlug,
    itemId: `${entitySlug}-${hash(sourceUrl)}`,
    sourceUrl,
  };
}

function readQueue(file: string): QueueItem[] {
  const parsed = JSON.parse(readFileSync(file, "utf8"));
  const rows = Array.isArray(parsed) ? parsed : parsed.items;
  if (!Array.isArray(rows)) throw Error("Queue must contain an items array");

  const invalid: number[] = [];
  const items = rows.map((row: Record<string, unknown>, index: number) => {
    const entitySlug = stringValue(row.entitySlug);
    const itemId = stringValue(row.itemId);
    const sourceUrl = stringValue(row.sourceUrl);
    if (!entitySlug || !itemId || !sourceUrl || !/^https?:\/\//.test(sourceUrl)) {
      invalid.push(index);
    }
    return { entitySlug, itemId, sourceUrl };
  });

  if (invalid.length) {
    throw Error(`Queue contains invalid item(s) at index: ${invalid.join(", ")}`);
  }

  return items;
}

function priorFailure(logs: string, id: string): boolean {
  try {
    return /error_class=|exit=|timeout/i.test(
      readFileSync(path.join(logs, `${sanitize(id)}.log`), "utf8"),
    );
  } catch {
    return false;
  }
}

function activeReviewUnitCount(): number {
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
  if (result.status !== 0) return 0;
  return result.stdout
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean).length;
}

function ensureDir(directory: string): void {
  try {
    mkdirSync(directory, { recursive: true });
  } catch (error) {
    if (!isPermissionError(error)) throw error;
    run("sudo", ["install", "-d", "-o", "openclaw", "-g", "openclaw", "-m", "775", directory]);
  }
}

function writeOwnedFile(file: string, content: string, mode: string): void {
  try {
    writeFileSync(file, content, "utf8");
  } catch (error) {
    if (!isPermissionError(error)) throw error;
    const tempFile = path.join(
      tmpdir(),
      `uapt-maintenance-${process.pid}-${path.basename(file)}`,
    );
    writeFileSync(tempFile, content, "utf8");
    try {
      run("sudo", [
        "install",
        "-o",
        "openclaw",
        "-g",
        "openclaw",
        "-m",
        mode,
        tempFile,
        file,
      ]);
    } finally {
      rmSync(tempFile, { force: true });
    }
  }
}

function isPermissionError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as NodeJS.ErrnoException).code === "EACCES"
  );
}

function hash(value: string): string {
  return createHash("sha256").update(value).digest("hex").slice(0, 12);
}

function sanitize(value: string): string {
  return value.replace(/[^a-zA-Z0-9-]/g, "-").replace(/-+/g, "-");
}

function quote(value: string): string {
  return `'${value.replaceAll("'", "'\\''")}'`;
}

function run(command: string, args: string[]): void {
  const result = spawnSync(command, args, { encoding: "utf8" });
  if (result.status !== 0) {
    throw Error(`${command} failed: ${(result.stderr || result.stdout || "").trim()}`);
  }
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function isString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

main();
