import assert from "node:assert/strict";
import type { AnalyticsEventRow } from "@uapt/db";
import type { GscSummary } from "../apps/web/lib/google-search-console.ts";
import {
  buildComparisonEligibility,
  buildAnalyticsInsights,
  buildQueryOpportunities,
  parseAnalyticsDashboardQuery
} from "../apps/web/lib/private-analytics-dashboard.ts";
import {
  buildPrivateAnalyticsSummary,
  getAnalyticsRowSourceCategory
} from "../apps/web/lib/private-analytics.ts";

const parsed = parseAnalyticsDashboardQuery(
  new URLSearchParams({ from: "2026-01-01", to: "2026-06-29", grain: "day" }),
  new Date("2026-07-10T12:00:00Z")
);
assert.equal(parsed.to, "2026-06-29");
assert.equal(daysBetween(parsed.from, parsed.to) + 1, 180);
assert.equal(daysBetween(parsed.previousFrom, parsed.previousTo) + 1, 180);
assert.throws(
  () => parseAnalyticsDashboardQuery(
    new URLSearchParams({ from: "2026-01-01", to: "2026-06-30" })
  ),
  /cannot exceed 180 days/
);
assert.throws(
  () => parseAnalyticsDashboardQuery(new URLSearchParams({ grain: "hour" })),
  /grain must be/
);

const rows: AnalyticsEventRow[] = [
  event("page-1", "page_view", "2026-07-01T14:00:00Z", "session-1", {
    source_category: "ai",
    source_name: "chatgpt"
  }),
  event("search-1", "search_submit", "2026-07-01T14:01:00Z", "session-1"),
  event("search-2", "search_submit", "2026-07-01T14:02:00Z", "session-1"),
  event("source-1", "official_source_click", "2026-07-01T14:03:00Z", "session-1"),
  event("page-2", "page_view", "2026-07-02T14:00:00Z", "session-2", {
    source_category: "direct"
  })
];
const summary = buildPrivateAnalyticsSummary(
  rows,
  new Date("2026-07-01T12:00:00Z"),
  "day",
  new Date("2026-07-02T12:00:00Z")
);
assert.equal(summary.sessions, 2);
assert.equal(summary.funnel.find((row) => row.label === "Search submits")?.count, 1);
assert.ok(summary.funnel.every((row) => row.share <= 1));
assert.equal(summary.trend.length, 2);
assert.equal(getAnalyticsRowSourceCategory(rows[0]), "ai");
assert.equal(
  getAnalyticsRowSourceCategory(
    event("unknown-source", "page_view", "2026-07-02T15:00:00Z", "session-3")
  ),
  "unknown"
);
assert.equal(summary.engagedSessions, 1);

const baselineComparison = buildComparisonEligibility(
  {
    compare: true,
    filters: { countries: [], devices: [], locales: [], sources: [] },
    from: "2026-07-01",
    grain: "day",
    previousFrom: "2026-06-01",
    previousTo: "2026-06-30",
    to: "2026-07-30"
  },
  gscSummary([])
);
assert.equal(baselineComparison.onsite.eligible, false);
assert.equal(baselineComparison.sources.eligible, false);

const gsc = gscSummary([
  { clicks: 1, ctr: 0.005, impressions: 240, key: "university ai policy", position: 8 },
  { clicks: 12, ctr: 0.12, impressions: 100, key: "high ctr", position: 3 }
]);
const opportunities = buildQueryOpportunities(gsc);
assert.equal(opportunities.length, 1);
assert.equal(opportunities[0]?.key, "university ai policy");

const period = {
  api: { clientKinds: [], latencyBuckets: [], queryKinds: [], requests: 0, zeroResultRequests: 0 },
  bot: { families: [], knownFamilyPageViews: 0, uniquePaths: 0, unknownFamilyPageViews: 0 },
  botPageViews: 0,
  botTrend: [],
  latestEventAt: new Date().toISOString(),
  quality: { collectorVersions: [], sessionIdCoverage: 1, visitorIdCoverage: 1 },
  sourceTrend: [],
  summary,
  unknownSourceShare: 0
};
const insights = buildAnalyticsInsights({
  analyticsStoreAvailable: true,
  current: period,
  currentGsc: gsc,
  opportunities,
  pageMovers: [],
  previous: { ...period, summary: { ...summary, visitors: 0 } },
  previousGsc: gscSummary([]),
  sourceMovers: []
});
assert.ok(insights.length <= 5);
assert.ok(!JSON.stringify(insights).includes("Infinity"));

console.log("private analytics dashboard smoke: ok");

function event(
  id: string,
  eventName: string,
  createdAt: string,
  sessionId: string,
  payload: Record<string, string> = {}
): AnalyticsEventRow {
  return {
    createdAt,
    deviceType: "desktop",
    eventName,
    id,
    locale: "en",
    pathname: "/search",
    payload,
    sessionId,
    source: "client",
    visitorId: `visitor-${sessionId}`
  };
}

function gscSummary(queryRows: GscSummary["queryRows"]): GscSummary {
  const clicks = queryRows.reduce((sum, row) => sum + row.clicks, 0);
  const impressions = queryRows.reduce((sum, row) => sum + row.impressions, 0);
  return {
    available: true,
    countryRows: [],
    dateRows: [],
    deviceRows: [],
    pageRows: [],
    queryRows,
    totals: {
      clicks,
      ctr: impressions ? clicks / impressions : 0,
      impressions,
      position: 8
    }
  };
}

function daysBetween(from: string, to: string) {
  return Math.round(
    (new Date(`${to}T12:00:00Z`).getTime() - new Date(`${from}T12:00:00Z`).getTime()) /
      86_400_000
  );
}
