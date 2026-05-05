# Architecture

University AI Policy Tracker is a public, SEO-first and GEO-ready policy-change intelligence site. It tracks source-backed university AI policy status, historical snapshots, diffs, taxonomy classifications, public JSON, citation-ready claims, and MDX reports.

Canonical public domain: `https://eduaipolicy.org`. DNS and edge configuration are managed in Cloudflare.

## Deployment Boundary

OpenClaw is only an automation and crawling orchestrator. It must not host the public website, production API, PostgreSQL, Redis, or canonical production data.

Recommended split:

1. OpenClaw Automation OCI
   - Runs agents, crawl planning, browser automation, opencli, and external crawl helpers.
   - Holds only limited ingestion credentials.
   - Writes staged crawl artifacts, extraction candidates, and claim/evidence/citation artifacts through pull requests or limited ingestion.
   - Must not push `main`, deploy public services, or write the production database directly.

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
8. Extraction candidates are promoted into `policy_claims` only when they carry source URL, source snapshot hash, and a short evidence snippet.
9. Public pages and JSON read from canonical entities, policy claims, claim evidence, and source attributions.
10. Reviewed records publish to public university, tool, region, theme, source, diff, report, and JSON pages.

## GEO Data Contract

The public contract is claim/evidence/citation first:

- `canonical_entities` represent universities, tools, regions, themes, and future course-level entities.
- `policy_claims` describe one citation-ready policy assertion about a canonical entity.
- `claim_evidence` links each public claim to a source URL, source snapshot hash, and short source-attributed evidence snippet.
- `source_attributions` preserve official source provenance and rights caveats.

`confidence` and `reviewState` are separate fields. `confidence` is machine confidence in extraction or classification. `reviewState` records workflow status such as `machine_candidate`, `agent_reviewed`, `human_reviewed`, `needs_review`, or `rejected`.

Student/course future features should reuse canonical entities, policy claims, claim evidence, and source attributions. They should not become a separate comment-only model with weaker provenance.

## Public Surfaces

Initial public routes should support:

- `/universities/[slug]`
- `/tools/[slug]`
- `/regions/[slug]`
- `/themes/[slug]`
- `/sources/[id]`
- `/diffs/[id]`
- `/reports/[slug]`
- `/api/public/v1/universities/[slug].json`
- `/api/public/v1/recent-changes.json`
- `/llms.txt`

Thin pages should stay `noindex` until they have useful source-backed content.

`llms.txt` is an auxiliary guide for agents and developers. It is not a guaranteed AI ranking signal, and Google does not require it for AI features.

## MVP Search

Use PostgreSQL full-text search for the MVP. Move to Meilisearch or Typesense only after public search traffic and query complexity justify a separate search service.
