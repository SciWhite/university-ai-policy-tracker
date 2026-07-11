begin;

alter table public.analytics_events enable row level security;

revoke all on table public.analytics_events from anon, authenticated;

revoke all on function public.uapt_record_analytics_event(text, jsonb) from public;
revoke all on function public.uapt_list_analytics_events(text, timestamptz) from public;
revoke all on function public.uapt_list_analytics_events_window(text, timestamptz, timestamptz, boolean, integer, integer) from public;
revoke all on function public.uapt_private_analytics_rollup(text, date, date, text, text[], text[], text[], text[]) from public;

grant execute on function public.uapt_record_analytics_event(text, jsonb) to anon, authenticated, service_role;
grant execute on function public.uapt_list_analytics_events(text, timestamptz) to anon, authenticated, service_role;
grant execute on function public.uapt_list_analytics_events_window(text, timestamptz, timestamptz, boolean, integer, integer) to anon, authenticated, service_role;
grant execute on function public.uapt_private_analytics_rollup(text, date, date, text, text[], text[], text[], text[]) to anon, authenticated, service_role;

commit;
