import type { AnalyticsEventRow } from "@uapt/db";
import {
  getMirroredAnalyticsRollup,
  hasAnalyticsStore,
  listMirroredAnalyticsEvents,
  type AnalyticsStoreRollup
} from "@/lib/analytics-store";
import {
  getGoogleSearchConsoleSummary,
  type GscMetricRow,
  type GscSummary
} from "@/lib/google-search-console";
import {
  buildPrivateAnalyticsSummary,
  getAnalyticsRowDeviceType,
  getAnalyticsRowLocale,
  getAnalyticsRowSourceCategory,
  isBotAnalyticsRow,
  type AnalyticsPeriod,
  type PrivateAnalyticsCountRow
} from "@/lib/private-analytics";
import type {
  AnalyticsDashboardDetail,
  AnalyticsDashboardFilterOption,
  AnalyticsDashboardFilters,
  AnalyticsDashboardFocus,
  AnalyticsDashboardInsight,
  AnalyticsDashboardMover,
  AnalyticsDashboardOpportunity,
  AnalyticsDashboardPeriod,
  AnalyticsDashboardQuery,
  AnalyticsDashboardResponse,
  AnalyticsDashboardSourceTrendRow
} from "@/lib/private-analytics-dashboard-types";

const ANALYTICS_TIME_ZONE = "America/Toronto";
export const ANALYTICS_TRACKING_BASELINE = "2026-06-19";
export const ANALYTICS_ATTRIBUTION_BASELINE = "2026-06-26";
const MAX_RANGE_DAYS = 180;
const DAY_MS = 24 * 60 * 60 * 1000;

export class AnalyticsDashboardQueryError extends Error {
  readonly code = "invalid_analytics_dashboard_query";
}

export function parseAnalyticsDashboardQuery(
  params: URLSearchParams,
  now = new Date()
): AnalyticsDashboardQuery {
  const today = formatTorontoDate(now);
  const defaultTo = shiftDate(today, -1);
  const rawFrom = params.get("from");
  const rawTo = params.get("to");
  const normalizedFrom = normalizeDate(rawFrom);
  const normalizedTo = normalizeDate(rawTo);
  if (rawFrom !== null && !normalizedFrom) {
    throw new AnalyticsDashboardQueryError("from must be a valid YYYY-MM-DD date");
  }
  if (rawTo !== null && !normalizedTo) {
    throw new AnalyticsDashboardQueryError("to must be a valid YYYY-MM-DD date");
  }
  const requestedTo = normalizedTo ?? defaultTo;
  const requestedFrom = normalizedFrom ?? shiftDate(requestedTo, -29);
  const orderedFrom = requestedFrom <= requestedTo ? requestedFrom : requestedTo;
  const orderedTo = requestedFrom <= requestedTo ? requestedTo : requestedFrom;
  const rangeDays = differenceInDays(orderedFrom, orderedTo) + 1;
  if (rangeDays > MAX_RANGE_DAYS) {
    throw new AnalyticsDashboardQueryError("Date range cannot exceed 180 days");
  }
  const rawGrain = params.get("grain");
  if (rawGrain !== null && !["day", "week", "month"].includes(rawGrain)) {
    throw new AnalyticsDashboardQueryError("grain must be day, week, or month");
  }
  const rawCompare = params.get("compare");
  if (rawCompare !== null && !["previous", "none"].includes(rawCompare)) {
    throw new AnalyticsDashboardQueryError("compare must be previous or none");
  }
  const rawFocus = params.get("focus");
  if (rawFocus !== null && !normalizeFocus(rawFocus)) {
    throw new AnalyticsDashboardQueryError("focus is not supported");
  }
  const from = orderedFrom;
  const to = orderedTo;
  const dayCount = differenceInDays(from, to) + 1;
  const previousTo = shiftDate(from, -1);
  const previousFrom = shiftDate(previousTo, -(dayCount - 1));

  return {
    compare: rawCompare !== "none",
    filters: {
      countries: getRepeatedValues(params, "country"),
      devices: getRepeatedValues(params, "device"),
      locales: getRepeatedValues(params, "locale"),
      sources: getRepeatedValues(params, "source")
    },
    focus: normalizeFocus(rawFocus),
    focusKey: normalizeText(params.get("focusKey")),
    from,
    grain: normalizeGrain(rawGrain, dayCount),
    previousFrom,
    previousTo,
    to
  };
}

export async function getAnalyticsDashboard(
  query: AnalyticsDashboardQuery
): Promise<AnalyticsDashboardResponse> {
  const analyticsStoreAvailable = hasAnalyticsStore();
  const loadFrom = query.compare ? query.previousFrom : query.from;
  const since = dateAtUtcNoon(shiftDate(loadFrom, -1));
  const currentRollupPromise = getMirroredAnalyticsRollup({
    ...query.filters,
    from: query.from,
    grain: query.grain,
    to: query.to
  });
  const previousRollupPromise = query.compare
    ? getMirroredAnalyticsRollup({
        ...query.filters,
        from: query.previousFrom,
        grain: query.grain,
        to: query.previousTo
      })
    : Promise.resolve(null);
  const gscPromise = Promise.all([
    getGoogleSearchConsoleSummary(
      dateAtUtcNoon(query.from),
      dateAtUtcNoon(query.to),
      { detailRowLimit: 250 }
    ),
    query.compare
      ? getGoogleSearchConsoleSummary(
          dateAtUtcNoon(query.previousFrom),
          dateAtUtcNoon(query.previousTo),
          { detailRowLimit: 250 }
        )
      : Promise.resolve(emptyGscSummary())
  ]);
  const [currentRollup, previousRollup] = await Promise.all([
    currentRollupPromise,
    previousRollupPromise
  ]);
  const rollupReady = Boolean(currentRollup && (!query.compare || previousRollup));
  const [allRows, [currentGsc, previousGsc]] = await Promise.all([
    loadRows(since, { excludeBots: false }),
    gscPromise
  ]);

  const currentRangeRows = filterRowsByDate(allRows, query.from, query.to);
  const previousRangeRows = query.compare
    ? filterRowsByDate(allRows, query.previousFrom, query.previousTo)
    : [];
  const filterOptions = buildFilterOptions(
    currentRangeRows.filter((row) => !isBotAnalyticsRow(row))
  );
  const currentRows = applyFilters(currentRangeRows, query.filters);
  const previousRows = applyFilters(previousRangeRows, query.filters);
  const current = buildDashboardPeriod(
    currentRows,
    query.from,
    query.to,
    query.grain,
    currentRollup
  );
  const previous = buildDashboardPeriod(
    previousRows,
    query.previousFrom,
    query.previousTo,
    query.grain,
    previousRollup
  );
  const pageMovers = buildMovers(
    current.summary.topLandingPages,
    previous.summary.topLandingPages
  );
  const sourceMovers = buildMovers(
    current.summary.sourceCategoryVisitors,
    previous.summary.sourceCategoryVisitors
  );
  const queryMovers = buildGscMovers(currentGsc.queryRows, previousGsc.queryRows);
  const gscPageMovers = buildGscMovers(currentGsc.pageRows, previousGsc.pageRows);
  const opportunities = buildQueryOpportunities(currentGsc);
  const comparison = buildComparisonEligibility(query, currentGsc);
  const insights = buildAnalyticsInsights({
    analyticsStoreAvailable,
    current,
    currentGsc,
    opportunities,
    pageMovers,
    previous,
    previousGsc,
    sourceMovers,
    comparison
  });

  return {
    detail: buildDetail(query, current, previous, currentGsc, previousGsc),
    filterOptions,
    gsc: {
      current: currentGsc,
      movers: {
        pages: gscPageMovers,
        queries: queryMovers
      },
      opportunities,
      previous: previousGsc
    },
    insights,
    meta: {
      baselines: {
        attribution: ANALYTICS_ATTRIBUTION_BASELINE,
        tracking: ANALYTICS_TRACKING_BASELINE
      },
      comparison,
      dataStatus: {
        gsc: currentGsc.available ? "connected" : "unavailable",
        onsite: analyticsStoreAvailable ? "connected" : "unavailable",
        rpc: rollupReady ? "ready" : "fallback"
      },
      generatedAt: new Date().toISOString(),
      gscCompleteThrough: currentGsc.dateRows.at(-1)?.key,
      partialDay: query.to >= formatTorontoDate(new Date()),
      query,
      timeZone: ANALYTICS_TIME_ZONE
    },
    onsite: {
      current,
      movers: {
        pages: pageMovers,
        sources: sourceMovers
      },
      previous
    }
  };
}

export function buildAnalyticsInsights(input: {
  analyticsStoreAvailable: boolean;
  current: AnalyticsDashboardPeriod;
  currentGsc: GscSummary;
  opportunities: AnalyticsDashboardOpportunity[];
  pageMovers: AnalyticsDashboardMover[];
  previous: AnalyticsDashboardPeriod;
  previousGsc: GscSummary;
  sourceMovers: AnalyticsDashboardMover[];
  comparison?: AnalyticsDashboardResponse["meta"]["comparison"];
}): AnalyticsDashboardInsight[] {
  const insights: AnalyticsDashboardInsight[] = [];
  const { current, previous, currentGsc, previousGsc } = input;

  if (!input.analyticsStoreAvailable) {
    insights.push(makeInsight(
      "onsite-unavailable",
      "warning",
      100,
      "站内数据不可用",
      "Onsite analytics unavailable",
      "请检查 Supabase 或 DATABASE_URL 配置。",
      "Check the Supabase or DATABASE_URL configuration."
    ));
  }
  if (!currentGsc.available) {
    insights.push(makeInsight(
      "gsc-unavailable",
      "warning",
      99,
      "GSC 数据不可用",
      "GSC data unavailable",
      currentGsc.error ?? "请检查只读凭据。",
      currentGsc.error ?? "Check the read-only credentials."
    ));
  }

  const latestAge = current.latestEventAt
    ? Date.now() - new Date(current.latestEventAt).getTime()
    : Number.POSITIVE_INFINITY;
  if (input.analyticsStoreAvailable && latestAge > DAY_MS) {
    insights.push(makeInsight(
      "stale-events",
      "warning",
      90,
      "站内事件超过 24 小时未更新",
      "Onsite events are more than 24 hours old",
      "优先检查采集端点与数据库写入。",
      "Check the collection endpoint and database writes first."
    ));
  }
  if (current.unknownSourceShare >= 0.2 && current.summary.pageViews >= 20) {
    insights.push(makeInsight(
      "unknown-source",
      "attention",
      80 + current.unknownSourceShare * 10,
      "未知来源占比偏高",
      "Unknown attribution is elevated",
      `${formatPercent(current.unknownSourceShare)} 的浏览量缺少明确来源。`,
      `${formatPercent(current.unknownSourceShare)} of page views lack a clear source.`
    ));
  }

  if (input.comparison?.onsite.eligible !== false) addMetricShiftInsight(insights, {
    current: current.summary.visitors,
    enLabel: "Visitors",
    id: "visitors-shift",
    minimum: 20,
    previous: previous.summary.visitors,
    zhLabel: "访客"
  });
  if (input.comparison?.gsc.eligible !== false) addMetricShiftInsight(insights, {
    current: currentGsc.totals.impressions,
    enLabel: "GSC impressions",
    id: "impressions-shift",
    minimum: 50,
    previous: previousGsc.totals.impressions,
    zhLabel: "GSC 展现"
  });

  const aiMover = input.comparison?.sources.eligible === false
    ? undefined
    : input.sourceMovers.find((row) => row.label === "ai");
  if (
    aiMover &&
    aiMover.change !== null &&
    Math.abs(aiMover.current - aiMover.previous) >= 3 &&
    Math.abs(aiMover.change) >= 0.2
  ) {
    const growing = aiMover.change > 0;
    insights.push(makeInsight(
      "ai-source-shift",
      growing ? "positive" : "negative",
      70 + Math.abs(aiMover.change) * 10,
      `AI 来源访客${growing ? "增长" : "下降"} ${formatPercent(Math.abs(aiMover.change))}`,
      `AI-source visitors ${growing ? "increased" : "decreased"} ${formatPercent(Math.abs(aiMover.change))}`,
      `本期 ${aiMover.current}，上一周期 ${aiMover.previous}。`,
      `${aiMover.current} this period versus ${aiMover.previous} previously.`
    ));
  }

  const opportunity = input.opportunities[0];
  if (opportunity) {
    insights.push(makeInsight(
      `query-opportunity:${opportunity.key}`,
      "attention",
      65 + opportunity.opportunityScore,
      "发现高展现低 CTR 查询",
      "High-impression, low-CTR query found",
      `“${opportunity.key}”有 ${opportunity.impressions} 次展现，CTR 为 ${formatPercent(opportunity.ctr)}。`,
      `“${opportunity.key}” has ${opportunity.impressions} impressions at ${formatPercent(opportunity.ctr)} CTR.`
    ));
  }

  return insights
    .sort((left, right) => right.score - left.score)
    .slice(0, 5);
}

function buildDashboardPeriod(
  rows: AnalyticsEventRow[],
  from: string,
  to: string,
  grain: AnalyticsPeriod,
  rollup: AnalyticsStoreRollup | null
): AnalyticsDashboardPeriod {
  const humanRows = rows.filter(
    (row) => !isBotAnalyticsRow(row) && row.source !== "server"
  );
  const apiRows = rows.filter(
    (row) => row.source === "server" || row.eventName === "api_search_request"
  );
  const botRows = rows.filter(isBotAnalyticsRow);
  const since = dateAtUtcNoon(from);
  const until = dateAtUtcNoon(to);
  const summary = buildPrivateAnalyticsSummary(humanRows, since, grain, until);
  const botSummary = buildPrivateAnalyticsSummary(botRows, since, grain, until);
  const unknown = summary.sourceCategories.find((row) => row.label === "unknown");
  return {
    api: buildApiMetrics(apiRows),
    bot: buildBotDiagnostics(botRows),
    botPageViews: rollup?.botPageViews ?? botSummary.pageViews,
    botTrend: rollup
      ? rollup.botTrend.map((row) => ({
          events: row.pageViews,
          label: row.label,
          pageViews: row.pageViews,
          sessions: 0,
          visitors: 0
        }))
      : botSummary.trend,
    latestEventAt: rollup?.latestEventAt ?? rows.at(-1)?.createdAt,
    quality: buildQualityMetrics(humanRows),
    sourceTrend: buildSourceTrend(humanRows, summary.trend, grain),
    summary,
    unknownSourceShare: rollup?.humanPageViews
      ? rollup.unknownSourcePageViews / rollup.humanPageViews
      : unknown?.share ?? 0
  };
}

function buildApiMetrics(rows: AnalyticsEventRow[]) {
  return {
    clientKinds: countAnalyticsRows(rows, (row) => getPayloadText(row, "client_kind")),
    latencyBuckets: countAnalyticsRows(
      rows,
      (row) => getPayloadText(row, "request_latency_bucket")
    ),
    queryKinds: countAnalyticsRows(rows, (row) => row.queryKind ?? undefined),
    requests: rows.filter((row) => row.eventName === "api_search_request").length,
    zeroResultRequests: rows.filter(
      (row) => row.eventName === "api_search_request" && row.resultCountBucket === "0"
    ).length
  };
}

function buildBotDiagnostics(rows: AnalyticsEventRow[]) {
  const pageViews = rows.filter((row) => row.eventName === "page_view");
  const families = countAnalyticsRows(
    pageViews,
    (row) => getPayloadText(row, "bot_family") ?? "unclassified"
  );
  const knownFamilyPageViews = families
    .filter((row) => row.label !== "unclassified" && row.label !== "other_bot")
    .reduce((sum, row) => sum + row.count, 0);
  return {
    families,
    knownFamilyPageViews,
    uniquePaths: new Set(pageViews.map((row) => row.pathname)).size,
    unknownFamilyPageViews: pageViews.length - knownFamilyPageViews
  };
}

function buildQualityMetrics(rows: AnalyticsEventRow[]) {
  const pageViews = rows.filter((row) => row.eventName === "page_view");
  return {
    collectorVersions: countAnalyticsRows(
      rows,
      (row) => getPayloadText(row, "collector_version") ?? "legacy"
    ),
    sessionIdCoverage: pageViews.length
      ? pageViews.filter((row) => Boolean(row.sessionId)).length / pageViews.length
      : 0,
    visitorIdCoverage: pageViews.length
      ? pageViews.filter((row) => Boolean(row.visitorId)).length / pageViews.length
      : 0
  };
}

function countAnalyticsRows(
  rows: AnalyticsEventRow[],
  getter: (row: AnalyticsEventRow) => string | undefined
): Array<{ count: number; label: string }> {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const label = getter(row);
    if (!label) continue;
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  return Array.from(counts, ([label, count]) => ({ count, label }))
    .sort((left, right) => right.count - left.count || left.label.localeCompare(right.label));
}

function getPayloadText(row: AnalyticsEventRow, key: string): string | undefined {
  if (!row.payload || typeof row.payload !== "object" || Array.isArray(row.payload)) {
    return undefined;
  }
  const value = (row.payload as Record<string, unknown>)[key];
  return typeof value === "string" && value.trim() ? value.trim().toLowerCase() : undefined;
}

export function buildComparisonEligibility(
  query: AnalyticsDashboardQuery,
  currentGsc: GscSummary
): AnalyticsDashboardResponse["meta"]["comparison"] {
  const disabledReason = {
    en: "Previous-period comparison is disabled.",
    zh: "未启用上一周期对比。"
  };
  const onsiteEligible = query.compare && query.previousFrom >= ANALYTICS_TRACKING_BASELINE;
  const sourcesEligible = query.compare && query.previousFrom >= ANALYTICS_ATTRIBUTION_BASELINE;
  const gscCompleteThrough = currentGsc.dateRows.at(-1)?.key;
  const gscEligible = Boolean(
    query.compare &&
    currentGsc.available &&
    gscCompleteThrough &&
    gscCompleteThrough >= query.to
  );
  return {
    gsc: {
      eligible: gscEligible,
      reason: gscEligible
        ? undefined
        : !query.compare
          ? disabledReason
          : {
              en: `GSC finalized data currently ends at ${gscCompleteThrough ?? "an unavailable date"}.`,
              zh: `GSC 已完成数据目前截止 ${gscCompleteThrough ?? "未知日期"}。`
            }
    },
    onsite: {
      eligible: onsiteEligible,
      reason: onsiteEligible
        ? undefined
        : !query.compare
          ? disabledReason
          : {
              en: `The previous period starts before the onsite tracking baseline (${ANALYTICS_TRACKING_BASELINE}).`,
              zh: `上一周期早于站内埋点基线（${ANALYTICS_TRACKING_BASELINE}）。`
            }
    },
    sources: {
      eligible: sourcesEligible,
      reason: sourcesEligible
        ? undefined
        : !query.compare
          ? disabledReason
          : {
              en: `The previous period crosses the attribution v2 baseline (${ANALYTICS_ATTRIBUTION_BASELINE}).`,
              zh: `上一周期跨越来源归因 v2 基线（${ANALYTICS_ATTRIBUTION_BASELINE}）。`
            }
    }
  };
}

function applyFilters(
  rows: AnalyticsEventRow[],
  filters: AnalyticsDashboardFilters
): AnalyticsEventRow[] {
  return rows.filter((row) => {
    if (isBotAnalyticsRow(row) || row.source === "server") return true;
    if (
      filters.sources.length &&
      !filters.sources.includes(getAnalyticsRowSourceCategory(row))
    ) return false;
    const country = normalizeCountry(row.countryCode);
    if (filters.countries.length && !filters.countries.includes(country)) return false;
    const locale = getAnalyticsRowLocale(row);
    if (filters.locales.length && !filters.locales.includes(locale)) return false;
    const device = getAnalyticsRowDeviceType(row);
    if (filters.devices.length && !filters.devices.includes(device)) return false;
    return true;
  });
}

function buildFilterOptions(rows: AnalyticsEventRow[]) {
  return {
    countries: countOptions(rows, (row) => normalizeCountry(row.countryCode)),
    devices: countOptions(rows, getAnalyticsRowDeviceType),
    locales: countOptions(rows, getAnalyticsRowLocale),
    sources: countOptions(rows, getAnalyticsRowSourceCategory)
  };
}

function countOptions(
  rows: AnalyticsEventRow[],
  getter: (row: AnalyticsEventRow) => string
): AnalyticsDashboardFilterOption[] {
  const counts = new Map<string, number>();
  for (const row of rows) {
    if (row.eventName !== "page_view") continue;
    const value = getter(row);
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([value, count]) => ({ count, label: value, value }))
    .sort((left, right) => right.count - left.count || left.value.localeCompare(right.value));
}

function buildSourceTrend(
  rows: AnalyticsEventRow[],
  trend: Array<{ label: string }>,
  grain: AnalyticsPeriod
): AnalyticsDashboardSourceTrendRow[] {
  const buckets = new Map<string, AnalyticsDashboardSourceTrendRow>();
  for (const item of trend) {
    buckets.set(item.label, emptySourceTrendRow(item.label));
  }
  for (const row of rows) {
    if (row.eventName !== "page_view") continue;
    const label = getBucketLabel(formatTorontoDate(new Date(row.createdAt)), grain);
    const bucket = buckets.get(label);
    if (!bucket) continue;
    const category = getAnalyticsRowSourceCategory(row);
    if (category === "direct" || category === "search" || category === "ai" || category === "referral" || category === "unknown") {
      bucket[category] += 1;
    } else {
      bucket.other += 1;
    }
  }
  return Array.from(buckets.values());
}

function emptySourceTrendRow(label: string): AnalyticsDashboardSourceTrendRow {
  return { ai: 0, direct: 0, label, other: 0, referral: 0, search: 0, unknown: 0 };
}

function buildMovers(
  currentRows: PrivateAnalyticsCountRow[],
  previousRows: PrivateAnalyticsCountRow[]
): AnalyticsDashboardMover[] {
  const current = new Map(currentRows.map((row) => [row.label, row.count]));
  const previous = new Map(previousRows.map((row) => [row.label, row.count]));
  return buildMoverRows(current, previous);
}

function buildGscMovers(
  currentRows: GscMetricRow[],
  previousRows: GscMetricRow[]
): AnalyticsDashboardMover[] {
  return buildMoverRows(
    new Map(currentRows.map((row) => [row.key, row.impressions])),
    new Map(previousRows.map((row) => [row.key, row.impressions]))
  );
}

function buildMoverRows(
  current: Map<string, number>,
  previous: Map<string, number>
): AnalyticsDashboardMover[] {
  const keys = new Set([...current.keys(), ...previous.keys()]);
  return Array.from(keys)
    .map((label) => {
      const currentValue = current.get(label) ?? 0;
      const previousValue = previous.get(label) ?? 0;
      return {
        change: previousValue ? (currentValue - previousValue) / previousValue : currentValue ? null : 0,
        current: currentValue,
        label,
        previous: previousValue
      };
    })
    .sort((left, right) => {
      const leftImpact = Math.abs(left.current - left.previous);
      const rightImpact = Math.abs(right.current - right.previous);
      return rightImpact - leftImpact || left.label.localeCompare(right.label);
    })
    .slice(0, 12);
}

export function buildQueryOpportunities(gsc: GscSummary): AnalyticsDashboardOpportunity[] {
  const threshold = gsc.totals.ctr * 0.75;
  return gsc.queryRows
    .filter((row) =>
      row.impressions >= 30 &&
      row.position >= 4 &&
      row.position <= 20 &&
      row.ctr < threshold
    )
    .map((row) => ({
      ...row,
      opportunityScore:
        Math.log10(row.impressions + 1) * Math.max(0.01, threshold - row.ctr) * 100
    }))
    .sort((left, right) => right.opportunityScore - left.opportunityScore)
    .slice(0, 24);
}

function buildDetail(
  query: AnalyticsDashboardQuery,
  current: AnalyticsDashboardPeriod,
  previous: AnalyticsDashboardPeriod,
  currentGsc: GscSummary,
  previousGsc: GscSummary
): AnalyticsDashboardDetail | undefined {
  if (!query.focus || !query.focusKey) return undefined;
  const currentValue = getFocusValue(query.focus, query.focusKey, current, currentGsc);
  const previousValue = getFocusValue(query.focus, query.focusKey, previous, previousGsc);
  return {
    current: currentValue,
    key: query.focusKey,
    kind: query.focus,
    previous: previousValue,
    rows: [
      { label: "current", value: String(currentValue) },
      { label: "previous", value: String(previousValue) },
      {
        label: "change",
        value: previousValue
          ? formatPercent((currentValue - previousValue) / previousValue)
          : currentValue ? "new" : "0%"
      }
    ]
  };
}

function getFocusValue(
  focus: AnalyticsDashboardFocus,
  key: string,
  period: AnalyticsDashboardPeriod,
  gsc: GscSummary
): number {
  if (focus === "query") return gsc.queryRows.find((row) => row.key === key)?.impressions ?? 0;
  if (focus === "page") return gsc.pageRows.find((row) => row.key === key)?.impressions ?? 0;
  if (focus === "source") return period.summary.sourceCategoryVisitors.find((row) => row.label === key)?.count ?? 0;
  if (focus === "landing") return period.summary.topLandingPages.find((row) => row.label === key)?.count ?? 0;
  if (focus === "country") return period.summary.countries.find((row) => row.countryCode === key)?.pageViews ?? 0;
  if (focus === "locale") return period.summary.topLanguages.find((row) => row.label === key)?.count ?? 0;
  if (focus === "device") return period.summary.devices.find((row) => row.deviceType === key)?.pageViews ?? 0;
  return 0;
}

function addMetricShiftInsight(
  insights: AnalyticsDashboardInsight[],
  input: {
    current: number;
    enLabel: string;
    id: string;
    minimum: number;
    previous: number;
    zhLabel: string;
  }
) {
  if (Math.max(input.current, input.previous) < input.minimum || input.previous === 0) return;
  const change = (input.current - input.previous) / input.previous;
  if (Math.abs(change) < 0.2) return;
  const growing = change > 0;
  insights.push(makeInsight(
    input.id,
    growing ? "positive" : "negative",
    60 + Math.abs(change) * 10,
    `${input.zhLabel}${growing ? "增长" : "下降"} ${formatPercent(Math.abs(change))}`,
    `${input.enLabel} ${growing ? "increased" : "decreased"} ${formatPercent(Math.abs(change))}`,
    `本期 ${input.current}，上一周期 ${input.previous}。`,
    `${input.current} this period versus ${input.previous} previously.`
  ));
}

function makeInsight(
  id: string,
  tone: AnalyticsDashboardInsight["tone"],
  score: number,
  zhTitle: string,
  enTitle: string,
  zhDetail: string,
  enDetail: string
): AnalyticsDashboardInsight {
  return {
    detail: { en: enDetail, zh: zhDetail },
    id,
    score,
    title: { en: enTitle, zh: zhTitle },
    tone
  };
}

async function loadRows(
  since: Date,
  options: { excludeBots?: boolean }
): Promise<AnalyticsEventRow[]> {
  if (!hasAnalyticsStore()) return [];
  try {
    return await listMirroredAnalyticsEvents(since, options);
  } catch {
    return [];
  }
}

function filterRowsByDate(rows: AnalyticsEventRow[], from: string, to: string) {
  return rows.filter((row) => {
    const date = formatTorontoDate(new Date(row.createdAt));
    return date >= from && date <= to;
  });
}

function normalizeGrain(value: string | null, days: number): AnalyticsPeriod {
  if (value === "day" || value === "week" || value === "month") return value;
  if (days > 120) return "month";
  if (days > 45) return "week";
  return "day";
}

function normalizeFocus(value: string | null): AnalyticsDashboardFocus | undefined {
  const allowed: AnalyticsDashboardFocus[] = [
    "country", "device", "landing", "locale", "metric", "page", "query", "source"
  ];
  return allowed.includes(value as AnalyticsDashboardFocus)
    ? value as AnalyticsDashboardFocus
    : undefined;
}

function normalizeDate(value: string | null): string | undefined {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const parsed = new Date(`${value}T12:00:00Z`);
  return Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value
    ? undefined
    : value;
}

function normalizeText(value: string | null): string | undefined {
  const normalized = value?.trim().slice(0, 255);
  return normalized || undefined;
}

function getRepeatedValues(params: URLSearchParams, key: string): string[] {
  return Array.from(new Set(params.getAll(key).map((value) => value.trim().toLowerCase()).filter(Boolean)))
    .slice(0, 12);
}

function normalizeCountry(value: string | null | undefined): string {
  const normalized = value?.trim().toUpperCase();
  return normalized && /^[A-Z]{2}$/.test(normalized) ? normalized : "unknown";
}

function getBucketLabel(date: string, grain: AnalyticsPeriod): string {
  if (grain === "day") return date.slice(5);
  if (grain === "month") return date.slice(0, 7);
  const value = new Date(`${date}T12:00:00Z`);
  const day = value.getUTCDay() || 7;
  value.setUTCDate(value.getUTCDate() - day + 1);
  return `Wk ${value.toISOString().slice(5, 10)}`;
}

function formatTorontoDate(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    timeZone: ANALYTICS_TIME_ZONE,
    year: "numeric"
  }).formatToParts(date);
  const part = (type: string) => parts.find((item) => item.type === type)?.value ?? "00";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

function shiftDate(value: string, days: number): string {
  const date = dateAtUtcNoon(value);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function differenceInDays(from: string, to: string): number {
  return Math.round((dateAtUtcNoon(to).getTime() - dateAtUtcNoon(from).getTime()) / DAY_MS);
}

function dateAtUtcNoon(value: string): Date {
  return new Date(`${value}T12:00:00Z`);
}

function formatPercent(value: number): string {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 1,
    style: "percent"
  }).format(value);
}

function emptyGscSummary(): GscSummary {
  return {
    available: false,
    countryRows: [],
    dateRows: [],
    deviceRows: [],
    pageRows: [],
    queryRows: [],
    totals: { clicks: 0, ctr: 0, impressions: 0, position: 0 }
  };
}
