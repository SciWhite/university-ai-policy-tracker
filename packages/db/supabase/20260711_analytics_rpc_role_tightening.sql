begin;

-- The server uses the anon API key plus the existing per-request analytics
-- secret. Signed-in Supabase users do not need access to these definer RPCs.
revoke execute on function public.uapt_record_analytics_event(text, jsonb) from authenticated;
revoke execute on function public.uapt_list_analytics_events(text, timestamptz) from authenticated;
revoke execute on function public.uapt_list_analytics_events_window(text, timestamptz, timestamptz, boolean, integer, integer) from authenticated;
revoke execute on function public.uapt_private_analytics_rollup(text, date, date, text, text[], text[], text[], text[]) from authenticated;

commit;
