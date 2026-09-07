/**
 * Bing Webmaster Tools API integration.
 *
 * Mirrors the google-search-console.ts module pattern:
 *   - API Key authentication (simpler than GSC's JWT)
 *   - In-memory cache with 5 minute TTL
 *   - Returns a BingSummary matching the GscSummary shape
 *
 * Endpoints used:
 *   - GetRankAndTrafficStats → dateRows (daily clicks/impressions)
 *   - GetPageStats           → pageRows (per-page clicks/impressions)
 *   - GetQueryStats          → queryRows (per-query clicks/impressions)
 *
 * The Bing API returns the available history rather than accepting a date
 * range. Rows are filtered and detail rows are aggregated client-side.
 */

export interface BingMetricRow {
  clicks: number;
  ctr: number;
  impressions: number;
  key: string;
  position: number;
}

export interface BingSummary {
  available: boolean;
  dateRows: BingMetricRow[];
  error?: string;
  pageRows: BingMetricRow[];
  queryRows: BingMetricRow[];
  siteUrl?: string;
  totals: {
    clicks: number;
    ctr: number;
    impressions: number;
    position: number;
  };
}

// ---------------------------------------------------------------------------
// Bing API response shapes
// ---------------------------------------------------------------------------

export interface BingApiRow {
  AvgClickPosition?: number;
  AvgImpressionPosition?: number;
  Clicks?: number;
  Date?: string;
  Impressions?: number;
  Query?: string;
}

// ---------------------------------------------------------------------------
// Cache
// ---------------------------------------------------------------------------

const bingSummaryCache = new Map<
  string,
  { expiresAt: number; summary: BingSummary }
>();
const bingSummaryRequests = new Map<string, Promise<BingSummary>>();
const BING_SUMMARY_CACHE_MS = 5 * 60 * 1000;

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

export async function getBingWebmasterSummary(
  startDate: Date,
  endDate: Date,
  options: { detailRowLimit?: number } = {}
): Promise<BingSummary> {
  const siteUrl =
    process.env.BING_WEBMASTER_SITE_URL ?? "https://eduaipolicy.org";
  const apiKey = process.env.BING_WEBMASTER_API_KEY;
  if (!apiKey) {
    return emptyBingSummary({
      error: "Bing Webmaster API key is not configured.",
      siteUrl
    });
  }

  const detailRowLimit = Math.max(
    12,
    Math.min(250, options.detailRowLimit ?? 12)
  );
  const cacheKey = [
    apiKey.slice(0, 8),
    siteUrl,
    formatDate(startDate),
    formatDate(endDate),
    detailRowLimit
  ].join("|");
  const cached = bingSummaryCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.summary;
  const pending = bingSummaryRequests.get(cacheKey);
  if (pending) return pending;

  const request = loadBingSummary(
    apiKey,
    siteUrl,
    startDate,
    endDate,
    detailRowLimit
  )
    .then((summary) => {
      bingSummaryCache.set(cacheKey, {
        expiresAt:
          Date.now() + (summary.available ? BING_SUMMARY_CACHE_MS : 30_000),
        summary
      });
      pruneBingSummaryCache();
      return summary;
    })
    .finally(() => {
      if (bingSummaryRequests.get(cacheKey) === request) {
        bingSummaryRequests.delete(cacheKey);
      }
    });
  bingSummaryRequests.set(cacheKey, request);
  return request;
}

// ---------------------------------------------------------------------------
// Loader
// ---------------------------------------------------------------------------

async function loadBingSummary(
  apiKey: string,
  siteUrl: string,
  startDate: Date,
  endDate: Date,
  detailRowLimit: number
): Promise<BingSummary> {
  try {
    const [dailyRows, pageRows, queryRows] = await Promise.all([
      queryBing(apiKey, siteUrl, "GetRankAndTrafficStats"),
      queryBing(apiKey, siteUrl, "GetPageStats"),
      queryBing(apiKey, siteUrl, "GetQueryStats")
    ]);

    const startStr = formatDate(startDate);
    const endStr = formatDate(endDate);

    // Filter daily rows to the requested date range
    const filteredDateRows = dailyRows
      .map(toBingDateMetricRow)
      .filter((row) => row.key >= startStr && row.key <= endStr)
      .sort((a, b) => a.key.localeCompare(b.key));

    // Bing emits one QueryStats row per key and reporting date. GetPageStats
    // uses the Query property for the page URL, so both endpoints need the
    // same range filter and aggregation before they can be compared.
    const allPageRows = aggregateBingDetailRows(pageRows, startStr, endStr);
    const allQueryRows = aggregateBingDetailRows(queryRows, startStr, endStr);
    const filteredPageRows = allPageRows.slice(0, detailRowLimit);
    const filteredQueryRows = allQueryRows.slice(0, detailRowLimit);
    const totals = getMetricTotals(filteredDateRows);
    totals.position = getMetricTotals(allQueryRows).position;

    return {
      available: true,
      dateRows: filteredDateRows,
      pageRows: filteredPageRows,
      queryRows: filteredQueryRows,
      siteUrl,
      totals
    };
  } catch (error) {
    return emptyBingSummary({
      error: error instanceof Error ? error.message : String(error),
      siteUrl
    });
  }
}

// ---------------------------------------------------------------------------
// Bing API query
// ---------------------------------------------------------------------------

async function queryBing(
  apiKey: string,
  siteUrl: string,
  method: string
): Promise<BingApiRow[]> {
  const url = new URL(
    `https://ssl.bing.com/webmaster/api.svc/json/${method}`
  );
  url.searchParams.set("apikey", apiKey);
  url.searchParams.set("siteUrl", siteUrl);

  const response = await fetch(url.toString(), {
    cache: "no-store",
    headers: { accept: "application/json" }
  });
  if (!response.ok) {
    throw new Error(`Bing ${method} failed: ${response.status}`);
  }
  const data = (await response.json()) as { d?: BingApiRow[] };
  return data.d ?? [];
}

// ---------------------------------------------------------------------------
// Row conversion
// ---------------------------------------------------------------------------

function toBingDateMetricRow(row: BingApiRow): BingMetricRow {
  const clicks = row.Clicks ?? 0;
  const impressions = row.Impressions ?? 0;
  const position = row.AvgImpressionPosition ?? 0;
  return {
    clicks,
    ctr: impressions > 0 ? clicks / impressions : 0,
    impressions,
    key: row.Date ? parseBingDate(row.Date) : "unknown",
    position
  };
}

export function aggregateBingDetailRows(
  rows: BingApiRow[],
  startDate: string,
  endDate: string
): BingMetricRow[] {
  const grouped = new Map<
    string,
    { clicks: number; impressions: number; weightedPosition: number }
  >();

  for (const row of rows) {
    const date = row.Date ? parseBingDate(row.Date) : "unknown";
    const key = row.Query?.trim();
    if (!key || date < startDate || date > endDate) continue;
    const current = grouped.get(key) ?? {
      clicks: 0,
      impressions: 0,
      weightedPosition: 0
    };
    const clicks = row.Clicks ?? 0;
    const impressions = row.Impressions ?? 0;
    current.clicks += clicks;
    current.impressions += impressions;
    current.weightedPosition += (row.AvgImpressionPosition ?? 0) * impressions;
    grouped.set(key, current);
  }

  return [...grouped.entries()]
    .map(([key, value]) => ({
      clicks: value.clicks,
      ctr: value.impressions ? value.clicks / value.impressions : 0,
      impressions: value.impressions,
      key,
      position: value.impressions
        ? value.weightedPosition / value.impressions
        : 0
    }))
    .sort((a, b) =>
      b.impressions - a.impressions ||
      b.clicks - a.clicks ||
      a.key.localeCompare(b.key)
    );
}

/**
 * Bing returns dates in .NET JSON format: "/Date(1781852400000-0700)/"
 * Parse to YYYY-MM-DD string.
 */
function parseBingDate(raw: string): string {
  const match = raw.match(/\/Date\((\d+)/);
  if (!match) return "unknown";
  const timestamp = parseInt(match[1], 10);
  const date = new Date(timestamp);
  return formatDate(date);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getMetricTotals(rows: BingMetricRow[]): BingSummary["totals"] {
  const clicks = rows.reduce((sum, row) => sum + row.clicks, 0);
  const impressions = rows.reduce((sum, row) => sum + row.impressions, 0);
  const weightedPosition = rows.reduce(
    (sum, row) => sum + row.position * row.impressions,
    0
  );

  return {
    clicks,
    ctr: impressions ? clicks / impressions : 0,
    impressions,
    position: impressions ? weightedPosition / impressions : 0
  };
}

function emptyBingSummary(input: {
  error?: string;
  siteUrl?: string;
}): BingSummary {
  return {
    available: false,
    dateRows: [],
    error: input.error,
    pageRows: [],
    queryRows: [],
    siteUrl: input.siteUrl,
    totals: { clicks: 0, ctr: 0, impressions: 0, position: 0 }
  };
}

function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function pruneBingSummaryCache() {
  const now = Date.now();
  for (const [key, value] of bingSummaryCache) {
    if (value.expiresAt <= now) bingSummaryCache.delete(key);
  }
  while (bingSummaryCache.size > 32) {
    const oldestKey = bingSummaryCache.keys().next().value;
    if (typeof oldestKey !== "string") break;
    bingSummaryCache.delete(oldestKey);
  }
}
