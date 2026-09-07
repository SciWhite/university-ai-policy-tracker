import { readFile, stat } from "node:fs/promises";
import path from "node:path";

export interface BingAiPerformanceDateRow {
  citations: number;
  citedPages: number;
  key: string;
}

export interface BingAiPerformancePageRow {
  citations: number;
  key: string;
}

export interface BingAiPerformanceQueryRow {
  citationShare: number;
  citations: number;
  intent?: string;
  key: string;
  topic?: string;
}

export interface BingAiPerformanceSnapshot {
  available: boolean;
  coverageEnd?: string;
  coverageStart?: string;
  dateRows: BingAiPerformanceDateRow[];
  error?: string;
  importedAt?: string;
  pageRows: BingAiPerformancePageRow[];
  queryRows: BingAiPerformanceQueryRow[];
  sampled: true;
  source: "bing-webmaster-csv";
  totals: {
    averageCitedPages: number;
    citations: number;
  };
}

const SNAPSHOT_FILES = {
  overview: "overview.csv",
  pages: "pages.csv",
  queries: "queries.csv"
} as const;

export async function getBingAiPerformanceSnapshot(): Promise<BingAiPerformanceSnapshot> {
  try {
    const directory = await resolveSnapshotDirectory();
    const paths = Object.fromEntries(
      Object.entries(SNAPSHOT_FILES).map(([key, file]) => [key, path.join(directory, file)])
    ) as Record<keyof typeof SNAPSHOT_FILES, string>;
    const [overviewCsv, pagesCsv, queriesCsv, ...fileStats] = await Promise.all([
      readFile(paths.overview, "utf8"),
      readFile(paths.pages, "utf8"),
      readFile(paths.queries, "utf8"),
      stat(paths.overview),
      stat(paths.pages),
      stat(paths.queries)
    ]);
    const dateRows = parseBingAiOverviewCsv(overviewCsv);
    const pageRows = parseBingAiPagesCsv(pagesCsv);
    const queryRows = parseBingAiQueriesCsv(queriesCsv);
    if (!dateRows.length) throw new Error("Bing AI overview snapshot is empty.");
    const citations = dateRows.reduce((sum, row) => sum + row.citations, 0);
    const averageCitedPages = dateRows.reduce((sum, row) => sum + row.citedPages, 0) /
      dateRows.length;

    return {
      available: true,
      coverageEnd: dateRows.at(-1)?.key,
      coverageStart: dateRows[0]?.key,
      dateRows,
      importedAt: new Date(Math.max(...fileStats.map((value) => value.mtimeMs))).toISOString(),
      pageRows,
      queryRows,
      sampled: true,
      source: "bing-webmaster-csv",
      totals: { averageCitedPages, citations }
    };
  } catch (error) {
    return emptyBingAiPerformanceSnapshot(
      error instanceof Error ? error.message : String(error)
    );
  }
}

export function parseBingAiOverviewCsv(csv: string): BingAiPerformanceDateRow[] {
  const rows = parseCsv(csv);
  assertHeaders(rows[0], ["Date", "Citations", "Cited Pages"]);
  return rows.slice(1).map((row) => ({
    citations: parseCount(row[1]),
    citedPages: parseCount(row[2]),
    key: parseBingDate(row[0])
  })).sort((a, b) => a.key.localeCompare(b.key));
}

export function parseBingAiPagesCsv(csv: string): BingAiPerformancePageRow[] {
  const rows = parseCsv(csv);
  assertHeaders(rows[0], ["Page", "Citations"]);
  return rows.slice(1).map((row) => ({
    citations: parseCount(row[1]),
    key: row[0]?.trim() ?? ""
  })).filter((row) => row.key).sort((a, b) => b.citations - a.citations);
}

export function parseBingAiQueriesCsv(csv: string): BingAiPerformanceQueryRow[] {
  const rows = parseCsv(csv);
  assertHeaders(rows[0], ["Grounding Query", "Intent", "Topic", "Citations", "Citation Share"]);
  return rows.slice(1).map((row) => ({
    citationShare: parsePercent(row[4]),
    citations: parseCount(row[3]),
    intent: row[1]?.trim() || undefined,
    key: row[0]?.trim() ?? "",
    topic: row[2]?.trim() || undefined
  })).filter((row) => row.key).sort((a, b) => b.citations - a.citations);
}

function emptyBingAiPerformanceSnapshot(error: string): BingAiPerformanceSnapshot {
  return {
    available: false,
    dateRows: [],
    error,
    pageRows: [],
    queryRows: [],
    sampled: true,
    source: "bing-webmaster-csv",
    totals: { averageCitedPages: 0, citations: 0 }
  };
}

async function resolveSnapshotDirectory() {
  if (process.env.BING_AI_PERFORMANCE_SNAPSHOT_DIR) {
    return process.env.BING_AI_PERFORMANCE_SNAPSHOT_DIR;
  }
  const candidates = [
    path.resolve(process.cwd(), ".local/data/bing-ai-performance"),
    path.resolve(process.cwd(), "../../.local/data/bing-ai-performance")
  ];
  for (const candidate of candidates) {
    try {
      if ((await stat(candidate)).isDirectory()) return candidate;
    } catch {
      // Try the next supported working-directory layout.
    }
  }
  return candidates[0];
}

function parseCsv(csv: string): string[][] {
  const rows: string[][] = [];
  let current = "";
  let row: string[] = [];
  let quoted = false;
  const input = csv.replace(/^\uFEFF/, "");
  for (let index = 0; index < input.length; index += 1) {
    const character = input[index];
    if (character === '"') {
      if (quoted && input[index + 1] === '"') {
        current += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (character === "," && !quoted) {
      row.push(current);
      current = "";
    } else if ((character === "\n" || character === "\r") && !quoted) {
      if (character === "\r" && input[index + 1] === "\n") index += 1;
      row.push(current);
      if (row.some((value) => value.length)) rows.push(row);
      row = [];
      current = "";
    } else {
      current += character;
    }
  }
  row.push(current);
  if (row.some((value) => value.length)) rows.push(row);
  if (quoted) throw new Error("Bing AI CSV contains an unterminated quoted field.");
  return rows;
}

function assertHeaders(row: string[] | undefined, expected: string[]) {
  if (!row || expected.some((header, index) => row[index]?.trim() !== header)) {
    throw new Error(`Unexpected Bing AI CSV headers; expected ${expected.join(", ")}.`);
  }
}

function parseCount(value: string | undefined) {
  const parsed = Number(value ?? "");
  if (!Number.isFinite(parsed) || parsed < 0) throw new Error(`Invalid Bing AI count: ${value}`);
  return parsed;
}

function parsePercent(value: string | undefined) {
  const parsed = Number((value ?? "").replace("%", "").trim());
  if (!Number.isFinite(parsed) || parsed < 0) throw new Error(`Invalid Bing AI percentage: ${value}`);
  return parsed / 100;
}

function parseBingDate(value: string | undefined) {
  const match = value?.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (!match) throw new Error(`Invalid Bing AI date: ${value}`);
  return `${match[3]}-${match[1].padStart(2, "0")}-${match[2].padStart(2, "0")}`;
}
