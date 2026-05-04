# Crawler Policy

The crawler should collect public policy evidence without bypassing access controls or creating avoidable load.

## Fetch Order

1. Use plain HTTP fetch first.
2. Use conditional requests with `ETag` and `Last-Modified` when available.
3. Escalate to Crawlee or Playwright for dynamic pages only when static fetch is insufficient.
4. Use opencli for browser/control workflows when it materially improves reliability.
5. Use Firecrawl as a fallback for difficult extraction or structured crawl tasks.

## Robots, Access, And Rate Limits

- Respect robots.txt and site-specific crawl rules.
- Use a clear crawler user agent and contact email.
- Apply per-host concurrency and delay limits.
- Do not bypass login gates, paywalls, MFA, IP blocks, or CAPTCHAs.
- Mark blocked or login-gated sources as `inaccessible`.

## Source Evidence

Every classification should preserve:

- source URL
- final URL after redirects
- title, if available
- fetched timestamp
- HTTP status
- robots decision
- content hash
- normalized text snapshot pointer
- evidence quote or location, when legally and practically available
- extraction confidence and review state

## Change Detection

Run extraction only after source content changes:

1. Fetch source.
2. Normalize text.
3. Compute content hash.
4. If hash is unchanged, update last checked metadata and stop.
5. If hash changed, create snapshot, diff, extraction candidate, and review task.

## Local Ingestion Contract

Crawler output should be converted into structured ingest payloads before it reaches the API:

- crawl plan: planned set of crawl targets, expected themes, and fetch modes.
- crawl target: one URL plus university slug and source metadata.
- crawl artifact: fetched URL result, status, headers, normalized text, hash, and failure reason.
- source snapshot ingest payload: normalized source text and hash tied to a known university/source.
- extraction candidate payload: taxonomy classification, evidence, confidence, and review state tied to a source snapshot.

The local sample script `pnpm ingest:sample` creates a crawl run and source snapshot directly against the local database after `pnpm db:seed`. It is for local verification only and does not connect OpenClaw.

## Content Retention

Raw snapshots, screenshots, browser profiles, and logs should not be committed to Git. Keep them in controlled object storage or local ignored artifact directories.
