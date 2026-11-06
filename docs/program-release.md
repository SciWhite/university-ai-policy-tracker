# Program release: content-free build, artifact, install

Status: draft for R1-d (2026-11-04). It describes how the program (code only)
is built in GitHub Actions and installed on the host. Content ships separately
as runtime content releases (`docs/content-release.md`). This document does not
authorize a push, workflow run, download to the server, deployment, restart,
cutover, Cloudflare purge or search notification. Policy evidence rules
(`AGENTS.md`, `docs/policy-evidence-integration-runbook.md`), the lifecycle
controller (`docs/release-lifecycle.md`) and the disk rules
(`docs/release-storage-policy.md`) are unchanged.

## 1. What "content-free" means

- `next build` runs with `UAPT_PROGRAM_BUILD=1`. Any content read while Next
  prerenders aborts that render (`isContentFreeProgramBuild()` in
  `apps/web/lib/content-runtime.ts` throws `notFound()`), and the CI checkout
  has no `data/` or `staging/` at all. The build therefore cannot bake content
  in, and it succeeds without any.
- The root document reads the V6 reading cohort, so every page depends on
  content. No page is rendered at build time for real: the packager deletes
  every prerendered body (`.html`, `.rsc`, `.meta`, `.body`, `.segments`) except
  the framework `/_not-found` (checked to be the content-free global page) and
  `/_global-error`. The prerender manifest keeps each route registered, so the
  first request renders it from the active content release, caches it in the
  in-memory ISR cache (`isrFlushToDisk: false`), and tags refresh it after a
  switch, as in R1-b.
- Catalog-derived landing pages (`/analysis/[slug]`, `/regions/[slug]`,
  `/themes/[slug]`) no longer enumerate params from content at build; they
  render on first request and still 404 unknown slugs.
- `output: "standalone"` with no content tracing (`outputFileTracingIncludes`
  is empty in program builds; `data/`, `staging/`, `.local/`, docs and tests
  are excluded). Workspace-mode builds (`scripts/uapt-release.mjs build`) are
  unchanged.

Measured locally (2026-11-04, macOS arm64, Node 26), from a sparse checkout
without `data/` and `staging/` as in the workflow: build 13 s (warm Turbopack),
53 prerendered bodies pruned, 4,686 files, **147 MB unpacked, 96 MB tarball**
(plan target ≤ 1 GB). Installed with the installer below and started against a
content root: `/`, `/zh`, `/changes`, `/reports`, `/about`, a university page,
`/llms.txt` and the three feeds returned 200 (MISS, then HIT); a `reports`/`home`
tag refresh re-rendered exactly those pages.

## 2. Build in GitHub Actions

`.github/workflows/program-build.yml`, manual `workflow_dispatch` only:

| Input | Meaning |
|---|---|
| `sha` | Frozen 40-character commit SHA |
| `runner` | `ubuntu-24.04-arm` (default) or `ubuntu-24.04`; must match the host CPU (`sharp` ships native code) |
| `node-version` | Default `22` (production runs Node 22) |

Steps: sparse checkout of the SHA without `data/` and `staging/` → copy of the
five content pointer files (for the marker scan only) → `pnpm install
--frozen-lockfile` → Prisma Client generate → web typecheck → build-scope
validator → `node scripts/program-build.mjs build` → `package` → upload as the
Actions artifact `uapt-program-<sha>` (30 days). Permissions: `contents: read`;
no secrets; no deploy step.

Build-time `NEXT_PUBLIC_*` values come only from
`apps/web/program-build.public-env.json`; inherited `NEXT_PUBLIC_*` and
`UAPT_CONTENT_*` variables are dropped. They must equal the production
environment file (the installer can check this with `--production-env`).

Local diagnosis: `pnpm program:build --sha <HEAD> --local` and
`pnpm program:package --sha <HEAD> --out <dir> --local`. `--local` allows a
dirty checkout and `data/`; the artifact is marked `diagnostic` and the
installer refuses it.

## 3. Artifact

The upload holds three files:

- `uapt-program-<sha12>-<BUILD_ID>.tar.gz`: the standalone tree (release root):
  `apps/web/server.js`, `apps/web/.next/` (pruned, plus `static/`),
  `apps/web/public/`, `node_modules/` (pnpm layout, relative symlinks only),
  `apps/mcp/server.mjs` (the MCP server bundled into one ESM file, §7.7),
  `build-artifact-manifest.json`, `source-manifest.json`;
- `<name>.tar.gz.sha256` (`sha256sum` format);
- `artifact.json`: the build manifest plus the tarball name, SHA256, size and
  the SHA256 of `build-artifact-manifest.json`.

`build-artifact-manifest.json` (`uapt-program-artifact-v1`): `codeSha`,
`BUILD_ID`, builder (Node, pnpm, Next, platform, arch, glibc), lockfile and
`next.config.ts` hashes, `publicBuildEnv`, `contentFree` (held-out checkout,
pruned count, marker count), `entries` (`web`, and `mcp` with the bundle's path
and SHA256, checked by the installer) and `files` (count, bytes, `listSha256`,
`sourceManifestSha256`). `source-manifest.json` (`uapt-program-file-list-v1`)
lists every file (path, SHA256, bytes, mode) and symlink; it is named for the
lifecycle controller's `basis.sourceManifestSha256` lookup.

The packager fails on: prerendered residue, private or content paths
(`data/`, `staging/`, `.local/`, `.runtime-data/`, `policy-inventory`,
`review-cache`, `screenshots`, `.env*`, keys, databases), symlinks leaving the
tree, setuid bits, more than 1 GiB unpacked, or any content pointer identity
(release ID, revision, hash) found in a text file.

## 4. Install on the host (not run yet)

`scripts/program-artifact-install.py` (Python standard library):

```bash
GH_TOKEN=<read-only actions token> sudo -E python3 scripts/program-artifact-install.py \
  --sha <40-hex> --run-id <workflow run id> --node-bin /opt/node-v22/bin/node \
  --production-env <production.env>
# or, with an artifact zip copied by the operator:
sudo python3 scripts/program-artifact-install.py --sha <40-hex> --zip <artifact.zip> ...
```

It takes the release lock (`/run/lock/uapt-release.lock`), checks the run
(head SHA, workflow path, `workflow_dispatch`, success) and the artifact, and
checks `diskCapacity` from the lifecycle policy before the download and again
before unpacking (reserve bytes and inodes, project ceiling, per-role cap; a
policy without `diskCapacity` is refused). It verifies the tarball SHA256,
platform/arch/Node major against the host, the manifest against
`artifact.json`, safe tar members, and every file against the file list, then
renames the tree into `/srv/uapt/releases/uapt-program-<sha12>-<BUILD_ID>`
(an existing directory is refused). It never starts, routes, switches content
or deletes a release. It removes only its own staging copy under
`<root>/builds/` after success; a failed run keeps it and prints the path,
which must be registered as a temporary artifact or reviewed.

Output: a receipt in `/srv/uapt/operations/program-artifacts/<name>.json` with
the `basis` fields the lifecycle plan binds (`release`, `codeSha`, `BUILD_ID`,
`sourceManifestSha256`, `buildArtifactSha256`) and the retention entry to add
(`disposition: candidate`; if it is not admitted it becomes a bounded `held`
entry). Run the candidate with `node server.js` from `apps/web` (env:
`PORT`, `HOSTNAME=127.0.0.1`, `UAPT_CONTENT_ROOT`, the production env; no
`node_modules` install).

## 5. R1 launch checklist (program side)

Not done by R1-d; each item is a launch step under the lifecycle controller.

1. **Architecture.** Confirm `uname -m` on the host and run the workflow on the
   matching runner (`ubuntu-24.04-arm` for aarch64).
2. **Lifecycle controller (done 2026-11-05).** A basis with `schemaVersion:
   "uapt-program-release-basis-v1"` (written by the installer) binds the
   runtime content pointer instead of in-tree data pointers. The plan adds
   `contentRelease: {root, contentId, manifestSha256}`. `validate_candidate_identity`
   then requires:
   - no `data/` or `staging/` in the release;
   - a content-free `uapt-program-artifact-v1` build manifest for the same `codeSha`;
   - a content manifest whose hash matches;
   - a `current.json` that selects that release with a sync receipt (local previews are refused).

   Legacy bases are unchanged.
3. **nginx deny for the refresh endpoint.** Add to the site config before the
   R1 upstream switch, and read it back (`curl -i https://eduaipolicy.org/api/internal/content/refresh` → 404):

   ```nginx
   location ^~ /api/internal/content/ { return 404; }
   ```

4. **Hand-added detail rule.** `/etc/nginx/snippets/uapt-eea1eb21-detail-routes.conf`
   (added by hand on 2026-11-04, outside the lifecycle controller; receipt in
   `/srv/uapt/operations/nginx-exception-20261104-changes-detail/`) sends
   `/changes/*` and `/rankings/*` detail routes in every locale to 3102. At R1
   launch the consolidated app serves these routes: take the rule into the
   controller's `routingFiles` (so it is switched and rolled back with the
   release) or remove it in the same cutover, before 3102 is retired. Do not
   leave it pointing at a retired upstream.
5. **Environment parity.** Install with `--production-env`; `NEXT_PUBLIC_*`
   are inlined at build time, so a mismatch needs a new build, not an env edit.
6. **Writable cache path.** The release tree is otherwise read-only at runtime
   (ISR stays in memory), but `/_next/image` writes `apps/web/.next/cache/`;
   give the service user that directory only.
7. **Cold start.** No page is prerendered, and the ISR cache is in memory, so
   every restart starts cold.
   - **How slow cold renders are.** On the loaded production host, first renders took up to 60–110 s (`/sitemaps/zh.xml`, `/reports`), which is longer than the 60 s proxy timeout.
   - **Enable warm-up.** Set `UAPT_WARMUP_ON_START=1` in the runtime env. After each start the server then requests the heavy pages, followed by every sitemap URL (up to 5,000), over loopback, one request at a time.
   - **Wait before routing.** Wait for the journal line `Runtime warm-up finished` before routing; sample cold pages if it is still running.
   - **Timing.** About 3,900 requests took 6 minutes locally and about 40 minutes on the host.
8. **Long-lived pages.** Pages with `revalidate = false` (`/about`, `/changes`,
   `/reports`) are cached for a year in the origin's ISR cache; Cloudflare
   keeps every public page for 2 hours (Cache Rule, see
   `docs/content-release.md` §5), so purge the whole zone after each cutover.
   A switch that changes the
   V6 reading cohort also changes the cohort every page embeds; untagged static
   pages are not in the switch plan. Expire `content` (or purge those paths)
   when the cohort changes.
9. **IndexNow.** The basis is the selected content release:
   `pnpm indexnow:latest --content-root /srv/uapt/content --sync-ledger <event.json>`
   submits the switch plan's changed paths that are in the published sitemap,
   after public readback.
10. **Retention.** Record the new release root, the previous accepted program
    release (rollback) and nothing else per role; old full-workspace release
    directories follow the archive rules.

## 6. Minimal nginx routing (prepared 2026-11-06, not installed)

**Old routing.** The live site config holds about 135k lines. It has:
- about 19,800 exact `location =` entries;
- 30 zone snippets left over from per-school releases.

Since R1, every one of those entries proxies to the same app.

**The generator.** `scripts/nginx-minimal-routing.py <nginx -T dump> <out> uapt_next_backend` rebuilds the site's locations. It keeps these verbatim:
- static aliases (1,221);
- pure `return` entries (107 redirects and retired-prefix 404s);
- proxies to non-app ports (MCP `/api/mcp` on 3161);
- the cached prefix blocks (`/api/public/v1/`, `/feeds/`, `/datasets`, `/sources`, `/search`, `/robots.txt`).

Everything else becomes one `location /` → `uapt_next_backend`. That location has a 180 s read timeout and no `private, no-store` header.

**What changes after the switch.** A program cutover then only rewrites `uapt-main-upstream.conf`.

**Cleanups it makes.**
- It drops the per-page RSC "Document navigation required" stubs of the old V5 zones.
- It drops another site's (`clb-pro`) CSP include that old static snippets had picked up.

**Equivalence test.**
- **Setup:** `scripts/nginx-minimal-routing-compare.py`, run on the host against a separate nginx instance on 127.0.0.1:18080, with production untouched.
- **Run of 2026-11-06:** 1,936 URLs, made up of every static or return path, 600 random app paths and 10 specials. 1,799 responses were identical. The rest differ for benign reasons:
  - JSON `generatedAt` timestamps;
  - first-request (cold) metadata streaming;
  - production's duplicated `Location` header on 5 redirects.
- **Evidence:** `/srv/uapt/operations/nginx-min-20261106/`.

**Install.** Install it as `routingFiles` of the next controller program release, in place of `uapt-proxy-locations.conf` and `uapt-eea1eb21-detail-routes.conf`. Then:
- run `nginx -t`;
- read back the public URL matrix;
- purge Cloudflare.

Keep the old files for rollback.

### 6.1 Origin HTML cache (nginx, from 2026-11-06)

The app's ISR cache lives in process memory (now 768 MB, about 500 pages), so every
restart or cutover starts cold. `--html-cache` makes the generated `location /` cache
public HTML/RSC on disk (`infra/nginx/uapt-html-cache.conf`, installed once as
`/etc/nginx/conf.d/uapt-html-cache.conf` with `uapt-html-cache-epoch.inc`):

- zone `uapt_html`, `/var/cache/nginx/uapt-html`, 3 GB, entries unused for 7 days age out;
- key `epoch|scheme|host|request_uri|rsc` (Vary/Accept-Encoding variants kept apart);
  200/301/308 for 6 h, then served stale while one background request refreshes it;
  `proxy_cache_lock` makes concurrent misses wait for one render;
- never cached: `/internal*`, `/api/*`, `/mcp*`, `/search`, requests with Authorization;
- `proxy_buffering on` in that location (nginx cannot cache unbuffered responses), and the
  server-level security headers are repeated there;
- `X-UAPT-Origin-Cache: HIT|MISS|EXPIRED|UPDATING|BYPASS` on responses.

**Purge** = `uapt-program-release.py purge-html-cache --reason "<why>"`: a new epoch in the
key, `nginx -t`, reload, a line in `release-lifecycle/html-cache-purges.jsonl`. Nothing is
deleted. `cutover` purges automatically. A **content switch must purge too**, together
with Cloudflare (`docs/content-release.md` §5).

Isolated test on the host (2026-11-06, separate nginx on 127.0.0.1:18080 against the live
app): MISS then HIT; gzip and identity variants cached separately; `/internal`, `/search`
and Authorization bypass; security headers present; a new epoch gives MISS then HIT.

## 7. One-command program release (`scripts/release/program-release.py`)

Added 2026-11-06 after three releases (R1 launch 11-05, R1 fixes and the
dashboard cache 11-06) took 1.5–2 h each. Most of that time went to:

- glue scripts written by hand for each release;
- two full 132-school readbacks;
- about 40–80 min of warm-up;
- hand edits to the retention register. One forgotten edit blocked a later
  release.

The command turns those steps into one tested tool. The lifecycle controller
keeps every gate (capacity, disk, retention, sync contract 2.1.0, journal and
recovery). The command only prepares the controller's inputs and calls it.

It never builds, never deletes a release, never writes nginx or policy files
itself, never purges a CDN and never sends search notifications. Running it
needs the same authorization as any release; reading this section authorizes
nothing.

### 7.1 Steps

Run as root on the host. Every subcommand is idempotent and writes its receipts
into one operation directory, `/srv/uapt/operations/program-<sha12>-<UTC time>/`.
`install` creates it. A rerun of `install` without `--op` continues the
unfinished operation for the same SHA. `status --op <dir>` prints the steps done
and the next one.

| Step | What it does | Receipts in the operation directory |
|---|---|---|
| `install --sha <40-hex> --run-id <id>` (`GH_TOKEN` set) or `--zip <file>` | Runs `program-artifact-install.py`, or reuses its receipt when this SHA is already installed. Writes the program basis bound to the current content pointer. Picks the readback scope (7.3). | `release.json` (state), `program-basis.json`, `install.log` |
| `candidate` | Takes the free fixed web slot. Copies the active slot's env to `runtime.env` (root:uapt 0640); it must not set `PORT`/`HOSTNAME` or allow unsynchronized content. Writes one managed drop-in (env, port, node, `SuccessExitStatus=143`, MemoryHigh/Max, `ReadWritePaths` incl. `.next/cache`), named to sort after every existing drop-in and reused on later releases. Restarts the slot. Waits for the journal line `Runtime warm-up finished` of this invocation. Fallback: after `--warmup-min-wait` (10 min), two consecutive probes in which every sampled page answers 200 within `--latency-ok` (5 s). | `dropin.conf`, `candidate-samples.json` (memory every 5 s) |
| `static` | Union copy of `.next/static` into the `/_next/static/` alias found in the managed snippets. Refuses same-name/different-bytes collisions; keeps old files. | `static-union.json` |
| `capacity` | Cold request pass (heavy routes + sampled school pages), then 60 s steady. Peaks combine the warm-up samples (startup ≤ 60 s, cold) with this pass. Refuses a restart during measurement or a peak above `candidatePeakMaxBytes`. | `capacity.json` |
| `routing` | Retargets every `/etc/nginx/snippets/uapt-*.conf` reference to `127.0.0.1:<active port>` to the candidate port and updates the code-release header in those files. Refuses when the active port is still referenced outside the managed snippets, which the controller cannot switch (the R1 launch missed four proxy-common snippets this way). Runs `nginx -T` on a rewritten copy of `/etc/nginx` and refuses if the retiring endpoint is still in that effective config (the controller's `complete` check, run before cutover). The live tree is not touched. Rerunning `routing` voids an existing plan. `--replace <snippet>=<file>` (repeatable) stages reviewed new content for a managed snippet, e.g. the consolidated minimal routing; it goes through the same retarget, journal and recovery. Once all app traffic goes through `upstream uapt_next_backend`, a release only stages `uapt-main-upstream.conf`. To install the minimal routing (§6, on `claude/r1-fixes`), pass its generated file for `uapt-proxy-locations.conf` and the reviewed replacement for `uapt-eea1eb21-detail-routes.conf`. | `routing/` + `routing-files.json` |
| `ledger` | Contract 2.1.0 `audit` event for the program basis (7.3). Candidate readback, MCP catalog and runtime content state. Ends with the release helper's `verify-sync … candidate`. | `sync/program/`, `ledger.log` |
| `plan` | Retention receipt (register + new root as `candidate`); refuses unclassified roots or temporary artifacts. Lifecycle plan with a fresh transaction id per attempt (`<op>`, then `<op>-p2`, …: the controller keeps `transactions/<id>` even after a failed cutover). Expiry is bounded by the plan window and by the candidate's start time plus `candidateTtlHours`. Peak budgets are at least the measured peaks and the previous plan's, never above policy. `publicChecks` is the BUILD_ID `_buildManifest.js` hash only: it shows the new assets are served from the shared static alias, not that routing switched (the completion readback's BUILD_ID-in-HTML and the controller's `nginx -T` check prove that); cold renders stay out of the cutover window. Then the controller `gate`. | `retention.json`, `plan.json`, `gate.log` |
| `cutover` | Checks routing drift first, then controller `cutover` (journal, candidate checks, routing switch, nginx reload, static public check). | `cutover.log` |
| `complete` | Public readback of the same scope on `https://eduaipolicy.org` (pages carry `?uapt_readback=<plan id>` against stale CDN HTML; `--no-cache-bust` turns this off). Completion event and `verify-sync … complete`. Controller `complete`: a retired slot that ended `failed` is `reset-failed` and completion retried once. Confirms that the controller updated the retention register (7.4), then runs the read-only `retention` check. | `sync/program-complete/`, `complete-*.log`, `retention.log`, `RESULT.json` |
| `mcp` (after `complete`) | Moves the MCP unit onto this release's `apps/mcp/server.mjs`, reading the runtime content root (7.7). A trial process on 127.0.0.1:3162 must report the selected `contentId`, manifest and catalog hashes on `/healthz` and list the three tools. The unit then gets a managed drop-in and one restart, with the same checks; on failure the previous drop-in is restored and the unit restarted. `--trial-only`, `--rollback`. | `mcp/trial.json`, `mcp/mcp.env`, `mcp/dropin.conf`, `mcp/dropin-before-*` |

Restarting the candidate (a crash, or `candidate` after a timeout) voids
`capacity`, `ledger` and `plan`, which describe the old process. `candidate` and
`capacity` refuse once the operation is cut over. A candidate started by
`candidate` and then abandoned keeps running until the operator stops it: the
controller's TTL timer only acts on transactions. Stop it, or let `plan` refuse
it once its lifetime is used up.

Defaults come from the host's actual state. Override them when needed:

- web slots: `uapt-mcp-v6-candidate` = 3101 and `uapt-mcp-v6-r2` = 3102 (`--slot unit=port`, twice). The active slot is the one the policy lists as active and that runs; the candidate is the other slot, which must be a registered candidate slot.
- SHA and BUILD_ID: from the install receipt.
- content root: `UAPT_CONTENT_ROOT` of the active slot's env file. The command refuses to continue if the pointer changes during the operation.
- MCP endpoint and catalog: `UAPT_MCP_PORT` and `UAPT_MCP_CATALOG` of the active non-web unit (`--mcp-endpoint`, `--mcp-catalog`).
- node: the active slot's `ExecStart` (`--node-bin`).
- release helper for `verify-sync`, disk budget, peak budgets: from the last completed plan (`--helper`, `--candidate-peak-bytes`, `--build-peak-bytes`).

Content changes are not part of this command. Switch content first with the
content release flow (`docs/content-release.md`, its own full contract 2.1.0
event). Then run the program release.

### 7.2 Timings

Measured (hand-run steps, 2026-11-06):

- the dashboard release took about 15 min from artifact to completion;
- it was routed about 75 min before its own warm-up finished (`Runtime warm-up finished` after 4,852 s, 3,937 requests);
- R1 fixes took about 50 min;
- the R1 launch, content included, took about 3 h.

Expected with this command. Readback times are from the three releases' own
receipts; the other rows are estimates, not yet measured with this command.

| Step | Expected |
|---|---|
| install | 1–2 min |
| candidate | warm-up 40–80 min on the loaded host; the fallback can finish after 10 min once sampled pages answer fast |
| static, routing | under 1 min each |
| capacity | 3–5 min |
| ledger | sample (60 school pages + 20 APIs + core): about 1 min; full candidate readback (396 pages + 132 APIs) measured 1–3 min |
| plan + gate | 1–3 min (`du` of `/srv/uapt`) |
| cutover | about 1 min |
| complete | sample: 1–2 min plus controller `complete`; the full public readback measured 7–13 min (00:10–00:22, 03:13–03:26, 03:59–04:05) |

The command does not shorten the warm-up. Waiting for it is the point: routing
before warm-up sent cold 60–110 s renders to users. Operator work drops to
running the steps in order.

### 7.3 Program-only ledger: sampled readback

The sync gate (`policy-inventory.py sync-gate`) requires every updated surface
to cover exactly the declared scope, and the 2.1.0 projection validator
recomputes the Changes v2 events for that scope. Neither requires all
published schools. The program event therefore declares the sampled schools as
its scope instead of claiming 132 while reading back 20.

- **Basis.** The event binds the program basis: release, codeSha, BUILD_ID,
  file and build manifests, and the content pointer.
- **Frozen artifacts.** Public data, the Changes v2 projection proof,
  overviews and event-surface IDs come from the content release's own
  synchronized event: the one whose hash the pointer's `sync.eventSha256`
  names. That event is located under `/srv/uapt/operations/*/sync/*/` and
  checked, including every referenced artifact hash. The artifacts are then
  restricted to the scope. Proof files are hard-linked, not copied.
- **Fresh observations.** Candidate pages, API Claim IDs, MCP Claim IDs and the
  runtime content manifest are observed for every school in scope. Each set
  must equal the synchronized Claim ID set exactly, which also proves that no
  held Claim ID is exposed.
- **Scope record.** `scope.json` records the content event (id, hash, 132
  schools), the sampling mode and the reason each school was chosen.

Scope modes (`install --readback auto|sample|full`, overridable at `ledger`):

- **sample** (the `auto` choice when the content release is the one the
  previous accepted program served). About 20 schools: `--sample-slug`
  additions, the schools with the most and fewest claims, two schools changed
  in the latest projection revision, then the QS tiers 1–50, 51–100, 101–200,
  201–400, 401+ and unranked, filled evenly by rank. Plus core pages, feeds,
  sitemap, `llms.txt`, the changes API and the BUILD_ID manifest.
- **full** (the `auto` choice when the content differs from the previous
  accepted program release). All schools of the content event.

Checked locally on 2026-11-06 against the R1 content event
(`c-20261105-r1`), copied from the host, with the production release helper's
code (eea1eb21):

- the 20-school and the 132-school program events pass `sync-gate --phase
  candidate`, and their completion events pass `--phase complete`;
- the candidate event is refused at `complete`;
- a removed `latestDiff` event ID is refused by the projection validator even
  with every hash rewritten.

This changes nothing for content releases. A content switch still needs its own
full-scope 2.1.0 event. A program release refuses to start when the pointer has
no 2.1.0 sync receipt.

### 7.4 Retention register at `complete` (controller)

The controller now updates `policy.retentionRegister` itself during
`complete`. The update is computed before any unit retires, so an unclassified
release root stops completion while the old slot still runs. It is written
after the policy, with a timestamped backup next to the register:

- the new release root becomes `active` (role from `plan.diskBudget.role`);
- the release roots of the retired units become `rollback` for it;
- the role's older `rollback` becomes `held`:
  - `heldSince` is the completion time;
  - `reviewBefore` is 167 h later (never more than `maxHoldHours`);
  - `nextAction` says to archive off-host with hash verification and a restore
    check, review references, then remove under the storage policy;
  - an existing first hold clock is reused, never reset;
- other roles' rollbacks and existing holds are untouched; roots no longer on
  disk drop out.

Role detection: entries registered before roles were recorded count as the
program role when both names start with `uapt-program-`. The new holds go into
`hold-clocks.json`, and the controller runs the read-only retention check on
the result. `transaction.json` records the outcome under `retentionRegister`
(summary, backup path, check result).

### 7.5 Rollback

- **Before `complete`** (stage `selected_pending_acceptance`): run
  `python3 /usr/local/libexec/uapt-release-lifecycle.py recover`. It restores
  the journaled snippets, re-enables the retired slot and restores the policy.
  The boot recovery unit and the TTL timer do the same automatically.
- **After `complete`:** the previous root is the `rollback` entry. Re-release
  it through the same gates, without a download:

  ```bash
  program-release.py install --sha <its codeSha> --existing-release /srv/uapt/releases/<rollback root>
  ```

  Then run `candidate` … `complete` as usual. It takes the warm-up again.
  A root already moved to `held` cannot be reused this way: the gate refuses
  held → candidate.

### 7.6 Installing (coordinating session, after review)

Nothing is installed by the PR.

1. Back up the installed controller:
   `cp -p /usr/local/libexec/uapt-release-lifecycle.py /srv/uapt/operations/release-lifecycle/controller-before-retention-register-<sha8>.py`.
2. Install the controller:
   `install -o root -g root -m 0755 scripts/uapt-release-lifecycle.py /usr/local/libexec/uapt-release-lifecycle.py`.
   Compare the SHA256 with the reviewed commit and save an install receipt next
   to the earlier ones.
3. Install the command and the installer side by side, because the command
   looks for `uapt-program-artifact-install.py` next to itself:
   `install -m 0755 scripts/release/program-release.py /usr/local/libexec/uapt-program-release.py`
   and `install -m 0755 scripts/program-artifact-install.py /usr/local/libexec/uapt-program-artifact-install.py`.
4. With no transaction pending, run `uapt-release-lifecycle.py retention`
   (read-only). Then run the next release with the command.

### 7.7 MCP on the program artifact

Before this, MCP (`uapt-shared-v6-r2.service`, 127.0.0.1:3161) ran
`apps/mcp/src/server.ts` through tsx from an old full-workspace release
(`uapt-qs101-120-066043dd`), pinned by a drop-in to one catalog file
(`UAPT_MCP_CATALOG`, `UAPT_MCP_EXPECTED_RELEASE_ID`). Every content release
therefore needed an MCP restart with a new drop-in.

- **Build.** `program-build.mjs build` bundles `apps/mcp/src/server.ts` with
  esbuild into `apps/mcp/dist/server.mjs`: the MCP SDK, zod and `@uapt/shared`
  are inlined and the file imports only Node builtins (about 1.4 MB). The
  bundle refuses to include checkout content. `package` ships it as
  `apps/mcp/server.mjs` and records it in `entries.mcp`.
- **Runtime.** `node server.mjs` with `NODE_ENV=production`,
  `UAPT_CONTENT_ROOT=/srv/uapt/content/runtime`, `UAPT_MCP_PORT`,
  `UAPT_MCP_TELEMETRY_FILE`, `UAPT_MCP_PUBLIC_ORIGIN`. MCP serves the catalog
  the selected content release declares and reloads it when the pointer
  changes (poll every 15 s, or SIGHUP). `/healthz` reports `contentId`,
  `manifestSha256`, `releaseId` and `catalogSha256`.
- **Release.** Run `mcp --op <dir>` after `complete` on every program release,
  so MCP always runs from the active root. `plan` refuses when MCP still runs
  from a program root that is neither the active one nor the new one, because
  `complete` would turn it into a hold. The first move from the legacy
  workspace root is allowed.
- **Content releases** then need no MCP restart: `content:switch --mcp-url
  http://127.0.0.1:3161` confirms that MCP picked up the new catalog.
- **Rollback.** `mcp --op <dir> --rollback` restores the drop-in that the step
  replaced (or removes the managed one) and restarts the unit. A failed switch
  does this automatically.
- **Tests.** `tests/mcp-bundle.test.mjs` starts the bundle outside the
  checkout against a fixture content root, lists the tools and follows a
  pointer switch without a restart. It needs an exported catalog
  (`apps/mcp/.runtime-data/catalog.json`) and is skipped without one.
