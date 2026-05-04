# Architecture

University AI Policy Tracker is a public, SEO-first policy-change intelligence site. It tracks source-backed university AI policy status, historical snapshots, diffs, taxonomy classifications, and MDX reports.

## Deployment Boundary

OpenClaw is only an automation and crawling orchestrator. It must not host the public website, production API, PostgreSQL, Redis, or canonical production data.

Recommended split:

1. OpenClaw Automation OCI
   - Runs agents, crawl planning, browser automation, opencli, and external crawl helpers.
   - Holds only limited ingestion credentials.
   - Writes staged crawl artifacts and extraction candidates.

2. Public Data/API OCI
   - Runs PostgreSQL, Redis, NestJS API, workers, and ingestion endpoints.
   - Owns canonical reviewed policy data.
   - Accepts limited, audited writes from OpenClaw.

3. Public Web
   - Prefer Vercel for the Next.js frontend.
   - Alternative: separate OCI host behind Caddy or Nginx.

## Monorepo Shape

```text
apps/
  web/       Next.js App Router public site
  api/       NestJS Fastify API
  worker/    BullMQ workers and scheduled ingestion processors

packages/
  db/             Prisma schema and database access
  shared/         taxonomy, shared types, and validation contracts
  crawler-core/   fetch, normalize, snapshot, diff, robots, and PDF utilities

content/
  reports/   MDX reports

docs/        architecture and operating policies
infra/       deployment notes and future infrastructure templates
```

## Data Flow

1. Crawl targets are scheduled from reviewed university records and agent-created crawl plans.
2. Crawler jobs fetch public sources with plain HTTP first.
3. Dynamic pages escalate to Playwright or opencli only when needed.
4. Firecrawl can be used as a fallback when structured extraction is useful.
5. Normalized text receives a content hash.
6. Unchanged content skips LLM extraction.
7. Changed content creates a snapshot, diff, extraction candidate, and review task.
8. Reviewed records publish to public university, tool, region, theme, source, and diff pages.

## Public Surfaces

Initial public routes should support:

- `/universities/[slug]`
- `/tools/[slug]`
- `/regions/[slug]`
- `/themes/[slug]`
- `/sources/[id]`
- `/diffs/[id]`
- `/reports/[slug]`

Thin pages should stay `noindex` until they have useful source-backed content.

## MVP Search

Use PostgreSQL full-text search for the MVP. Move to Meilisearch or Typesense only after public search traffic and query complexity justify a separate search service.
