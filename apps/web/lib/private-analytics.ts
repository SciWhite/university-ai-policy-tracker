import type { AnalyticsEventRow } from "@uapt/db";

export type AnalyticsPeriod = "day" | "week" | "month";

export interface PrivateAnalyticsCountRow {
  count: number;
  label: string;
  share: number;
}

export interface PrivateAnalyticsTrendRow {
  events: number;
  label: string;
  pageViews: number;
  sessions: number;
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

export interface PrivateAnalyticsSourceRow {
  pageViews: number;
  referrerDomain: string;
  sessions: number;
  share: number;
  sourceCategory: string;
  sourceName: string;
  visitors: number;
}

export interface PrivateAnalyticsSummary {
  bounceRate: number;
  countries: PrivateAnalyticsCountryRow[];
  countryLanguages: PrivateAnalyticsCountryLanguageRow[];
  devices: PrivateAnalyticsDeviceRow[];
  engagedSessions: number;
  events: number;
  funnel: PrivateAnalyticsFunnelRow[];
  pageViews: number;
  period: AnalyticsPeriod;
  recent: AnalyticsEventRow[];
  sessions: number;
  sourceCategoryVisitors: PrivateAnalyticsCountRow[];
  sourceCategories: PrivateAnalyticsCountRow[];
  sourceMix: PrivateAnalyticsSourceRow[];
  topDomains: PrivateAnalyticsCountRow[];
  topEntities: PrivateAnalyticsCountRow[];
  topEvents: PrivateAnalyticsCountRow[];
  topLandingPages: PrivateAnalyticsCountRow[];
  topLanguages: PrivateAnalyticsCountRow[];
  topPages: PrivateAnalyticsCountRow[];
  trend: PrivateAnalyticsTrendRow[];
  visitors: number;
  visitorSourceMix: PrivateAnalyticsSourceRow[];
}

const DAY_MS = 24 * 60 * 60 * 1000;
const ANALYTICS_TIME_ZONE = "America/Toronto";

export function buildPrivateAnalyticsSummary(
  rows: AnalyticsEventRow[],
  since: Date,
  period: AnalyticsPeriod = "day",
  until: Date = new Date()
): PrivateAnalyticsSummary {
  const pageViewRows = rows.filter((row) => row.eventName === "page_view");
  const eventCounts = countBy(rows, (row) => row.eventName);
  const customEventCounts = countBy(
    rows.filter((row) => row.eventName !== "page_view"),
    (row) => row.eventName
  );
  const pageCounts = countBy(pageViewRows, (row) => row.pathname);
  const landingCounts = countBy(pageViewRows, getRowLandingPath);
  const languageCounts = countBy(pageViewRows, (row) => normalizeLocale(row.locale));
  const entityCounts = countBy(rows, (row) => row.entitySlug ?? undefined);
  const domainCounts = countBy(rows, getRowSourceDomain);
  const visitors = new Set(
    pageViewRows.map((row) => row.visitorId).filter(isPresent)
  ).size;

  const sessionStats = buildSessionStats(rows);
  const sessions = sessionStats.size;
  const engagedSessions = Array.from(sessionStats.values()).filter(
    (stats) => stats.engaged
  ).length;
  const bounceSessions = Array.from(sessionStats.values()).filter(
    (stats) => stats.pageViews === 1 && !stats.engaged
  ).length;
  const sourceRows = buildSourceRows(pageViewRows);

  return {
    bounceRate: sessions ? bounceSessions / sessions : 0,
    countries: buildCountryRows(rows, pageViewRows),
    countryLanguages: buildCountryLanguageRows(pageViewRows),
    devices: buildDeviceRows(rows, pageViewRows),
    engagedSessions,
    events: rows.length,
    funnel: buildBehaviorRates(rows, sessions),
    pageViews: pageViewRows.length,
    period,
    recent: rows.slice().reverse().slice(0, 30),
    sessions,
    sourceCategoryVisitors: buildSourceCategoryVisitorRows(pageViewRows),
    sourceCategories: toCountRows(
      countBy(pageViewRows, getRowSourceCategory)
    ),
    sourceMix: sourceRows.slice(0, 12),
    topDomains: toCountRows(domainCounts),
    topEntities: toCountRows(entityCounts),
    topEvents: toCountRows(customEventCounts),
    topLandingPages: toCountRows(landingCounts),
    topLanguages: toCountRows(languageCounts),
    topPages: toCountRows(pageCounts),
    trend: buildPeriodSeries(rows, since, period, until),
    visitors,
    visitorSourceMix: sourceRows
      .slice()
      .sort((left, right) => {
        if (right.visitors !== left.visitors) return right.visitors - left.visitors;
        if (right.sessions !== left.sessions) return right.sessions - left.sessions;
        if (right.pageViews !== left.pageViews) return right.pageViews - left.pageViews;
        return `${left.sourceCategory}:${left.sourceName}`.localeCompare(
          `${right.sourceCategory}:${right.sourceName}`
        );
      })
      .slice(0, 12)
  };
}

export function isBotAnalyticsRow(row: AnalyticsEventRow): boolean {
  return normalizeDeviceType(row.deviceType) === "bot";
}

export function getAnalyticsRowSourceName(row: AnalyticsEventRow): string {
  return getRowSourceName(row);
}

export function getAnalyticsRowSourceCategory(row: AnalyticsEventRow): string {
  return getRowSourceCategory(row);
}

export function getAnalyticsRowLocale(row: AnalyticsEventRow): string {
  return normalizeLocale(row.locale);
}

export function getAnalyticsRowDeviceType(row: AnalyticsEventRow): string {
  return normalizeDeviceType(row.deviceType);
}

function buildSessionStats(rows: AnalyticsEventRow[]) {
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

  return sessionStats;
}

function buildSourceRows(
  pageViewRows: AnalyticsEventRow[]
): PrivateAnalyticsSourceRow[] {
  const buckets = new Map<
    string,
    {
      pageViews: number;
      referrerDomain: string;
      sessions: Set<string>;
      sourceCategory: string;
      sourceName: string;
      visitors: Set<string>;
    }
  >();

  for (const row of pageViewRows) {
    const sourceCategory = getRowSourceCategory(row);
    const sourceName = getRowSourceName(row, sourceCategory);
    const referrerDomain = getRowReferrerDomain(row);
    const key = `${sourceCategory}:${sourceName}:${referrerDomain}`;
    const bucket =
      buckets.get(key) ??
      {
        pageViews: 0,
        referrerDomain,
        sessions: new Set<string>(),
        sourceCategory,
        sourceName,
        visitors: new Set<string>()
      };

    bucket.pageViews += 1;
    if (row.visitorId) bucket.visitors.add(row.visitorId);
    if (row.sessionId) bucket.sessions.add(row.sessionId);
    buckets.set(key, bucket);
  }

  const totalPageViews = pageViewRows.length;
  return Array.from(buckets.values())
    .map((bucket) => ({
      pageViews: bucket.pageViews,
      referrerDomain: bucket.referrerDomain,
      sessions: bucket.sessions.size,
      share: shareOf(bucket.pageViews, totalPageViews),
      sourceCategory: bucket.sourceCategory,
      sourceName: bucket.sourceName,
      visitors: bucket.visitors.size
    }))
    .sort((left, right) => {
      if (right.pageViews !== left.pageViews) return right.pageViews - left.pageViews;
      return `${left.sourceCategory}:${left.sourceName}`.localeCompare(
        `${right.sourceCategory}:${right.sourceName}`
      );
    });
}

function buildSourceCategoryVisitorRows(
  pageViewRows: AnalyticsEventRow[]
): PrivateAnalyticsCountRow[] {
  const buckets = new Map<string, Set<string>>();

  for (const row of pageViewRows) {
    const category = getRowSourceCategory(row);
    const visitors = buckets.get(category) ?? new Set<string>();
    if (row.visitorId) visitors.add(row.visitorId);
    buckets.set(category, visitors);
  }

  const counts = Array.from(buckets.entries())
    .map(([label, visitors]) => ({
      count: visitors.size,
      label
    }))
    .sort((left, right) => {
      if (right.count !== left.count) return right.count - left.count;
      return left.label.localeCompare(right.label);
    });
  return toCountRows(counts);
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
    .slice(0, 12);
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
      return `${left.countryName}:${left.locale}`.localeCompare(
        `${right.countryName}:${right.locale}`
      );
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

function buildPeriodSeries(
  rows: AnalyticsEventRow[],
  since: Date,
  period: AnalyticsPeriod,
  until: Date
): PrivateAnalyticsTrendRow[] {
  const buckets = new Map<
    string,
    {
      events: number;
      label: string;
      pageViews: number;
      sessions: Set<string>;
      visitors: Set<string>;
    }
  >();
  const end = until;
  for (
    let cursor = new Date(since);
    cursor.getTime() <= end.getTime();
    cursor = new Date(cursor.getTime() + DAY_MS)
  ) {
    const bucket = getPeriodBucket(cursor, period);
    if (!buckets.has(bucket.key)) {
      buckets.set(bucket.key, {
        events: 0,
        label: bucket.label,
        pageViews: 0,
        sessions: new Set<string>(),
        visitors: new Set<string>()
      });
    }
  }

  for (const row of rows) {
    const bucketKey = getPeriodBucket(new Date(row.createdAt), period);
    const bucket = buckets.get(bucketKey.key);
    if (!bucket) continue;

    bucket.events += 1;
    if (row.sessionId) bucket.sessions.add(row.sessionId);
    if (row.eventName === "page_view") {
      bucket.pageViews += 1;
      if (row.visitorId) bucket.visitors.add(row.visitorId);
    }
  }

  return Array.from(buckets.values()).map((bucket) => ({
    events: bucket.events,
    label: bucket.label,
    pageViews: bucket.pageViews,
    sessions: bucket.sessions.size,
    visitors: bucket.visitors.size
  }));
}

function buildBehaviorRates(
  rows: AnalyticsEventRow[],
  sessionCount: number
): PrivateAnalyticsFunnelRow[] {
  const stages = [
    {
      events: new Set(["search_submit"]),
      label: "Search submits"
    },
    {
      events: new Set(["search_result_record_click", "autocomplete_result_click"]),
      label: "Result clicks"
    },
    {
      events: new Set([
        "record_canonical_click",
        "record_public_json_click",
        "official_source_click"
      ]),
      label: "Record / source opens"
    },
    {
      events: new Set(["citation_copy"]),
      label: "Citation copies"
    },
    {
      events: new Set(["api_link_click", "autocomplete_json_click"]),
      label: "API / JSON discovery"
    }
  ];

  return stages.map((stage) => {
    const sessions = new Set<string>();
    for (const row of rows) {
      if (!stage.events.has(row.eventName)) continue;
      const sessionKey = row.sessionId ?? row.visitorId;
      if (sessionKey) sessions.add(sessionKey);
    }
    return {
      count: sessions.size,
      label: stage.label,
      share: shareOf(sessions.size, sessionCount)
    };
  });
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

function getPeriodBucket(
  date: Date,
  period: AnalyticsPeriod
): { key: string; label: string } {
  const day = formatAnalyticsDate(date);
  if (period === "day") {
    return {
      key: day,
      label: day.slice(5)
    };
  }
  if (period === "month") {
    const key = day.slice(0, 7);
    return {
      key,
      label: key
    };
  }

  const weekStart = getWeekStart(date);
  const key = formatAnalyticsDate(weekStart);
  return {
    key,
    label: `Wk ${key.slice(5)}`
  };
}

function getWeekStart(date: Date): Date {
  const current = new Date(`${formatAnalyticsDate(date)}T12:00:00Z`);
  const day = current.getUTCDay() || 7;
  current.setUTCDate(current.getUTCDate() - day + 1);
  return current;
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
    timeZone: ANALYTICS_TIME_ZONE,
    year: "numeric"
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

function getRowLandingPath(row: AnalyticsEventRow): string {
  return getRowText(row, "landingPath", "landing_path") ?? row.pathname;
}

function getRowSourceCategory(row: AnalyticsEventRow): string {
  return normalizeSourceCategory(getRowText(row, "sourceCategory", "source_category"));
}

function getRowSourceDomain(row: AnalyticsEventRow): string | undefined {
  return getRowText(row, "sourceDomain", "source_domain");
}

function getRowSourceName(
  row: AnalyticsEventRow,
  category = getRowSourceCategory(row)
): string {
  return normalizeSourceName(getRowText(row, "sourceName", "source_name"), category);
}

function getRowReferrerDomain(row: AnalyticsEventRow): string {
  return normalizeText(getRowText(row, "referrerDomain", "referrer_domain"));
}

function getRowText(
  row: AnalyticsEventRow,
  rowKey: keyof AnalyticsEventRow,
  payloadKey: string
): string | undefined {
  const direct = row[rowKey];
  if (typeof direct === "string" && direct.trim()) return direct;
  return getPayloadString(row.payload, payloadKey);
}

function getPayloadString(payload: unknown, key: string): string | undefined {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return undefined;
  const value = (payload as Record<string, unknown>)[key];
  return typeof value === "string" && value.trim() ? value : undefined;
}

function normalizeSourceCategory(value: string | null | undefined): string {
  const normalized = normalizeText(value);
  return normalized === "unknown" ? "direct" : normalized;
}

function normalizeSourceName(
  value: string | null | undefined,
  category = "unknown"
): string {
  const normalized = normalizeText(value);
  if (normalized !== "unknown") return normalized;
  return category === "direct" ? "direct" : "unknown";
}

function normalizeText(value: string | null | undefined): string {
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

  return counts.slice(0, 12).map((row) => ({
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
