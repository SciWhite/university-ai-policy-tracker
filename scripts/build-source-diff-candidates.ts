import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  OFFICIAL_SOURCE_RIGHTS_CAVEAT,
  TRACKER_METADATA_LICENSE,
  sourceDiffCandidateDocumentSchema,
  type SourceDiffCandidate,
  type SourceDiffClass,
  type SourceDiffHunk,
  type SourceDiffReviewAction
} from "@uapt/shared";

interface CliOptions {
  contextChars: number;
  currentReleaseId?: string;
  diffFile?: string;
  help: boolean;
  limit?: number;
  maxHunks: number;
  minConfidence: number;
  outputDir: string;
  outputRoot: string;
  previousReleaseId?: string;
}

type PrivateDiffStatus =
  | "added"
  | "removed"
  | "unchanged"
  | "normalized_text_changed"
  | "metadata_changed"
  | "metadata_only"
  | "unavailable";

interface PrivateSourceDiffRow {
  currentReleaseId: string;
  entityName: string;
  entitySlug: string;
  newNormalizedTextHash?: string;
  newPublicSnapshotHash?: string;
  oldNormalizedTextHash?: string;
  oldPublicSnapshotHash?: string;
  previousReleaseId: string;
  sourceUrl: string;
  status: PrivateDiffStatus;
  summary: string;
}

interface PrivateSourceDiff {
  currentReleaseId: string;
  previousReleaseId: string;
  rows: PrivateSourceDiffRow[];
  schemaVersion: "uapt-private-source-snapshot-diff-v1";
}

interface PrivateSourceSnapshotRecord {
  citationTitle: string;
  contentType?: string;
  entityName: string;
  entitySlug: string;
  fetchedAt?: string;
  fetchStatus: string;
  finalUrl?: string;
  httpStatus?: number;
  normalizedTextHash?: string;
  normalizedTextPath?: string;
  publicSnapshotHash: string;
  retrievedAt?: string;
  sourceLastModified?: string;
  sourceType?: string;
  sourceUrl: string;
}

interface PrivateSnapshotManifest {
  records: PrivateSourceSnapshotRecord[];
  releaseId: string;
  schemaVersion: "uapt-private-source-snapshot-manifest-v1";
}

const DEFAULT_OUTPUT_ROOT = ".local/source-snapshots";
const DEFAULT_OUTPUT_DIR = ".local/source-diff-candidates";
const DEFAULT_CONTEXT_CHARS = 700;
const DEFAULT_MAX_HUNKS = 4;
const DEFAULT_MIN_CONFIDENCE = 0.72;
const POLICY_SIGNAL_TERMS = [
  "ai",
  "artificial intelligence",
  "generative ai",
  "genai",
  "chatgpt",
  "copilot",
  "deepseek",
  "machine learning",
  "academic integrity",
  "assessment",
  "assignment",
  "coursework",
  "exam",
  "disclosure",
  "acknowledge",
  "privacy",
  "confidential",
  "student work",
  "syllabus",
  "instructor",
  "faculty",
  "permitted",
  "prohibited",
  "allowed"
];

void main();

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    printUsage();
    return;
  }

  const repoRoot = await findRepoRoot();
  const outputRoot = path.resolve(repoRoot, options.outputRoot);
  const diff = await readPrivateDiff(outputRoot, options);
  const previousManifest = await readManifest(outputRoot, diff.previousReleaseId);
  const currentManifest = await readManifest(outputRoot, diff.currentReleaseId);
  const previousByKey = indexRecords(previousManifest.records);
  const currentByKey = indexRecords(currentManifest.records);
  const candidates: SourceDiffCandidate[] = [];

  for (const row of diff.rows) {
    if (row.status === "unchanged") continue;
    const key = sourceKey(row);
    const oldRecord = previousByKey.get(key);
    const newRecord = currentByKey.get(key);
    const candidate = await buildCandidate(row, oldRecord, newRecord, options);
    if (!candidate) continue;
    if (candidate.confidence < options.minConfidence) continue;
    candidates.push(candidate);
    if (options.limit !== undefined && candidates.length >= options.limit) break;
  }

  const generatedAt = new Date().toISOString();
  const document = sourceDiffCandidateDocumentSchema.parse({
    schemaVersion: "uapt-source-diff-candidates-v1",
    generatedAt,
    previousReleaseId: diff.previousReleaseId,
    currentReleaseId: diff.currentReleaseId,
    license: TRACKER_METADATA_LICENSE,
    sourceRightsPolicy: OFFICIAL_SOURCE_RIGHTS_CAVEAT,
    candidates,
    summary: summarize(candidates)
  });
  const outputDir = path.join(
    path.resolve(repoRoot, options.outputDir),
    `${diff.previousReleaseId}__${diff.currentReleaseId}`
  );

  await mkdir(outputDir, { recursive: true });
  await writeJson(path.join(outputDir, "candidates.json"), document);
  await writeFile(path.join(outputDir, "summary.md"), renderMarkdown(document), "utf8");

  console.log(
    JSON.stringify(
      {
        candidates: document.candidates.length,
        currentReleaseId: document.currentReleaseId,
        outputDir: path.relative(repoRoot, outputDir),
        previousReleaseId: document.previousReleaseId,
        summary: document.summary
      },
      null,
      2
    )
  );
}

async function buildCandidate(
  row: PrivateSourceDiffRow,
  oldRecord: PrivateSourceSnapshotRecord | undefined,
  newRecord: PrivateSourceSnapshotRecord | undefined,
  options: CliOptions
): Promise<SourceDiffCandidate | undefined> {
  const oldText = oldRecord?.normalizedTextPath
    ? await readOptionalText(oldRecord.normalizedTextPath)
    : "";
  const newText = newRecord?.normalizedTextPath
    ? await readOptionalText(newRecord.normalizedTextPath)
    : "";
  const hunks = buildPolicyHunks(oldText, newText, options);
  const diffClass = classifyCandidate(row, oldRecord, newRecord, hunks);
  const confidence = scoreCandidate(row, diffClass, hunks);
  const recommendedAction = recommendedActionFor(diffClass);
  const record = newRecord ?? oldRecord;

  if (!record) return undefined;

  return {
    schemaVersion: "uapt-source-diff-candidates-v1",
    candidateId: candidateId(row),
    currentReleaseId: row.currentReleaseId,
    previousReleaseId: row.previousReleaseId,
    entityName: record.entityName,
    entitySlug: record.entitySlug,
    sourceUrl: record.sourceUrl,
    finalUrl: newRecord?.finalUrl ?? oldRecord?.finalUrl,
    sourceTitle: record.citationTitle,
    sourceType: mapSourceType(record.sourceType),
    sourceLastModified: newRecord?.sourceLastModified ?? oldRecord?.sourceLastModified,
    trackerCheckedAt: newRecord?.fetchedAt ?? oldRecord?.fetchedAt,
    oldPublicSnapshotHash: row.oldPublicSnapshotHash,
    newPublicSnapshotHash: row.newPublicSnapshotHash,
    oldNormalizedTextHash: row.oldNormalizedTextHash,
    newNormalizedTextHash: row.newNormalizedTextHash,
    diffClass,
    confidence,
    recommendedAction,
    openClawConcurrencyPolicy: "single_source_no_concurrency",
    hunks,
    limitations: [
      "Source diff candidates are private maintenance metadata until reviewed.",
      "Short excerpts are used for review routing only; full source text is not published.",
      "A source diff does not by itself prove a university policy changed."
    ],
    sourceRightsPolicy: OFFICIAL_SOURCE_RIGHTS_CAVEAT
  };
}

function buildPolicyHunks(
  oldText: string,
  newText: string,
  options: Pick<CliOptions, "contextChars" | "maxHunks">
): SourceDiffHunk[] {
  const oldSignals = extractPolicySignals(oldText);
  const newSignals = extractPolicySignals(newText);
  const oldSet = new Set(oldSignals.map((signal) => normalizeComparable(signal)));
  const newSet = new Set(newSignals.map((signal) => normalizeComparable(signal)));
  const removed = oldSignals.filter((signal) => !newSet.has(normalizeComparable(signal)));
  const added = newSignals.filter((signal) => !oldSet.has(normalizeComparable(signal)));
  const hunkCount = Math.min(options.maxHunks, Math.max(removed.length, added.length));
  const hunks: SourceDiffHunk[] = [];

  for (let index = 0; index < hunkCount; index += 1) {
    const oldExcerpt = removed[index]
      ? trimExcerpt(removed[index], options.contextChars)
      : undefined;
    const newExcerpt = added[index]
      ? trimExcerpt(added[index], options.contextChars)
      : undefined;
    const policySignalTerms = findPolicyTerms(`${oldExcerpt ?? ""} ${newExcerpt ?? ""}`);

    if (!oldExcerpt && !newExcerpt) continue;
    if (!policySignalTerms.length) continue;

    hunks.push({
      hunkId: `hunk-${index + 1}`,
      oldExcerpt,
      newExcerpt,
      policySignalTerms,
      summary: summarizeHunk(oldExcerpt, newExcerpt)
    });
  }

  return hunks;
}

function extractPolicySignals(text: string): string[] {
  const sentences = splitIntoSentences(text);
  const signals: string[] = [];

  for (const sentence of sentences) {
    const terms = findPolicyTerms(sentence);
    if (!terms.length) continue;
    if (sentence.length < 30) continue;
    signals.push(sentence);
  }

  return dedupe(signals, normalizeComparable).slice(0, 240);
}

function classifyCandidate(
  row: PrivateSourceDiffRow,
  oldRecord: PrivateSourceSnapshotRecord | undefined,
  newRecord: PrivateSourceSnapshotRecord | undefined,
  hunks: SourceDiffHunk[]
): SourceDiffClass {
  if (row.status === "added") {
    return hunks.length ? "source_index_expansion" : "metadata_or_chrome_delta";
  }
  if (row.status === "removed") return "source_removed_candidate";
  if (row.status === "unavailable") return "source_unavailable";
  if (
    oldRecord?.fetchStatus?.includes("failed") ||
    newRecord?.fetchStatus?.includes("failed")
  ) {
    return "http_or_access_noise";
  }
  if (row.status === "normalized_text_changed" && hunks.length) {
    return "content_policy_delta";
  }
  if (row.status === "metadata_changed" || row.status === "metadata_only") {
    return "metadata_or_chrome_delta";
  }
  return "metadata_or_chrome_delta";
}

function scoreCandidate(
  row: PrivateSourceDiffRow,
  diffClass: SourceDiffClass,
  hunks: SourceDiffHunk[]
): number {
  if (diffClass === "content_policy_delta") {
    const termCount = new Set(hunks.flatMap((hunk) => hunk.policySignalTerms)).size;
    return Math.min(0.97, 0.74 + hunks.length * 0.04 + termCount * 0.02);
  }
  if (diffClass === "source_index_expansion" || diffClass === "source_removed_candidate") {
    return 0.78;
  }
  if (diffClass === "source_unavailable") return 0.64;
  if (row.status === "metadata_changed") return 0.48;
  return 0.4;
}

function recommendedActionFor(diffClass: SourceDiffClass): SourceDiffReviewAction {
  if (diffClass === "content_policy_delta") return "needs_openclaw_light_review";
  if (diffClass === "source_index_expansion") return "needs_codex_review";
  if (diffClass === "source_removed_candidate") return "candidate_deprecate_claims";
  if (diffClass === "source_unavailable") return "needs_source_repair";
  if (diffClass === "metadata_or_chrome_delta") return "write_no_change_note";
  return "no_action";
}

function splitIntoSentences(text: string): string[] {
  return text
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+|(?=\b(?:AI|GenAI|ChatGPT|Copilot|DeepSeek)\b)/)
    .map((value) => value.trim())
    .filter(Boolean);
}

function trimExcerpt(value: string, maxLength: number): string {
  const trimmed = value.replace(/\s+/g, " ").trim();
  if (trimmed.length <= maxLength) return trimmed;
  return `${trimmed.slice(0, maxLength - 1).trim()}…`;
}

function findPolicyTerms(value: string): string[] {
  const lower = value.toLowerCase();
  return POLICY_SIGNAL_TERMS.filter((term) => lower.includes(term));
}

function normalizeComparable(value: string): string {
  return value.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").replace(/\s+/g, " ").trim();
}

function dedupe<T>(items: T[], keyFn: (item: T) => string): T[] {
  const seen = new Set<string>();
  const output: T[] = [];
  for (const item of items) {
    const key = keyFn(item);
    if (seen.has(key)) continue;
    seen.add(key);
    output.push(item);
  }
  return output;
}

function summarizeHunk(oldExcerpt: string | undefined, newExcerpt: string | undefined): string {
  if (oldExcerpt && newExcerpt) return "Policy-relevant source excerpt changed.";
  if (newExcerpt) return "Policy-relevant source excerpt appears in the new snapshot.";
  return "Policy-relevant source excerpt appears to be absent from the new snapshot.";
}

async function readPrivateDiff(
  outputRoot: string,
  options: CliOptions
): Promise<PrivateSourceDiff> {
  const diffFile =
    options.diffFile ??
    (options.previousReleaseId && options.currentReleaseId
      ? path.join(
          outputRoot,
          "diffs",
          `${options.previousReleaseId}__${options.currentReleaseId}.json`
        )
      : undefined);

  if (!diffFile) {
    throw new Error(
      "Provide --diff-file or both --previous-release-id and --current-release-id."
    );
  }

  const parsed = JSON.parse(await readFile(diffFile, "utf8")) as PrivateSourceDiff;
  if (parsed.schemaVersion !== "uapt-private-source-snapshot-diff-v1") {
    throw new Error(`Unsupported private source diff file: ${diffFile}`);
  }
  return parsed;
}

async function readManifest(
  outputRoot: string,
  releaseId: string
): Promise<PrivateSnapshotManifest> {
  const manifestPath = path.join(outputRoot, releaseId, "manifest.json");
  const parsed = JSON.parse(await readFile(manifestPath, "utf8")) as PrivateSnapshotManifest;
  if (parsed.schemaVersion !== "uapt-private-source-snapshot-manifest-v1") {
    throw new Error(`Unsupported private snapshot manifest: ${manifestPath}`);
  }
  return parsed;
}

function indexRecords(
  records: PrivateSourceSnapshotRecord[]
): Map<string, PrivateSourceSnapshotRecord> {
  return new Map(records.map((record) => [sourceKey(record), record]));
}

function sourceKey(value: { entitySlug: string; sourceUrl: string }): string {
  return `${value.entitySlug}\u0000${value.sourceUrl}`;
}

function candidateId(row: PrivateSourceDiffRow): string {
  return `sdc-${row.currentReleaseId}-${createHash("sha1")
    .update(`${row.entitySlug}:${row.sourceUrl}`)
    .digest("hex")
    .slice(0, 12)}`;
}

function summarize(candidates: SourceDiffCandidate[]): Record<string, number> {
  const summary: Record<string, number> = {
    candidates: candidates.length,
    content_policy_delta: 0,
    http_or_access_noise: 0,
    metadata_or_chrome_delta: 0,
    source_index_expansion: 0,
    source_removed_candidate: 0,
    source_replaced_candidate: 0,
    source_unavailable: 0
  };

  for (const candidate of candidates) {
    summary[candidate.diffClass] = (summary[candidate.diffClass] ?? 0) + 1;
  }

  return summary;
}

function renderMarkdown(document: {
  candidates: SourceDiffCandidate[];
  currentReleaseId: string;
  generatedAt: string;
  previousReleaseId: string;
  summary: Record<string, number>;
}): string {
  const lines = [
    `# Source Diff Candidates ${document.previousReleaseId} -> ${document.currentReleaseId}`,
    "",
    `Generated at: ${document.generatedAt}`,
    "",
    "## Summary",
    "",
    "| Class | Count |",
    "| --- | ---: |",
    ...Object.entries(document.summary)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, value]) => `| \`${key}\` | ${value} |`),
    "",
    "## OpenClaw Queue",
    "",
    "OpenClaw should process only `content_policy_delta` rows, one source at a time, with no concurrency and no automatic push.",
    "",
    "| Entity | Class | Confidence | Action | Source |",
    "| --- | --- | ---: | --- | --- |",
    ...document.candidates
      .filter((candidate) => candidate.diffClass !== "metadata_or_chrome_delta")
      .map(
        (candidate) =>
          `| ${escapeTable(candidate.entitySlug)} | \`${candidate.diffClass}\` | ${candidate.confidence.toFixed(2)} | \`${candidate.recommendedAction}\` | ${escapeTable(candidate.sourceUrl)} |`
      )
  ];

  return `${lines.join("\n")}\n`;
}

async function readOptionalText(file: string): Promise<string> {
  try {
    return await readFile(file, "utf8");
  } catch {
    return "";
  }
}

function mapSourceType(value: string | undefined) {
  if (value === "official_pdf") return "official_pdf";
  if (value === "archived_official_source") return "archived_official_source";
  if (value === "other") return "other";
  return "official_policy_page";
}

async function writeJson(file: string, value: unknown): Promise<void> {
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function escapeTable(value: string): string {
  return value.replaceAll("|", "\\|").replace(/\s+/g, " ").trim();
}

async function findRepoRoot(): Promise<string> {
  let current = process.cwd();

  for (;;) {
    try {
      await readFile(path.join(current, "package.json"), "utf8");
      return current;
    } catch {
      const parent = path.dirname(current);
      if (parent === current) return process.cwd();
      current = parent;
    }
  }
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

  return {
    contextChars: parsePositiveInteger(values.get("context-chars"), DEFAULT_CONTEXT_CHARS),
    currentReleaseId: values.get("current-release-id"),
    diffFile: values.get("diff-file"),
    help: flags.has("help") || flags.has("h"),
    limit: values.has("limit")
      ? parsePositiveInteger(values.get("limit"), Number.POSITIVE_INFINITY)
      : undefined,
    maxHunks: parsePositiveInteger(values.get("max-hunks"), DEFAULT_MAX_HUNKS),
    minConfidence: parseNumber(values.get("min-confidence"), DEFAULT_MIN_CONFIDENCE),
    outputDir: values.get("output-dir") ?? DEFAULT_OUTPUT_DIR,
    outputRoot: values.get("output-root") ?? DEFAULT_OUTPUT_ROOT,
    previousReleaseId: values.get("previous-release-id")
  };
}

function parsePositiveInteger(value: string | undefined, fallback: number): number {
  if (fallback === Number.POSITIVE_INFINITY && value === undefined) return fallback;
  const parsed = value === undefined ? fallback : Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`Expected positive integer, got: ${value}`);
  }
  return parsed;
}

function parseNumber(value: string | undefined, fallback: number): number {
  const parsed = value === undefined ? fallback : Number.parseFloat(value);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 1) {
    throw new Error(`Expected number between 0 and 1, got: ${value}`);
  }
  return parsed;
}

function printUsage(): void {
  console.log(`Usage:
  pnpm source-diffs:build -- --previous-release-id <old> --current-release-id <new>
  pnpm source-diffs:build -- --diff-file .local/source-snapshots/diffs/<old>__<new>.json

Options:
  --output-root <dir>       Private source snapshot root. Default: .local/source-snapshots
  --output-dir <dir>        Candidate output root. Default: .local/source-diff-candidates
  --min-confidence <0-1>    Filter low-confidence candidates. Default: 0.72
  --max-hunks <n>           Max short excerpt hunks per source. Default: 4
  --context-chars <n>       Max chars per excerpt. Default: 700
`);
}
