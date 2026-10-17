import assert from "node:assert/strict";
import { mkdtemp, rm, utimes, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { AnalyticsEventRow } from "@uapt/db";
import { aggregateBingDetailRows } from "../apps/web/lib/bing-webmaster.ts";
import {
  getBingAiPerformanceSnapshot,
  parseBingAiOverviewCsv,
  parseBingAiPagesCsv,
  parseBingAiQueriesCsv,
  parseBingAiTopicPortfolioCsv,
  parseBingAiOpportunityQueriesCsv,
  resolveOptionalSnapshotFile
} from "../apps/web/lib/bing-ai-performance.ts";
import {
  clearClarityInsightsMemoryCache,
  getClarityLiveInsightsSnapshot,
  parseClarityLiveInsights
} from "../apps/web/lib/clarity-insights.ts";
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

const bingRows = aggregateBingDetailRows(
  [
    bingRow("2026-07-01", "university ai policy", 3, 30, 4),
    bingRow("2026-07-02", "university ai policy", 2, 20, 6),
    bingRow("2026-06-30", "outside range", 99, 100, 1),
    bingRow("2026-07-02", "https://eduaipolicy.org/universities/example", 1, 10, 8)
  ],
  "2026-07-01",
  "2026-07-02"
);
assert.equal(bingRows.length, 2);
assert.deepEqual(bingRows[0], {
  clicks: 5,
  ctr: 0.1,
  impressions: 50,
  key: "university ai policy",
  position: 4.8
});
assert.equal(bingRows[1]?.key, "https://eduaipolicy.org/universities/example");

const bingAiDates = parseBingAiOverviewCsv(
  '\uFEFF"Date","Citations","Cited Pages"\r\n"9/5/2026 12:00:00 AM","12","4"\r\n'
);
assert.deepEqual(bingAiDates, [{ citations: 12, citedPages: 4, key: "2026-09-05" }]);
assert.deepEqual(
  parseBingAiPagesCsv('"Page","Citations"\n"https://eduaipolicy.org/a","7"\n'),
  [{ citations: 7, key: "https://eduaipolicy.org/a" }]
);
assert.deepEqual(
  parseBingAiQueriesCsv('"Grounding Query","Intent","Topic","Citations","Citation Share"\n"ai policy","Informational","AI, Policy","5","12.5%"\n'),
  [{ citationShare: 0.125, citations: 5, intent: "Informational", key: "ai policy", topic: "AI, Policy" }]
);
assert.deepEqual(
  parseBingAiTopicPortfolioCsv('"Topic","Volume Range","Queries Range","Sites Range"\n"Education","1B-5B","1M-5M","100K-500K"\n'),
  [{ queriesRange: "1M-5M", sitesRange: "100K-500K", topic: "Education", volumeRange: "1B-5B" }]
);
assert.deepEqual(
  parseBingAiOpportunityQueriesCsv('Query,Topic,Citation Range\n"ai whistleblower","AI Ethics & Regulation","1K-5K"\n'),
  [{ citationRange: "1K-5K", query: "ai whistleblower", topic: "AI Ethics & Regulation" }]
);

const clarityParsed = parseClarityLiveInsights(
  [
    {
      metricName: "Traffic",
      information: [
        {
          totalSessionCount: "1",
          totalBotSessionCount: "0",
          distinctUserCount: "1",
          pagesPerSessionPercentage: 1,
          Url: "https://eduaipolicy.org/zh/universities/tsinghua-university",
          Device: "PC"
        },
        {
          totalSessionCount: "1",
          totalBotSessionCount: "0",
          distinctUserCount: "1",
          pagesPerSessionPercentage: 1,
          Url: "https://eduaipolicy.org/zh/universities/cornell-university",
          Device: "PC"
        }
      ]
    },
    {
      metricName: "EngagementTime",
      information: [
        {
          totalTime: "50",
          activeTime: "50",
          Url: "https://eduaipolicy.org/zh/universities/tsinghua-university",
          Device: "PC"
        },
        {
          totalTime: "13",
          activeTime: "13",
          Url: "https://eduaipolicy.org/zh/universities/cornell-university",
          Device: "PC"
        }
      ]
    },
    {
      metricName: "ScrollDepth",
      information: [
        {
          averageScrollDepth: 13,
          Url: "https://eduaipolicy.org/zh/universities/tsinghua-university",
          Device: "PC"
        },
        {
          averageScrollDepth: 100,
          Url: "https://eduaipolicy.org/zh/universities/cornell-university",
          Device: "PC"
        }
      ]
    },
    {
      metricName: "DeadClickCount",
      information: [
        {
          sessionsCount: "1",
          sessionsWithMetricPercentage: 0,
          sessionsWithoutMetricPercentage: 100,
          pagesViews: "0",
          subTotal: "0",
          Url: "https://eduaipolicy.org/zh/universities/tsinghua-university",
          Device: "PC"
        }
      ]
    }
  ],
  { cached: true, fetchedAt: "2026-10-17T13:55:00.000Z", numOfDays: 3 }
);
assert.equal(clarityParsed.available, true);
assert.equal(clarityParsed.totals.sessions, 2);
assert.equal(clarityParsed.totals.distinctUsers, 2);
assert.equal(clarityParsed.totals.avgActiveTimeSec, 31.5);
assert.equal(clarityParsed.totals.avgScrollDepth, 56.5);
assert.equal(clarityParsed.totals.frustrationEvents, 0);
assert.equal(clarityParsed.pageRows.length, 2);

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

async function verifyBingAiAndClaritySnapshotResolution() {
  const tempSnapshotDir = await mkdtemp(path.join(os.tmpdir(), "uapt-bing-ai-smoke-"));
  try {
    const oldTopicPath = path.join(tempSnapshotDir, "topic-portfolio.csv");
    const newTopicPath = path.join(tempSnapshotDir, "eduaipolicy.org_AITopicsOverallPortfolio_11_01_2026.csv");
    await writeFile(oldTopicPath, '"Topic","Volume Range","Queries Range","Sites Range"\n"Old Topic","1M-5M","1K-5K","1K-5K"\n', "utf8");
    await writeFile(newTopicPath, '"Topic","Volume Range","Queries Range","Sites Range"\n"New Topic","10M-50M","10K-50K","10K-50K"\n', "utf8");
    const oldTime = new Date("2026-10-01T00:00:00Z");
    const newTime = new Date("2026-11-01T00:00:00Z");
    await utimes(oldTopicPath, oldTime, oldTime);
    await utimes(newTopicPath, newTime, newTime);

    const selected = await resolveOptionalSnapshotFile(
      tempSnapshotDir,
      ["topic-portfolio.csv", "topics.csv"],
      /AITopicsOverallPortfolio/i
    );
    assert.equal(selected?.path, newTopicPath);

    const previousDir = process.env.BING_AI_PERFORMANCE_SNAPSHOT_DIR;
    const previousClarityDir = process.env.CLARITY_CACHE_DIR;
    process.env.BING_AI_PERFORMANCE_SNAPSHOT_DIR = tempSnapshotDir;
    process.env.CLARITY_CACHE_DIR = tempSnapshotDir;
    try {
      const partialSnapshot = await getBingAiPerformanceSnapshot();
      assert.equal(partialSnapshot.available, true);
      assert.equal(partialSnapshot.topicPortfolioRows[0]?.topic, "New Topic");
      assert.equal(partialSnapshot.importedAt, newTime.toISOString());

      await writeFile(
        path.join(tempSnapshotDir, "live-insights-cache.json"),
        JSON.stringify({
          fetchedAt: new Date().toISOString(),
          numOfDays: 3,
          raw: [
            {
              metricName: "Traffic",
              information: [
                {
                  totalSessionCount: "2",
                  totalBotSessionCount: "0",
                  distinctUserCount: "2",
                  pagesPerSessionPercentage: 1,
                  Url: "https://eduaipolicy.org/zh/universities/cornell-university",
                  Device: "PC"
                }
              ]
            }
          ]
        }),
        "utf8"
      );
      clearClarityInsightsMemoryCache();
      const claritySnapshot = await getClarityLiveInsightsSnapshot();
      assert.equal(claritySnapshot.available, true);
      assert.equal(claritySnapshot.cached, true);
      assert.equal(claritySnapshot.totals.sessions, 2);
    } finally {
      clearClarityInsightsMemoryCache();
      if (previousDir === undefined) delete process.env.BING_AI_PERFORMANCE_SNAPSHOT_DIR;
      else process.env.BING_AI_PERFORMANCE_SNAPSHOT_DIR = previousDir;
      if (previousClarityDir === undefined) delete process.env.CLARITY_CACHE_DIR;
      else process.env.CLARITY_CACHE_DIR = previousClarityDir;
    }
  } finally {
    await rm(tempSnapshotDir, { force: true, recursive: true });
  }
  console.log("private analytics dashboard smoke: ok");
}

void verifyBingAiAndClaritySnapshotResolution().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

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

function bingRow(
  date: string,
  query: string,
  clicks: number,
  impressions: number,
  position: number
) {
  return {
    AvgImpressionPosition: position,
    Clicks: clicks,
    Date: `/Date(${new Date(`${date}T07:00:00Z`).getTime()}-0700)/`,
    Impressions: impressions,
    Query: query
  };
}

function daysBetween(from: string, to: string) {
  return Math.round(
    (new Date(`${to}T12:00:00Z`).getTime() - new Date(`${from}T12:00:00Z`).getTime()) /
      86_400_000
  );
}
