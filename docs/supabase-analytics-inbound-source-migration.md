# Supabase analytics inbound-source migration

Production analytics uses Supabase RPCs when `SUPABASE_URL`,
`SUPABASE_ANON_KEY`, and `SUPABASE_ANALYTICS_SECRET` are configured. Apply the
Prisma migration locally for Postgres-backed development, and update Supabase
with the same nullable columns plus RPC field mappings.

Do not store full referrer URLs. The application sends only source category,
source name, referrer domain, landing path, and UTM fields.

## Table migration

```sql
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

create index if not exists analytics_events_source_category_created_at_idx
  on public.analytics_events(source_category, created_at);
create index if not exists analytics_events_source_name_created_at_idx
  on public.analytics_events(source_name, created_at);
create index if not exists analytics_events_referrer_domain_created_at_idx
  on public.analytics_events(referrer_domain, created_at);
```

## `uapt_record_analytics_event`

Keep the existing `p_secret` guard unchanged. Add these insert assignments from
`p_event`:

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

## `uapt_list_analytics_events`

Keep the existing `p_secret` guard and `p_since` filtering unchanged. Add these
columns to the returned row type and `select` list:

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

After applying the Supabase change, verify `/internal/analytics` shows source
mix rows for new page views. Historical rows are expected to appear as
`direct` or `unknown` because the new fields are nullable.
