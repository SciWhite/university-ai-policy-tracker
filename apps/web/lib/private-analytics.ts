import type { AnalyticsEventRow } from "@uapt/db";

export interface PrivateAnalyticsCountRow {
  count: number;
  label: string;
  share: number;
}

export interface PrivateAnalyticsDailyRow {
  date: string;
  events: number;
  pageViews: number;
  visitors: number;
}

export interface PrivateAnalyticsFunnelRow {
  count: number;
  label: string;
  share: number;
}

export interface PrivateAnalyticsSummary {
  bounceRate: number;
  daily: PrivateAnalyticsDailyRow[];
  engagedSessions: number;
  events: number;
  funnel: PrivateAnalyticsFunnelRow[];
  pageViews: number;
  recent: AnalyticsEventRow[];
  sessions: number;
  topDomains: PrivateAnalyticsCountRow[];
  topEntities: PrivateAnalyticsCountRow[];
  topEvents: PrivateAnalyticsCountRow[];
  topPages: PrivateAnalyticsCountRow[];
  visitors: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const ANALYTICS_TIME_ZONE = "America/Toronto";

export function buildPrivateAnalyticsSummary(
  rows: AnalyticsEventRow[],
  since: Date
): PrivateAnalyticsSummary {
  const pageViewRows = rows.filter((row) => row.eventName === "page_view");
  const eventCounts = countBy(rows, (row) => row.eventName);
  const customEventCounts = countBy(
    rows.filter((row) => row.eventName !== "page_view"),
    (row) => row.eventName
  );
  const pageCounts = countBy(pageViewRows, (row) => row.pathname);
  const entityCounts = countBy(rows, (row) => row.entitySlug ?? undefined);
  const domainCounts = countBy(rows, (row) => row.sourceDomain ?? undefined);
  const visitors = new Set(
    pageViewRows.map((row) => row.visitorId).filter(isPresent)
  ).size;

  const sessionStats = new Map<string, { engaged: boolean; pageViews: number }>();
  for (const row of rows) {
    const sessionKey = row.sessionId ?? row.visitorId;
    if (!sessionKey) continue;

    const stats = sessionStats.get(sessionKey) ?? {
      engaged: false,
      pageViews: 0
    };

    if (row.eventName === "page_view") {
      stats.pageViews += 1;
    } else {
      stats.engaged = true;
    }

    sessionStats.set(sessionKey, stats);
  }

  const sessions = sessionStats.size;
  const engagedSessions = Array.from(sessionStats.values()).filter(
    (stats) => stats.engaged
  ).length;
  const bounceSessions = Array.from(sessionStats.values()).filter(
    (stats) => stats.pageViews === 1 && !stats.engaged
  ).length;

  return {
    bounceRate: sessions ? bounceSessions / sessions : 0,
    daily: buildDailySeries(rows, since),
    engagedSessions,
    events: rows.length,
    funnel: buildFunnel(eventCounts, pageViewRows.length),
    pageViews: pageViewRows.length,
    recent: rows.slice().reverse().slice(0, 25),
    sessions,
    topDomains: toCountRows(domainCounts),
    topEntities: toCountRows(entityCounts),
    topEvents: toCountRows(customEventCounts),
    topPages: toCountRows(pageCounts),
    visitors
  };
}

function buildDailySeries(
  rows: AnalyticsEventRow[],
  since: Date
): PrivateAnalyticsDailyRow[] {
  const buckets = new Map<
    string,
    { events: number; pageViews: number; visitors: Set<string> }
  >();
  const days = Math.max(
    1,
    Math.round((Date.now() - since.getTime()) / DAY_MS)
  );

  for (let index = 0; index < days; index += 1) {
    const date = formatAnalyticsDate(new Date(Date.now() - (days - 1 - index) * DAY_MS));
    buckets.set(date, {
      events: 0,
      pageViews: 0,
      visitors: new Set<string>()
    });
  }

  for (const row of rows) {
    const bucket = buckets.get(formatAnalyticsDate(new Date(row.createdAt)));
    if (!bucket) continue;

    bucket.events += 1;
    if (row.eventName === "page_view") {
      bucket.pageViews += 1;
      if (row.visitorId) {
        bucket.visitors.add(row.visitorId);
      }
    }
  }

  return Array.from(buckets.entries()).map(([date, bucket]) => ({
    date,
    events: bucket.events,
    pageViews: bucket.pageViews,
    visitors: bucket.visitors.size
  }));
}

function buildFunnel(
  eventCounts: Array<{ count: number; label: string }>,
  pageViewCount: number
): PrivateAnalyticsFunnelRow[] {
  const searchSubmit = getCount(eventCounts, "search_submit");
  const resultClick =
    getCount(eventCounts, "search_result_record_click") +
    getCount(eventCounts, "autocomplete_result_click");
  const citationCopy = getCount(eventCounts, "citation_copy");
  const recordOpen =
    getCount(eventCounts, "record_canonical_click") +
    getCount(eventCounts, "record_public_json_click") +
    getCount(eventCounts, "official_source_click");
  const apiDiscovery =
    getCount(eventCounts, "api_link_click") +
    getCount(eventCounts, "autocomplete_json_click");

  return [
    {
      count: searchSubmit,
      label: "Search submits",
      share: 1
    },
    {
      count: resultClick,
      label: "Result clicks",
      share: shareOf(resultClick, searchSubmit)
    },
    {
      count: recordOpen,
      label: "Record / source opens",
      share: shareOf(recordOpen, resultClick || searchSubmit)
    },
    {
      count: citationCopy,
      label: "Citation copies",
      share: shareOf(citationCopy, recordOpen || resultClick || searchSubmit)
    },
    {
      count: apiDiscovery,
      label: "API / JSON discovery",
      share: shareOf(apiDiscovery, pageViewCount)
    }
  ];
}

function countBy<T>(
  rows: T[],
  getter: (row: T) => string | undefined
): Array<{ count: number; label: string }> {
  const counts = new Map<string, number>();

  for (const row of rows) {
    const label = getter(row);
    if (!label) continue;
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }

  return Array.from(counts.entries())
    .map(([label, count]) => ({ count, label }))
    .sort((left, right) => {
      if (right.count !== left.count) return right.count - left.count;
      return left.label.localeCompare(right.label);
    });
}

function formatAnalyticsDate(date: Date): string {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: ANALYTICS_TIME_ZONE
  });
  const parts = formatter.formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value ?? "0000";
  const month = parts.find((part) => part.type === "month")?.value ?? "00";
  const day = parts.find((part) => part.type === "day")?.value ?? "00";
  return `${year}-${month}-${day}`;
}

function getCount(
  counts: Array<{ count: number; label: string }>,
  label: string
): number {
  return counts.find((row) => row.label === label)?.count ?? 0;
}

function isPresent(value: string | null | undefined): value is string {
  return Boolean(value);
}

function shareOf(value: number, total: number): number {
  if (!total) return 0;
  return value / total;
}

function toCountRows(
  counts: Array<{ count: number; label: string }>
): PrivateAnalyticsCountRow[] {
  const total = counts.reduce((sum, row) => sum + row.count, 0);

  return counts.slice(0, 8).map((row) => ({
    ...row,
    share: shareOf(row.count, total)
  }));
}
