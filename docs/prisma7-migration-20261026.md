# Prisma 7 isolated migration acceptance — 2026-10-26

Historical migration acceptance below is preserved. The subsequent MCP exporter
repair and expanded preflight are recorded in [the follow-up](prisma7-mcp-preflight-20261026.md).
That follow-up resolves the two MCP failures listed in this original report;
neither report authorizes or claims a production cutover.

The isolated candidate upgrades the PostgreSQL access layer from Prisma 6.19.3 to
7.10.1. Migration-specific acceptance passes. This is **not a production release**:
the existing MCP suite still has two baseline failures, and actual production
database connectivity, packaging and cutover remain untested.

## Workspace eligibility

- Primary checkout `main` was at `14b874c61c914191329ba10316350f8008249fd7`
  with many unrelated uncommitted changes. It was ineligible for an in-place upgrade.
- Candidate branch: `codex/uapt-prisma7-20261026`, based on
  `2e1a00521e92ead92c31541398522fadd672a771`, the read-back active shared-web
  baseline and current local `origin/main`. The main and MCP services have separate
  accepted artifacts; they were not replaced or consolidated.
- Pre-upgrade `pnpm check` passed. Existing TypeScript 5.9.3 and production
  Node 22.22.3 meet Prisma 7 requirements. Root Node constraints now match the
  Prisma package requirement: `^20.19 || ^22.12 || >=24.0`.
- The private inventory pointer failed the existing seven-day freshness check.
  Pointer, parent, evidence, approvals and held decisions were not refreshed or
  reinterpreted. This local code migration does not perform a university audit.
- Docker was not running. PostgreSQL 16.15 was installed alongside the existing
  PostgreSQL 18 installation, then used only for dedicated loopback test clusters.
  No database server was upgraded or existing database service restarted.
- Read-only inspection of the primary production env found no `DATABASE_URL` or
  `DIRECT_DATABASE_URL`; the Supabase RPC analytics variables are present. This
  describes that env file, not every possible service. No production DB was queried.

## Exact versions and changes

| Package | Before | Candidate |
| --- | --- | --- |
| `prisma` | 6.19.3 | 7.10.1 |
| `@prisma/client` | 6.19.3 | 7.10.1 |
| `@prisma/adapter-pg` | absent | 7.10.1 |
| direct `pg` | absent | 8.23.1 |
| `@types/pg` | absent | 8.23.1 |
| direct `dotenv` | absent | 18.0.9 |

The direct versions are pinned and the lockfile is updated. Do not use an
unversioned downloaded Prisma CLI; its `latest` tag currently selects Prisma 8 RC.

- `packages/db/prisma.config.ts` explicitly loads CLI env from the package/root
  `.env` files; existing process env wins. CLI migrations prefer
  `DIRECT_DATABASE_URL`, falling back to `DATABASE_URL`. Generation works without
  credentials. Application launchers must provide runtime environment variables;
  do not rely on Prisma 6's implicit env loading.
- The `prisma-client` generator writes to ignored
  `packages/db/src/generated/prisma`. Generated TypeScript imports use `.ts` for
  Next/Turbopack; the database compiler rewrites them to `.js` when emitting.
  `prisma-client.js` and `connection.js` follow existing source-package bridge
  conventions. A real local Next route found and verified this requirement.
- Production imports go through `src/prisma-client`; the permissive ambient
  `prisma-compat.d.ts` and placeholder payload types are removed. Query includes,
  payloads, transactions and row mappings use generated types.
- The lazy client uses `PrismaPg` and explicitly configures the pool and
  interactive transaction limits. Disconnect disposes the pool and resets the
  singleton. Runtime schema selection is passed to the adapter.
- No model fields, table definitions, historical migration bytes, public policy
  data, claim IDs, evidence text, history, held decisions or language gaps change.

## Connection configuration

| Environment variable | Default per process |
| --- | --- |
| `DATABASE_POOL_MAX` | 5 |
| `DATABASE_CONNECTION_TIMEOUT_MS` | 5000 |
| `DATABASE_IDLE_TIMEOUT_MS` | 300000 |
| `DATABASE_TRANSACTION_MAX_WAIT_MS` | 2000 |
| `DATABASE_TRANSACTION_TIMEOUT_MS` | 5000 |
| `DATABASE_TLS_MODE` | loopback: disable; remote: verify-full |
| `DATABASE_TLS_CA_FILE` | optional additional trusted CA file |

These defaults are a bounded candidate configuration, not a measurement of the
old production pool. Budget `processes × pool max` across all services/replicas
before enabling a production Prisma connection. Pool connect/acquire timeout is
one `pg` setting; it cannot preserve Prisma 6's separate defaults of 5s and 10s.

Legacy URL `connection_limit`, timeout/lifetime and `schema` settings are translated
and removed before passing the connection string to `pg`. Differing explicit
`connect_timeout`/`pool_timeout` require an explicit new timeout decision. Zero or
invalid bounded settings fail early; a legacy `pgbouncer` flag requires a separate
pooler review. Remote TLS always validates certificates, including when the old
URL says `sslmode=require`; unencrypted mode is limited to loopback. CA and optional
client certificate/key files are read explicitly so URL options cannot override
the verified TLS object. Unreviewed URI parameters (including query-field host
overrides and `ssl=no-verify`) fail closed before `pg` can override these settings.
No `rejectUnauthorized: false` fallback is added.

## Acceptance evidence

Private evidence lives in `.local/prisma7/evidence/`. A fresh, repeatable run is in
`.local/prisma7/runs/20261027T012256Z-xu4l5qt7/evidence/` (UTC directory timestamp;
the user-facing date remains October 26 in Toronto).

| Check | Result |
| --- | --- |
| Baseline Prisma 6 `pnpm check` | PASS |
| Prisma 7 generate without database credentials | PASS |
| Full `pnpm check` on local Node 26.12.1 and production-matched Node 22.22.3 | PASS |
| DB, API and worker TypeScript emit; explicit shared-zone typecheck | PASS |
| New integration-test typecheck and 3 connection configuration tests | PASS |
| 11 real PostgreSQL integration groups on Node 22.22.3 | PASS |
| Nest/Fastify HTTP catalog, pagination, 404, ingestion auth and writes | PASS |
| Web analytics Prisma branch and existing worker config | PASS |
| Browser search submit, English and Chinese Harvard routes, analytics POST | PASS, bounded dev smoke |
| MCP tests and real Streamable HTTP calls | 9/11 pass; same two failures reproduced with baseline sources/catalog |
| Historical migration replay and Prisma 7 `migrate deploy` | PASS, no additional migration |
| Before/after PostgreSQL structure dump | identical after omitting random pg_dump restrict tokens |
| 6,487 tracked public-data and migration files vs candidate base | zero changed files |
| Primary checkout key hashes, HEAD and inventory pointer | preserved |

The schema dump normalized SHA256 is
`0d63933ec54ee462cc7d3dbf4d1c2e832fa4f5697704fb49c5b023922607717e`.
The integration groups cover: v6 seed and v7 idempotence; nullable fields, JSON
database null versus JSON null, dates, enum/array/relation queries; ordered offset
and cursor pagination; public contracts and canonical Claim/Evidence IDs; ingestion
round trips; interactive/batch commit and rollback; P2002; bounded pool saturation
and recovery; trusted/untrusted TLS; stalled connection handshake; idle connection
termination recovery; and actual pool closure on disconnect. The v6 client reads
v7 writes throughout the test, exercising database-level fallback compatibility.
Version-specific JSON null sentinels are supplied by each client's own runtime.

Browser artifacts are under `.playwright-cli/`, with a viewport image at
`output/playwright/prisma7-harvard.png`. The initial browser failure from missing
ESM bridges was fixed and rechecked; final school-route console captures have no
errors. This is not full locale/device coverage or production-build acceptance.

## Existing problems and untested scope

- Both baseline and candidate MCP runs fail `focused topics retain CLIE assessment
  exceptions and Waterloo instructor restrictions` and `policy conditions precede
  tool entries without losing claims or mutating the catalog`. The current exporter
  does not supply some Claim IDs expected by those tests. This migration does not
  fix or approve a policy/MCP data change. Overall MCP acceptance is not green.
- Inventory diagnostic age is a pre-existing gap. Fresh metadata is not claimed.
- The worker currently only exports configuration loading; no queue processor is
  implemented there. Queue processing was not invented or represented as tested.
- Synthetic seed/boundary fixtures are not a production database clone. Actual
  production DB version, data volume, pooler, credentials, TLS chain, networking,
  concurrent load, operational pool budget and restoration from backups are untested.
- Supabase RPC behavior was not modified or independently reaccepted. Public
  loaders/MCP use accepted artifacts; local generation does not repin snapshots or
  promote private candidates.
- No OCI production build, frozen deployed package, file-tracing acceptance,
  routing cutover, live smoke, deployment rollback drill, push or notification was
  performed. A future dependency release needs the authoritative OCI build-once
  route, all active-zone dependencies and lifecycle/storage/synchronization gates.

## Repeat local acceptance

Install the locked workspace dependencies, then use an already installed PostgreSQL
16 binary directory. The script creates a new cluster and a new evidence directory
on every run, freezes the original Prisma 6 source from the exact base SHA,
replays unchanged migrations, compares both versions, and stops its cluster in
`finally`. It never loads a production env file. It preserves test evidence/data.

```bash
pnpm install --frozen-lockfile
python3 scripts/verify-prisma7.py --pg-bin /opt/homebrew/opt/postgresql@16/bin \
  --node-bin .local/prisma7/node22/node_modules/node-bin-darwin-arm64/bin
pnpm check
pnpm mcp:export
pnpm test:mcp
git diff --check
```

`--node-bin` is optional; the recorded run used Node 22.22.3. The Node path above is
this machine's private test runtime, not a tracked dependency. The final MCP command
is expected to expose the two recorded baseline failures until separately repaired.

## Executable fallback

**Current isolated candidate:** leave production and the primary checkout alone.
The previous artifact remains active. Keep this branch and evidence for review.

**Source-level local fallback:** after committing the candidate, use the recorded
upgrade commit SHA in a clean integration branch and reverse that commit. This
restores CLI/client versions, config, generator and import paths together:

```bash
git revert <recorded-prisma7-upgrade-commit>
pnpm install --frozen-lockfile
pnpm db:generate
pnpm check
```

Do not run this against someone else's uncommitted work. A clean v6 reference can
also be prepared without changing any active checkout:

```bash
git worktree add --detach /tmp/uapt-prisma6-reference \
  2e1a00521e92ead92c31541398522fadd672a771
```

**Future production fallback:** retain the exact old accepted code artifact,
generated client, Node runtime, env and routing configuration. Use the installed
release lifecycle controller's recorded rollback/recovery transaction to restore
that artifact/configuration; do not rebuild or merely downgrade packages inside
the active artifact. Recheck affected API, analytics, page and MCP routes. No
executable production transaction can be named before that release plan exists.
This candidate creates no DDL/data migration to reverse. Reverting code cannot
undo bad writes; any actual data corruption needs a separate exact-data recovery.

## References

- [Prisma 7 upgrade guide](https://www.prisma.io/docs/guides/upgrade-prisma-orm/v7)
- [Prisma release status](https://www.prisma.io/docs/orm/release-status)
- [Driver pool defaults](https://www.prisma.io/docs/orm/v7/prisma-client/setup-and-configuration/databases-connections/connection-pool)
