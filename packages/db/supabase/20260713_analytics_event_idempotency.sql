begin;

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
  )
  on conflict (id) do nothing;
end;
$function$;

revoke all on function public.uapt_record_analytics_event(text, jsonb) from public, authenticated;
grant execute on function public.uapt_record_analytics_event(text, jsonb) to anon, service_role;

commit;
