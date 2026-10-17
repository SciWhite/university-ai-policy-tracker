import { mkdir, readFile, rename, stat, writeFile } from "node:fs/promises";
import path from "node:path";

export type ClaritySignalMetricName =
  | "DeadClickCount"
  | "ErrorClickCount"
  | "ExcessiveScroll"
  | "QuickbackClick"
  | "RageClickCount"
  | "ScriptErrorCount";

export interface ClarityPageMetricRow {
  avgActiveTimeSec: number;
  avgScrollDepth: number;
  avgTotalTimeSec: number;
  country?: string;
  deadClicks: number;
  device: string;
  distinctUsers: number;
  errorClicks: number;
  excessiveScrolls: number;
  pagesPerSession: number;
  quickbacks: number;
  rageClicks: number;
  scriptErrors: number;
  sessions: number;
  url: string;
}

export interface ClaritySignalSummaryRow {
  affectedSessionsPercentage: number;
  metricName: ClaritySignalMetricName;
  pagesViews: number;
  sessionsCount: number;
  subTotal: number;
}

export interface ClarityLiveInsightsSnapshot {
  available: boolean;
  cached: boolean;
  error?: string;
  fetchedAt?: string;
  numOfDays: 1 | 2 | 3;
  pageRows: ClarityPageMetricRow[];
  projectId: string;
  quotaNote: string;
  signalRows: ClaritySignalSummaryRow[];
  source: "clarity-export-api";
  stale?: boolean;
  totals: {
    avgActiveTimeSec: number;
    avgScrollDepth: number;
    avgTotalTimeSec: number;
    botSessions: number;
    deadClicks: number;
    distinctUsers: number;
    errorClicks: number;
    excessiveScrolls: number;
    frustrationEvents: number;
    pagesPerSession: number;
    quickbacks: number;
    rageClicks: number;
    scriptErrors: number;
    sessions: number;
  };
}

interface ClarityRawMetricBlock {
  information?: Array<Record<string, unknown>>;
  metricName?: string;
}

interface ClarityDiskCachePayload {
  fetchedAt: string;
  numOfDays: 1 | 2 | 3;
  raw: ClarityRawMetricBlock[];
}

const CLARITY_PROJECT_ID = process.env.CLARITY_PROJECT_ID ?? "ye6c4h9822";
const CLARITY_CACHE_TTL_MS = Number(process.env.CLARITY_CACHE_TTL_MS ?? 3 * 60 * 60 * 1000);
const CLARITY_SIGNAL_METRICS: ClaritySignalMetricName[] = [
  "RageClickCount",
  "DeadClickCount",
  "QuickbackClick",
  "ExcessiveScroll",
  "ScriptErrorCount",
  "ErrorClickCount"
];

let memoryCache: { expiresAt: number; snapshot: ClarityLiveInsightsSnapshot } | null = null;
let inflightRequest: Promise<ClarityLiveInsightsSnapshot> | null = null;

export async function getClarityLiveInsightsSnapshot(): Promise<ClarityLiveInsightsSnapshot> {
  if (memoryCache && memoryCache.expiresAt > Date.now()) {
    return memoryCache.snapshot;
  }
  if (inflightRequest) return inflightRequest;

  inflightRequest = loadClarityLiveInsightsSnapshot()
    .then((snapshot) => {
      memoryCache = {
        expiresAt: Date.now() + (snapshot.available ? Math.min(CLARITY_CACHE_TTL_MS, 15 * 60 * 1000) : 30_000),
        snapshot
      };
      return snapshot;
    })
    .finally(() => {
      inflightRequest = null;
    });

  return inflightRequest;
}

export function clearClarityInsightsMemoryCache() {
  memoryCache = null;
}

async function loadClarityLiveInsightsSnapshot(): Promise<ClarityLiveInsightsSnapshot> {
  const cacheFile = await resolveClarityCacheFile();
  const diskCached = await readDiskCache(cacheFile);

  if (diskCached) {
    const ageMs = Date.now() - Date.parse(diskCached.fetchedAt);
    if (Number.isFinite(ageMs) && ageMs >= 0 && ageMs < CLARITY_CACHE_TTL_MS) {
      return parseClarityLiveInsights(diskCached.raw, {
        cached: true,
        fetchedAt: diskCached.fetchedAt,
        numOfDays: diskCached.numOfDays,
        stale: false
      });
    }
  }

  const token = (
    process.env.CLARITY_API_TOKEN ??
    process.env.CLARITY_DATA_EXPORT_TOKEN ??
    ""
  ).trim();

  if (!token) {
    if (diskCached) {
      return parseClarityLiveInsights(diskCached.raw, {
        cached: true,
        fetchedAt: diskCached.fetchedAt,
        numOfDays: diskCached.numOfDays,
        stale: true
      });
    }
    return emptyClaritySnapshot("Clarity Data Export API token is not configured.");
  }

  try {
    const url = new URL("https://www.clarity.ms/export-data/api/v1/project-live-insights");
    url.searchParams.set("numOfDays", "3");
    url.searchParams.set("dimension1", "URL");
    url.searchParams.set("dimension2", "Device");
    url.searchParams.set("dimension3", "Country/Region");

    const response = await fetch(url.toString(), {
      cache: "no-store",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      signal: AbortSignal.timeout(12_000)
    });

    if (!response.ok) {
      throw new Error(`Clarity API request failed: ${response.status}`);
    }

    const raw = (await response.json()) as ClarityRawMetricBlock[];
    if (!Array.isArray(raw)) {
      throw new Error("Unexpected Clarity API payload shape.");
    }

    const fetchedAt = new Date().toISOString();
    await writeDiskCache(cacheFile, { fetchedAt, numOfDays: 3, raw });

    return parseClarityLiveInsights(raw, {
      cached: false,
      fetchedAt,
      numOfDays: 3,
      stale: false
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (diskCached) {
      const fallback = parseClarityLiveInsights(diskCached.raw, {
        cached: true,
        fetchedAt: diskCached.fetchedAt,
        numOfDays: diskCached.numOfDays,
        stale: true
      });
      return { ...fallback, error: message };
    }
    return emptyClaritySnapshot(message);
  }
}

export function parseClarityLiveInsights(
  raw: unknown,
  options: {
    cached?: boolean;
    fetchedAt?: string;
    numOfDays?: 1 | 2 | 3;
    stale?: boolean;
  } = {}
): ClarityLiveInsightsSnapshot {
  if (!Array.isArray(raw)) {
    throw new Error("Clarity Live Insights payload must be an array.");
  }

  const blocks = new Map<string, Array<Record<string, unknown>>>();
  for (const item of raw) {
    if (
      item &&
      typeof item === "object" &&
      typeof (item as ClarityRawMetricBlock).metricName === "string" &&
      Array.isArray((item as ClarityRawMetricBlock).information)
    ) {
      blocks.set(
        (item as ClarityRawMetricBlock).metricName!,
        (item as ClarityRawMetricBlock).information!
      );
    }
  }

  const pageMap = new Map<string, ClarityPageMetricRow>();
  const ensurePageRow = (info: Record<string, unknown>): ClarityPageMetricRow | null => {
    const url = readDimension(info, ["Url", "URL", "url"]);
    if (!url) return null;
    const device = readDimension(info, ["Device", "device"]) || "All";
    const country = readDimension(info, ["Country/Region", "Country", "country"]) || undefined;
    const key = `${url}|${device}|${country ?? ""}`;
    let row = pageMap.get(key);
    if (!row) {
      row = {
        avgActiveTimeSec: 0,
        avgScrollDepth: 0,
        avgTotalTimeSec: 0,
        country,
        deadClicks: 0,
        device,
        distinctUsers: 0,
        errorClicks: 0,
        excessiveScrolls: 0,
        pagesPerSession: 0,
        quickbacks: 0,
        rageClicks: 0,
        scriptErrors: 0,
        sessions: 0,
        url
      };
      pageMap.set(key, row);
    }
    return row;
  };

  let totalBotSessions = 0;
  for (const info of blocks.get("Traffic") ?? []) {
    const row = ensurePageRow(info);
    const sessions = toNumber(info.totalSessionCount);
    const botSessions = toNumber(info.totalBotSessionCount);
    const distinctUsers = toNumber(info.distinctUserCount);
    const pagesPerSession = toNumber(info.pagesPerSessionPercentage);
    totalBotSessions += botSessions;
    if (row) {
      row.sessions += sessions;
      row.distinctUsers += distinctUsers;
      row.pagesPerSession = pagesPerSession;
    }
  }

  for (const info of blocks.get("EngagementTime") ?? []) {
    const row = ensurePageRow(info);
    if (row) {
      row.avgTotalTimeSec = toNumber(info.totalTime);
      row.avgActiveTimeSec = toNumber(info.activeTime);
    }
  }

  for (const info of blocks.get("ScrollDepth") ?? []) {
    const row = ensurePageRow(info);
    if (row) {
      row.avgScrollDepth = toNumber(info.averageScrollDepth);
    }
  }

  const signalRows: ClaritySignalSummaryRow[] = CLARITY_SIGNAL_METRICS.map((metricName) => {
    const infos = blocks.get(metricName) ?? [];
    let sessionsCount = 0;
    let subTotal = 0;
    let pagesViews = 0;
    let weightedAffected = 0;

    for (const info of infos) {
      const rowSessions = toNumber(info.sessionsCount);
      const rowSubTotal = toNumber(info.subTotal);
      const rowPageViews = toNumber(info.pagesViews);
      const rowAffectedPct = toNumber(info.sessionsWithMetricPercentage);

      sessionsCount += rowSessions;
      subTotal += rowSubTotal;
      pagesViews += rowPageViews;
      weightedAffected += rowSessions * rowAffectedPct;

      const pageRow = ensurePageRow(info);
      if (pageRow) {
        if (!pageRow.sessions && rowSessions > 0) {
          pageRow.sessions = rowSessions;
        }
        if (metricName === "DeadClickCount") pageRow.deadClicks += rowSubTotal;
        else if (metricName === "RageClickCount") pageRow.rageClicks += rowSubTotal;
        else if (metricName === "QuickbackClick") pageRow.quickbacks += rowSubTotal;
        else if (metricName === "ExcessiveScroll") pageRow.excessiveScrolls += rowSubTotal;
        else if (metricName === "ScriptErrorCount") pageRow.scriptErrors += rowSubTotal;
        else if (metricName === "ErrorClickCount") pageRow.errorClicks += rowSubTotal;
      }
    }

    return {
      affectedSessionsPercentage: sessionsCount > 0 ? weightedAffected / sessionsCount : 0,
      metricName,
      pagesViews,
      sessionsCount,
      subTotal
    };
  });

  const pageRows = Array.from(pageMap.values()).sort((a, b) => {
    if (b.sessions !== a.sessions) return b.sessions - a.sessions;
    if (b.avgActiveTimeSec !== a.avgActiveTimeSec) return b.avgActiveTimeSec - a.avgActiveTimeSec;
    return a.url.localeCompare(b.url);
  });

  const totalSessions = pageRows.reduce((sum, row) => sum + row.sessions, 0);
  const totalDistinctUsers = pageRows.reduce((sum, row) => sum + row.distinctUsers, 0);
  const weightDenom = totalSessions > 0 ? totalSessions : pageRows.length || 1;
  const rowWeight = (row: ClarityPageMetricRow) => (totalSessions > 0 ? row.sessions : 1);

  const avgTotalTimeSec = pageRows.length
    ? pageRows.reduce((sum, row) => sum + row.avgTotalTimeSec * rowWeight(row), 0) / weightDenom
    : 0;
  const avgActiveTimeSec = pageRows.length
    ? pageRows.reduce((sum, row) => sum + row.avgActiveTimeSec * rowWeight(row), 0) / weightDenom
    : 0;
  const avgScrollDepth = pageRows.length
    ? pageRows.reduce((sum, row) => sum + row.avgScrollDepth * rowWeight(row), 0) / weightDenom
    : 0;
  const pagesPerSession = pageRows.length
    ? pageRows.reduce((sum, row) => sum + row.pagesPerSession * rowWeight(row), 0) / weightDenom
    : 0;

  const signalTotals = Object.fromEntries(
    signalRows.map((row) => [row.metricName, row.subTotal])
  ) as Record<ClaritySignalMetricName, number>;

  const deadClicks = signalTotals.DeadClickCount ?? 0;
  const rageClicks = signalTotals.RageClickCount ?? 0;
  const quickbacks = signalTotals.QuickbackClick ?? 0;
  const excessiveScrolls = signalTotals.ExcessiveScroll ?? 0;
  const scriptErrors = signalTotals.ScriptErrorCount ?? 0;
  const errorClicks = signalTotals.ErrorClickCount ?? 0;

  return {
    available: true,
    cached: options.cached ?? false,
    fetchedAt: options.fetchedAt,
    numOfDays: options.numOfDays ?? 3,
    pageRows,
    projectId: CLARITY_PROJECT_ID,
    quotaNote: "Rolling 72h window (numOfDays=3); cached 3h on disk (<=8 calls/day vs 10/day Clarity limit).",
    signalRows,
    source: "clarity-export-api",
    stale: options.stale,
    totals: {
      avgActiveTimeSec,
      avgScrollDepth,
      avgTotalTimeSec,
      botSessions: totalBotSessions,
      deadClicks,
      distinctUsers: totalDistinctUsers,
      errorClicks,
      excessiveScrolls,
      frustrationEvents:
        deadClicks + rageClicks + quickbacks + excessiveScrolls + scriptErrors + errorClicks,
      pagesPerSession,
      quickbacks,
      rageClicks,
      scriptErrors,
      sessions: totalSessions
    }
  };
}

export function emptyClaritySnapshot(error: string): ClarityLiveInsightsSnapshot {
  return {
    available: false,
    cached: false,
    error,
    numOfDays: 3,
    pageRows: [],
    projectId: CLARITY_PROJECT_ID,
    quotaNote: "Rolling 72h window (numOfDays=3); cached 3h on disk (<=8 calls/day vs 10/day Clarity limit).",
    signalRows: [],
    source: "clarity-export-api",
    totals: {
      avgActiveTimeSec: 0,
      avgScrollDepth: 0,
      avgTotalTimeSec: 0,
      botSessions: 0,
      deadClicks: 0,
      distinctUsers: 0,
      errorClicks: 0,
      excessiveScrolls: 0,
      frustrationEvents: 0,
      pagesPerSession: 0,
      quickbacks: 0,
      rageClicks: 0,
      scriptErrors: 0,
      sessions: 0
    }
  };
}

async function resolveClarityCacheFile(): Promise<string> {
  if (process.env.CLARITY_CACHE_DIR) {
    return path.join(process.env.CLARITY_CACHE_DIR, "live-insights-cache.json");
  }
  const candidates = [
    path.resolve(process.cwd(), ".local/data/clarity"),
    path.resolve(process.cwd(), "../../.local/data/clarity"),
    "/srv/uapt/content/clarity-cache"
  ];
  for (const candidate of candidates) {
    try {
      if ((await stat(candidate)).isDirectory()) {
        return path.join(candidate, "live-insights-cache.json");
      }
    } catch {
      // Try next candidate
    }
  }
  return path.join(candidates[0], "live-insights-cache.json");
}

async function readDiskCache(filePath: string): Promise<ClarityDiskCachePayload | null> {
  try {
    const rawText = await readFile(filePath, "utf8");
    const parsed = JSON.parse(rawText) as Partial<ClarityDiskCachePayload>;
    if (
      parsed &&
      typeof parsed.fetchedAt === "string" &&
      Array.isArray(parsed.raw)
    ) {
      return {
        fetchedAt: parsed.fetchedAt,
        numOfDays: parsed.numOfDays === 1 || parsed.numOfDays === 2 ? parsed.numOfDays : 3,
        raw: parsed.raw
      };
    }
  } catch {
    // No valid cache file
  }
  return null;
}

async function writeDiskCache(filePath: string, payload: ClarityDiskCachePayload): Promise<void> {
  try {
    const dir = path.dirname(filePath);
    await mkdir(dir, { recursive: true });
    const tempPath = `${filePath}.${process.pid}.tmp`;
    await writeFile(tempPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
    await rename(tempPath, filePath);
  } catch {
    // Non-fatal if filesystem is read-only
  }
}

function readDimension(info: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const val = info[key];
    if (typeof val === "string" && val.trim()) {
      return val.trim();
    }
  }
  return "";
}

function toNumber(value: unknown): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value === "string") {
    const cleaned = value.replace("%", "").trim();
    const parsed = Number(cleaned);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}
