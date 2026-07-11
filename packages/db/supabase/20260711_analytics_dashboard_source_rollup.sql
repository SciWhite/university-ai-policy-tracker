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
  source_category is null or source_name is null or referrer_domain is null
  or landing_path is null or utm_source is null or utm_medium is null
  or utm_campaign is null or utm_term is null or utm_content is null;

create index if not exists analytics_events_source_category_created_at_idx
  on public.analytics_events(source_category, created_at desc);
create index if not exists analytics_events_source_name_created_at_idx
  on public.analytics_events(source_name, created_at desc);
create index if not exists analytics_events_referrer_domain_created_at_idx
  on public.analytics_events(referrer_domain, created_at desc);
create index if not exists analytics_events_locale_created_at_idx
  on public.analytics_events(locale, created_at desc);

create or replace function public.uapt_record_analytics_event(
  p_secret text,
  p_event jsonb
)
returns void
language plpgsql
security definer
set search_path to 'public', 'private', 'extensions'
as $function$
declare
  v_secret text;
  v_event_name text;
  v_pathname text;
begin
  select value into v_secret
  from private.analytics_config
  where key = 'mirror_secret';

  if v_secret is null or p_secret is distinct from v_secret then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  v_event_name := nullif(p_event->>'eventName', '');
  v_pathname := nullif(p_event->>'pathname', '');

  if v_event_name is null or v_pathname is null then
    raise exception 'eventName and pathname are required' using errcode = '22023';
  end if;

  insert into public.analytics_events (
    id, event_name, source, pathname, visitor_id, session_id,
    country_code, device_type, locale, page_type, entity_slug,
    query_kind, query_length_bucket, result_rank, result_source,
    endpoint_kind, target_kind, source_domain,
    source_category, source_name, referrer_domain, landing_path,
    utm_source, utm_medium, utm_campaign, utm_term, utm_content,
    nav_area, footer_group, example_key, copy_target,
    from_locale, to_locale, from_theme, to_theme,
    limit_bucket, result_count_bucket, payload, created_at
  ) values (
    coalesce(nullif(p_event->>'id', ''), gen_random_uuid()::text),
    v_event_name,
    coalesce(nullif(p_event->>'source', ''), 'client'),
    v_pathname,
    nullif(p_event->>'visitorId', ''),
    nullif(p_event->>'sessionId', ''),
    nullif(p_event->>'countryCode', ''),
    nullif(p_event->>'deviceType', ''),
    nullif(p_event->>'locale', ''),
    nullif(p_event->>'pageType', ''),
    nullif(p_event->>'entitySlug', ''),
    nullif(p_event->>'queryKind', ''),
    nullif(p_event->>'queryLengthBucket', ''),
    nullif(p_event->>'resultRank', '')::integer,
    nullif(p_event->>'resultSource', ''),
    nullif(p_event->>'endpointKind', ''),
    nullif(p_event->>'targetKind', ''),
    nullif(p_event->>'sourceDomain', ''),
    nullif(p_event->>'sourceCategory', ''),
    nullif(p_event->>'sourceName', ''),
    nullif(p_event->>'referrerDomain', ''),
    nullif(p_event->>'landingPath', ''),
    nullif(p_event->>'utmSource', ''),
    nullif(p_event->>'utmMedium', ''),
    nullif(p_event->>'utmCampaign', ''),
    nullif(p_event->>'utmTerm', ''),
    nullif(p_event->>'utmContent', ''),
    nullif(p_event->>'navArea', ''),
    nullif(p_event->>'footerGroup', ''),
    nullif(p_event->>'exampleKey', ''),
    nullif(p_event->>'copyTarget', ''),
    nullif(p_event->>'fromLocale', ''),
    nullif(p_event->>'toLocale', ''),
    nullif(p_event->>'fromTheme', ''),
    nullif(p_event->>'toTheme', ''),
    nullif(p_event->>'limitBucket', ''),
    nullif(p_event->>'resultCountBucket', ''),
    coalesce(p_event->'payload', '{}'::jsonb),
    coalesce(nullif(p_event->>'createdAt', '')::timestamptz, now())
  );
end;
$function$;

drop function if exists public.uapt_private_analytics_rollup(
  text, date, date, text, text[], text[], text[], text[]
);
drop function if exists public.uapt_list_analytics_events_window(
  text, timestamptz, timestamptz, boolean, integer, integer
);
drop function if exists public.uapt_list_analytics_events(text, timestamptz);

create function public.uapt_list_analytics_events(
  p_secret text,
  p_since timestamptz
)
returns table(
  id text, event_name text, source text, pathname text,
  visitor_id text, session_id text, country_code text, device_type text,
  locale text, page_type text, entity_slug text, query_kind text,
  query_length_bucket text, result_rank integer, result_source text,
  endpoint_kind text, target_kind text, source_domain text,
  source_category text, source_name text, referrer_domain text, landing_path text,
  utm_source text, utm_medium text, utm_campaign text, utm_term text, utm_content text,
  nav_area text, footer_group text, example_key text, copy_target text,
  from_locale text, to_locale text, from_theme text, to_theme text,
  limit_bucket text, result_count_bucket text, payload jsonb, created_at timestamptz
)
language plpgsql
security definer
set search_path to 'public', 'private'
as $function$
declare
  v_secret text;
begin
  select value into v_secret from private.analytics_config where key = 'mirror_secret';
  if v_secret is null or p_secret is distinct from v_secret then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return query
  select
    e.id, e.event_name, e.source, e.pathname, e.visitor_id, e.session_id,
    e.country_code, e.device_type, e.locale, e.page_type, e.entity_slug,
    e.query_kind, e.query_length_bucket, e.result_rank, e.result_source,
    e.endpoint_kind, e.target_kind, e.source_domain,
    e.source_category, e.source_name, e.referrer_domain, e.landing_path,
    e.utm_source, e.utm_medium, e.utm_campaign, e.utm_term, e.utm_content,
    e.nav_area, e.footer_group, e.example_key, e.copy_target,
    e.from_locale, e.to_locale, e.from_theme, e.to_theme,
    e.limit_bucket, e.result_count_bucket, e.payload, e.created_at
  from public.analytics_events e
  where e.created_at >= p_since
  order by e.created_at asc, e.id asc;
end;
$function$;

create function public.uapt_list_analytics_events_window(
  p_secret text,
  p_since timestamptz,
  p_until timestamptz,
  p_exclude_bots boolean default false,
  p_offset integer default 0,
  p_limit integer default 1000
)
returns table(
  id text, event_name text, source text, pathname text,
  visitor_id text, session_id text, country_code text, device_type text,
  locale text, page_type text, entity_slug text, query_kind text,
  query_length_bucket text, result_rank integer, result_source text,
  endpoint_kind text, target_kind text, source_domain text,
  source_category text, source_name text, referrer_domain text, landing_path text,
  utm_source text, utm_medium text, utm_campaign text, utm_term text, utm_content text,
  nav_area text, footer_group text, example_key text, copy_target text,
  from_locale text, to_locale text, from_theme text, to_theme text,
  limit_bucket text, result_count_bucket text, payload jsonb, created_at timestamptz
)
language plpgsql
security definer
set search_path to 'public', 'private'
as $function$
declare
  v_secret text;
  v_limit integer := greatest(1, least(coalesce(p_limit, 1000), 1000));
  v_offset integer := greatest(0, coalesce(p_offset, 0));
begin
  select value into v_secret from private.analytics_config where key = 'mirror_secret';
  if v_secret is null or p_secret is distinct from v_secret then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return query
  select
    e.id, e.event_name, e.source, e.pathname, e.visitor_id, e.session_id,
    e.country_code, e.device_type, e.locale, e.page_type, e.entity_slug,
    e.query_kind, e.query_length_bucket, e.result_rank, e.result_source,
    e.endpoint_kind, e.target_kind, e.source_domain,
    e.source_category, e.source_name, e.referrer_domain, e.landing_path,
    e.utm_source, e.utm_medium, e.utm_campaign, e.utm_term, e.utm_content,
    e.nav_area, e.footer_group, e.example_key, e.copy_target,
    e.from_locale, e.to_locale, e.from_theme, e.to_theme,
    e.limit_bucket, e.result_count_bucket, e.payload, e.created_at
  from public.analytics_events e
  where e.created_at >= p_since
    and e.created_at < p_until
    and (not coalesce(p_exclude_bots, false) or coalesce(lower(e.device_type), 'unknown') <> 'bot')
  order by e.created_at asc, e.id asc
  offset v_offset
  limit v_limit;
end;
$function$;

create function public.uapt_private_analytics_rollup(
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
language plpgsql
stable
security definer
set search_path to 'public', 'private'
as $function$
declare
  v_secret text;
  v_result jsonb;
begin
  select value into v_secret from private.analytics_config where key = 'mirror_secret';
  if v_secret is null or p_secret is distinct from v_secret then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  with raw as (
    select
      e.*,
      coalesce(nullif(lower(e.source_category), ''), nullif(lower(e.payload->>'source_category'), ''), 'unknown') as normalized_source,
      case when upper(coalesce(e.country_code, '')) ~ '^[A-Z]{2}$' then upper(e.country_code) else 'unknown' end as normalized_country,
      coalesce(nullif(lower(e.locale), ''), 'unknown') as normalized_locale,
      coalesce(nullif(lower(e.device_type), ''), 'unknown') as normalized_device,
      case
        when p_grain = 'month' then to_char(e.created_at at time zone 'America/Toronto', 'YYYY-MM')
        when p_grain = 'week' then 'Wk ' || to_char(date_trunc('week', e.created_at at time zone 'America/Toronto'), 'MM-DD')
        else to_char(e.created_at at time zone 'America/Toronto', 'MM-DD')
      end as bucket_label
    from public.analytics_events e
    where e.created_at >= (p_from::timestamp at time zone 'America/Toronto')
      and e.created_at < ((p_to + 1)::timestamp at time zone 'America/Toronto')
  ), human as (
    select * from raw
    where normalized_device <> 'bot'
      and (coalesce(cardinality(p_sources), 0) = 0 or normalized_source = any(p_sources))
      and (coalesce(cardinality(p_countries), 0) = 0 or normalized_country = any(p_countries))
      and (coalesce(cardinality(p_locales), 0) = 0 or normalized_locale = any(p_locales))
      and (coalesce(cardinality(p_devices), 0) = 0 or normalized_device = any(p_devices))
  ), bot_trend as (
    select bucket_label as label, count(*) filter (where event_name = 'page_view')::integer as page_views
    from raw where normalized_device = 'bot'
    group by bucket_label order by min(created_at)
  ), totals as (
    select
      count(*) filter (where event_name = 'page_view')::integer as human_page_views,
      count(*) filter (where event_name = 'page_view' and normalized_source = 'unknown')::integer as unknown_source_page_views
    from human
  ), bot_total as (
    select count(*) filter (where event_name = 'page_view')::integer as bot_page_views
    from raw where normalized_device = 'bot'
  )
  select jsonb_build_object(
    'botPageViews', bot_total.bot_page_views,
    'botTrend', coalesce((select jsonb_agg(jsonb_build_object('label', label, 'pageViews', page_views)) from bot_trend), '[]'::jsonb),
    'humanPageViews', totals.human_page_views,
    'latestEventAt', (select to_char(max(created_at) at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') from raw),
    'unknownSourcePageViews', totals.unknown_source_page_views
  ) into v_result
  from totals cross join bot_total;

  return v_result;
end;
$function$;

revoke all on function public.uapt_record_analytics_event(text, jsonb) from public;
revoke all on function public.uapt_list_analytics_events(text, timestamptz) from public;
revoke all on function public.uapt_list_analytics_events_window(text, timestamptz, timestamptz, boolean, integer, integer) from public;
revoke all on function public.uapt_private_analytics_rollup(text, date, date, text, text[], text[], text[], text[]) from public;

grant execute on function public.uapt_record_analytics_event(text, jsonb) to anon, authenticated, service_role;
grant execute on function public.uapt_list_analytics_events(text, timestamptz) to anon, authenticated, service_role;
grant execute on function public.uapt_list_analytics_events_window(text, timestamptz, timestamptz, boolean, integer, integer) to anon, authenticated, service_role;
grant execute on function public.uapt_private_analytics_rollup(text, date, date, text, text[], text[], text[], text[]) to anon, authenticated, service_role;

commit;
