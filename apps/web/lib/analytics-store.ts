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
  since: Date
): Promise<AnalyticsEventRow[]> {
  if (hasSupabaseAnalyticsStore()) {
    return listSupabaseAnalyticsEvents(since);
  }

  if (!process.env.DATABASE_URL) return [];
  return listAnalyticsEvents(since);
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
const SUPABASE_ANALYTICS_MAX_ROWS = 20000;

async function listSupabaseAnalyticsEvents(
  since: Date
): Promise<AnalyticsEventRow[]> {
  const rows: SupabaseAnalyticsEventRow[] = [];

  for (
    let offset = 0;
    offset < SUPABASE_ANALYTICS_MAX_ROWS;
    offset += SUPABASE_ANALYTICS_PAGE_SIZE
  ) {
    const page = await listSupabaseAnalyticsEventsPage(since, offset);
    rows.push(...page);
    if (page.length < SUPABASE_ANALYTICS_PAGE_SIZE) break;
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
  offset: number
): Promise<SupabaseAnalyticsEventRow[]> {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error("Supabase analytics store is not configured");
  }

  const requestUrl = new URL(`${url}/rest/v1/analytics_events`);
  requestUrl.searchParams.set("select", "*");
  requestUrl.searchParams.set("created_at", `gte.${since.toISOString()}`);
  requestUrl.searchParams.set("order", "created_at.desc,id.desc");

  const response = await fetch(requestUrl, {
    cache: "no-store",
    headers: {
      apikey: key,
      authorization: `Bearer ${key}`,
      Range: `${offset}-${offset + SUPABASE_ANALYTICS_PAGE_SIZE - 1}`
    }
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(
      `Supabase analytics table read failed: ${response.status} ${text}`
    );
  }

  return (await response.json()) as SupabaseAnalyticsEventRow[];
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
