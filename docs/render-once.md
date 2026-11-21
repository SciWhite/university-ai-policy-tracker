# Render once per release, keep pages on disk (audit 2026-11-21, phase 2)

Status (2026-11-21): code, tests and docs on branch `claude/pensive-elion-2fc75f` (built on
`claude/laughing-murdock-3c9e56`). **Nothing is installed on the host.** §8 is the rollout plan;
every production step needs the owner's go-ahead.

A page is a pure function of (program build, content release, path). Content changes only at a
content release, which already lists the changed URLs (`switch-<time>.json`). So pages are
rendered once per release and kept on disk; Node serves only API, search, MCP, store misses and
refresh fetches.

| Layer | Before | After this phase |
|---|---|---|
| Next render | ISR, `revalidate = 3600` on school and home pages, 1.5–2 GiB in-memory LRU | `revalidate = false`; a page changes only when a content switch expires its tags; LRU 1 GiB |
| URL variants | `?returnTo=` on every directory/ranking link (18–23 % of origin requests) | no query on school links; the view is kept in sessionStorage; old links still work |
| nginx | 3 GB, 6 h, key = full `request_uri`, new epoch on every content switch | page store: 12 GB, 30 d, school/changes documents ignore the query; epoch changes only on program releases; a content release refreshes the changed URLs |
| Pre-render | none; 23–43 min warm-up of ~4,000 URLs per start | optional tree of every indexable school/changes page (HTML + RSC), served by nginx `try_files` first |
| Warm-up | ~4,000 sitemap URLs | with a tree: ~640 URLs (target < 10 min) |

## 1. Code changes (2.1)

- `apps/web/app/(default)/universities/[slug]/page.tsx`, `[locale]/universities/[slug]/page.tsx`,
  `(default)/page.tsx`, `[locale]/page.tsx`: `revalidate = false` (changes pages already were).
  School pages carry the tags `catalog` and `school:<slug>`, home pages `home` and `catalog`;
  `content:switch` expires them through `POST /api/internal/content/refresh` exactly as before
  (`docs/content-release.md` §5). No timer re-renders them any more.
- The school page put the render date into the HTML (`PolicyV6Changes` passed `today` for the
  90-day window). With `revalidate = false` that date would freeze. The server now renders every
  dated change (no date in the markup) and the browser applies the 90-day window with its own
  clock after hydration (`components/policy-v6-changes-client.tsx`; the module is collapsed by
  default, so nothing visibly jumps). Test: `tests/v6-changes-module.test.tsx`.
- `returnTo`: directory and ranking links are plain `/universities/<slug>`; a click stores
  `{url, target, at}` in sessionStorage (`lib/discovery-return-state.ts`,
  `rememberDiscoveryReturn`/`discoveryReturnLinkProps`). The school page's back link reads it for
  its own path (6 h). An old `?returnTo=` link is adopted into sessionStorage and removed from the
  address bar with `history.replaceState` (hash kept). Unsafe values are dropped
  (`safeDiscoveryReturn`). Test: `tests/discovery-return-state.test.ts`.
- `next.config.ts`: `cacheMaxMemorySize` 1.5 GiB → 1 GiB.
- `lib/runtime-warmup.ts`: `UAPT_WARMUP_PAGE_TREE=1` and `UAPT_WARMUP_MAX_SECONDS` (§5).

## 2. nginx page store (2.2)

Files: `infra/nginx/uapt-page-store.conf` (http context; replaces `uapt-html-cache.conf` when
installed), `infra/nginx/uapt-html-content-generation.inc`, generator
`scripts/nginx-minimal-routing.py --page-store [--page-tree <root>]`.

- `proxy_cache_path … keys_zone=uapt_html:64m max_size=12g min_free=20g inactive=30d`. Same zone
  name, path and zone size as today (a reload cannot resize a shared zone). `min_free` stops the
  cache from taking the last 20 GB of the shared disk (today 26 GB free, so it grows to ~9 GB
  until the disk reclaim of the audit §6.2 lands).
- One pattern location (not per page) for school and changes pages in every reading locale:
  `^/(?:(<33 locales>)/)?(?:universities/<slug>|changes(/<id>){0,2})$`. Kept `=`/`^~` locations
  still win; the generator refuses kept prefix locations the pattern would shadow.

**Keys.**

| Request | Key | Validity | Cleared by |
|---|---|---|---|
| School/changes document | `epoch \| host \| uri \| doc \| ae=gzip\|identity` (no query: `?returnTo=` and tracking parameters share the entry) | 30 d, then stale-while-updating | program release (epoch), refresh (overwrite) |
| School/changes RSC | `epoch \| host \| uri \| rsc \| generation \| _rsc \| prefetch \| segment-prefetch \| state-tree \| ae` | 30 d | program release, content release (generation) |
| Everything else in `location /` | `epoch \| generation \| scheme \| host \| request_uri \| rsc` | 6 h (as before) | program release, content release |
| 404/410 in the store | as above | 10 min | — |

- `epoch` = `uapt-html-cache-epoch.inc`, written by `uapt-program-release.py purge-html-cache`
  (the `cutover` step). Unchanged tooling; with the page store installed it is no longer run for
  content switches.
- `generation` = `uapt-html-content-generation.inc` = the selected `contentId`, written by
  `render-once.py generation`. Because it is the contentId, an RSC entry is content-addressed: a
  rollback to an earlier release can hit its old entries again.
- Encoding: `Accept-Encoding` is normalized to `gzip` or nothing before it reaches Next, and
  `Vary` is ignored, so each URL has exactly two stored entries a refresh can overwrite.
- Next validates `_rsc` against the router headers (a mismatch is a 307 to the right value,
  verified locally), so an RSC entry cannot be poisoned with another state tree.

**Refresh.** `X-UAPT-Refresh: 1` → `proxy_cache_bypass` without `proxy_no_cache`: nginx fetches
from Next and overwrites the entry. Honoured only when the TCP peer (`$realip_remote_addr`, not
the real-IP address) is 127.0.0.1/::1 **and** the request has no `CF-Connecting-IP`, `CF-Ray` or
`Forwarded` header (so neither Cloudflare nor a local tunnel can relay it), and never forwarded to
the app. A local user on the shared host can at most force a re-render (CPU), not change content.

**Purge semantics** (tested in `tests/test_render_once.py`, which evaluates the installed `map`
rules):

| Event | Documents (school/changes) | RSC (school/changes) | Other pages | Pre-rendered tree |
|---|---|---|---|---|
| Program release (`cutover`) | cold (new epoch) | cold | cold | switch to the new program's tree (§3) |
| Content release | kept; changed URLs refreshed in **all 33 locales** | cold (new generation) | cold (new generation) | new tree = old tree + re-rendered changed pages |
| Content rollback | same as a content release (the switch plan covers both sides) | old entries of that contentId may hit | same | activate the earlier tree |
| School removed | refresh stores the 404 (10 min) | cold | cold | page leaves the tree (gap `html status 404`) |
| No refresh (missed URL) | stays old until refreshed, 30 d, or the next program release | — | — | stays old |

Known limits:
- `switch.ts` lists a non-cohort school in en/zh only; `render-once.py urls/refresh` expands every
  page-store path to all 33 locales. Other plan paths are fetched as listed (they only warm).
- School pages also show catalog-wide data (related universities, counts). A content release that
  changes only the catalog of *other* schools leaves those bits on unchanged school pages until the
  next program release or 30 days. Next's own ISR still expires them (`catalog` tag); the nginx
  copy does not. Run `refresh` with the affected paths if a release needs them everywhere.
- Cloudflare: a URL purge cannot reach `?_rsc=` variants. Until the edge bypasses `_rsc`
  (audit §6.4), keep `purge_everything` after a content release; the origin stays warm, so the
  edge refills cheaply.

## 3. Pre-rendered tree (2.3)

`scripts/release/render-once.py capture|materialize|activate|verify|diff|deactivate`, layout
under a root such as `/srv/uapt/page-tree`:

```
objects/<aa>/<sha256 of the raw bytes>.gz     immutable, gzip -9, mtime 0 (same bytes on every machine)
trees/<treeId>.json                           {buildId, contentId, baseTree, pages{path:{html,rsc}}, gaps, notes, stats}
trees/<treeId>/{html,rsc}/<path>/index.<kind>{,.gz}   hardlinks to the object (0 extra bytes)
current -> trees/<treeId>                     atomic symlink swap; activations.jsonl
```

nginx (`--page-tree <root>`): `try_files /$uapt_page_tree_kind$uri/index.$uapt_page_tree_kind
@uapt_page_store` with `gzip_static always; gunzip on;` and the same `Cache-Control`
(`s-maxage=31536000`, what Next sends for these pages) and `Vary` as the app;
`X-UAPT-Origin-Cache: STATIC`. Only plain GET/HEAD documents and full (non-prefetch) RSC
navigations use the tree; prefetches, refreshes and every other request fall through to the store.
A static page's full RSC payload does not depend on the router state tree (verified: identical
bytes with and without a tree header).

`capture` refuses pages that set a cookie, are `private`/`no-store`, or whose RSC request is not
`text/x-component`; it records them as gaps (nginx then serves them from the store). It refuses
to mix program builds, and a content-release capture (`--base-tree`) must use the base tree's
build. It reports pages whose markup contains the contentId (none found).

**Dedup check (measured).** The HTML and RSC carry no contentId and no render timestamp (the only
one, the 90-day window date, is removed in §1). But renders are **not byte-deterministic**: Next
resolves metadata and client references concurrently, so 25 of 120 pages rendered by two fresh
processes from the same program and content differed only in `<head>` tag order and flight-row ids.
Consequences, handled in the tool:
- a content release re-renders only the changed paths and keeps the base tree's objects for the
  rest (100 % reuse for unchanged pages); a full re-render of unchanged pages still reuses ~80 %;
- `verify` and `diff --root` compare modulo render order (`normalized()`): same content → 0
  mismatches (48 byte-equal + 12 order-only of 60); the other content release → 6 of 60 flagged.
- Between the two local content releases (October report → source metadata, same program, 120
  pages): 98 byte-identical, 15 order-only, 7 real changes, exactly the release's new source dates.
- Across program releases nothing is shared (the build id is in every page).

## 4. Measurements (this Mac, 2026-11-21) and estimates for the host

Local: content-free program build of this branch (standalone, prerenders pruned like `package`),
content root `.local/content-source-metadata-20261118` (815 schools), 14-core Apple silicon.

| Item | Measured here |
|---|---|
| Indexable set (all sitemap `<loc>`) | 3,968 URLs: 1,686 school (en 815, zh 701, 12 other locales 170), 1,640 changes (en 1,622), 642 other |
| Full tree, 3,326 school/changes pages (HTML + RSC) | **88 s** wall with 6 Node processes; 457 CPU-s (0.14 CPU-s per page); 0 gaps |
| Tree size | **132 MB** gzip objects (921 MB raw), 6,652 objects; HTML median 159 KB raw / 24 KB gz (max 1.7 MB); RSC median 68 / 12 KB; materialize 4.5 s, 0 extra bytes |
| The other 642 indexable URLs, 1 process | 72 s (80 CPU-s); `/search` 11.8 s, `/reports` 4 s |
| `?_rsc` without headers / with a state tree | identical 157 KB payload |

Host factor: production warm-up took 0.34–0.64 s per request (1,370–2,581 s for 4,021), about
2.5–4.7× this Mac. Production pages are larger (a `de` school page is 737 KB raw), so the tree is
estimated at 150–300 MB.

| | Before (measured on the host 2026-11-21) | After (estimate) |
|---|---|---|
| Web slot memory | 4.5 GB after warm-up, +0.4 GB per content switch (fixed on laughing-murdock), 6.2 GB at the OOM | ISR LRU 2 → 1 GiB: **~3.0–3.5 GB** steady; no growth per switch |
| CPU | ~0.85 core steady, 0.24 CPU-s per origin request, ISR hit < 5 % | Node renders store misses only (first touch of a long-tail locale per program release, RSC/generic pages once per content release, refresh). **~0.1–0.3 core** (audit target < 0.3); a 12-school content refresh ≈ 400 renders ≈ 3–5 min of one core |
| Candidate warm-up | 23–43 min (~4,000 renders) | with a tree: ~640 renders ≈ **4–7 min**; without a tree: unchanged |
| Full pre-render | — | offline 6 processes: ~2 min + upload 150–300 MB; on the host against the candidate: ~19–36 min (one Node thread) |
| nginx disk | 3 GB full, 59,873 files, cold after every content switch | ≤ 12 GB (≤ ~9 GB until disk reclaim, `min_free=20g`); school/changes entries survive content releases; working set est. 4–8 GB |
| Tree disk | — | 150–300 MB per program × content; a content release adds only changed pages (MBs); keep current + rollback |

The memory and CPU figures are estimates; check them after rollout (§8 verification).

## 5. Warm-up (2.4)

`UAPT_WARMUP_PAGE_TREE=1` in the candidate's `runtime.env`: after the core paths and sitemaps the
warm-up renders every indexable URL that is **not** a school/changes page plus a sample of 12 of
those (to load their code and data). The finished line adds `pageTree`, `skippedForPageTree`,
`truncated`. `UAPT_WARMUP_MAX_SECONDS=<n>` caps it. Without the variables nothing changes. Set it
only when the tree for the candidate's build is ready, or school pages are cold after cutover.

With a 1 GiB LRU (~650 pages) the old full warm-up cannot keep the 3,326 school/changes pages in
Node's memory anyway; the tree and the page store hold them.

## 6. Interface for the release tooling (`full-project-audit` consolidation)

One file, stdlib only: `scripts/release/render-once.py` (install as
`/usr/local/libexec/uapt-render-once.py`, root 0755). All network calls are loopback; exit 0 = ok,
1 = problems in the receipt, 2 = refused.

Content release, once the page store is installed (replaces `purge-html-cache` and complements
`warm-changed-pages.py`):

```bash
pnpm content:switch … --refresh-url http://127.0.0.1:<routed port>          # unchanged: Next ISR tags/paths
sudo uapt-render-once.py generation --content-id <id> --reason "content switch <id>"   # nginx -t + reload, restores on failure
# with a tree: re-render the changed indexable pages on the routed slot
uapt-render-once.py capture --root /srv/uapt/page-tree --tree-id <id>.<build8> --base-tree <current> \
  --origin http://127.0.0.1:<routed port> --paths-file <(uapt-render-once.py urls --plan switch.json) --content-id <id>
uapt-render-once.py materialize --root /srv/uapt/page-tree --tree-id <id>.<build8>
uapt-render-once.py activate    --root /srv/uapt/page-tree --tree-id <id>.<build8> --build-id <buildId>
uapt-render-once.py refresh --plan <release>/switch-<time>.json --path <readback paths> --receipt <op>/page-store-refresh.json
# then the Cloudflare purge (purge_everything until the edge bypasses _rsc), public readback
```

`urls` prints the expanded list (readback paths first, page-store paths × 33 locales, then the
plan's other paths); `refresh` fetches each through nginx (`https://127.0.0.1`, SNI
`eduaipolicy.org`) with `X-UAPT-Refresh: 1` for the gzip and identity entries (one retry), then
reads it back and requires `HIT`/`STATIC` for stored pages. 404/410 count as answered.

Program release: `cutover` already sets a new epoch. With a tree: capture the full indexable set
for the candidate's build (offline, then `verify --origin http://127.0.0.1:<candidate>
--sample 40` on the host; or on the host against the candidate), `materialize`, and `activate`
right after `cutover` (`--build-id` must match). Rollback: `activate` the previous tree with the
previous build, or `deactivate` (everything falls through to the store).

## 7. Tests

- `pnpm test:render-once`: `tests/test_render_once.py` (map semantics, refresh, generation,
  tree), `tests/test_nginx_minimal_routing.py` (generator modes, shadowing, and `nginx -t` of the
  full config where an nginx binary exists; skipped on this Mac: no nginx, no Docker daemon),
  `tests/runtime-warmup.test.ts`, `tests/discovery-return-state.test.ts`,
  `tests/v6-changes-module.test.tsx`.
- `pnpm check`, `pnpm test:content-release`, `pnpm test:program-release` unchanged and passing.

## 8. Rollout plan (owner go-ahead per step; nothing done yet)

**中文摘要（给 owner）**：分三步上线，每步单独批准、可单独回滚。R1 是一次普通程序发布（代码改动，路由不变）；R2 安装 nginx 页面库（先装 http 配置、再随下一次程序发布替换路由），之后内容发布不再整站清空，只刷新改动的 URL；R3 启用预渲染树和缩短预热。前提是阶段 0（内存上限、watchdog、`worker_rlimit_nofile`）已完成、磁盘可用 ≥ 25 GB、`nginx -V` 含 gzip_static/gunzip/realip。

Preconditions: phase 0 of the audit is installed (server fixes A–D, `worker_rlimit_nofile 65536`);
this branch merged with `laughing-murdock`; no content or program release running; ≥ 25 GB free;
`nginx -V 2>&1 | tr ' ' '\n' | grep -E 'gzip_static|gunzip|realip'` shows all three.

**R1 – program release of the code (2.1, 2.4 dormant).** Normal lifecycle (`docs/program-release.md`
§7), routing unchanged. Verify on the candidate and after cutover:
`curl -sD- http://127.0.0.1:<port>/universities/<slug> -H 'Host: eduaipolicy.org'` shows
`Cache-Control: s-maxage=31536000` and `x-nextjs-cache: HIT` on the second request; a directory
page's school links have no `returnTo=`; an old `/universities/<slug>?returnTo=%2Funiversities`
link shows "back" and drops the parameter (browser); the next content switch's refresh response
lists the tags and the changed page shows the new content; memory after warm-up (expect
≤ 3.5 GB, compare `memory.current`). Rollback: the lifecycle rollback to the previous program.

**R2 – nginx page store (2.2).**
1. Install (root, receipt): back up `/etc/nginx/conf.d/uapt-html-cache.conf`; install
   `uapt-page-store.conf` in its place and `uapt-html-content-generation.inc` with
   `default "<current contentId>"`; `nginx -t`; `systemctl reload nginx`. Only maps and limits
   change; the live routing does not use the new variables yet. Check: `X-UAPT-Origin-Cache` still
   HIT on a cached page. Rollback: restore the backup, reload.
2. Next program release with `routing --replace uapt-proxy-locations.conf=<file>` where `<file>` is
   `scripts/nginx-minimal-routing.py <nginx -T dump> <file> uapt_next_backend --page-store` run on
   the host from the release helper (the routing step's isolated `nginx -t` covers it). After
   cutover, verify from the host:
   - `curl -sk --resolve eduaipolicy.org:443:127.0.0.1 -D- -o/dev/null https://eduaipolicy.org/universities/<slug>`:
     MISS, then HIT; the same URL with `?returnTo=x` → HIT (same entry);
   - with `-H 'X-UAPT-Refresh: 1'` → `BYPASS`, then the plain request → HIT;
   - the same header through Cloudflare (public URL) → never `BYPASS`;
   - `/de/universities/<slug>` with `-H 'RSC: 1'` → `text/x-component`.
   Rollback: the program rollback restores the old routing files; restore the http conf (step 1).
3. From the next content release: `generation` + `refresh` instead of `purge-html-cache`
   (§6). Verify the refresh receipt has no problems and one changed school page reads back with
   the new content in en, zh and one other locale.

**R3 – pre-rendered tree and short warm-up (2.3, 2.4).**
1. Create `/srv/uapt/page-tree` (deploy user, 0755); register it with the retention register
   (kept: current + rollback tree; objects shared). Capture the tree for the routed program and
   current content on the host (`capture --sitemap --origin http://127.0.0.1:<routed port>`, one
   request at a time; ~20–40 min, it only reads the routed slot) or offline (§6), `verify
   --sample 40`, `materialize`. Do not activate yet.
2. Next program release: routing generated with `--page-store --page-tree /srv/uapt/page-tree`;
   the candidate's tree captured and verified before cutover; `activate --build-id <candidate>`
   right after `cutover`; `UAPT_WARMUP_PAGE_TREE=1` in that candidate's `runtime.env`. Verify:
   school page → `X-UAPT-Origin-Cache: STATIC`, `Content-Encoding: gzip`, `Content-Type:
   text/html`; `RSC: 1` → `text/x-component`; a prefetch (`Next-Router-Prefetch: 1`) → not
   STATIC; warm-up finished line `pageTree: true` and < 10 min.
   Rollback: `deactivate` (instant; store and app serve everything) or the program rollback.

After each step: public readback with one worker, then the Cloudflare purge (as today). Stop and
roll back if 5xx rise, memory exceeds 6 GB, or readback shows old content.

## 9. Open items

- Byte-deterministic rendering (metadata streaming order) would let unchanged pages dedupe even
  when re-rendered; not needed for correctness. Candidate: `htmlLimitedBots` or a metadata-order
  fix upstream.
- Cloudflare `_rsc` bypass and URL purges (audit §6.4) need the owner; until then
  `purge_everything` after content releases.
- An on-host offline renderer (several Node processes) would need the memory budget; offline
  rendering on a workstation needs the program artifact and the content release there.
- `nginx -t` of the generated config ran only in the unit test where nginx exists; run it on the
  host's isolated instance (`scripts/nginx-minimal-routing-compare.py`) before R2.2.
