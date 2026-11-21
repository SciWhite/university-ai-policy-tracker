# Architecture (current state, 2026-11-22)

University AI Policy Tracker (`https://eduaipolicy.org`) publishes source-backed
claims about about 815 universities' AI policies. Each claim carries
original-language evidence, citations, change history and machine-readable APIs.
This page describes what runs today. Binding rules are in `AGENTS.md`; procedures
are in the docs listed in [README.md](README.md).

## Production

```text
Cloudflare (DNS, WAF, HTML edge cache 7 days, purge after every switch)
  └─ nginx on host hermes-agent-prod
       ├─ disk HTML cache (purged by cutover / purge-html-cache)
       ├─ static aliases for retired _next builds
       ├─ /mcp ─────────────► MCP service  uapt-shared-v6-r2       127.0.0.1:3161
       └─ location / ───────► upstream uapt_next_backend
                                ├─ web slot uapt-mcp-v6-candidate  127.0.0.1:3101
                                └─ web slot uapt-mcp-v6-r2         127.0.0.1:3102
```

- One Next.js web service runs in two fixed slots. Only one is routed; the other
  holds the next candidate during a program release. The slot names are
  historical, so check `systemctl is-active` instead of assuming.
- Program and content are separate:
  - **Program:** a content-free artifact built once in GitHub Actions
    (`.github/workflows/program-build.yml`) from a frozen commit, installed by
    `/usr/local/libexec/uapt-program-release.py`. See [program-release.md](program-release.md).
  - **Content:** immutable content releases under `/srv/uapt/content/runtime`.
    `current.json` points at the active release, together with a sync contract 2.1.0
    receipt. Web and MCP follow the pointer without a restart. See
    [content-release.md](content-release.md).
- The lifecycle controller `/usr/local/libexec/uapt-release-lifecycle.py` keeps
  the gates: capacity, disk, retention register, sync contract, journal and
  recovery. See [release-lifecycle.md](release-lifecycle.md) and
  [release-storage-policy.md](release-storage-policy.md).
- Memory: each slot runs with MemoryHigh = MemoryMax = 8 GiB and a 4608 MiB heap. The
  host has no swap. `uapt-web-watchdog.timer` restarts the routed slot only after
  repeated failed probes.
- OpenClaw runs on a separate OCI host. It does crawling and maintenance scans
  only, never hosts the site, and writes staged artifacts only. See
  [maintenance-oci-runbook.md](maintenance-oci-runbook.md).

## Repository

| Path | Role |
|---|---|
| `apps/web` | Next.js App Router site and public APIs (`/api/public/v1/...`), V6 school pages, changes/history, reports, search, sitemaps |
| `apps/mcp` | MCP server, reading the same runtime content |
| `apps/tulsa-zone` | Frozen pre-R1 zone app. It is not deployed, but its files are still hash-pinned and tested; see [v4-v5-retirement-plan.md](v4-v5-retirement-plan.md) |
| `apps/api`, `apps/worker` | NestJS API and BullMQ worker scaffolds; not part of production |
| `packages/shared` | Schemas (claims, OpenClaw artifacts, taxonomy, entity aliases) |
| `packages/db` | Prisma schema and client (analytics and local ingest) |
| `packages/crawler-core` | Shared crawl helpers |
| `plugins/university-ai-policy-tracker` | Student plugin package |
| `data/` | Runtime and history data, about 1.3 GB: the public releases, `public-v6-*` pages, records, history and change overviews, the public change history, translations and marks registries. Content releases are built from it |
| `staging/` | Crawl and staging runs: `uapt-runs/` belongs to the content file set, `ai-tools/` to the release manifests, `uapt-maintenance/` to the maintenance scripts |
| `knowledge/` | Small retrieval index for agents; not authoritative |
| `scripts/content-release/` | `content:build`, `validate`, `bundle`, `correct`, `switch`, and sync proofs |
| `scripts/release/` | Host-side release tools (`program-release.py`, `content-release.py`, watchdog, remote-bg) |
| `scripts/v6-pipeline/` | Batch crawl → V6 → release pipeline ([v6-pipeline.md](v6-pipeline.md)) |
| `scripts/uapt-release-lifecycle.py` | Source of the installed lifecycle controller |
| `infra/` | nginx, systemd units, OpenClaw and Docker configuration |
| `tests/` | Node and Python tests; `pnpm check` runs the validators, typecheck and lint |

Searches skip `data/`, `staging/`, `apps/tulsa-zone/`, `apps/web/public/` and the
lockfile (see `.ignore`). Use `rg -uu` to search them on purpose.

## Data flow

```text
official sources
  → crawl (OpenClaw maintenance scan, or the V6 pipeline: discover → select → capture)
  → extraction and agent review (quote/hash gates, independent review agent)
  → V6 page input and records (scripts/v6-pipeline, data/public-v6-*)
  → content:build → content:validate → sync event 2.1.0 → content:bundle
  → host: content-release.py check → activate → complete → classify-content-releases
  → purge (nginx HTML cache, Cloudflare zone) → public readback → IndexNow (opt-in)
```

The evidence model is claims, evidence and citations first
([data-contract.md](data-contract.md)). Original-language quotations are canonical;
translations and summaries are for navigation only. Review state `agent_reviewed`
is publication-ready, and there is no human review step.

## Page generations

V6 is the only school-page template, with full and base tiers. Some V4/V5 modules
still feed V6: V5 UI strings, V4 procedure supplements, and V5 scene localization on
zh pages. Their retirement is planned in
[v4-v5-retirement-plan.md](v4-v5-retirement-plan.md).

Locales: content URLs are moving to English and Chinese only, with UI locales
picked in the browser. That redesign is the render-once work on branch
`claude/pensive-elion-2fc75f`; until it ships, the older locale routes stay live.
