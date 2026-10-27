# Prisma 7: MCP repair and pre-deployment acceptance

2026-10-26, Toronto. Local acceptance passes. Production is unchanged. Formal OCI
artifact acceptance is pending source publication and release admission; this is
not a declaration that production deployment is accepted.

## Root cause and repair

The generic `mcp:export` command read the historical base dataset but omitted the
selected, already published V6 record corrections used by university detail APIs.
That lost UCL's CLIE assessment exception and Toronto/Princeton restrictions,
separate tool records, and school revision metadata. The original topic selectors
and restriction-first ordering were already correct. Existing failure assertions
remain in place; no expected Claim IDs were removed to make the tests pass.

`scripts/export-mcp-catalog.ts` now reads the verified public V6 pointer and its
school shards, retains canonical identities, and validates each selected record's
original fingerprint before export. It exports the public schema projection of
each record, its original revision/hash/date, reviewed tools, aliases and held IDs.
Candidate/private selectors and data-root overrides are refused. A temporary file
must pass the real catalog loader before an atomic rename selects the local output.

Original `recordSha256` hashes the published source summary with its original key
order. Zod reorders schema fields on parsing, so it cannot be recomputed from a
parsed MCP record. A separate optional `summarySha256` binds the schema-normalized
export. It does not replace or relabel the original fingerprint. The loader checks
this digest when present, completeness of revision metadata, and held/current ID
separation. Old immutable catalogs without the new digest remain readable.

Snapshots are validated against the effective current claims. Corrected schools
cannot inherit an old base snapshot merely because the base release ID is the
same. No review, hold, language gap, snapshot pin or university policy is promoted.
Public data files, migrations and database models are unchanged by this repair.

## Evidence and results

Evidence directory: `.local/prisma7/mcp-repair/evidence/`. Earlier failure logs and
the original generated catalog remain intact. The new exported artifact is local
at `apps/mcp/.runtime-data/catalog.json`; it has not replaced the production file.

| Acceptance | Result |
| --- | --- |
| Original two failures plus metadata tamper/held regression and real MCP transport tests | 12/12 PASS |
| Node 22.22.3 complete `pnpm check` | PASS |
| Exporter/validator types and explicit shared-zone typecheck | PASS |
| Complete catalog-to-effective-public-contract reconciliation | 815 schools; 100 selected corrections; 5,993 Claims; 421 separately published tool records; zero remaining Claim IDs |
| PolicyService topic calls, schema validation and complete evidence continuation | 6,520 topic calls; every current Claim recoverable with original evidence |
| Historical/held IDs | 34 retained separately; none treated as current conclusions |
| Snapshots | 4 eligible strong summaries; 9 historical base approvals not inherited by corrected records |
| Unchanged controls | All 715 schools outside the selected correction cohort retain identical Claims/evidence and snapshots |
| Preview/private/alternate-manifest refusal | 4 tested selector classes rejected; existing catalog bytes unchanged |
| Local HTTP API-to-MCP comparison | Exact Claim/evidence equality for UCL, Toronto, Princeton, Waterloo and Aalto; exact tool contract equality for UCL, Toronto and Princeton |
| Locale route smoke | 35 HTTP paths across en/zh/fr/pl/es/nl/ms; status, language and canonical assertions pass, including unchanged Waterloo controls |
| Browser interaction | Chinese UCL assessment anchor and official evidence dialog opened; original English evidence/scope retained; screenshot inspected |
| Fresh PostgreSQL 16.15 database, Node 22.22.3 | 11 parity/failure/recovery groups, API ingestion and Web/worker checks PASS; unchanged before/after structure hash |
| Emitted/traced database package | 80 regular files copied outside the workspace; emitted ESM client imports and real PostgreSQL query PASS |
| OCI lifecycle read-only retention audit | PASS with existing 24-hour review reminders; no expired seven-day blocking hold or unclassified artifact reported |

The fresh database run is
`.local/prisma7/runs/20261027T021746Z-4uyabqbv/evidence/`. Its runner creates a new
cluster, applies historical migrations, runs both clients against the same data,
checks the resulting structure and stops that cluster. Test instances and browser
sessions started for this task are stopped after acceptance.

The trace check uses Next's bundled `@vercel/nft`. It reports optional `pg-native`
and `cloudflare:sockets` branches absent on this Node TCP path. The isolated copy
successfully imports and queries without either. This bounded diagnostic is not
an OCI `next build` or a validation of the final full-site tracing manifest.

## Actual production discrepancy, verified read-only

The active MCP process selects
`/srv/uapt/operations/qs91-100-20261026/mcp-catalog.json`. Its frozen catalog contains
815 schools, 5,578 Claims, 94 tools and 13 base strong snapshots. Claim ID sets or
tool counts differ from the repaired local export for 40 schools. All 40 repaired
Claim sets, text and evidence match the currently published public university APIs
exactly. This establishes a regeneration/synchronization gap; it is not evidence
that new university policy research was performed or approved.

The readback is recorded in `production-mcp-readonly.json`,
`production-mcp-ids-comparison.json`, `live-api-parity.json` and `public-readback/`.
An initial Python HTTP client received 403 responses; ordinary curl retrieval
succeeded and the complete 40-school comparison passed. Failed transport attempts
remain recorded and were not interpreted as missing policies.

No live MCP output has been corrected by this task. A future release must bind the
40-school behavioral difference, all 100 selected revision metadata/snapshot
decisions and the complete corpus to its synchronized candidate/public readback.
Do not reuse the old generated base catalog as this release's MCP artifact.

## Repeatable commands

```bash
pnpm install --frozen-lockfile
pnpm check
pnpm test:mcp-acceptance
pnpm --filter @uapt/tulsa-zone exec tsc --noEmit -p tsconfig.json
python3 scripts/verify-prisma7.py --pg-bin /opt/homebrew/opt/postgresql@16/bin \
  --node-bin .local/prisma7/node22/node_modules/node-bin-darwin-arm64/bin
git diff --check
```

`test:mcp-acceptance` generates the catalog, typechecks the export/validator, checks
every effective published record and tool, and runs the transport/security tests.
It operates on committed public selections and local output only.

## Remaining release work and boundaries

The root source upgrade remains Prisma CLI/Client/adapter 7.10.1 with pg 8.23.1,
dotenv 18.0.9, and TypeScript 5.9.3. This follow-up changes no dependency version.

The formal OCI build-once path requires a reviewed, pushed frozen SHA on
`origin/main`, and a plan admitted by the installed lifecycle/storage controller.
Current remote main was read back as
`2e1a00521e92ead92c31541398522fadd672a771`; the Prisma upgrade and this repair remain
local. No source was pushed, merged or uploaded to an OCI candidate. Existing
production artifacts, services, routing, env and retention clocks are untouched.

Still required for formal pre-deployment artifact acceptance:

1. Authorize publication/integration of the reviewed exact source commits, recheck
   concurrent main changes and freeze the resulting SHA.
2. Prepare contract 2.1.0 candidate scope/receipts for the selected Changes/V6
   artifacts and MCP delta; bind the exact generated catalog and source hashes.
3. Resolve an exact release plan and fresh retention, disk/inode, per-role package
   and build/startup/cold/steady memory budgets. Current low-load audit is not a
   build-peak measurement and does not itself admit a candidate.
4. Perform one isolated OCI production build; validate final file tracing and all
   active-zone dependencies. Exercise the fixed candidate slots and complete the
   semantic route/API/MCP matrix against that exact artifact.
5. Rehearse artifact/config rollback on the isolated candidate. Production traffic
   selection, public post-cutover readback and notifications remain a later,
   separately authorized operation.

The primary main env file has no direct Prisma database URL; its analytics uses
Supabase RPC. This task did not change or reaccept that external RPC. Actual
production PostgreSQL credentials, pooler, certificates, load and aggregate
connection budget have not been validated. The local independent database is a
synthetic acceptance fixture, not a production backup. The private inventory still
has its pre-existing freshness gap and no policy audit status was advanced.

## Fallback

For this local candidate, the old production artifact already remains active.
The private `.local/prisma7/mcp-repair/rollback-local.sh` reverses the MCP follow-up
and Prisma upgrade together from their exact clean branch tip, restores the lock
and generated v6 client, and reruns `pnpm check`. It refuses a changed tip or dirty
working tree. A separate disposable clone exercises both commit reversals and
checks that its tree exactly equals the original accepted baseline.

The historical Prisma 6 and 7 integration checks also verify that the old client
reads new-client writes, and that failed/expired transactions leave no partial
changes. A source rollback does not undo unrelated bad writes. Production fallback
still requires the future release's exact saved artifact, env/routing and lifecycle
transaction; a source revert is not an artifact cutover drill.
