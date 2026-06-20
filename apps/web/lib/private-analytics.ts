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

export interface PrivateAnalyticsCountryRow {
  countryCode: string;
  countryName: string;
  events: number;
  pageViews: number;
  primaryLocale: string;
  share: number;
  visitors: number;
}

export interface PrivateAnalyticsCountryLanguageRow {
  countryCode: string;
  countryName: string;
  locale: string;
  pageViews: number;
  share: number;
  visitors: number;
}

export interface PrivateAnalyticsDeviceRow {
  deviceType: string;
  events: number;
  pageViews: number;
  share: number;
  visitors: number;
}

export interface PrivateAnalyticsFunnelRow {
  count: number;
  label: string;
  share: number;
}

export interface PrivateAnalyticsSummary {
  bounceRate: number;
  countries: PrivateAnalyticsCountryRow[];
  countryLanguages: PrivateAnalyticsCountryLanguageRow[];
  daily: PrivateAnalyticsDailyRow[];
  devices: PrivateAnalyticsDeviceRow[];
  engagedSessions: number;
  events: number;
  funnel: PrivateAnalyticsFunnelRow[];
  pageViews: number;
  recent: AnalyticsEventRow[];
  sessions: number;
  topDomains: PrivateAnalyticsCountRow[];
  topEntities: PrivateAnalyticsCountRow[];
  topEvents: PrivateAnalyticsCountRow[];
  topLanguages: PrivateAnalyticsCountRow[];
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
  const languageCounts = countBy(pageViewRows, (row) => normalizeLocale(row.locale));
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
    countries: buildCountryRows(rows, pageViewRows),
    countryLanguages: buildCountryLanguageRows(pageViewRows),
    daily: buildDailySeries(rows, since),
    devices: buildDeviceRows(rows, pageViewRows),
    engagedSessions,
    events: rows.length,
    funnel: buildFunnel(eventCounts, pageViewRows.length),
    pageViews: pageViewRows.length,
    recent: rows.slice().reverse().slice(0, 25),
    sessions,
    topDomains: toCountRows(domainCounts),
    topEntities: toCountRows(entityCounts),
    topEvents: toCountRows(customEventCounts),
    topLanguages: toCountRows(languageCounts),
    topPages: toCountRows(pageCounts),
    visitors
  };
}

function buildCountryRows(
  rows: AnalyticsEventRow[],
  pageViewRows: AnalyticsEventRow[]
): PrivateAnalyticsCountryRow[] {
  const buckets = new Map<
    string,
    {
      events: number;
      localeCounts: Map<string, number>;
      pageViews: number;
      visitors: Set<string>;
    }
  >();

  for (const row of rows) {
    const countryCode = normalizeCountryCode(row.countryCode);
    const bucket = getCountryBucket(buckets, countryCode);
    bucket.events += 1;
  }

  for (const row of pageViewRows) {
    const countryCode = normalizeCountryCode(row.countryCode);
    const locale = normalizeLocale(row.locale);
    const bucket = getCountryBucket(buckets, countryCode);
    bucket.pageViews += 1;
    bucket.localeCounts.set(locale, (bucket.localeCounts.get(locale) ?? 0) + 1);
    if (row.visitorId) bucket.visitors.add(row.visitorId);
  }

  const totalPageViews = pageViewRows.length;
  return Array.from(buckets.entries())
    .map(([countryCode, bucket]) => ({
      countryCode,
      countryName: getCountryName(countryCode),
      events: bucket.events,
      pageViews: bucket.pageViews,
      primaryLocale: getTopMapKey(bucket.localeCounts) ?? "unknown",
      share: shareOf(bucket.pageViews, totalPageViews),
      visitors: bucket.visitors.size
    }))
    .sort((left, right) => {
      if (right.pageViews !== left.pageViews) return right.pageViews - left.pageViews;
      if (right.events !== left.events) return right.events - left.events;
      return left.countryName.localeCompare(right.countryName);
    })
    .slice(0, 10);
}

function buildCountryLanguageRows(
  pageViewRows: AnalyticsEventRow[]
): PrivateAnalyticsCountryLanguageRow[] {
  const countryTotals = new Map<string, number>();
  const buckets = new Map<
    string,
    {
      countryCode: string;
      locale: string;
      pageViews: number;
      visitors: Set<string>;
    }
  >();

  for (const row of pageViewRows) {
    const countryCode = normalizeCountryCode(row.countryCode);
    const locale = normalizeLocale(row.locale);
    const key = `${countryCode}:${locale}`;
    const bucket =
      buckets.get(key) ??
      {
        countryCode,
        locale,
        pageViews: 0,
        visitors: new Set<string>()
      };

    bucket.pageViews += 1;
    if (row.visitorId) bucket.visitors.add(row.visitorId);
    buckets.set(key, bucket);
    countryTotals.set(countryCode, (countryTotals.get(countryCode) ?? 0) + 1);
  }

  return Array.from(buckets.values())
    .map((bucket) => ({
      countryCode: bucket.countryCode,
      countryName: getCountryName(bucket.countryCode),
      locale: bucket.locale,
      pageViews: bucket.pageViews,
      share: shareOf(bucket.pageViews, countryTotals.get(bucket.countryCode) ?? 0),
      visitors: bucket.visitors.size
    }))
    .sort((left, right) => {
      if (right.pageViews !== left.pageViews) return right.pageViews - left.pageViews;
      return `${left.countryName}:${left.locale}`.localeCompare(`${right.countryName}:${right.locale}`);
    })
    .slice(0, 12);
}

function buildDeviceRows(
  rows: AnalyticsEventRow[],
  pageViewRows: AnalyticsEventRow[]
): PrivateAnalyticsDeviceRow[] {
  const buckets = new Map<
    string,
    {
      events: number;
      pageViews: number;
      visitors: Set<string>;
    }
  >();

  for (const row of rows) {
    const deviceType = normalizeDeviceType(row.deviceType);
    const bucket = getDeviceBucket(buckets, deviceType);
    bucket.events += 1;
  }

  for (const row of pageViewRows) {
    const deviceType = normalizeDeviceType(row.deviceType);
    const bucket = getDeviceBucket(buckets, deviceType);
    bucket.pageViews += 1;
    if (row.visitorId) bucket.visitors.add(row.visitorId);
  }

  const totalPageViews = pageViewRows.length;
  return Array.from(buckets.entries())
    .map(([deviceType, bucket]) => ({
      deviceType,
      events: bucket.events,
      pageViews: bucket.pageViews,
      share: shareOf(bucket.pageViews, totalPageViews),
      visitors: bucket.visitors.size
    }))
    .sort((left, right) => {
      if (right.pageViews !== left.pageViews) return right.pageViews - left.pageViews;
      return left.deviceType.localeCompare(right.deviceType);
    });
}

function buildDailySeries(
  rows: AnalyticsEventRow[],
  since: Date
): PrivateAnalyticsDailyRow[] {
  if (!rows.length) return [];

  const buckets = new Map<
    string,
    { events: number; pageViews: number; visitors: Set<string> }
  >();
  const firstEventTime = rows.reduce(
    (earliest, row) => Math.min(earliest, new Date(row.createdAt).getTime()),
    Number.POSITIVE_INFINITY
  );
  const startTime = Math.max(since.getTime(), firstEventTime);
  const days = Math.max(
    1,
    Math.round((Date.now() - startTime) / DAY_MS) + 1
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

function getCountryBucket(
  buckets: Map<
    string,
    {
      events: number;
      localeCounts: Map<string, number>;
      pageViews: number;
      visitors: Set<string>;
    }
  >,
  countryCode: string
) {
  const bucket =
    buckets.get(countryCode) ??
    {
      events: 0,
      localeCounts: new Map<string, number>(),
      pageViews: 0,
      visitors: new Set<string>()
    };
  buckets.set(countryCode, bucket);
  return bucket;
}

function getDeviceBucket(
  buckets: Map<
    string,
    {
      events: number;
      pageViews: number;
      visitors: Set<string>;
    }
  >,
  deviceType: string
) {
  const bucket =
    buckets.get(deviceType) ??
    {
      events: 0,
      pageViews: 0,
      visitors: new Set<string>()
    };
  buckets.set(deviceType, bucket);
  return bucket;
}

function getTopMapKey(counts: Map<string, number>): string | undefined {
  return Array.from(counts.entries()).sort((left, right) => {
    if (right[1] !== left[1]) return right[1] - left[1];
    return left[0].localeCompare(right[0]);
  })[0]?.[0];
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

function normalizeCountryCode(value: string | null | undefined): string {
  const normalized = value?.trim().toUpperCase();
  if (!normalized || normalized === "XX") return "unknown";
  return /^[A-Z]{2}$/.test(normalized) ? normalized : "unknown";
}

function normalizeDeviceType(value: string | null | undefined): string {
  const normalized = value?.trim().toLowerCase();
  if (
    normalized === "mobile" ||
    normalized === "desktop" ||
    normalized === "bot"
  ) {
    return normalized;
  }
  return "unknown";
}

function normalizeLocale(value: string | null | undefined): string {
  const normalized = value?.trim().toLowerCase();
  return normalized || "unknown";
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

const regionNameFormatter = new Intl.DisplayNames(["en"], {
  type: "region"
});

function getCountryName(countryCode: string): string {
  if (countryCode === "unknown") return "Unknown";
  return regionNameFormatter.of(countryCode) ?? countryCode;
}
