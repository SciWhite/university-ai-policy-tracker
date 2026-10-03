begin;
-- A fixed server-side cutoff; callers cannot choose a wider deletion window.
create or replace function public.uapt_analytics_retention(p_secret text, p_dry_run boolean default true)
returns jsonb
language plpgsql security definer
set search_path = public, private, extensions
as $function$
declare
  v_secret text;
  v_cutoff timestamptz := now() - interval '13 months';
  v_count bigint;
begin
  select value into v_secret from private.analytics_config where key = 'mirror_secret';
  if v_secret is null or p_secret is distinct from v_secret then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_dry_run is distinct from false then
    select count(*) into v_count from public.analytics_events where created_at < v_cutoff;
  else
    delete from public.analytics_events where created_at < v_cutoff;
    get diagnostics v_count = row_count;
  end if;
  return jsonb_build_object('dryRun', p_dry_run is distinct from false, 'cutoff', v_cutoff, 'rows', v_count);
end;
$function$;
revoke all on function public.uapt_analytics_retention(text, boolean) from public, authenticated;
grant execute on function public.uapt_analytics_retention(text, boolean) to anon, service_role;
commit;
