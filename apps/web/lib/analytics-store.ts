import {
  listAnalyticsEvents,
  recordAnalyticsEvent,
  type AnalyticsEventRecordInput,
  type AnalyticsEventRow
} from "@uapt/db";

interface SupabaseAnalyticsEventRow {
  country_code?: string | null;
  copy_target?: string | null;
  created_at: string;
  device_type?: string | null;
  endpoint_kind?: string | null;
  entity_slug?: string | null;
  event_name: string;
  example_key?: string | null;
  footer_group?: string | null;
  from_locale?: string | null;
  from_theme?: string | null;
  id: string;
  limit_bucket?: string | null;
  locale?: string | null;
  nav_area?: string | null;
  page_type?: string | null;
  pathname: string;
  payload?: unknown;
  query_kind?: string | null;
  query_length_bucket?: string | null;
  result_count_bucket?: string | null;
  result_rank?: number | null;
  result_source?: string | null;
  session_id?: string | null;
  source: string;
  source_category?: string | null;
  source_domain?: string | null;
  source_name?: string | null;
  referrer_domain?: string | null;
  landing_path?: string | null;
  utm_source?: string | null;
  utm_medium?: string | null;
  utm_campaign?: string | null;
  utm_term?: string | null;
  utm_content?: string | null;
  target_kind?: string | null;
  to_locale?: string | null;
  to_theme?: string | null;
  visitor_id?: string | null;
}

export function hasAnalyticsStore(): boolean {
  return hasSupabaseAnalyticsStore() || Boolean(process.env.DATABASE_URL);
}

export async function recordMirroredAnalyticsEvent(
  input: AnalyticsEventRecordInput
): Promise<{ eventName: string; id: string }> {
  if (hasSupabaseAnalyticsStore()) {
    await callSupabaseRpc("uapt_record_analytics_event", {
      p_event: input,
      p_secret: process.env.SUPABASE_ANALYTICS_SECRET
    });

    return {
      eventName: input.eventName,
      id: ""
    };
  }

  return recordAnalyticsEvent(input);
}

export async function listMirroredAnalyticsEvents(
  since: Date,
  options: { excludeBots?: boolean } = {}
): Promise<AnalyticsEventRow[]> {
  if (hasSupabaseAnalyticsStore()) {
    return listSupabaseAnalyticsEvents(since, options);
  }

  if (!process.env.DATABASE_URL) return [];
  return listAnalyticsEvents(since);
}

export interface AnalyticsStoreRollup {
  behavior?: Array<{ label: string; rate: number; sessions: number }>;
  botPageViews: number;
  botTrend: Array<{ label: string; pageViews: number }>;
  devices?: Array<{ label: string; pageViews: number; visitors: number }>;
  geo?: Array<{ label: string; pageViews: number; visitors: number }>;
  humanPageViews: number;
  latestEventAt?: string;
  recent?: Array<{
    createdAt: string;
    eventName: string;
    pathname: string;
    source: string;
  }>;
  sources?: Array<{ label: string; pageViews: number; visitors: number }>;
  totals?: {
    bounceRate: number;
    engagedSessions: number;
    events: number;
    pageViews: number;
    sessions: number;
    visitors: number;
  };
  trend?: Array<{
    events: number;
    label: string;
    pageViews: number;
    sessions: number;
    visitors: number;
  }>;
  unknownSourcePageViews: number;
}

export async function getMirroredAnalyticsRollup(input: {
  countries: string[];
  devices: string[];
  from: string;
  grain: "day" | "month" | "week";
  locales: string[];
  sources: string[];
  to: string;
}): Promise<AnalyticsStoreRollup | null> {
  if (!hasSupabaseAnalyticsStore()) return null;
  try {
    return await callSupabaseRpc<AnalyticsStoreRollup>(
      "uapt_private_analytics_rollup",
      {
        p_countries: input.countries,
        p_devices: input.devices,
        p_from: input.from,
        p_grain: input.grain,
        p_locales: input.locales,
        p_secret: process.env.SUPABASE_ANALYTICS_SECRET,
        p_sources: input.sources,
        p_to: input.to
      }
    );
  } catch {
    return null;
  }
}

function hasSupabaseAnalyticsStore(): boolean {
  return Boolean(
    process.env.SUPABASE_URL &&
      process.env.SUPABASE_ANON_KEY &&
      process.env.SUPABASE_ANALYTICS_SECRET
  );
}

async function callSupabaseRpc<T = unknown>(
  functionName: string,
  body: Record<string, unknown>
): Promise<T> {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error("Supabase analytics store is not configured");
  }

  const response = await fetch(`${url}/rest/v1/rpc/${functionName}`, {
    body: JSON.stringify(body),
    cache: "no-store",
    headers: {
      apikey: key,
      authorization: `Bearer ${key}`,
      "content-type": "application/json"
    },
    method: "POST"
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(
      `Supabase analytics RPC ${functionName} failed: ${response.status} ${text}`
    );
  }

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

const SUPABASE_ANALYTICS_PAGE_SIZE = 1000;
const SUPABASE_ANALYTICS_PAGE_BATCH = 4;
const SUPABASE_ANALYTICS_MAX_ROWS = 20000;

async function listSupabaseAnalyticsEvents(
  since: Date,
  options: { excludeBots?: boolean }
): Promise<AnalyticsEventRow[]> {
  const rows: SupabaseAnalyticsEventRow[] = [];

  for (
    let offset = 0;
    offset < SUPABASE_ANALYTICS_MAX_ROWS;
    offset += SUPABASE_ANALYTICS_PAGE_SIZE * SUPABASE_ANALYTICS_PAGE_BATCH
  ) {
    const offsets = Array.from(
      { length: SUPABASE_ANALYTICS_PAGE_BATCH },
      (_, index) => offset + index * SUPABASE_ANALYTICS_PAGE_SIZE
    ).filter((pageOffset) => pageOffset < SUPABASE_ANALYTICS_MAX_ROWS);
    const pages = await Promise.all(
      offsets.map((pageOffset) =>
        listSupabaseAnalyticsEventsPage(since, pageOffset, options)
      )
    );
    for (const page of pages) rows.push(...page);
    if (pages.some((page) => page.length < SUPABASE_ANALYTICS_PAGE_SIZE)) break;
  }

  return rows
    .map(mapSupabaseAnalyticsRow)
    .sort((left, right) => {
      const dateOrder =
        new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime();
      if (dateOrder !== 0) return dateOrder;
      return left.id.localeCompare(right.id);
    });
}

async function listSupabaseAnalyticsEventsPage(
  since: Date,
  offset: number,
  options: { excludeBots?: boolean }
): Promise<SupabaseAnalyticsEventRow[]> {
  return callSupabaseRpc<SupabaseAnalyticsEventRow[]>(
    "uapt_list_analytics_events_window",
    {
      p_exclude_bots: Boolean(options.excludeBots),
      p_limit: SUPABASE_ANALYTICS_PAGE_SIZE,
      p_offset: offset,
      p_secret: process.env.SUPABASE_ANALYTICS_SECRET,
      p_since: since.toISOString(),
      p_until: new Date(Date.now() + 60_000).toISOString()
    }
  );
}

function mapSupabaseAnalyticsRow(
  row: SupabaseAnalyticsEventRow
): AnalyticsEventRow {
  return {
    countryCode: row.country_code,
    copyTarget: row.copy_target,
    createdAt: new Date(row.created_at).toISOString(),
    deviceType: row.device_type,
    endpointKind: row.endpoint_kind,
    entitySlug: row.entity_slug,
    eventName: row.event_name,
    exampleKey: row.example_key,
    footerGroup: row.footer_group,
    fromLocale: row.from_locale,
    fromTheme: row.from_theme,
    id: row.id,
    limitBucket: row.limit_bucket,
    locale: row.locale,
    navArea: row.nav_area,
    pageType: row.page_type,
    pathname: row.pathname,
    payload: row.payload,
    queryKind: row.query_kind,
    queryLengthBucket: row.query_length_bucket,
    resultCountBucket: row.result_count_bucket,
    resultRank: row.result_rank,
    resultSource: row.result_source,
    sessionId: row.session_id,
    source: row.source,
    sourceCategory: row.source_category,
    sourceDomain: row.source_domain,
    sourceName: row.source_name,
    referrerDomain: row.referrer_domain,
    landingPath: row.landing_path,
    utmSource: row.utm_source,
    utmMedium: row.utm_medium,
    utmCampaign: row.utm_campaign,
    utmTerm: row.utm_term,
    utmContent: row.utm_content,
    targetKind: row.target_kind,
    toLocale: row.to_locale,
    toTheme: row.to_theme,
    visitorId: row.visitor_id
  };
}
