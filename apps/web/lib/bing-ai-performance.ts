import { readFile, readdir, stat } from "node:fs/promises";
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

export interface BingAiTopicPortfolioRow {
  queriesRange: string;
  sitesRange: string;
  topic: string;
  volumeRange: string;
}

export interface BingAiOpportunityQueryRow {
  citationRange: string;
  query: string;
  topic: string;
}

export interface BingAiPerformanceSnapshot {
  available: boolean;
  coverageEnd?: string;
  coverageStart?: string;
  dateRows: BingAiPerformanceDateRow[];
  error?: string;
  importedAt?: string;
  opportunityQueryRows: BingAiOpportunityQueryRow[];
  pageRows: BingAiPerformancePageRow[];
  queryRows: BingAiPerformanceQueryRow[];
  sampled: true;
  source: "bing-webmaster-csv";
  topicPortfolioRows: BingAiTopicPortfolioRow[];
  totals: {
    averageCitedPages: number;
    citations: number;
    opportunityQueriesCount: number;
    topicsCount: number;
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

    const [topicPortfolioMatch, opportunityQueriesMatch] = await Promise.all([
      resolveOptionalSnapshotFile(
        directory,
        ["topic-portfolio.csv", "topics.csv"],
        /AITopicsOverallPortfolio/i
      ),
      resolveOptionalSnapshotFile(
        directory,
        ["opportunity-queries.csv", "opportunities.csv"],
        /AITopicsTopOpportunityQueries/i
      )
    ]);

    let topicPortfolioRows: BingAiTopicPortfolioRow[] = [];
    if (topicPortfolioMatch) {
      try {
        const topicCsv = await readFile(topicPortfolioMatch.path, "utf8");
        topicPortfolioRows = parseBingAiTopicPortfolioCsv(topicCsv);
      } catch {
        // Continue with empty topic portfolio on read/parse error
      }
    }

    let opportunityQueryRows: BingAiOpportunityQueryRow[] = [];
    if (opportunityQueriesMatch) {
      try {
        const oppCsv = await readFile(opportunityQueriesMatch.path, "utf8");
        opportunityQueryRows = parseBingAiOpportunityQueriesCsv(oppCsv);
      } catch {
        // Continue with empty opportunity queries on read/parse error
      }
    }

    let dateRows: BingAiPerformanceDateRow[] = [];
    let pageRows: BingAiPerformancePageRow[] = [];
    let queryRows: BingAiPerformanceQueryRow[] = [];
    let coreMtimes: number[] = [];
    let coreError: string | undefined;

    try {
      const [overviewCsv, pagesCsv, queriesCsv, ...fileStats] = await Promise.all([
        readFile(paths.overview, "utf8"),
        readFile(paths.pages, "utf8"),
        readFile(paths.queries, "utf8"),
        stat(paths.overview),
        stat(paths.pages),
        stat(paths.queries)
      ]);
      dateRows = parseBingAiOverviewCsv(overviewCsv);
      pageRows = parseBingAiPagesCsv(pagesCsv);
      queryRows = parseBingAiQueriesCsv(queriesCsv);
      if (!dateRows.length) throw new Error("Bing AI overview snapshot is empty.");
      coreMtimes = fileStats.map((value) => value.mtimeMs);
    } catch (error) {
      coreError = error instanceof Error ? error.message : String(error);
    }

    const mtimes = [
      ...coreMtimes,
      ...(topicPortfolioMatch ? [topicPortfolioMatch.mtimeMs] : []),
      ...(opportunityQueriesMatch ? [opportunityQueriesMatch.mtimeMs] : [])
    ];

    if (!dateRows.length && !topicPortfolioRows.length && !opportunityQueryRows.length) {
      return emptyBingAiPerformanceSnapshot(coreError ?? "Bing AI snapshot is unavailable.");
    }

    const citations = dateRows.reduce((sum, row) => sum + row.citations, 0);
    const averageCitedPages = dateRows.length
      ? dateRows.reduce((sum, row) => sum + row.citedPages, 0) / dateRows.length
      : 0;

    return {
      available: dateRows.length > 0 || topicPortfolioRows.length > 0 || opportunityQueryRows.length > 0,
      coverageEnd: dateRows.at(-1)?.key,
      coverageStart: dateRows[0]?.key,
      dateRows,
      error: dateRows.length ? undefined : coreError,
      importedAt: mtimes.length ? new Date(Math.max(...mtimes)).toISOString() : undefined,
      opportunityQueryRows,
      pageRows,
      queryRows,
      sampled: true,
      source: "bing-webmaster-csv",
      topicPortfolioRows,
      totals: {
        averageCitedPages,
        citations,
        opportunityQueriesCount: opportunityQueryRows.length,
        topicsCount: topicPortfolioRows.length
      }
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

export function parseBingAiTopicPortfolioCsv(csv: string): BingAiTopicPortfolioRow[] {
  const rows = parseCsv(csv);
  assertHeaders(rows[0], ["Topic", "Volume Range", "Queries Range", "Sites Range"]);
  return rows.slice(1).map((row) => ({
    queriesRange: row[2]?.trim() ?? "",
    sitesRange: row[3]?.trim() ?? "",
    topic: row[0]?.trim() ?? "",
    volumeRange: row[1]?.trim() ?? ""
  })).filter((row) => row.topic);
}

export function parseBingAiOpportunityQueriesCsv(csv: string): BingAiOpportunityQueryRow[] {
  const rows = parseCsv(csv);
  assertHeaders(rows[0], ["Query", "Topic", "Citation Range"]);
  return rows.slice(1).map((row) => ({
    citationRange: row[2]?.trim() ?? "",
    query: row[0]?.trim() ?? "",
    topic: row[1]?.trim() ?? ""
  })).filter((row) => row.query);
}

function emptyBingAiPerformanceSnapshot(error: string): BingAiPerformanceSnapshot {
  return {
    available: false,
    dateRows: [],
    error,
    opportunityQueryRows: [],
    pageRows: [],
    queryRows: [],
    sampled: true,
    source: "bing-webmaster-csv",
    topicPortfolioRows: [],
    totals: { averageCitedPages: 0, citations: 0, opportunityQueriesCount: 0, topicsCount: 0 }
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

export async function resolveOptionalSnapshotFile(
  directory: string,
  preferredNames: string[],
  fallbackPattern: RegExp
): Promise<{ mtimeMs: number; path: string } | undefined> {
  try {
    const entries = await readdir(directory);
    const preferredOrder = new Map(
      preferredNames.map((name, index) => [name.toLowerCase(), index])
    );
    const matchingNames = entries.filter(
      (entry) => preferredOrder.has(entry.toLowerCase()) || fallbackPattern.test(entry)
    );
    const candidates: Array<{ mtimeMs: number; name: string; path: string; preferredRank: number }> = [];
    for (const name of matchingNames) {
      const candidatePath = path.join(directory, name);
      try {
        const info = await stat(candidatePath);
        if (info.isFile()) {
          candidates.push({
            mtimeMs: info.mtimeMs,
            name,
            path: candidatePath,
            preferredRank: preferredOrder.get(name.toLowerCase()) ?? Number.MAX_SAFE_INTEGER
          });
        }
      } catch {
        // Ignore unreadable file candidate
      }
    }
    if (!candidates.length) return undefined;
    candidates.sort((a, b) => {
      if (b.mtimeMs !== a.mtimeMs) return b.mtimeMs - a.mtimeMs;
      if (a.preferredRank !== b.preferredRank) return a.preferredRank - b.preferredRank;
      return b.name.localeCompare(a.name);
    });
    return { mtimeMs: candidates[0].mtimeMs, path: candidates[0].path };
  } catch {
    return undefined;
  }
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
