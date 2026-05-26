import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import type { PublicEntitySummary, SourceAttribution } from "@uapt/shared";
import {
  getCurrentPublicReleaseManifest,
  getStagedPublicDataset
} from "../apps/web/lib/staged-public-data";

type FetchStatus =
  | "metadata_only"
  | "fetched"
  | "fetch_failed"
  | "firecrawl_failed"
  | "skipped_non_http"
  | "pdf_extracted"
  | "pdf_text_too_short"
  | "unsupported_content_type";

type PrivateDiffStatus =
  | "added"
  | "removed"
  | "unchanged"
  | "normalized_text_changed"
  | "metadata_changed"
  | "metadata_only"
  | "unavailable";

interface CliOptions {
  compareWith?: string;
  enableFirecrawlPdf: boolean;
  fetch: boolean;
  firecrawlZeroDataRetention: boolean;
  help: boolean;
  includePdf: boolean;
  limit?: number;
  mergeExisting: boolean;
  minPdfTextChars: number;
  outputRoot: string;
  releaseId?: string;
  retryStatus?: FetchStatus;
  timeoutMs: number;
}

interface SourceTarget {
  entityName: string;
  entitySlug: string;
  source: SourceAttribution;
}

interface PrivateSourceSnapshotRecord {
  schemaVersion: "uapt-private-source-snapshot-record-v1";
  citationTitle: string;
  contentLength?: number;
  contentType?: string;
  entityName: string;
  entitySlug: string;
  error?: string;
  fetchedAt?: string;
  fetchStatus: FetchStatus;
  finalUrl?: string;
  httpStatus?: number;
  limitations: string[];
  metadataPath: string;
  normalizedTextBytes?: number;
  normalizedTextHash?: string;
  normalizedTextPath?: string;
  publicSnapshotHash: string;
  releaseId: string;
  retrievedAt?: string;
  sourceRightsPolicy: string;
  sourceType?: string;
  sourceUrl: string;
}

interface PrivateSnapshotManifest {
  schemaVersion: "uapt-private-source-snapshot-manifest-v1";
  boundary: string;
  counts: {
    fetched: number;
    fetchFailed: number;
    firecrawlFailed: number;
    metadataOnly: number;
    pdfExtracted: number;
    pdfTextTooShort: number;
    records: number;
    skipped: number;
    unsupportedContentType: number;
  };
  generatedAt: string;
  outputRoot: string;
  records: PrivateSourceSnapshotRecord[];
  releaseId: string;
  sourceRightsPolicy: string;
}

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
  schemaVersion: "uapt-private-source-snapshot-diff-v1";
  counts: Record<PrivateDiffStatus, number>;
  currentReleaseId: string;
  generatedAt: string;
  previousReleaseId: string;
  rows: PrivateSourceDiffRow[];
}

const PRIVATE_BOUNDARY =
  "Private operational metadata for source maintenance. Not claim evidence, not public source text, and not legal or academic integrity advice.";
const SOURCE_RIGHTS_POLICY =
  "Official university sources are cited separately. Full source text is not redistributed by public tracker APIs.";
const DEFAULT_OUTPUT_ROOT = ".local/source-snapshots";
const DEFAULT_MIN_PDF_TEXT_CHARS = 500;
const DEFAULT_TIMEOUT_MS = 15_000;
const execFileAsync = promisify(execFile);

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    printUsage();
    return;
  }

  const manifest = await getCurrentPublicReleaseManifest();
  if (!manifest) throw new Error("Missing current public release manifest");
  if (options.releaseId && options.releaseId !== manifest.releaseId) {
    throw new Error(
      `Only the current promoted release can be snapshotted by this script. Requested ${options.releaseId}, current is ${manifest.releaseId}.`
    );
  }

  const repoRoot = await findRepoRoot();
  const outputRoot = path.resolve(repoRoot, options.outputRoot);
  const releaseRoot = path.join(outputRoot, manifest.releaseId);
  const snapshotRoot = path.join(releaseRoot, "snapshots");
  await mkdir(snapshotRoot, { recursive: true });

  const dataset = await getStagedPublicDataset();
  const retryKeys = options.retryStatus
    ? await getRetryKeys(releaseRoot, options.retryStatus)
    : undefined;
  const targets = collectSourceTargets(dataset.publicSummaries, retryKeys).slice(
    0,
    options.limit ?? Number.POSITIVE_INFINITY
  );
  const records: PrivateSourceSnapshotRecord[] = [];

  for (const target of targets) {
    records.push(await buildRecord(target, manifest.releaseId, snapshotRoot, options));
  }

  const mergedRecords = options.mergeExisting
    ? await mergeExistingRecords(releaseRoot, records)
    : records;
  const privateManifest: PrivateSnapshotManifest = {
    schemaVersion: "uapt-private-source-snapshot-manifest-v1",
    boundary: PRIVATE_BOUNDARY,
    counts: {
      fetched: mergedRecords.filter((record) => record.fetchStatus === "fetched").length,
      fetchFailed: mergedRecords.filter((record) => record.fetchStatus === "fetch_failed").length,
      firecrawlFailed: mergedRecords.filter((record) => record.fetchStatus === "firecrawl_failed").length,
      metadataOnly: mergedRecords.filter((record) => record.fetchStatus === "metadata_only").length,
      pdfExtracted: mergedRecords.filter((record) => record.fetchStatus === "pdf_extracted").length,
      pdfTextTooShort: mergedRecords.filter((record) => record.fetchStatus === "pdf_text_too_short").length,
      records: mergedRecords.length,
      skipped: mergedRecords.filter((record) => record.fetchStatus === "skipped_non_http").length,
      unsupportedContentType: mergedRecords.filter(
        (record) => record.fetchStatus === "unsupported_content_type"
      ).length
    },
    generatedAt: new Date().toISOString(),
    outputRoot,
    records: mergedRecords,
    releaseId: manifest.releaseId,
    sourceRightsPolicy: SOURCE_RIGHTS_POLICY
  };

  await writeJson(path.join(releaseRoot, "manifest.json"), privateManifest);
  await writeJson(path.join(outputRoot, "current.json"), {
    schemaVersion: "uapt-private-source-snapshot-current-v1",
    releaseId: manifest.releaseId,
    manifestPath: path.join(releaseRoot, "manifest.json"),
    generatedAt: privateManifest.generatedAt,
    boundary: PRIVATE_BOUNDARY
  });

  if (options.compareWith) {
    const diff = await buildDiff(outputRoot, options.compareWith, privateManifest);
    const diffRoot = path.join(outputRoot, "diffs");
    await mkdir(diffRoot, { recursive: true });
    await writeJson(
      path.join(diffRoot, `${options.compareWith}__${manifest.releaseId}.json`),
      diff
    );
  }

  console.log(
    JSON.stringify(
      {
        releaseId: manifest.releaseId,
        records: privateManifest.counts.records,
        fetched: privateManifest.counts.fetched,
        pdfExtracted: privateManifest.counts.pdfExtracted,
        pdfTextTooShort: privateManifest.counts.pdfTextTooShort,
        metadataOnly: privateManifest.counts.metadataOnly,
        output: path.join(releaseRoot, "manifest.json"),
        comparedWith: options.compareWith ?? null
      },
      null,
      2
    )
  );
}

async function buildRecord(
  target: SourceTarget,
  releaseId: string,
  snapshotRoot: string,
  options: CliOptions
): Promise<PrivateSourceSnapshotRecord> {
  const sourceId = `${target.entitySlug}__${hash(`${target.entitySlug}:${target.source.sourceUrl}`).slice(0, 16)}`;
  const sourceRoot = path.join(snapshotRoot, sourceId);
  const metadataPath = path.join(sourceRoot, "metadata.json");
  const normalizedTextPath = path.join(sourceRoot, "normalized.md");
  await mkdir(sourceRoot, { recursive: true });

  const baseRecord: PrivateSourceSnapshotRecord = {
    schemaVersion: "uapt-private-source-snapshot-record-v1",
    citationTitle: target.source.citationTitle,
    entityName: target.entityName,
    entitySlug: target.entitySlug,
    fetchStatus: "metadata_only",
    finalUrl: target.source.finalUrl,
    limitations: [PRIVATE_BOUNDARY],
    metadataPath,
    publicSnapshotHash: target.source.snapshotHash,
    releaseId,
    retrievedAt: target.source.retrievedAt,
    sourceRightsPolicy: SOURCE_RIGHTS_POLICY,
    sourceType: target.source.sourceType,
    sourceUrl: target.source.sourceUrl
  };

  let record = baseRecord;
  if (options.fetch) {
    record = await fetchAndNormalize(baseRecord, normalizedTextPath, options);
  }

  await writeJson(metadataPath, record);
  return record;
}

async function fetchAndNormalize(
  record: PrivateSourceSnapshotRecord,
  normalizedTextPath: string,
  options: Pick<CliOptions, "enableFirecrawlPdf" | "includePdf" | "minPdfTextChars" | "timeoutMs">
): Promise<PrivateSourceSnapshotRecord> {
  if (!record.sourceUrl.startsWith("http://") && !record.sourceUrl.startsWith("https://")) {
    return {
      ...record,
      fetchStatus: "skipped_non_http"
    };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs);
  try {
    const response = await fetch(record.sourceUrl, {
      headers: {
        accept: "text/html,application/xhtml+xml,text/plain,application/pdf;q=0.9,*/*;q=0.1",
        "user-agent":
          "UniversityAIPolicyTracker/0.1 (+https://eduaipolicy.org/methodology)"
      },
      redirect: "follow",
      signal: controller.signal
    });
    const contentType = response.headers.get("content-type") ?? undefined;
    const contentLength = Number(response.headers.get("content-length") ?? "0") || undefined;
    const finalUrl = response.url || record.sourceUrl;
    const pdfSource = isPdfContent(record.sourceUrl, contentType);

    if (pdfSource && options.includePdf) {
      const pdfBytes = Buffer.from(await response.arrayBuffer());
      const pdfRecord = await normalizePdfSource(
        {
          ...record,
          contentLength,
          contentType,
          fetchedAt: new Date().toISOString(),
          finalUrl,
          httpStatus: response.status
        },
        pdfBytes,
        normalizedTextPath,
        options
      );

      return response.ok ? pdfRecord : { ...pdfRecord, fetchStatus: "fetch_failed" };
    }

    if (!isSupportedTextContent(contentType)) {
      return {
        ...record,
        contentLength,
        contentType,
        fetchedAt: new Date().toISOString(),
        fetchStatus: "unsupported_content_type",
        finalUrl,
        httpStatus: response.status
      };
    }

    const raw = await response.text();
    const normalized = normalizeSourceText(raw);
    await writeFile(normalizedTextPath, `${normalized}\n`, "utf8");

    return {
      ...record,
      contentLength,
      contentType,
      fetchedAt: new Date().toISOString(),
      fetchStatus: response.ok ? "fetched" : "fetch_failed",
      finalUrl,
      httpStatus: response.status,
      normalizedTextBytes: Buffer.byteLength(normalized, "utf8"),
      normalizedTextHash: hash(normalized),
      normalizedTextPath
    };
  } catch (error) {
    return {
      ...record,
      error: error instanceof Error ? error.message : String(error),
      fetchedAt: new Date().toISOString(),
      fetchStatus: "fetch_failed"
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function normalizePdfSource(
  record: PrivateSourceSnapshotRecord,
  pdfBytes: Buffer,
  normalizedTextPath: string,
  options: Pick<CliOptions, "enableFirecrawlPdf" | "minPdfTextChars">
): Promise<PrivateSourceSnapshotRecord> {
  const extracted = await extractPdfTextWithPython(pdfBytes);
  const normalized = normalizeSourceText(extracted.text);
  if (normalized.length >= options.minPdfTextChars) {
    await writeFile(normalizedTextPath, `${normalized}\n`, "utf8");

    return {
      ...record,
      fetchStatus: "pdf_extracted",
      normalizedTextBytes: Buffer.byteLength(normalized, "utf8"),
      normalizedTextHash: hash(normalized),
      normalizedTextPath
    };
  }

  if (options.enableFirecrawlPdf) {
      const firecrawl = await extractPdfTextWithFirecrawl(
        record.sourceUrl,
        options.firecrawlZeroDataRetention
      );
    const firecrawlNormalized = normalizeSourceText(firecrawl.text);
    if (firecrawlNormalized.length >= options.minPdfTextChars) {
      await writeFile(normalizedTextPath, `${firecrawlNormalized}\n`, "utf8");

      return {
        ...record,
        fetchStatus: "pdf_extracted",
        normalizedTextBytes: Buffer.byteLength(firecrawlNormalized, "utf8"),
        normalizedTextHash: hash(firecrawlNormalized),
        normalizedTextPath
      };
    }

    return {
      ...record,
      error: firecrawl.error
        ? `pdf text too short (${normalized.length}); firecrawl failed: ${firecrawl.error}`
        : `pdf text too short (${normalized.length}); firecrawl text too short (${firecrawlNormalized.length})`,
      fetchStatus: firecrawl.error ? "firecrawl_failed" : "pdf_text_too_short"
    };
  }

  return {
    ...record,
    error: extracted.error
      ? `pdf text too short (${normalized.length}); ${extracted.error}`
      : `pdf text too short (${normalized.length})`,
    fetchStatus: "pdf_text_too_short"
  };
}

async function extractPdfTextWithPython(
  pdfBytes: Buffer
): Promise<{ error?: string; text: string }> {
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), "uapt-pdf-"));
  const pdfPath = path.join(tmpDir, "source.pdf");
  const scriptPath = path.join(tmpDir, "extract.py");
  await writeFile(pdfPath, pdfBytes);
  await writeFile(
    scriptPath,
    [
      "import sys",
      "try:",
      "    import fitz",
      "except Exception as exc:",
      "    print(f'PYMUPDF_IMPORT_ERROR: {exc}', file=sys.stderr)",
      "    sys.exit(2)",
      "doc = fitz.open(sys.argv[1])",
      "parts = []",
      "for page in doc:",
      "    parts.append(page.get_text('text'))",
      "print('\\n'.join(parts))"
    ].join("\n"),
    "utf8"
  );

  try {
    const result = await execFileAsync("python3", [scriptPath, pdfPath], {
      maxBuffer: 32 * 1024 * 1024,
      timeout: 60_000
    });

    return { text: result.stdout };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : String(error),
      text: ""
    };
  } finally {
    await rm(tmpDir, { force: true, recursive: true });
  }
}

async function extractPdfTextWithFirecrawl(
  sourceUrl: string,
  zeroDataRetention: boolean
): Promise<{ error?: string; text: string }> {
  const apiKey = process.env.FIRECRAWL_API_KEY;
  if (!apiKey) return { error: "FIRECRAWL_API_KEY is not set", text: "" };

  try {
    const response = await fetch("https://api.firecrawl.dev/v2/scrape", {
      body: JSON.stringify({
        formats: ["markdown"],
        parsers: ["pdf"],
        url: sourceUrl,
        zeroDataRetention
      }),
      headers: {
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json"
      },
      method: "POST"
    });
    const data = (await response.json()) as {
      data?: { markdown?: string };
      error?: string;
      success?: boolean;
    };
    if (!response.ok || data.success === false) {
      return { error: data.error ?? `Firecrawl HTTP ${response.status}`, text: "" };
    }

    return { text: data.data?.markdown ?? "" };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : String(error),
      text: ""
    };
  }
}

async function buildDiff(
  outputRoot: string,
  previousReleaseId: string,
  currentManifest: PrivateSnapshotManifest
): Promise<PrivateSourceDiff> {
  const previousPath = path.join(outputRoot, previousReleaseId, "manifest.json");
  const previousManifest = JSON.parse(
    await readFile(previousPath, "utf8")
  ) as PrivateSnapshotManifest;
  const previousByKey = new Map(
    previousManifest.records.map((record) => [sourceKey(record), record])
  );
  const currentByKey = new Map(
    currentManifest.records.map((record) => [sourceKey(record), record])
  );
  const rows: PrivateSourceDiffRow[] = [];

  for (const [key, current] of currentByKey.entries()) {
    const previous = previousByKey.get(key);
    if (!previous) {
      rows.push(buildDiffRow(previousReleaseId, currentManifest.releaseId, undefined, current, "added"));
      continue;
    }
    rows.push(
      buildDiffRow(
        previousReleaseId,
        currentManifest.releaseId,
        previous,
        current,
        classifySnapshotDiff(previous, current)
      )
    );
  }

  for (const [key, previous] of previousByKey.entries()) {
    if (!currentByKey.has(key)) {
      rows.push(
        buildDiffRow(previousReleaseId, currentManifest.releaseId, previous, undefined, "removed")
      );
    }
  }

  return {
    schemaVersion: "uapt-private-source-snapshot-diff-v1",
    counts: countDiffRows(rows),
    currentReleaseId: currentManifest.releaseId,
    generatedAt: new Date().toISOString(),
    previousReleaseId,
    rows: rows.sort(
      (left, right) =>
        left.entityName.localeCompare(right.entityName) ||
        left.sourceUrl.localeCompare(right.sourceUrl)
    )
  };
}

function buildDiffRow(
  previousReleaseId: string,
  currentReleaseId: string,
  oldRecord: PrivateSourceSnapshotRecord | undefined,
  newRecord: PrivateSourceSnapshotRecord | undefined,
  status: PrivateDiffStatus
): PrivateSourceDiffRow {
  const record = newRecord ?? oldRecord;
  if (!record) throw new Error("Cannot build source diff row without a record");

  return {
    currentReleaseId,
    entityName: record.entityName,
    entitySlug: record.entitySlug,
    newNormalizedTextHash: newRecord?.normalizedTextHash,
    newPublicSnapshotHash: newRecord?.publicSnapshotHash,
    oldNormalizedTextHash: oldRecord?.normalizedTextHash,
    oldPublicSnapshotHash: oldRecord?.publicSnapshotHash,
    previousReleaseId,
    sourceUrl: record.sourceUrl,
    status,
    summary: summarizeDiffStatus(status)
  };
}

function classifySnapshotDiff(
  previous: PrivateSourceSnapshotRecord,
  current: PrivateSourceSnapshotRecord
): PrivateDiffStatus {
  if (previous.fetchStatus === "fetch_failed" || current.fetchStatus === "fetch_failed") {
    return "unavailable";
  }
  if (previous.normalizedTextHash && current.normalizedTextHash) {
    return previous.normalizedTextHash === current.normalizedTextHash
      ? "unchanged"
      : "normalized_text_changed";
  }
  if (previous.publicSnapshotHash !== current.publicSnapshotHash) {
    return "metadata_changed";
  }

  return "metadata_only";
}

function summarizeDiffStatus(status: PrivateDiffStatus): string {
  switch (status) {
    case "added":
      return "Source exists in the current private snapshot baseline but not the previous one.";
    case "removed":
      return "Source existed in the previous private snapshot baseline but not the current one.";
    case "unchanged":
      return "Private normalized source text hash is unchanged.";
    case "normalized_text_changed":
      return "Private normalized source text hash changed; review claim/evidence before treating this as policy change.";
    case "metadata_changed":
      return "Public source snapshot metadata changed, but private normalized text was unavailable for comparison.";
    case "unavailable":
      return "One or both private fetches failed; treat as source-health metadata, not policy change.";
    case "metadata_only":
    default:
      return "Only metadata-only private snapshot records were available.";
  }
}

function countDiffRows(rows: PrivateSourceDiffRow[]): Record<PrivateDiffStatus, number> {
  const counts: Record<PrivateDiffStatus, number> = {
    added: 0,
    metadata_changed: 0,
    metadata_only: 0,
    normalized_text_changed: 0,
    removed: 0,
    unavailable: 0,
    unchanged: 0
  };
  for (const row of rows) counts[row.status] += 1;
  return counts;
}

async function getRetryKeys(releaseRoot: string, retryStatus: FetchStatus): Promise<Set<string>> {
  const manifestPath = path.join(releaseRoot, "manifest.json");
  const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as PrivateSnapshotManifest;

  return new Set(
    manifest.records
      .filter((record) => record.fetchStatus === retryStatus)
      .map((record) => sourceKey(record))
  );
}

async function mergeExistingRecords(
  releaseRoot: string,
  records: PrivateSourceSnapshotRecord[]
): Promise<PrivateSourceSnapshotRecord[]> {
  const manifestPath = path.join(releaseRoot, "manifest.json");
  let previousRecords: PrivateSourceSnapshotRecord[] = [];

  try {
    const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as PrivateSnapshotManifest;
    previousRecords = Array.isArray(manifest.records) ? manifest.records : [];
  } catch {
    previousRecords = [];
  }

  const byKey = new Map(previousRecords.map((record) => [sourceKey(record), record]));
  for (const record of records) byKey.set(sourceKey(record), record);

  return [...byKey.values()].sort(
    (left, right) =>
      left.entityName.localeCompare(right.entityName) ||
      left.sourceUrl.localeCompare(right.sourceUrl)
  );
}

function collectSourceTargets(
  summaries: PublicEntitySummary[],
  allowedKeys?: Set<string>
): SourceTarget[] {
  const byKey = new Map<string, SourceTarget>();

  for (const summary of summaries) {
    for (const source of summary.officialSources) {
      const key = `${summary.entity.slug}:${source.sourceUrl}`;
      if (allowedKeys && !allowedKeys.has(key)) continue;
      const previous = byKey.get(key);
      if (!previous || isNewer(source.retrievedAt, previous.source.retrievedAt)) {
        byKey.set(key, {
          entityName: summary.entity.name,
          entitySlug: summary.entity.slug,
          source
        });
      }
    }
  }

  return [...byKey.values()].sort(
    (left, right) =>
      left.entityName.localeCompare(right.entityName) ||
      left.source.sourceUrl.localeCompare(right.source.sourceUrl)
  );
}

function normalizeSourceText(value: string): string {
  return decodeBasicEntities(
    value
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
      .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
      .replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
  );
}

function decodeBasicEntities(value: string): string {
  return value
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function isSupportedTextContent(contentType: string | undefined): boolean {
  if (!contentType) return true;
  const lower = contentType.toLowerCase();
  return (
    lower.includes("text/html") ||
    lower.includes("text/plain") ||
    lower.includes("application/xhtml+xml")
  );
}

function isPdfContent(sourceUrl: string, contentType: string | undefined): boolean {
  return (
    sourceUrl.toLowerCase().split("?")[0].endsWith(".pdf") ||
    Boolean(contentType?.toLowerCase().includes("application/pdf"))
  );
}

function parseArgs(args: string[]): CliOptions {
  const options: CliOptions = {
    enableFirecrawlPdf: false,
    fetch: false,
    firecrawlZeroDataRetention: false,
    help: false,
    includePdf: true,
    mergeExisting: false,
    minPdfTextChars: DEFAULT_MIN_PDF_TEXT_CHARS,
    outputRoot: DEFAULT_OUTPUT_ROOT,
    timeoutMs: DEFAULT_TIMEOUT_MS
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--") continue;
    switch (arg) {
      case "--compare-with":
        options.compareWith = requireValue(args, ++index, arg);
        break;
      case "--fetch":
        options.fetch = true;
        break;
      case "--enable-firecrawl-pdf":
        options.enableFirecrawlPdf = true;
        break;
      case "--firecrawl-zero-data-retention":
        options.firecrawlZeroDataRetention = true;
        break;
      case "--help":
      case "-h":
        options.help = true;
        break;
      case "--no-pdf":
        options.includePdf = false;
        break;
      case "--limit":
        options.limit = Number(requireValue(args, ++index, arg));
        break;
      case "--merge-existing":
        options.mergeExisting = true;
        break;
      case "--min-pdf-text-chars":
        options.minPdfTextChars = Number(requireValue(args, ++index, arg));
        break;
      case "--output-root":
        options.outputRoot = requireValue(args, ++index, arg);
        break;
      case "--release-id":
        options.releaseId = requireValue(args, ++index, arg);
        break;
      case "--retry-status":
        options.retryStatus = parseFetchStatus(requireValue(args, ++index, arg));
        break;
      case "--timeout-ms":
        options.timeoutMs = Number(requireValue(args, ++index, arg));
        break;
      default:
        throw new Error(`Unknown argument: ${arg}`);
    }
  }

  if (options.limit !== undefined && (!Number.isFinite(options.limit) || options.limit < 1)) {
    throw new Error("--limit must be a positive number");
  }
  if (!Number.isFinite(options.timeoutMs) || options.timeoutMs < 1000) {
    throw new Error("--timeout-ms must be at least 1000");
  }
  if (!Number.isFinite(options.minPdfTextChars) || options.minPdfTextChars < 0) {
    throw new Error("--min-pdf-text-chars must be a non-negative number");
  }

  return options;
}

function parseFetchStatus(value: string): FetchStatus {
  if (
    value === "metadata_only" ||
    value === "fetched" ||
    value === "fetch_failed" ||
    value === "firecrawl_failed" ||
    value === "skipped_non_http" ||
    value === "pdf_extracted" ||
    value === "pdf_text_too_short" ||
    value === "unsupported_content_type"
  ) {
    return value;
  }

  throw new Error(`Unknown fetch status: ${value}`);
}

function requireValue(args: string[], index: number, flag: string): string {
  const value = args[index];
  if (!value || value.startsWith("--")) throw new Error(`${flag} requires a value`);
  return value;
}

function printUsage(): void {
  console.log(`Build private source snapshot metadata for the current promoted release.

Usage:
  pnpm snapshots:baseline
  pnpm snapshots:baseline -- --fetch --limit 25
  pnpm snapshots:baseline -- --fetch --enable-firecrawl-pdf
  pnpm snapshots:baseline -- --fetch --retry-status unsupported_content_type --merge-existing
  pnpm snapshots:baseline -- --compare-with public-release-20260523-002

Options:
  --fetch                    Fetch public HTTP pages and store normalized text privately.
  --enable-firecrawl-pdf     Use Firecrawl PDF parsing when local PDF text extraction is too short.
  --firecrawl-zero-data-retention
                             Request Firecrawl zero data retention mode. Requires team support.
  --limit <n>                Limit source count for test runs.
  --merge-existing           Merge subset retry results into an existing private manifest.
  --min-pdf-text-chars <n>   Minimum PDF text length before fallback/too-short. Default: ${DEFAULT_MIN_PDF_TEXT_CHARS}
  --no-pdf                   Keep PDFs as unsupported_content_type.
  --output-root <path>       Private output root. Default: ${DEFAULT_OUTPUT_ROOT}
  --retry-status <status>    Only retry sources with this status in the existing private manifest.
  --compare-with <release>   Write private diff metadata against an existing private baseline.
  --timeout-ms <n>           HTTP timeout for --fetch. Default: ${DEFAULT_TIMEOUT_MS}
`);
}

function sourceKey(record: Pick<PrivateSourceSnapshotRecord, "entitySlug" | "sourceUrl">): string {
  return `${record.entitySlug}:${record.sourceUrl}`;
}

function isNewer(left: string | undefined, right: string | undefined): boolean {
  if (!left) return false;
  if (!right) return true;
  return new Date(left).getTime() > new Date(right).getTime();
}

async function writeJson(filePath: string, value: unknown): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function hash(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

async function findRepoRoot(): Promise<string> {
  let current = process.cwd();

  for (;;) {
    try {
      await readFile(path.join(current, "package.json"), "utf8");
      await readFile(path.join(current, "pnpm-lock.yaml"), "utf8");
      return current;
    } catch {
      const parent = path.dirname(current);
      if (parent === current) return process.cwd();
      current = parent;
    }
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
