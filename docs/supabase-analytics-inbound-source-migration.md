# Supabase analytics dashboard migration

This migration supports `/internal/analytics`. Production uses Supabase RPCs
when `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and
`SUPABASE_ANALYTICS_SECRET` are configured.

Run the statements in the Supabase SQL Editor. They are additive and
idempotent. Do not store full referrer URLs, raw IPs, or full user-agent
strings. The application stores only source category, source name, referrer
domain, landing path, UTM fields, coarse country, locale, and device class.

## 1. Columns, historical backfill, and indexes

```sql
begin;

alter table public.analytics_events
  add column if not exists source_category text,
  add column if not exists source_name text,
  add column if not exists referrer_domain text,
  add column if not exists landing_path text,
  add column if not exists utm_source text,
  add column if not exists utm_medium text,
  add column if not exists utm_campaign text,
  add column if not exists utm_term text,
  add column if not exists utm_content text;

update public.analytics_events
set
  source_category = coalesce(source_category, nullif(payload->>'source_category', '')),
  source_name = coalesce(source_name, nullif(payload->>'source_name', '')),
  referrer_domain = coalesce(referrer_domain, nullif(payload->>'referrer_domain', '')),
  landing_path = coalesce(landing_path, nullif(payload->>'landing_path', '')),
  utm_source = coalesce(utm_source, nullif(payload->>'utm_source', '')),
  utm_medium = coalesce(utm_medium, nullif(payload->>'utm_medium', '')),
  utm_campaign = coalesce(utm_campaign, nullif(payload->>'utm_campaign', '')),
  utm_term = coalesce(utm_term, nullif(payload->>'utm_term', '')),
  utm_content = coalesce(utm_content, nullif(payload->>'utm_content', ''))
where
  source_category is null
  or source_name is null
  or referrer_domain is null
  or landing_path is null
  or utm_source is null
  or utm_medium is null
  or utm_campaign is null
  or utm_term is null
  or utm_content is null;

create index if not exists analytics_events_source_category_created_at_idx
  on public.analytics_events(source_category, created_at desc);
create index if not exists analytics_events_source_name_created_at_idx
  on public.analytics_events(source_name, created_at desc);
create index if not exists analytics_events_referrer_domain_created_at_idx
  on public.analytics_events(referrer_domain, created_at desc);
create index if not exists analytics_events_country_created_at_idx
  on public.analytics_events(country_code, created_at desc);
create index if not exists analytics_events_locale_created_at_idx
  on public.analytics_events(locale, created_at desc);
create index if not exists analytics_events_device_created_at_idx
  on public.analytics_events(device_type, created_at desc);

commit;
```

## 2. Keep the existing guarded write/list RPCs aligned

Do not replace or weaken the existing `p_secret` checks.

Add these assignments to the existing `uapt_record_analytics_event` insert:

```sql
source_category = nullif(p_event->>'sourceCategory', ''),
source_name = nullif(p_event->>'sourceName', ''),
referrer_domain = nullif(p_event->>'referrerDomain', ''),
landing_path = nullif(p_event->>'landingPath', ''),
utm_source = nullif(p_event->>'utmSource', ''),
utm_medium = nullif(p_event->>'utmMedium', ''),
utm_campaign = nullif(p_event->>'utmCampaign', ''),
utm_term = nullif(p_event->>'utmTerm', ''),
utm_content = nullif(p_event->>'utmContent', '')
```

Add these columns to both the returned row type and select list of the existing
`uapt_list_analytics_events(p_secret, p_since)` function:

```sql
source_category,
source_name,
referrer_domain,
landing_path,
utm_source,
utm_medium,
utm_campaign,
utm_term,
utm_content
```

## 3. Aggregated rollup RPC

The dashboard calls this function before reading event detail. When available,
Bot traffic and data-quality totals come from the rollup and raw event reads
exclude Bot rows, preventing Bot volume from consuming the 20,000-row fallback
limit. The function delegates authentication to the existing guarded
`uapt_list_analytics_events` RPC.

```sql
create or replace function public.uapt_private_analytics_rollup(
  p_secret text,
  p_from date,
  p_to date,
  p_grain text default 'day',
  p_sources text[] default '{}',
  p_countries text[] default '{}',
  p_locales text[] default '{}',
  p_devices text[] default '{}'
)
returns jsonb
language sql
stable
set search_path = public
as $function$
with raw as (
  select *
  from public.uapt_list_analytics_events(
    p_secret,
    (p_from::timestamp at time zone 'America/Toronto')
  )
  where created_at < ((p_to + 1)::timestamp at time zone 'America/Toronto')
), normalized as (
  select
    *,
    coalesce(nullif(lower(source_category), ''), nullif(lower(payload->>'source_category'), ''), 'unknown') as normalized_source,
    case
      when upper(coalesce(country_code, '')) ~ '^[A-Z]{2}$' then upper(country_code)
      else 'unknown'
    end as normalized_country,
    coalesce(nullif(lower(locale), ''), 'unknown') as normalized_locale,
    coalesce(nullif(lower(device_type), ''), 'unknown') as normalized_device,
    case
      when p_grain = 'month' then to_char(created_at at time zone 'America/Toronto', 'YYYY-MM')
      when p_grain = 'week' then 'Wk ' || to_char(date_trunc('week', created_at at time zone 'America/Toronto'), 'MM-DD')
      else to_char(created_at at time zone 'America/Toronto', 'MM-DD')
    end as bucket_label
  from raw
), human as (
  select *
  from normalized
  where normalized_device <> 'bot'
    and (coalesce(cardinality(p_sources), 0) = 0 or normalized_source = any(p_sources))
    and (coalesce(cardinality(p_countries), 0) = 0 or normalized_country = any(p_countries))
    and (coalesce(cardinality(p_locales), 0) = 0 or normalized_locale = any(p_locales))
    and (coalesce(cardinality(p_devices), 0) = 0 or normalized_device = any(p_devices))
), bot_trend as (
  select bucket_label as label, count(*) filter (where event_name = 'page_view')::integer as page_views
  from normalized
  where normalized_device = 'bot'
  group by bucket_label
  order by min(created_at)
), totals as (
  select
    count(*) filter (where event_name = 'page_view')::integer as human_page_views,
    count(*) filter (where event_name = 'page_view' and normalized_source = 'unknown')::integer as unknown_source_page_views
  from human
), session_stats as (
  select
    coalesce(session_id, visitor_id) as session_key,
    count(*) filter (where event_name = 'page_view')::integer as page_views,
    bool_or(event_name <> 'page_view') as engaged
  from human
  where coalesce(session_id, visitor_id) is not null
  group by coalesce(session_id, visitor_id)
), human_totals as (
  select
    (select count(*)::integer from human) as events,
    (select count(*)::integer from human where event_name = 'page_view') as page_views,
    (select count(distinct visitor_id)::integer from human where event_name = 'page_view' and visitor_id is not null) as visitors,
    (select count(*)::integer from session_stats) as sessions,
    (select count(*)::integer from session_stats where engaged) as engaged_sessions,
    (select count(*)::integer from session_stats where page_views = 1 and not engaged) as bounced_sessions
), trend as (
  select
    bucket_label as label,
    count(*)::integer as events,
    count(*) filter (where event_name = 'page_view')::integer as page_views,
    count(distinct visitor_id) filter (where event_name = 'page_view')::integer as visitors,
    count(distinct coalesce(session_id, visitor_id))::integer as sessions,
    min(created_at) as bucket_start
  from human
  group by bucket_label
), source_breakdown as (
  select
    normalized_source as label,
    count(*) filter (where event_name = 'page_view')::integer as page_views,
    count(distinct visitor_id) filter (where event_name = 'page_view')::integer as visitors
  from human
  group by normalized_source
  order by visitors desc, page_views desc
), geo_breakdown as (
  select
    normalized_country as label,
    count(*) filter (where event_name = 'page_view')::integer as page_views,
    count(distinct visitor_id) filter (where event_name = 'page_view')::integer as visitors
  from human
  group by normalized_country
  order by page_views desc
  limit 24
), device_breakdown as (
  select
    normalized_device as label,
    count(*) filter (where event_name = 'page_view')::integer as page_views,
    count(distinct visitor_id) filter (where event_name = 'page_view')::integer as visitors
  from human
  group by normalized_device
  order by page_views desc
), behavior_events as (
  select
    coalesce(session_id, visitor_id) as session_key,
    case
      when event_name = 'search_submit' then 'Search submits'
      when event_name in ('search_result_record_click', 'autocomplete_result_click') then 'Result clicks'
      when event_name in ('record_canonical_click', 'record_public_json_click', 'official_source_click') then 'Record / source opens'
      when event_name = 'citation_copy' then 'Citation copies'
      when event_name in ('api_link_click', 'autocomplete_json_click') then 'API / JSON discovery'
      else null
    end as label
  from human
), behavior as (
  select
    label,
    count(distinct session_key)::integer as sessions
  from behavior_events
  where label is not null and session_key is not null
  group by label
), recent_rows as (
  select created_at, event_name, pathname, normalized_source
  from human
  order by created_at desc
  limit 20
), bot_total as (
  select count(*) filter (where event_name = 'page_view')::integer as bot_page_views
  from normalized
  where normalized_device = 'bot'
)
select jsonb_build_object(
  'botPageViews', bot_total.bot_page_views,
  'botTrend', coalesce(
    (select jsonb_agg(jsonb_build_object('label', label, 'pageViews', page_views)) from bot_trend),
    '[]'::jsonb
  ),
  'humanPageViews', totals.human_page_views,
  'totals', jsonb_build_object(
    'events', human_totals.events,
    'pageViews', human_totals.page_views,
    'visitors', human_totals.visitors,
    'sessions', human_totals.sessions,
    'engagedSessions', human_totals.engaged_sessions,
    'bounceRate', case when human_totals.sessions = 0 then 0 else human_totals.bounced_sessions::numeric / human_totals.sessions end
  ),
  'trend', coalesce((
    select jsonb_agg(jsonb_build_object(
      'label', label,
      'events', events,
      'pageViews', page_views,
      'visitors', visitors,
      'sessions', sessions
    ) order by bucket_start)
    from trend
  ), '[]'::jsonb),
  'sources', coalesce((
    select jsonb_agg(jsonb_build_object(
      'label', label,
      'pageViews', page_views,
      'visitors', visitors
    )) from source_breakdown
  ), '[]'::jsonb),
  'geo', coalesce((
    select jsonb_agg(jsonb_build_object(
      'label', label,
      'pageViews', page_views,
      'visitors', visitors
    )) from geo_breakdown
  ), '[]'::jsonb),
  'devices', coalesce((
    select jsonb_agg(jsonb_build_object(
      'label', label,
      'pageViews', page_views,
      'visitors', visitors
    )) from device_breakdown
  ), '[]'::jsonb),
  'behavior', coalesce((
    select jsonb_agg(jsonb_build_object(
      'label', label,
      'sessions', sessions,
      'rate', case when human_totals.sessions = 0 then 0 else sessions::numeric / human_totals.sessions end
    )) from behavior cross join human_totals
  ), '[]'::jsonb),
  'recent', coalesce((
    select jsonb_agg(jsonb_build_object(
      'createdAt', created_at,
      'eventName', event_name,
      'pathname', pathname,
      'source', normalized_source
    ) order by created_at desc) from recent_rows
  ), '[]'::jsonb),
  'latestEventAt', (
    select to_char(max(created_at) at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
    from normalized
  ),
  'unknownSourcePageViews', totals.unknown_source_page_views
)
from totals cross join bot_total cross join human_totals;
$function$;

revoke all on function public.uapt_private_analytics_rollup(
  text, date, date, text, text[], text[], text[], text[]
) from public;
grant execute on function public.uapt_private_analytics_rollup(
  text, date, date, text, text[], text[], text[], text[]
) to anon, authenticated;
```

## 4. Verification

After running the migration:

1. Confirm the columns exist with a one-row select.
2. Call `uapt_private_analytics_rollup` with the production analytics secret and
   a seven-day range; confirm `botPageViews`, `humanPageViews`, and `botTrend`
   are returned.
3. Open `/internal/analytics`; the status payload should report `rpc: ready`.
4. Change Source, Country, Language, and Device filters and confirm only onsite
   charts change. GSC totals must remain stable for the same date range.
5. Confirm newly recorded page views populate the normalized source columns.

The application retains payload fallback. Historical rows with no source
information remain `direct` or `unknown` rather than being guessed.
