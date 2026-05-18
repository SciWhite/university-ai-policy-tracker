import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { PublicEntitySummary } from "@uapt/shared";
import { getStagedPublicDataset } from "../apps/web/lib/staged-public-data";

type TargetMode = "all" | "qs200" | "weekly-other";
type Stage1Status =
  | "baseline_recorded"
  | "blocked_or_inconclusive"
  | "changed_hash"
  | "firecrawl_failed"
  | "firecrawl_opened_no_content"
  | "firecrawl_verified_changed"
  | "http_failed"
  | "metadata_changed"
  | "needs_firecrawl_verification"
  | "needs_openclaw"
  | "not_scanned"
  | "repair_queue"
  | "suspected_policy_update"
  | "unchanged";

interface CliOptions {
  dryRun: boolean;
  enableFirecrawl: boolean;
  firecrawlLimit: number;
  limit?: number;
  maxBytes: number;
  mode: TargetMode;
  outputDir: string;
  shardCount: number;
  shardIndex: number;
  stateFile: string;
  timeoutMs: number;
}

interface SourceStateRecord {
  checkedAt: string;
  contentHash?: string;
  etag?: string;
  finalUrl?: string;
  lastModified?: string;
  title?: string;
}

interface MaintenanceState {
  records: Record<string, SourceStateRecord>;
  schemaVersion: "uapt-maintenance-source-state-v1";
  updatedAt: string;
}

interface MaintenanceTarget {
  entityName: string;
  entitySlug: string;
  qsRank?: number;
  sourceTitle: string;
  sourceUrl: string;
  previousSnapshotHash: string;
  previousFinalUrl?: string;
}

interface HttpResult {
  accessStatus: "blocked" | "failed" | "ok";
  contentHash?: string;
  contentLength?: string;
  contentType?: string;
  error?: string;
  etag?: string;
  finalUrl?: string;
  httpStatus?: number;
  lastModified?: string;
  readable: boolean;
  title?: string;
}

interface MaintenanceRow {
  accessStatus?: HttpResult["accessStatus"];
  checkedAt: string;
  contentHash?: string;
  contentLength?: string;
  contentType?: string;
  entityName: string;
  entitySlug: string;
  error?: string;
  etag?: string;
  finalUrl?: string;
  firecrawlAttempted: boolean;
  httpStatus?: number;
  lastModified?: string;
  previousFinalUrl?: string;
  previousMaintenanceHash?: string;
  previousSnapshotHash: string;
  qsRank?: number;
  recommendedAction: string;
  sourceTitle: string;
  sourceUrl: string;
  status: Stage1Status;
  title?: string;
}

interface MaintenanceReport {
  caveats: string[];
  generatedAt: string;
  mode: TargetMode;
  options: {
    dryRun: boolean;
    enableFirecrawl: boolean;
    firecrawlLimit: number;
    limit?: number;
    shardCount: number;
    shardIndex: number;
  };
  rows: MaintenanceRow[];
  runId: string;
  summary: Record<string, number>;
  targetCount: number;
}

const DEFAULT_OUTPUT_DIR = ".local/maintenance-runs";
const DEFAULT_STATE_FILE = ".local/maintenance-state/source-hashes.json";
const FIRECRAWL_ENDPOINT = "https://api.firecrawl.dev/v2/scrape";
const POLICY_SIGNAL_PATTERN =
  /\b(ai|artificial intelligence|generative ai|genai|chatgpt|copilot|deepseek|academic integrity|student conduct|assessment|exam|coursework|syllabus)\b/i;

void main();

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const generatedAt = new Date().toISOString();
  const runId = `maintenance-${generatedAt.replace(/[:.]/g, "-")}`;
  const dataset = await getStagedPublicDataset();
  const state = await readState(options.stateFile);
  const targets = selectTargets(dataset.publicSummaries, dataset.catalogUniversities, options);
  const rows: MaintenanceRow[] = [];
  let firecrawlAttempts = 0;

  for (const target of targets) {
    const checkedAt = new Date().toISOString();
    const key = stateKey(target);
    const previous = state.records[key];

    if (options.dryRun) {
      rows.push({
        checkedAt,
        entityName: target.entityName,
        entitySlug: target.entitySlug,
        firecrawlAttempted: false,
        previousFinalUrl: previous?.finalUrl ?? target.previousFinalUrl,
        previousMaintenanceHash: previous?.contentHash,
        previousSnapshotHash: target.previousSnapshotHash,
        qsRank: target.qsRank,
        recommendedAction: "Dry run only; no HTTP, Firecrawl, or OpenClaw action.",
        sourceTitle: target.sourceTitle,
        sourceUrl: target.sourceUrl,
        status: "not_scanned"
      });
      continue;
    }

    const http = await fetchHttpMetadata(target, options);
    let row = classifyHttpResult(target, http, previous, checkedAt);

    if (
      row.status === "needs_firecrawl_verification" &&
      options.enableFirecrawl &&
      firecrawlAttempts < options.firecrawlLimit
    ) {
      firecrawlAttempts += 1;
      row = await verifyWithFirecrawl(target, row, previous, options);
    }

    rows.push(row);
    updateStateFromRow(state, row);
  }

  if (!options.dryRun) {
    state.updatedAt = new Date().toISOString();
    await writeJson(options.stateFile, state);
  }

  const report: MaintenanceReport = {
    caveats: [
      "Maintenance metadata is not claim evidence.",
      "HTTP failure, blocked responses, and Firecrawl failure do not prove policy change.",
      "Firecrawl verification does not upgrade review state or source officialness.",
      "No raw source text, HTML, PDF text, screenshots, or credentials are written by this scanner."
    ],
    generatedAt,
    mode: options.mode,
    options: {
      dryRun: options.dryRun,
      enableFirecrawl: options.enableFirecrawl,
      firecrawlLimit: options.firecrawlLimit,
      limit: options.limit,
      shardCount: options.shardCount,
      shardIndex: options.shardIndex
    },
    rows,
    runId,
    summary: summarize(rows),
    targetCount: targets.length
  };

  await mkdir(path.join(options.outputDir, runId), { recursive: true });
  await writeJson(path.join(options.outputDir, runId, "source-health.json"), report);
  await writeFile(
    path.join(options.outputDir, runId, "summary.md"),
    renderMarkdown(report),
    "utf8"
  );

  console.log(`Maintenance scan ${runId}`);
  console.log(`Targets: ${targets.length}`);
  console.log(`Summary: ${JSON.stringify(report.summary)}`);
  console.log(`Output: ${path.join(options.outputDir, runId)}`);
}

function parseArgs(args: string[]): CliOptions {
  const values = new Map<string, string>();
  const flags = new Set<string>();

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (!arg.startsWith("--")) continue;
    const [rawKey, rawValue] = arg.slice(2).split("=", 2);
    if (rawValue !== undefined) {
      values.set(rawKey, rawValue);
    } else if (args[index + 1] && !args[index + 1].startsWith("--")) {
      values.set(rawKey, args[index + 1]);
      index += 1;
    } else {
      flags.add(rawKey);
    }
  }

  const mode = parseMode(values.get("mode") ?? values.get("target") ?? "qs200");
  const shardCount = parsePositiveInteger(values.get("shard-count"), 7);
  const shardIndex = parseNonNegativeInteger(values.get("shard-index"), 0);

  if (shardIndex >= shardCount) {
    throw new Error("--shard-index must be lower than --shard-count");
  }

  return {
    dryRun: flags.has("dry-run"),
    enableFirecrawl: flags.has("enable-firecrawl"),
    firecrawlLimit: parseNonNegativeInteger(values.get("firecrawl-limit"), 100),
    limit: values.has("limit")
      ? parseNonNegativeInteger(values.get("limit"), 0)
      : undefined,
    maxBytes: parsePositiveInteger(values.get("max-bytes"), 1_000_000),
    mode,
    outputDir: values.get("output-dir") ?? DEFAULT_OUTPUT_DIR,
    shardCount,
    shardIndex,
    stateFile: values.get("state-file") ?? DEFAULT_STATE_FILE,
    timeoutMs: parsePositiveInteger(values.get("timeout-ms"), 15_000)
  };
}

function parseMode(value: string): TargetMode {
  if (value === "all" || value === "qs200" || value === "weekly-other") {
    return value;
  }
  throw new Error(`Unsupported --mode: ${value}`);
}

function parsePositiveInteger(value: string | undefined, fallback: number): number {
  const parsed = value === undefined ? fallback : Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`Expected a positive integer, got: ${value}`);
  }
  return parsed;
}

function parseNonNegativeInteger(
  value: string | undefined,
  fallback: number
): number {
  const parsed = value === undefined ? fallback : Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(`Expected a non-negative integer, got: ${value}`);
  }
  return parsed;
}

function selectTargets(
  summaries: PublicEntitySummary[],
  catalogUniversities: Awaited<ReturnType<typeof getStagedPublicDataset>>["catalogUniversities"],
  options: CliOptions
): MaintenanceTarget[] {
  const qsRankBySlug = new Map<string, number>();

  for (const university of catalogUniversities) {
    const qsRank = university.rankings.find(
      (ranking) =>
        ranking.systemId === "qs" &&
        ranking.rankingYear === 2026 &&
        ranking.rankNumber <= 200
    )?.rankNumber;

    if (qsRank) qsRankBySlug.set(university.slug, qsRank);
  }

  const selectedSummaries = summaries
    .filter((summary) => {
      const isQsTop200 = qsRankBySlug.has(summary.entity.slug);
      if (options.mode === "qs200") return isQsTop200;
      if (options.mode === "weekly-other") return !isQsTop200;
      return true;
    })
    .sort((left, right) => {
      const leftRank = qsRankBySlug.get(left.entity.slug) ?? Number.MAX_SAFE_INTEGER;
      const rightRank = qsRankBySlug.get(right.entity.slug) ?? Number.MAX_SAFE_INTEGER;
      return leftRank - rightRank || left.entity.slug.localeCompare(right.entity.slug);
    });

  const sharded =
    options.mode === "weekly-other"
      ? selectedSummaries.filter(
          (_, index) => index % options.shardCount === options.shardIndex
        )
      : selectedSummaries;

  const targets = sharded.flatMap((summary) =>
    dedupeSources(summary).map((source) => ({
      entityName: summary.entity.name,
      entitySlug: summary.entity.slug,
      previousFinalUrl: source.finalUrl,
      previousSnapshotHash: source.snapshotHash,
      qsRank: qsRankBySlug.get(summary.entity.slug),
      sourceTitle: source.citationTitle,
      sourceUrl: source.sourceUrl
    }))
  );

  return options.limit === undefined ? targets : targets.slice(0, options.limit);
}

function dedupeSources(summary: PublicEntitySummary) {
  const byUrl = new Map<string, (typeof summary.officialSources)[number]>();
  for (const source of summary.officialSources) {
    if (!byUrl.has(source.sourceUrl)) byUrl.set(source.sourceUrl, source);
  }
  return Array.from(byUrl.values()).sort((left, right) =>
    left.sourceUrl.localeCompare(right.sourceUrl)
  );
}

async function fetchHttpMetadata(
  target: MaintenanceTarget,
  options: CliOptions
): Promise<HttpResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs);

  try {
    const response = await fetch(target.sourceUrl, {
      headers: {
        Accept: "text/html,application/xhtml+xml,text/plain,application/xml;q=0.9,*/*;q=0.5",
        "User-Agent": "UniversityAIPolicyTrackerBot/0.1 (+https://eduaipolicy.org/methodology)"
      },
      redirect: "follow",
      signal: controller.signal
    });
    const contentType = response.headers.get("content-type") ?? undefined;
    const text = response.ok ? await readLimitedText(response, options.maxBytes) : "";
    const normalized = normalizeSourceText(text, contentType);
    const contentHash = normalized ? sha256(normalized) : undefined;

    return {
      accessStatus: response.ok ? "ok" : isBlockedStatus(response.status) ? "blocked" : "failed",
      contentHash,
      contentLength: response.headers.get("content-length") ?? undefined,
      contentType,
      etag: response.headers.get("etag") ?? undefined,
      finalUrl: response.url,
      httpStatus: response.status,
      lastModified: response.headers.get("last-modified") ?? undefined,
      readable: Boolean(contentHash),
      title: extractTitle(text)
    };
  } catch (error) {
    return {
      accessStatus: "failed",
      error: error instanceof Error ? error.message : String(error),
      readable: false
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function readLimitedText(response: Response, maxBytes: number): Promise<string> {
  if (!response.body) return "";
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;

  for (;;) {
    const { done, value } = await reader.read();
    if (done || !value) break;
    chunks.push(value);
    total += value.byteLength;
    if (total >= maxBytes) {
      await reader.cancel();
      break;
    }
  }

  return new TextDecoder("utf8", { fatal: false }).decode(Buffer.concat(chunks));
}

function classifyHttpResult(
  target: MaintenanceTarget,
  http: HttpResult,
  previous: SourceStateRecord | undefined,
  checkedAt: string
): MaintenanceRow {
  const base = {
    accessStatus: http.accessStatus,
    checkedAt,
    contentHash: http.contentHash,
    contentLength: http.contentLength,
    contentType: http.contentType,
    entityName: target.entityName,
    entitySlug: target.entitySlug,
    error: http.error,
    etag: http.etag,
    finalUrl: http.finalUrl,
    firecrawlAttempted: false,
    httpStatus: http.httpStatus,
    lastModified: http.lastModified,
    previousFinalUrl: previous?.finalUrl ?? target.previousFinalUrl,
    previousMaintenanceHash: previous?.contentHash,
    previousSnapshotHash: target.previousSnapshotHash,
    qsRank: target.qsRank,
    sourceTitle: target.sourceTitle,
    sourceUrl: target.sourceUrl,
    title: http.title
  };

  if (http.accessStatus !== "ok") {
    return {
      ...base,
      recommendedAction:
        http.accessStatus === "blocked"
          ? "Record source-health risk. Do not call Firecrawl or OpenClaw unless another metadata signal suggests source change."
          : "Record HTTP failure. Retry in a later maintenance run before escalating.",
      status: http.accessStatus === "blocked" ? "blocked_or_inconclusive" : "http_failed"
    };
  }

  if (!http.readable || !http.contentHash) {
    const hasPriorChangeSignal = Boolean(
      previous &&
        ((http.finalUrl && previous.finalUrl && http.finalUrl !== previous.finalUrl) ||
          (http.etag && previous.etag && http.etag !== previous.etag) ||
          (http.lastModified &&
            previous.lastModified &&
            http.lastModified !== previous.lastModified))
    );

    return {
      ...base,
      recommendedAction: hasPriorChangeSignal
        ? "HTTP metadata changed but content is unreliable; send to Firecrawl verification."
        : "Record inconclusive HTTP read. Do not escalate without a prior change signal.",
      status: hasPriorChangeSignal
        ? "needs_firecrawl_verification"
        : "blocked_or_inconclusive"
    };
  }

  if (!previous?.contentHash) {
    return {
      ...base,
      recommendedAction: "Record first maintenance hash baseline. No OpenClaw action.",
      status: "baseline_recorded"
    };
  }

  if (http.contentHash === previous.contentHash) {
    return {
      ...base,
      recommendedAction: "No action. Maintenance hash unchanged.",
      status: "unchanged"
    };
  }

  const hasPolicySignal = POLICY_SIGNAL_PATTERN.test(`${http.title ?? ""}\n${target.sourceTitle}`);
  return {
    ...base,
    recommendedAction: hasPolicySignal
      ? "Potential policy-relevant source change. Queue one lightweight OpenClaw review."
      : "Content hash changed without a clear policy signal. Keep as metadata change for review.",
    status: hasPolicySignal ? "needs_openclaw" : "metadata_changed"
  };
}

async function verifyWithFirecrawl(
  target: MaintenanceTarget,
  row: MaintenanceRow,
  previous: SourceStateRecord | undefined,
  options: CliOptions
): Promise<MaintenanceRow> {
  const apiKey = process.env.FIRECRAWL_API_KEY;
  if (!apiKey) {
    return {
      ...row,
      recommendedAction:
        "Firecrawl verification requested but FIRECRAWL_API_KEY is not set. Keep in verification queue.",
      status: "needs_firecrawl_verification"
    };
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), options.timeoutMs * 2);
    const response = await fetch(FIRECRAWL_ENDPOINT, {
      body: JSON.stringify({
        formats: ["markdown"],
        onlyMainContent: true,
        url: target.sourceUrl
      }),
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      method: "POST",
      signal: controller.signal
    });
    clearTimeout(timeout);

    if (!response.ok) {
      return {
        ...row,
        firecrawlAttempted: true,
        httpStatus: response.status,
        recommendedAction:
          "Firecrawl failed. Move to repair queue; do not trigger OpenClaw from Firecrawl failure alone.",
        status: "firecrawl_failed"
      };
    }

    const payload = (await response.json()) as {
      data?: { markdown?: string; metadata?: { title?: string; sourceURL?: string } };
    };
    const markdown = payload.data?.markdown ?? "";
    const normalized = normalizeSourceText(markdown, "text/markdown");
    const contentHash = normalized ? sha256(normalized) : undefined;
    const title = payload.data?.metadata?.title ?? row.title;

    if (!contentHash) {
      return {
        ...row,
        firecrawlAttempted: true,
        recommendedAction:
          "Firecrawl opened the source but did not extract meaningful content. Move to repair queue.",
        status: "firecrawl_opened_no_content",
        title
      };
    }

    const changed = previous?.contentHash && previous.contentHash !== contentHash;
    const hasPolicySignal = POLICY_SIGNAL_PATTERN.test(`${title ?? ""}\n${target.sourceTitle}`);

    return {
      ...row,
      contentHash,
      firecrawlAttempted: true,
      recommendedAction:
        changed && hasPolicySignal
          ? "Firecrawl verified changed content with policy signal. Queue one lightweight OpenClaw review."
          : "Firecrawl extracted content, but no policy-change escalation is justified.",
      status: changed && hasPolicySignal ? "needs_openclaw" : "firecrawl_verified_changed",
      title
    };
  } catch (error) {
    return {
      ...row,
      error: error instanceof Error ? error.message : String(error),
      firecrawlAttempted: true,
      recommendedAction:
        "Firecrawl errored. Move to repair queue; do not trigger OpenClaw from this failure alone.",
      status: "firecrawl_failed"
    };
  }
}

function updateStateFromRow(state: MaintenanceState, row: MaintenanceRow): void {
  if (!row.contentHash) return;
  state.records[stateKey(row)] = {
    checkedAt: row.checkedAt,
    contentHash: row.contentHash,
    etag: row.etag,
    finalUrl: row.finalUrl,
    lastModified: row.lastModified,
    title: row.title
  };
}

async function readState(file: string): Promise<MaintenanceState> {
  try {
    const parsed = JSON.parse(await readFile(file, "utf8")) as MaintenanceState;
    if (parsed.schemaVersion === "uapt-maintenance-source-state-v1") return parsed;
  } catch {
    // Missing state is expected for the first run.
  }

  return {
    records: {},
    schemaVersion: "uapt-maintenance-source-state-v1",
    updatedAt: new Date(0).toISOString()
  };
}

async function writeJson(file: string, value: unknown): Promise<void> {
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function summarize(rows: MaintenanceRow[]): Record<string, number> {
  const summary: Record<string, number> = {
    blocked_or_inconclusive: 0,
    changed_hash: 0,
    firecrawl_verified_changed: 0,
    http_failed: 0,
    needs_openclaw: 0,
    scanned: rows.length,
    suspected_changed: 0,
    unchanged: 0
  };

  for (const row of rows) {
    summary[row.status] = (summary[row.status] ?? 0) + 1;
    if (row.status === "needs_openclaw" || row.status === "suspected_policy_update") {
      summary.suspected_changed += 1;
    }
  }

  return summary;
}

function renderMarkdown(report: MaintenanceReport): string {
  const lines = [
    `# Maintenance Scan ${report.runId}`,
    "",
    `Generated at: ${report.generatedAt}`,
    `Mode: ${report.mode}`,
    `Targets: ${report.targetCount}`,
    "",
    "## Summary",
    "",
    "| Status | Count |",
    "| --- | ---: |",
    ...Object.entries(report.summary)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([status, count]) => `| \`${status}\` | ${count} |`),
    "",
    "## Queues",
    "",
    `Needs Firecrawl verification: ${countStatus(report.rows, "needs_firecrawl_verification")}`,
    `Needs OpenClaw lightweight review: ${countStatus(report.rows, "needs_openclaw")}`,
    "",
    "## Caveats",
    "",
    ...report.caveats.map((caveat) => `- ${caveat}`),
    "",
    "## Changed Or Queued Rows",
    "",
    "| Entity | Source | Status | Recommended action |",
    "| --- | --- | --- | --- |",
    ...report.rows
      .filter((row) => row.status !== "unchanged" && row.status !== "not_scanned")
      .slice(0, 100)
      .map(
        (row) =>
          `| ${escapeTable(row.entitySlug)} | ${escapeTable(row.sourceUrl)} | \`${row.status}\` | ${escapeTable(row.recommendedAction)} |`
      )
  ];

  return `${lines.join("\n")}\n`;
}

function countStatus(rows: MaintenanceRow[], status: Stage1Status): number {
  return rows.filter((row) => row.status === status).length;
}

function escapeTable(value: string): string {
  return value.replaceAll("|", "\\|").replace(/\s+/g, " ").trim();
}

function stateKey(value: { entitySlug: string; sourceUrl: string }): string {
  return `${value.entitySlug}\u0000${value.sourceUrl}`;
}

function normalizeSourceText(value: string, contentType: string | undefined): string {
  if (!value || /image|audio|video/i.test(contentType ?? "")) return "";

  const withoutScripts = value
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return withoutScripts.length >= 80 ? withoutScripts : "";
}

function extractTitle(value: string): string | undefined {
  const title = value.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1];
  return title?.replace(/\s+/g, " ").trim();
}

function isBlockedStatus(status: number): boolean {
  return status === 401 || status === 403 || status === 407 || status === 429;
}

function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}
