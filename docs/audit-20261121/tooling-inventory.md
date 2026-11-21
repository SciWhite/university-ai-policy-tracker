# Tooling sprawl inventory (eduaipolicy.org / university-ai-policy-tracker)

> Note (2026-11-22): several `docs/` files cited below as evidence were removed from the tree; `docs/HISTORY.md` gives the commit that still has each one.

Audit date 2026-11-21. Read-only. Repo basis: worktree `clever-shirley-462b54` at `b59ae274` (= `origin/main`).
No server access: everything about the host is from docs and from paths hard-coded in scripts; it is marked "per docs" or "per script".

Status legend: **LIVE** = current documented path or imported by the current one. **LIVE-OOR** = live, but only called from out-of-repo copies. **DUP** = duplicates another live path. **DORMANT** = valid code for a pre-R1 flow, no current caller. **DEAD** = retired, one-off, or contradicted by AGENTS.md. **ONE-SHOT** = migration tool used once, kept as a record.

---

## 0. Headline numbers

| Measure | Value |
|---|---|
| Files in `scripts/` (tracked) | 167 (130 ts, 22 py, 8 mjs, 5 json, 1 sh, 1 js). 146 at top level, 11 in `content-release/`, 9 in `lib/`, 1 in `release/` |
| Scripts with **zero** references (package.json, workflows, docs, other scripts, tests) | 53 (of which 1, `content-release/sync-basis-v6-source-metadata.ts`, is used from outside the repo) |
| One-off scripts tied to a date, school or batch (`*-20261014`, `qs-501-600`, `-011`, `-012`, `imperial`, `mit`, `msu-unist`, `september` and similar) | 40 |
| Root `package.json` scripts | 85 (whole workspace: 126 across 9 package.json files) |
| GitHub workflows | 1 (`program-build.yml`, manual dispatch only) |
| Release entry points in the repo: LIVE | 11 (table 1A) |
| Release entry points in the repo: DEAD/DORMANT/historical but still runnable | 17 (table 1B) |
| Out-of-repo pipeline code (`uapt-v6-source-metadata/.local/policy-v6`) | 112 script files across 3 batch dirs (31 + 34 + 47), 42 GB of data |
| `host-release.py` copies (a content-release orchestrator that is in neither repo nor docs) | 9 (7 in the batch dirs, 2 in the main checkout's `.local`) |
| Same-named batch scripts byte-identical in all 3 batches | 5 of 31 common files (the 4 copied `monitor_*.py` and one `dry_run.py`) |
| Server-side helper checkouts that live scripts hard-code | 3 (`/srv/uapt/release-helper`, `/srv/uapt/operations/content-priority-six-20261109/helper`, `/srv/uapt/operations/content-9schools-20261106/tools/install-release-tree.py`) |
| Local branches / remote branches / unmerged into origin/main | 127 / 81 / 30 local (16 remote) |
| Git worktrees | 9 (3 inside the main checkout's `.local/`) |
| Main checkout's local `main` | `14b874c6` (2026-09-24), **291 commits behind** `origin/main` |
| Finder duplicates `* 2.*` | 0 in this worktree. 90 in the main checkout (32 outside `.local`, all untracked, including `apps/web/app/favicon 2.ico` and `apps/web/lib/index-recovery-pilot 2.ts`) |

---

## 1. Release entry points

### 1A. LIVE (current method per AGENTS.md, `docs/program-release.md`, `docs/content-release.md`)

| Path | Purpose | Callers / evidence | Last change | Installed on host (per docs) | Status |
|---|---|---|---|---|---|
| `.github/workflows/program-build.yml` | Content-free program build on a frozen SHA, `ubuntu-24.04-arm` | AGENTS.md table, program-release.md §2 | 2026-11-05 | n/a (CI) | LIVE |
| `scripts/program-build.mjs` (`pnpm program:build`, `program:package`) | Next standalone build, prune, package, MCP esbuild bundle | the workflow, `tests/program-build.test.mjs` | 2026-11-06 | n/a | LIVE |
| `scripts/validate-web-build-scope.mjs` | Source-only build admission (on-demand route list) | the workflow | 2026-11-04 | n/a | LIVE |
| `scripts/program-artifact-install.py` | Verifies and unpacks the Actions artifact into `/srv/uapt/releases` | program-release.py `install`, docs §4/§7 | 2026-11-06 | `/usr/local/libexec/uapt-program-artifact-install.py` | LIVE |
| `scripts/release/program-release.py` (2,111 lines) | One-command host steps install → candidate → static → capacity → routing → ledger → plan → cutover → mcp → complete, plus `purge-html-cache` | AGENTS.md, docs §7, `tests/test_program_release.py` | 2026-11-07 | `/usr/local/libexec/uapt-program-release.py` | LIVE |
| `scripts/uapt-release-lifecycle.py` (1,488 lines) | Lifecycle controller: admission, capacity, disk, retention register, journal, recovery, cutover | program-release.py (`CONTROLLER`), all 7 batch `host-release.py` (`runpy.run_path`), docs | 2026-11-06 | `/usr/local/libexec/uapt-release-lifecycle.py` | LIVE (but it carries pre-R1 data: see §1C) |
| `scripts/content-release/build.ts` (`pnpm content:build`) | Builds an immutable content release under the content root | content-release.md §3 | 2026-11-06 | runs from a host checkout | LIVE per docs. The batches do **not** use it on the host; they build locally and copy the tree in with `install-release-tree.py` (see §5) |
| `scripts/content-release/validate.ts` (`content:validate`) | Release validator | docs §4, build.ts | 2026-11-06 | host checkout | LIVE |
| `scripts/content-release/switch.ts` (`content:switch`) | Pointer switch, ISR tag/path expiry, sync gate | docs §5, batch `host-release.py` | **2026-11-19** (ff3d8218: expire pages when source metadata changes) | host runs the copy in `/srv/uapt/operations/content-priority-six-20261109/helper` (per batch scripts), i.e. **without** the 11-19 fix | LIVE, with version skew |
| `scripts/content-release/correct.ts` (+ `correction-apply.ts`, `correction-lint.ts`, `reading-delta.ts`) | Claim-correction release flow | docs §8 | 2026-11-06 | host checkout | LIVE |
| `scripts/policy-inventory.py` (`sync-gate`) | Synchronization-contract gate (candidate/complete) | switch.ts via `lib/require-policy-sync.ts`, batch host-release.py, docs | 2026-10-24 | host helper checkout | LIVE |
| `scripts/uapt-release.mjs verify-sync` | Checks 2.0.0/2.1.0 sync receipts | program-release.py (`DEFAULT_RELEASE_HELPER=/srv/uapt/release-helper/scripts/uapt-release.mjs`), `tests/policy-sync-v21.test.py` | 2026-11-03 | `/srv/uapt/release-helper` checkout (per script) | LIVE (this subcommand only) |
| `scripts/submit-indexnow.ts` (`indexnow:*`) | IndexNow after public readback (needs its own authorization) | AGENTS.md | 2026-11-04 | — | LIVE |

Live libraries behind these: `scripts/lib/require-policy-sync.ts`, `lib/v6-release-contract.ts`, `lib/change-package.ts`, `lib/retain-change-revisions.ts`, `lib/export-change-events.ts`, `content-release/lib.ts`, `content-release/file-set.ts`, `pack-v6-release.ts` (`v6:pack`), `validate-v6-release.ts`, `export-v6-shards.ts`, `export-mcp-catalog.ts`, `validate-change-event-projection.ts`. The batch `assemble.ts` imports `v6-release-contract`, `change-package`, `retain-change-revisions`, `export-v6-shards` and `export-mcp-catalog` directly (relative `../../../scripts/...` from the uapt-v6-source-metadata worktree).

LIVE-OOR: `scripts/content-release/sync-basis-v6-source-metadata.ts` (2026-11-19) has no in-repo caller. All three batch `sync_basis.ts` files call it.

### 1B. DEAD / DORMANT / HISTORICAL entry points that can still be run

| Path / command | Purpose | Callers | Last change | Status | Evidence |
|---|---|---|---|---|---|
| `pnpm build`, `pnpm build:zone`, `pnpm build:debug`, `apps/web` `build`/`build:debug` → `scripts/uapt-release.mjs build full\|zone` | Pre-R1 on-server "Linux OCI" workspace `next build` for the full app or the Tulsa zone | 5 package.json aliases, `tests/release-build-pipeline.test.mjs` asserts them | 2026-11-03 | **DEAD, still the default `pnpm build`** | AGENTS.md: "Never build on the server and never run `next build` as a release." The help text still sends readers to the superseded `release-routing-policy.md` / `oci-small-release.md` |
| `pnpm release:inspect` → `uapt-release.mjs inspect` | OCI build identity check | package.json | 2026-11-03 | DEAD | Only meaningful for the OCI workspace build |
| `pnpm release:local-check` → `uapt-release.mjs local-check` | `git diff --check` + `pnpm check` | package.json | 2026-11-03 | DUP (thin wrapper) | Same thing as the AGENTS.md local gates |
| `uapt-release.mjs lifecycle …` | Wrapper that runs the installed lifecycle controller | release-lifecycle.md:13 | 2026-11-03 | DUP | Same entry point as `uapt-release-lifecycle.py`. program-release.py calls the controller directly |
| `scripts/release-build-pipeline.mjs` | Steps behind `uapt-release.mjs build` | uapt-release.mjs, `test:release-build` | 2026-11-03 | DEAD | Only reachable from the dead build path |
| `scripts/prepare-web-runtime-data.mjs` | Builds `apps/web/.runtime-data` for the workspace build | release-build-pipeline.mjs, `tests/web-runtime-data.test.mjs` | 2026-11-04 | DEAD | `content-release/file-set.ts` says it replaced "the former `.runtime-data` set" |
| `scripts/prepare-candidate-build-inputs.ts` | Stages history packages before a pre-R1 candidate build | tests only (2) | 2026-10-24 | DORMANT | No package.json, doc or workflow caller |
| `pnpm maintenance:prepare-candidate` / `maintenance:promote-candidate` | Legacy `data/public-releases` maintenance promotion (`--sync-ledger --confirm`) | package.json; AGENTS.md mentions the promoter | 2026-09-24 / 2026-10-11 | DORMANT | The last public release is `public-release-20260924-002` (`data/public-releases/current.json`). Since R1, content ships as runtime content releases |
| `pnpm snapshots:repin-release` → `repin-policy-snapshots-release.ts` | Re-pins snapshots after a legacy public release | package.json | 2026-10-11 | DORMANT | Bound to the legacy `public-releases` manifest |
| `scripts/run-synchronized-policy-mutation.ts` | Adapter for "legacy repair/content entry points" | AGENTS.md, 2 docs, 1 test | 2026-10-11 | DORMANT | It exists to wrap the legacy publishers below |
| `scripts/activate-september-report.py` | — | docs mention it as retired | 2026-11-04 | DEAD | The body is `raise SystemExit("Retired: …")` |
| `scripts/publish-imperial-reviewed-repair.ts` | One-off Imperial publisher | none | 2026-10-11 | DEAD | Zero references |
| `scripts/build-msu-unist-july-release.ts` | One-off July release builder | none | 2026-08-02 | DEAD | Zero references, hard-coded run id |
| `scripts/prepare-v6-audit-correction.py`, `finalize-v6-audit-correction.ts` | 2026-10-13 audit correction | content-release.md:347 "remain for history only" | 2026-10-13 | DEAD | Per the doc |
| `prepare-hku-v6-20261014.ts`, `finalize-hku-v6-20261014.ts`, `prepare-ntu-chicago-v6-20261014.ts`, `prepare-pku-v5-20261014.ts`, `prepare-chicago-tool-classification-20261014.ts`, `prepare-v6-followup-20261014.ts`, `prepare-v6-followup-catalog.ts`, `prepare-v6-mcp-correction.ts`, `prepare-imperial-runtime-repair.ts`, `prepare-mit-record-repair.ts`, `capture-mit-record-repair.py`, `prepare-scoped-policy-correction.ts`, `repair-v6-locale-completeness.ts`, `prepare-reviewed-presentation.ts`, `verify-v6-presentation-candidate.ts` | Per-school/per-date V5/V6 prepare and publish steps | none | 2026-10-10 to 10-25 | DEAD | Zero references |
| `scripts/nginx-minimal-routing.py`, `nginx-minimal-routing-compare.py` | R1 generator for the minimal nginx location set, and its isolated comparison | program-release.md §6 | 2026-11-06 | ONE-SHOT | Run once for the R1 routing migration. `routing` in program-release.py now only retargets the upstream |
| `apps/tulsa-zone` (1,783 files, 118 MB: 88 MB `public/`, 29 MB `content/`) + `pnpm build:zone` | Pre-R1 per-zone Next app | `release-build-pipeline.mjs`; `apps/web/lib/public-history-basis.ts` hashes 3 of its components; `content-runtime.ts`/`reading-cohort.ts` regexes mention it | 2026-11-04 | DEAD (but coupled) | AGENTS.md: per-school zones are historical. It is still a pnpm workspace member and is installed on every `pnpm install` |
| `infra/oci/uapt-mcp.service`, `infra/oci/uapt-mcp-location.conf` | MCP unit running `tsx apps/mcp/src/server.ts` on 3110 | none current | 2026-10-03 | DEAD | Production MCP is `uapt-shared-v6-r2` on 3161 running the bundled `server.mjs` (AGENTS.md, program-release.md §7.7) |
| `docs/oci-production-deployment.md`, `docs/deployment.md` | "pull/build/restart" OCI deploy at a fixed IP | — | 2026-06-26 / 06-20 | DEAD, **not marked superseded** | They contradict AGENTS.md. Only `release-routing-policy.md`, `oci-small-release.md` and `oci-build-once-release.md` carry the "Superseded (2026-11-06)" banner |
| `docs/content-release.md` examples `--refresh-url http://127.0.0.1:3100` | — | — | — | Stale | Port 3100 is the retired main service. The web slots are 3101/3102 |

### 1C. Pre-R1 data baked into the live controller

`scripts/uapt-release-lifecycle.py` (LIVE) hard-codes `STATIC_CONFIGS` (7 historical nginx snippets: `uapt-two-0a468b3`, `uapt-changes-77182af`, `uapt-imperial-c7275d4`, `uapt-imperial-b466afa`, `uapt-mit-803e4e3`, `uapt-v5-static-legacy-fallbacks-1af9e1f`, `uapt-v6-cef6184-live`) and 28 distinct quoted `uapt-*` unit/root names. It also has an `r4` reuse authorization path and discovery-static migration code. This is per-incident legacy that the "3 roles" model was supposed to retire (release-lifecycle.md:51 still lists 9 legacy fallback services).

### 1D. infra/

| Path | Last change | Status |
|---|---|---|
| `infra/nginx/uapt-html-cache.conf`, `uapt-html-cache-epoch.inc` | 2026-11-06 | LIVE (program-release.md §6.1, `purge-html-cache`) |
| `infra/nginx/uapt-api-root-redirects.conf` | 2026-10-18 | Probably LIVE (redirects kept verbatim by the minimal routing) |
| `infra/oci/uapt-analytics-retention.{service,timer}` | 2026-10-03 | UNVERIFIED (runs `pnpm exec tsx scripts/analytics-retention.ts` from a checkout) |
| `infra/systemd/uapt-maintenance-*.{service,timer}` | 2026-05-18 / 07-17 | UNVERIFIED (OpenClaw host. They do `git pull --ff-only && pnpm maintenance:scan`, a self-updating checkout) |
| `infra/oci/uapt-mcp.*` | 2026-10-03 | DEAD (see 1B) |
| `infra/docker/docker-compose.yml` | 2026-05-04 | dev only |

---

## 2. package.json scripts

| File | Count | Notes |
|---|---|---|
| `package.json` | 85 | listed below |
| `apps/api` | 5 | `start` → `dist/main.js` (build output, not committed). `@uapt/api` is not part of production (web + MCP only) |
| `apps/worker` | 5 | `start` → `dist/index.js`. Untouched since 2026-05-04. Not in production |
| `apps/mcp` | 7 | `start`/`dev` = `tsx src/server.ts`. Production runs the esbuild bundle instead |
| `apps/web` | 6 | `build`/`build:debug` → the dead `uapt-release.mjs build full` |
| `apps/tulsa-zone` | 2 | `next build` / `next start` (dead zone) |
| `packages/db` 10, `packages/shared` 3, `packages/crawler-core` 3 | 16 | `crawler-core` untouched since 2026-05-04 |
| **Total** | **126** | |

No script points to a missing source file. The only unresolved targets are `dist/*` build outputs (api, worker) and a shell glob (`apps/mcp test/*.test.ts`, which exists).

Release/content/V6/policy scripts in the root package.json (26):

| Script | Target | Status |
|---|---|---|
| `program:build`, `program:package`, `test:program-build`, `test:program-release` | program-build.mjs, installer/release tests | LIVE |
| `content:build`, `content:validate`, `content:switch`, `content:correct`, `test:content-release` | `scripts/content-release/*` | LIVE |
| `indexnow:dry-run`, `indexnow:latest`, `indexnow:all`, `test:indexnow` | submit-indexnow.ts | LIVE (needs separate authorization) |
| `v6:pack`, `validate:v6-release`, `v6:shards`, `validate:v6-shards`, `mcp:export`, `validate:mcp-export`, `test:mcp-acceptance` | V6 packaging/validation | LIVE (as libraries for the batch pipeline) |
| `build`, `build:zone`, `build:debug`, `release:inspect`, `test:release-build` | uapt-release.mjs build / release-build-pipeline | DEAD (pre-R1 OCI build) |
| `release:local-check` | uapt-release.mjs local-check | DUP |
| `maintenance:prepare-candidate`, `maintenance:promote-candidate`, `snapshots:repin-release` | legacy `public-releases` promotion | DORMANT |
| `test:web-runtime-data`, `validate:web-runtime-data` | `.runtime-data` used only by the dead build | DORMANT |
| `convert:openclaw-legacy` | 2026-05-05 converter | DEAD |

The V6 batch pipeline itself (discover/capture/select/packets/finalize/assemble/sync_basis/host-release) has **no** package.json script, doc or workflow. It exists only as copies outside the repo (§5).

---

## 3. GitHub workflows

| Workflow | Trigger | Steps | Status |
|---|---|---|---|
| `.github/workflows/program-build.yml` | `workflow_dispatch` (sha, runner, node-version) | install → prisma generate → web tsc → `validate-web-build-scope.mjs` → `program-build.mjs build` → `package` → upload | LIVE. It is the only workflow: no CI on push/PR, so `pnpm check` and tests are never run automatically |

---

## 4. V4 / V5 / V6 layers

| Layer | Code | Data | Rendered in production? |
|---|---|---|---|
| Legacy home | `app/(default)/page.tsx` `layout === "legacy"` branch | — | Only with a dev preview query |
| **V4** | `components/home-v4-view.tsx`, `components/enforcement-v4-refresh.tsx`, `lib/home-v4-{copy,guides,preview}.ts`, `lib/policy-scene-ready-v4.ts`, `lib/enforcement-v4-refresh-data.json` (54 schools), `public/assets/home-v4/` (11 files) | — | **Home V4**: preview only (`isHomeV4Preview(layout)` from `readDevelopmentPreviewQuery`). `home-v4-copy` is also used by `home-v6-view.tsx`. **Enforcement V4 refresh: LIVE** on `/universities/[slug]` for the 54 slugs in the JSON when the school is not full-V6 (and always for Harvard): `enforcementPage = isPublished && enforcementV4RefreshSlugs.includes(slug) && (!fullV6 \|\| slug === "harvard-university")` |
| **V5** | `lib/enforcement-v5-ui.ts` (`v5Ui`), `lib/enforcement-v5-scene-zh.ts` (`localizeV5Scene`), `lib/enforcement-v5-new-scenes.json`; 105 scene assets under `public/assets/policy-scenes/*v5*`; 298 V5 files in `apps/tulsa-zone` | 18 V5-named files under `data/` | **LIVE**: `v5Ui("en")` feeds the accepted UI strings on every university page, and `localizeV5Scene` runs on zh enforcement pages. `/api/public/v1/policy-pages/v5.json` is still a public route |
| **V6** | 46 `lib/` + 33 `components/` V6 files, `/api/policy-v6/*`, `/api/public/v1/policy-pages/v6*` | `data/public-v6-{pages,records,history,change-overviews}` (3,078 V6 files), `public-v6-source-metadata.json`, `policy-v6-*.json` | LIVE: the main path. The repo's V6 data is frozen at 2026-10-28 (`data/public-v6-pages` last commit). Newer V6 content lives only in runtime content releases on the host and in the out-of-repo batches |

So three generations of school-page UI still ship together: V6 (full or base tier), V4 enforcement refresh with V5 copy (54 non-full-V6 schools), and V5 scene localization. `apps/tulsa-zone` holds a fourth, frozen copy.

---

## 5. Out-of-repo pipeline copies

### 5.1 `/Users/newvolume/Documents/uapt-v6-source-metadata`

- A **git worktree** of the main repo (`.git` file → `university-ai-policy-tracker/.git/worktrees/uapt-v6-source-metadata`).
- Branch `claude/v6-source-metadata-contract` at **`fbd8e84e`** (2026-11-19, "feat(v6): make source metadata part of the V6 delivery contract"). Its parent is `b59ae274` = origin/main, so it is one **unmerged** commit ahead (18 files, +1,146: `scripts/v6-source-metadata.py` (430 lines), prompts and schema under `scripts/v6-source-metadata/`, a coverage check, `pack-v6-release.ts`/`validate.ts` changes).
- `git status --short`: 0 lines. All the pipeline work is in the git-ignored `.local/` (`.gitignore:36`).
- The batch scripts import `../../../apps/web/lib/*` and `../../../scripts/*` from this worktree. **The live batch pipeline therefore runs against unmerged code.**

### 5.2 Batch directories (`.local/policy-v6/`)

| Batch | Size | Script files | Extra files only in this batch |
|---|---|---|---|
| `pilot-qs130-140-20261119` | 10 GB | 31 | — |
| `batch-qs145-155-20261120` | 12 GB | 34 | `chatgpt_brief.py`, `openclaw-enrollment{,-r2}/readback.py` |
| `batch3-20261120` | 20 GB | 47 | `chatgpt_sources.py`, `firecrawl_discover.sh`, `firecrawl_sources.py`, `save_clip.sh`, `zh-backfill/` (9 files: a third deploy plus assemble/packets/sync_basis/receipts copies) |

Every batch has the same layout: `discover.py`, `select_sources.py`, `capture.py`, `render_capture.py`, `build_view.py`, `packets.ts`, `packets_update.ts`, `finalize.ts`, `assemble.ts`, `assemble_update.ts`, `check_meta.ts`, `sync_basis.ts`, `receipts.py`, `deploy/{host-release,http_readback,make_event}.py`, `deploy-r2/{same}`, `openclaw-enrollment/` and `openclaw-enrollment-r2/` (build, dry_run, install, test_install, parent/monitor_*). Within each batch, `deploy` vs `deploy-r2` and `openclaw-enrollment` vs `-r2` are themselves forks.

### 5.3 Per-batch drift (changed lines from `diff | grep '^[<>]'`, "same" = byte-identical)

| File | pilot lines | b2 lines | b3 lines | pilot→b2 | b2→b3 | pilot→b3 |
|---|---|---|---|---|---|---|
| assemble.ts | 228 | 228 | 228 | 8 | 8 | 8 |
| assemble_update.ts | 218 | 218 | 220 | 10 | 12 | 12 |
| build_view.py | 178 | 187 | 187 | 15 | 4 | 15 |
| capture.py | 83 | 83 | 85 | 4 | 6 | 10 |
| chatgpt_brief.py | – | 59 | 59 | n/a | same | n/a |
| chatgpt_sources.py | – | – | 44 | n/a | n/a | n/a |
| check_meta.ts | 7 | 7 | 7 | 2 | 2 | 2 |
| deploy/host-release.py | 116 | 116 | 123 | 10 | 19 | 19 |
| deploy/http_readback.py | 46 | 46 | 46 | 8 | 4 | 8 |
| deploy/make_event.py | 72 | 72 | 72 | 10 | 10 | 10 |
| deploy-r2/host-release.py | 116 | 123 | 123 | 19 | 10 | 19 |
| deploy-r2/http_readback.py | 46 | 46 | 46 | 8 | 2 | 8 |
| deploy-r2/make_event.py | 71 | 71 | 71 | 12 | 12 | 12 |
| discover.py | 83 | 83 | 83 | 6 | 6 | 6 |
| finalize.ts | 77 | 77 | 92 | same | 15 | 15 |
| firecrawl_discover.sh / firecrawl_sources.py / save_clip.sh | – | – | 28 / 48 / 7 | n/a | n/a | n/a |
| openclaw-enrollment/build.py | 254 | 279 | 275 | **75** | 36 | **75** |
| openclaw-enrollment/dry_run.py | 39 | 42 | 42 | 7 | 4 | 7 |
| openclaw-enrollment/install.py | 225 | 244 | 243 | 39 | 27 | 38 |
| openclaw-enrollment/test_install.py | 135 | 164 | 164 | 37 | 12 | 37 |
| openclaw-enrollment/readback.py | – | 52 | 52 | n/a | 2 | n/a |
| openclaw-enrollment/parent/monitor_control.py | 573 | 573 | 573 | same | same | same |
| openclaw-enrollment/parent/monitor_noise.py | 162 | 162 | 162 | same | same | same |
| openclaw-enrollment-r2/build.py | 130 | 143 | 130 | 41 | 37 | 30 |
| openclaw-enrollment-r2/dry_run.py | 39 | 39 | 39 | same | same | same |
| openclaw-enrollment-r2/install.py | 233 | 237 | 235 | 22 | 22 | 20 |
| openclaw-enrollment-r2/test_install.py | 130 | 138 | 138 | 18 | 8 | 18 |
| openclaw-enrollment-r2/readback.py | – | 52 | 52 | n/a | 2 | n/a |
| openclaw-enrollment-r2/parent/monitor_control.py | 573 | 573 | 573 | same | same | same |
| openclaw-enrollment-r2/parent/monitor_noise.py | 162 | 162 | 162 | same | same | same |
| packets.ts | 119 | 119 | 119 | 8 | 6 | 8 |
| packets_update.ts | 121 | 121 | 121 | 8 | 6 | 8 |
| receipts.py | 37 | 37 | 37 | 2 | 4 | 4 |
| render_capture.py | 35 | 35 | 35 | 6 | same | 6 |
| select_sources.py | 45 | 45 | 45 | 2 | 2 | 2 |
| sync_basis.ts | 87 | 88 | 88 | 3 | same | 3 |
| zh-backfill/* (9 files) | – | – | 37–220 | n/a | n/a | n/a |

Within batch3, `deploy-r2/host-release.py` vs `zh-backfill/deploy/host-release.py` differ by 10 lines, and `assemble_update.ts` vs `zh-backfill/assemble.ts` by 54.

What the drift is (sampled):
- **Hard-coded per-batch constants**: in every `host-release.py`, the `op` dir, `prev`/`cid` content ids, `PREV_SHA`, `NEW_SCHOOLS`. This is configuration that was copied and edited instead of passed as arguments.
- **Real logic forks**: from batch 2 on, `host-release.py` adds a manual `POST /api/internal/content/refresh` ISR-expiry step because "the switch tool on this host does not reliably expire V6 page renders". That is the bug fixed in-repo by `ff3d8218` (2026-11-19), which the host never received because the host helper is the 2026-11-09 checkout. `discover.py` grows per-batch vocabularies (Swedish/French terms) and `MULTI` domain lists. The `openclaw-enrollment` builder/installer forks by up to 75 lines per batch.

### 5.4 Host dependencies hard-coded in the batch `host-release.py` (all 7 copies)

- `helper = /srv/uapt/operations/content-priority-six-20261109/helper` (a repo checkout from 11-09 that runs `switch.ts` and `policy-inventory.py sync-gate`)
- `install_script = /srv/uapt/operations/content-9schools-20261106/tools/install-release-tree.py`. **This file exists only on the unmerged branch `claude/content-9-schools-5fce2c`** (commit `168c67e2`, 2026-11-06) and in that server op dir. It is not in main and not in the docs (content-release.md has no install step).
- `controller = runpy.run_path('/usr/local/libexec/uapt-release-lifecycle.py')`
- slot units `uapt-mcp-v6-candidate.service:3101` / `uapt-mcp-v6-r2.service:3102`

### 5.5 Further copies in the main checkout's `.local/` (`/Users/newvolume/Documents/university-ai-policy-tracker/.local`)

- 96 entries. 1,376 code files (excluding the venv, node_modules, nested worktrees and the `ten-school-runtime-pilot` app).
- `content-source-metadata-20261118/host-release.py` (114 lines) and `host-release.october.py` (112) plus `make_event.py` and `http_readback.py`: the ancestors of the batch `deploy/` scripts (16-line diff to the pilot copy). That makes **9 `host-release.py`**, 8 `make_event.py` and 8 `http_readback.py` copies in total.
- `cleanup-salvage-20261117/`: 149 code files. 107 of them are release/cutover/static-migration/archive helpers from past releases (for example `unified-v6-multilingual-release-20261101-r5/{archive-r4-only,static-migration-*,prepare-static-runtime-plan,controller-installed-before-static}.py`, `make-prebuild-plan-server.py`).
- `uapt-release-archives/prisma7-20261027/{storage-20261027,retry-storage,failed-build-storage}/`: 24 copies of `prepare-archive.py`, `verify-archive.py`, `restore-archive.py`, `cleanup-verified.py`, `update-retention.py`, `audit-references.py` (a three-way fork of the storage-cleanup toolkit).
- `ten-school-runtime-pilot/`: a separate 77 MB Next app (app/components/lib/node_modules).
- Nested worktrees: `georgia-tech-v6-en-20261115/workspace`, `v6-five-publish-20261117/program`, `v6-source-metadata-20261118/workspace`.
- One plaintext credential file sits directly in `.local/` (git-ignored, but outside `.local/secrets`). Contents were not read; path withheld from this public doc.

---

## 6. Unmerged branches with release tooling

| Branch | Commits ahead of origin/main | Release tooling added/changed | Note |
|---|---|---|---|
| `claude/laughing-murdock-3c9e56` (worktree) | 5 (2026-11-21) | `scripts/uapt-release-lifecycle.py` +587 lines (governed retention rescan, content-hold deadlines); `scripts/release/program-release.py` +54; **new** `scripts/release/uapt-web-watchdog.py` (245), `scripts/release/remote-bg.sh` (55), `scripts/content-release/warm-changed-pages.py` (110); 4 new systemd units (`uapt-web-watchdog`, `uapt-hold-status`); AGENTS.md and 4 release docs; `docs/server-fixes-20261121.md` | 29 files, +2,148. Fixes the 524s seen on 2026-11-21 (cold renders after purge) |
| `claude/modest-bun-549899` (worktree) | 1 (`84081739`) | lifecycle controller retention rescan | **Fully contained** in laughing-murdock (its single commit is laughing-murdock's base). Redundant branch and worktree |
| `claude/v6-source-metadata-contract` (worktree `uapt-v6-source-metadata`) | 1 (`fbd8e84e`) | `scripts/v6-source-metadata.py`, coverage validator, `pack-v6-release.ts` | The batch pipeline runs on this branch |
| `claude/content-9-schools-5fce2c` | 4 (2026-11-06) | `scripts/content-release/install-release-tree.py`, `policy-release-ledger.ts`, `reviewed-corrections.ts` | `install-release-tree.py` is used in production from a server copy. `reading-delta.ts` landed in main separately |
| `codex/v6-english-first-20261117` and `codex/v6-source-metadata-pilot` | 3 each, **same tip `ea719b70`** | `content-release/lib.ts`, `lib/v6-release-contract.ts` (English-only V6) | Duplicate branches. Also checked out as the `.local/v6-five-publish-20261117/program` and `.local/v6-source-metadata-20261118/workspace` worktrees |
| `codex/qs71-80-history-repair` | 2 (2026-10-25) | `lib/retain-change-revisions.ts`, `pack-v6-release.ts` | Likely superseded (the file exists in main) |
| 9× `codex/uapt-security-20261023-*` + `codex/uapt-main-security-20261023` | 3–7 each | none in scripts/ | One branch per historical release root (`0a468b3d`, `803e4e3d` and so on): the per-zone era |

---

## 7. Duplicate Finder files

- Worktree (`clever-shirley-462b54`): **0**.
- Main checkout: **90** `* 2.*` files, 32 outside `.local`. None are tracked. They include `apps/web/app/favicon 2.ico`, `icon 2.png`, `apple-icon 2.png`, `apps/web/components/{related-universities,university-claim-groups} 2.tsx`, `apps/web/lib/{index-recovery-basis,index-recovery-dates,index-recovery-pilot,related-universities,university-claims-organization} 2.ts`, `apps/web/public/llms 2.txt`, `tests/index-recovery-pilot.test 2.ts`, 20 under `docs/google-index-recovery-p0-evidence/`, `.local/uapt-review 2.sqlite`. Some sit inside the Next `app/` tree: `app/icon 2.png` and `favicon 2.ico` would be picked up by a build from that checkout.
- `uapt-v6-source-metadata`: 0.

---

## 8. Proposed keep / consolidate / delete

### Keep (the single release path)
- `.github/workflows/program-build.yml`, `scripts/program-build.mjs`, `scripts/validate-web-build-scope.mjs`
- `scripts/program-artifact-install.py`, `scripts/release/program-release.py`, `scripts/uapt-release-lifecycle.py` (the installed trio)
- `scripts/content-release/{build,validate,switch,correct,correction-apply,correction-lint,reading-delta,file-set,lib}.ts`
- `scripts/policy-inventory.py`, `policy-inventory-status.py`, `scripts/lib/*`, `pack-v6-release.ts`, `validate-v6-release.ts`, `export-v6-shards.ts`, `export-mcp-catalog.ts`, `validate-mcp-export.ts`, `submit-indexnow.ts`
- `infra/nginx/uapt-html-cache*`

### Merge first (live code that is not in main)
1. `claude/laughing-murdock-3c9e56` (watchdog, warm-changed-pages, retention rescan). Then delete `claude/modest-bun-549899` and its worktree.
2. `install-release-tree.py` from `claude/content-9-schools-5fce2c`, as `scripts/content-release/install-tree.py`, and document it in content-release.md §3/§5. The host must stop running it from `/srv/uapt/operations/content-9schools-20261106/tools`.
3. `claude/v6-source-metadata-contract` (`fbd8e84e`).
4. Decide on `ea719b70` (English-only V6): merge once, delete the twin branch.
5. Replace the two ad-hoc host helper checkouts (`/srv/uapt/release-helper`, `.../content-priority-six-20261109/helper`) with one helper pinned to the program release's SHA, so `switch.ts` on the host equals main. This removes the manual ISR-expiry workaround in host-release.py.

### Consolidate into one versioned `scripts/v6-pipeline/`
Promote the batch3 versions (the newest superset) and parameterize them with a per-batch `batch.json` (op dir, `prev`/`cid`, `PREV_SHA`, school list, discovery vocab and domains):
- `discover.py` (+ `firecrawl_sources.py`, `firecrawl_discover.sh`), `select_sources.py`, `capture.py`, `render_capture.py`, `save_clip.sh`, `chatgpt_brief.py`, `chatgpt_sources.py`, `build_view.py`
- `packets.ts` + `packets_update.ts` (one file, `--update`), `finalize.ts`, `assemble.ts` + `assemble_update.ts` + `zh-backfill/assemble.ts` (one, with modes), `check_meta.ts`, `sync_basis.ts`, `receipts.py`, `zh-backfill/{apply_zh,diff_release}.ts`
- `host-release.py` (9 copies) → fold into a `content-release` subcommand of `scripts/release/program-release.py` (or a `scripts/release/content-release.py` that calls the installed controller and `content:switch`), with `make_event.py` → `scripts/content-release/make-event.py` and `http_readback.py` → the existing readback in program-release.py
- `openclaw-enrollment{,-r2}/` → one `scripts/v6-pipeline/openclaw-enrollment/` (keep `monitor_control.py`/`monitor_noise.py` once: they are identical everywhere) with its `test_install.py` moved into `tests/`
- Add package.json entries (`v6:discover`, `v6:capture`, `v6:assemble`, `content:host-release`) and a doc section, so the pipeline has callers and CI-visible tests.
- Afterwards the batch dirs keep **data and receipts only**, no code.

### Delete (or move to a `historical/` tag/branch)
- One-offs with zero references (39 + 2): the qs-501-600 / 601-700 / 701-857 / top-500-008 series (24), `*-20261014` (6), `prepare-v6-followup-catalog.ts`, `prepare-v6-mcp-correction.ts`, `prepare-imperial-runtime-repair.ts`, `publish-imperial-reviewed-repair.ts`, `prepare-mit-record-repair.ts`, `capture-mit-record-repair.py`, `build-msu-unist-july-release.ts`, `prepare-scoped-policy-correction.ts`, `repair-v6-locale-completeness.ts`, `prepare-reviewed-presentation.ts`, `verify-v6-presentation-candidate.ts`, `activate-september-report.py`, `prepare-v6-audit-correction.py`, `finalize-v6-audit-correction.ts`, `convert-openclaw-legacy-staging.ts`.
- Pre-R1 build path: `uapt-release.mjs` `build`/`inspect`/`local-check`/`lifecycle` (keep only `verify-sync`, or move it into `scripts/lib`), `release-build-pipeline.mjs`, `prepare-web-runtime-data.mjs`, `prepare-candidate-build-inputs.ts`, `tests/release-build-pipeline.test.mjs`, `tests/web-runtime-data.test.mjs`. Repoint `pnpm build` and the `apps/web` `build` to `program-build.mjs build --local` (or remove them) so `pnpm build` can no longer start an OCI build.
- `apps/tulsa-zone` (118 MB) and `build:zone`: first freeze the 3 component hashes in `lib/public-history-basis.ts` (they bind a "frozen renderer identity", so keep the hashes and drop the files), then remove the `tulsa-zone` regex alternatives.
- `infra/oci/uapt-mcp.service`, `infra/oci/uapt-mcp-location.conf`.
- Mark `docs/oci-production-deployment.md` and `docs/deployment.md` as superseded. Fix the `--refresh-url …:3100` examples in content-release.md.
- Dormant legacy promotion (`maintenance:prepare-candidate`/`promote-candidate`, `snapshots:repin-release`, `run-synchronized-policy-mutation.ts`): decide whether maintenance releases will be content releases. If yes, delete them and drop the AGENTS.md promoter clause.
- Controller cleanup: move `STATIC_CONFIGS` and the hard-coded legacy unit/root names in `uapt-release-lifecycle.py` into the host policy file (`policy.json`) so the code stops carrying per-incident names.
- Local hygiene (main checkout, not repo content): fast-forward or reset the stale local `main` (291 behind); delete the 32 untracked `* 2.*` files outside `.local`; prune merged/duplicate branches (the 10 per-release security branches, `modest-bun`, one of the `ea719b70` twins); move the plaintext credential file in `.local/` into `.local/secrets` or delete it; archive `.local/cleanup-salvage-20261117` and the three `uapt-release-archives/prisma7-20261027/*` toolkit forks off-disk.

### Must stay regardless
- Runtime content releases, history and held evidence on the host. The `data/public-v6-*` revisions and `data/public-releases/history` in the repo, because historical URLs and the frozen-history hashes depend on them.
- The V4 enforcement refresh and V5 UI/scene modules **until** the 54 enforcement schools are full-V6. They are rendered today.
- `/api/public/v1/policy-pages/v5.json` (a public API contract).
