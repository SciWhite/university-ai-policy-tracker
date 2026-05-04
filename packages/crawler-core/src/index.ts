import { createHash } from "node:crypto";

export type FetchMode = "http" | "playwright" | "opencli" | "firecrawl";

export interface CrawlTarget {
  url: string;
  universitySlug?: string;
  fetchMode?: FetchMode;
  expectedThemes?: string[];
}

export interface FetchResult {
  target: CrawlTarget;
  requestedUrl: string;
  finalUrl?: string;
  statusCode?: number;
  ok: boolean;
  fetchedAt: string;
  headers: Record<string, string>;
  rawText?: string;
  normalizedText?: string;
  contentHash?: string;
  error?: string;
}

export interface TextDiffLine {
  type: "equal" | "insert" | "delete";
  value: string;
  oldLineNumber?: number;
  newLineNumber?: number;
}

export interface TextDiffSummary {
  added: number;
  removed: number;
  unchanged: number;
}

export function normalizePolicyText(input: string): string {
  return input
    .normalize("NFKC")
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.replace(/[ \t]+/g, " ").trim())
    .filter(Boolean)
    .join("\n")
    .trim();
}

export function sha256ContentHash(input: string | Uint8Array): string {
  return createHash("sha256").update(input).digest("hex");
}

export function createFetchResult(params: {
  target: CrawlTarget;
  finalUrl?: string;
  statusCode?: number;
  headers?: Record<string, string>;
  rawText?: string;
  error?: string;
  fetchedAt?: string;
}): FetchResult {
  const normalizedText =
    params.rawText === undefined ? undefined : normalizePolicyText(params.rawText);
  const contentHash =
    normalizedText === undefined ? undefined : sha256ContentHash(normalizedText);

  return {
    target: params.target,
    requestedUrl: params.target.url,
    finalUrl: params.finalUrl,
    statusCode: params.statusCode,
    ok:
      params.error === undefined &&
      params.statusCode !== undefined &&
      params.statusCode >= 200 &&
      params.statusCode < 400,
    fetchedAt: params.fetchedAt ?? new Date().toISOString(),
    headers: params.headers ?? {},
    rawText: params.rawText,
    normalizedText,
    contentHash,
    error: params.error
  };
}

export function shouldExtract(previousHash: string | null, nextHash: string): boolean {
  return previousHash !== nextHash;
}

export function diffTextLines(before: string, after: string): TextDiffLine[] {
  const beforeLines = normalizePolicyText(before).split("\n").filter(Boolean);
  const afterLines = normalizePolicyText(after).split("\n").filter(Boolean);
  const lengths = buildLcsTable(beforeLines, afterLines);
  const diff: TextDiffLine[] = [];

  let i = 0;
  let j = 0;
  let oldLineNumber = 1;
  let newLineNumber = 1;

  while (i < beforeLines.length && j < afterLines.length) {
    if (beforeLines[i] === afterLines[j]) {
      diff.push({
        type: "equal",
        value: beforeLines[i],
        oldLineNumber,
        newLineNumber
      });
      i += 1;
      j += 1;
      oldLineNumber += 1;
      newLineNumber += 1;
    } else if (lengths[i + 1]?.[j] >= lengths[i]?.[j + 1]) {
      diff.push({ type: "delete", value: beforeLines[i], oldLineNumber });
      i += 1;
      oldLineNumber += 1;
    } else {
      diff.push({ type: "insert", value: afterLines[j], newLineNumber });
      j += 1;
      newLineNumber += 1;
    }
  }

  while (i < beforeLines.length) {
    diff.push({ type: "delete", value: beforeLines[i], oldLineNumber });
    i += 1;
    oldLineNumber += 1;
  }

  while (j < afterLines.length) {
    diff.push({ type: "insert", value: afterLines[j], newLineNumber });
    j += 1;
    newLineNumber += 1;
  }

  return diff;
}

export function summarizeTextDiff(diff: TextDiffLine[]): TextDiffSummary {
  return diff.reduce<TextDiffSummary>(
    (summary, line) => {
      if (line.type === "insert") summary.added += 1;
      if (line.type === "delete") summary.removed += 1;
      if (line.type === "equal") summary.unchanged += 1;
      return summary;
    },
    { added: 0, removed: 0, unchanged: 0 }
  );
}

function buildLcsTable(beforeLines: string[], afterLines: string[]): number[][] {
  const table = Array.from({ length: beforeLines.length + 1 }, () =>
    Array.from({ length: afterLines.length + 1 }, () => 0)
  );

  for (let i = beforeLines.length - 1; i >= 0; i -= 1) {
    for (let j = afterLines.length - 1; j >= 0; j -= 1) {
      table[i][j] =
        beforeLines[i] === afterLines[j]
          ? table[i + 1][j + 1] + 1
          : Math.max(table[i + 1][j], table[i][j + 1]);
    }
  }

  return table;
}
