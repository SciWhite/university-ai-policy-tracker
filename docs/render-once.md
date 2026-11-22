# Render once per release, keep pages on disk (audit 2026-11-21, phase 2) + content-language URLs (2026-11-22)

Status (2026-11-22): code, tests and docs on branch `claude/pensive-elion-2fc75f` (built on
`claude/laughing-murdock-3c9e56`). **Nothing is installed on the host.** §8 is the one combined
rollout plan (phase 2 + content-language URLs); every production step needs the owner's go-ahead.
The owner approved the locale redesign on 2026-11-22: "按新结构改" (§10).

A page is a pure function of (program build, content release, path). Content changes only at a
content release, which already lists the changed URLs (`switch-<time>.json`). So pages are
rendered once per release and kept on disk; Node serves only API, search, MCP, store misses and
refresh fetches. Since 2026-11-22 only languages with authored content have URLs (en, zh and a
school's native language with complete accepted prose); the other 31 reading locales are a UI
preference applied in the browser.

| Layer | Before | After |
|---|---|---|
| URLs | 33 reading locales × every route (~27k school/changes URLs, ~25k of them noindex English in a foreign UI) | en + zh for every route, plus 57 native-language school pages (local data); `/<uiLocale>/…` answers 301 (school pages 308) to the English page with `#ui=<locale>` |
| UI languages | server render per locale | English page + content-hashed dictionary per UI locale, applied in the browser (`lang`/`dir` on switched text) |
| Next render | ISR, `revalidate = 3600` on school and home pages, 1.5–2 GiB in-memory LRU | `revalidate = false`; a page changes only when a content switch expires its tags; LRU 1 GiB |
| URL variants | `?returnTo=` on every directory/ranking link (18–23 % of origin requests) | no query on school links; the view is kept in sessionStorage; old links still work |
| nginx | 3 GB, 6 h, key = full `request_uri`, new epoch on every content switch | page store: 12 GB, 30 d, school/changes documents ignore the query; epoch changes only on program releases; a content release refreshes the changed URLs |
| Pre-render | none; 23–43 min warm-up of ~4,000 URLs per start | optional tree of every indexable school/changes page (HTML + RSC, 3,198 pages), served by nginx `try_files` first |
| Warm-up | ~4,000 sitemap URLs | with a tree: ~190 URLs (≈ 2–4 min on the host) |

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

- `proxy_cache_path … keys_zone=uapt_html:64m max_size=6g inactive=30d`. Same zone name, path and
  zone size as today (a reload cannot resize a shared zone). No `min_free`: the host runs nginx
  1.18 and it needs 1.19.1 (found at R1, 2026-11-22). 6 GB is above the 2–4 GB working set and
  keeps the disk well over the controller's 12 GiB reserve.
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

## 4. Measurements (this Mac, 2026-11-21) and estimates for the host (before the locale change; see §12)

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
| nginx disk | 3 GB full, 59,873 files, cold after every content switch | ≤ 6 GB (`max_size`; nginx 1.18 has no `min_free`); school/changes entries survive content releases; working set est. 2–4 GB |
| Tree disk | — | 150–300 MB per program × content; a content release adds only changed pages (MBs); keep current + rollback |

The memory and CPU figures are estimates; check them after rollout (§8 verification).

## 5. Warm-up (2.4)

`UAPT_WARMUP_PAGE_TREE=1` in the candidate's `runtime.env`: after the core paths and sitemaps the
warm-up renders every indexable URL that is **not** a school/changes page plus a sample of 12 of
those (to load their code and data): ~190 URLs with the content-language set (§12). The finished line adds `pageTree`, `skippedForPageTree`,
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

## 8. Combined rollout plan: phase 2 + content-language URLs (owner go-ahead per step; nothing done yet)

**中文摘要（给 owner）**：这次是全站路由/语言结构变更，按现行流程作为**一次程序发布**上线（GitHub Actions
在冻结 SHA 上构建一次，主机上用 `uapt-program-release.py` 生命周期各步；旧文档
`docs/release-routing-policy.md` 已是历史流程，AGENTS.md 规定不再使用，它要求的"一个权威构建"
在现行流程里就是这一次程序发布）。顺序：先装 nginx http 配置（不改行为）→ 程序发布（新代码 + 页面库路由，
候选槽验收 URL 矩阵）→ 切换 → 公网回读 → Cloudflare 全量 purge。预渲染树和缩短预热放在之后单独一步（R3）。
回滚＝生命周期回滚到上一程序 + 恢复 http 配置 + purge。IndexNow/搜索通知仍需单独授权。

Preconditions: phase 0 of the audit is installed (server fixes A–D, `worker_rlimit_nofile 65536`);
this branch merged into main (with `laughing-murdock`; conflicts with PR #49 noted in §13); no
content or program release running; ≥ 25 GB free; `nginx -V 2>&1 | tr ' ' '\n' | grep -E
'gzip_static|gunzip|realip'` shows all three. One authoritative build: `program-build.yml` on the
merged 40-hex SHA (the locale change is global, so no partial or per-zone release).

**Preflight (read-only, 2026-11-22 01:45Z).**

| Check | Result |
| --- | --- |
| Web and MCP | Web runs `uapt-program-d9f6b48016a3` on 3101; MCP runs on the same root. |
| Program roots | Rollback `716cd5e9f576`. Stale `987cbda4201d` (184 MB, hold blocks 2026-11-26 15:22Z). |
| Disk | 26 GB free (83 %), nginx cache 3.1 GB. |
| nginx modules | gzip_static, gunzip and realip are all present. |
| Holds | `hold-status` ok: 0 overdue, retention receipt 5 h old. |
| Installed tools | Controller, `program-release.py` and the artifact installer match main. `render-once.py` and `content-release.py` are not installed. |

Phase 0 is installed. The cache-leak fix (`laughing-murdock`) and this branch are merged.

Consequences:
- **R0 – archive `987cbda4` first.** Use the off-host tar with hash and an isolated restore check, then delete by exact allowlist. Otherwise the candidate makes four program roots, against "active + rollback + one candidate", and the hold blocks on 11-26.
- **Install `render-once.py` before R2.** Install it as `/usr/local/libexec/uapt-render-once.py`. Content switches after R2 need its `generation` step.
- **Disk.** nginx is 1.18, which has no `min_free` (the first R1 attempt failed `nginx -t` on it and was restored). The store is bounded by `max_size=6g`: at most about 3 GB more than today, well over the 12 GiB reserve.

**R1 – nginx http configuration (no behavior change).** Root, with a receipt: back up
`/etc/nginx/conf.d/uapt-html-cache.conf`; install `infra/nginx/uapt-page-store.conf` in its place
and `uapt-html-content-generation.inc` with `default "<current contentId>"`; `nginx -t`;
`systemctl reload nginx`. Only maps and limits change (same zone and size); the live routing does
not use the new variables yet. Check: a cached page still shows `X-UAPT-Origin-Cache: HIT`.
Rollback: restore the backup, reload.

**R2 – the program release (code + page-store routing), `docs/program-release.md` §7.**
1. `install` the artifact; `candidate` on the free slot (`UAPT_WARMUP_PAGE_TREE` unset: no tree
   yet; the warm-up covers the new indexable set, ~3,400 URLs, ~20–35 min).
2. `routing --replace uapt-proxy-locations.conf=<file>`, `<file>` =
   `scripts/nginx-minimal-routing.py <nginx -T dump> <file> uapt_next_backend --page-store` run
   on the host from the release helper; the step's isolated `nginx -t` must pass (also run
   `python3 -m unittest tests/test_nginx_minimal_routing.py` there: its `nginx -t` test runs where
   nginx exists).
3. **Candidate acceptance** (loopback to the candidate port, one request at a time; receipt):
   - en/zh school pages (20 + 20, incl. Toronto/York/Ghent): 200, `Cache-Control:
     s-maxage=31536000`, hreflang = en, zh, x-default (+ native), robots index; no `returnTo=`
     in directory links;
   - native pages (all `/<l>/universities/<slug>` in `/sitemaps/<l>.xml`, e.g.
     `/fr/universities/epfl`): 200, index, hreflang includes the native locale;
   - old URLs (sample 50 across 31 locales): `/fr/universities/<non-native>` → 308
     `/universities/<slug>#ui=fr`; `/ja/changes/<slug>` → 301
     `https://eduaipolicy.org/changes/<slug>#ui=ja`; `/de` → 301 `/#ui=de`; `/es/contact?x=1`
     → 301 with the query kept; no `Set-Cookie`; `Cache-Control: public, max-age=86400,
     s-maxage=31536000`;
   - `/sitemap.xml`, `/sitemaps/core.xml` (no `/es|nl|ms|fr|pl/` static pages),
     `/sitemaps/<uiLocale>.xml` (native school pages only), `/sitemaps/zh.xml`; total ≈ the
     indexable count of §12 for production content; `/robots.txt` disallows only
     `/internal/analytics`;
   - `/ui-text/manifest.json` lists 31 locales; one `<locale>.<hash>.json` → 200, `immutable`;
   - `/api/public/v1/index.json`, one university JSON, `/llms.txt`, MCP `/healthz` (contentId):
     unchanged (they list no locale URLs);
   - browser (one worker): `/universities/<slug>#ui=ja` switches the interface, keeps claims and
     quotations in English, the switcher shows 日本語, "English" restores it; a topic-evidence
     popover fills its excerpts; no console errors.
4. `ledger` → `plan` → `cutover` (new HTML epoch) → `mcp` → `complete` (public readback, one
   worker). Then Cloudflare `purge_everything` (cached old-locale pages must go).
5. After cutover, from the host: `curl -sk --resolve eduaipolicy.org:443:127.0.0.1 -D-
   -o/dev/null https://eduaipolicy.org/universities/<slug>` MISS then HIT; with `?returnTo=x` HIT;
   with `-H 'X-UAPT-Refresh: 1'` BYPASS then HIT; through Cloudflare never BYPASS; an old
   `/fr/changes/<slug>` URL → 301 (from the store or Cloudflare on the second request).
6. Watch for 24 h: 5xx rate, `memory.current` (expect ≤ 3.5 GB), CPU, 301 share in the access
   log, GSC coverage (old locale URLs move to "Page with redirect").

Rollback: the lifecycle rollback to the previous program (it restores the routing files);
restore the R1 backup; Cloudflare purge. Browsers that already followed a 301 keep it up to a day
(`max-age=86400`); they land on the English page, which still exists.

**R3 – pre-rendered tree and short warm-up (later, separate go-ahead).** As before: create
`/srv/uapt/page-tree` (registered in the retention register), capture and `verify` the tree for
the candidate's build (offline or on the host), next program release with `--page-store
--page-tree /srv/uapt/page-tree`, `activate --build-id` right after `cutover`,
`UAPT_WARMUP_PAGE_TREE=1`. From then on content releases use `generation` + capture + `refresh`
(§6). Rollback: `deactivate`.

After each step: public readback with one worker, then the Cloudflare purge. Stop and roll back
if 5xx rise, memory exceeds 6 GB, or readback shows old content. IndexNow for the changed URLs and
a GSC sitemap resubmission stay separate authorizations.

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

- `/<uiLocale>/universities/<slug>` without native content is a 308 (a permanent redirect browsers
  may cache); if that school later gets native prose, readers who followed it earlier keep landing
  on the English page until their cache expires. Use 307 there if that matters more than
  consolidating the old URLs. Quote fill flattens the bidi isolation of right-to-left quotes in
  opened popovers (the claim card keeps it).
- The 301 for `/<uiLocale>/…` comes from Next's proxy and is then cached; nginx could answer it
  directly with one pattern location (school pages excluded) to save the first hit per URL.
- `zh-Hant` is a UI preference on the English page (its content would be Simplified Chinese on
  `/zh/`); revisit if Traditional Chinese readers should land on `/zh/` instead.
- The switcher adds `?layout=v6` to published V6 school links (`preservePolicyReferenceSearch`,
  pre-existing); the page store ignores the query, Cloudflare does not.
- Pre-existing test failures (same on the parent commit, not caused by this branch):
  `index-measurement-repair` (1), `index-recovery-pilot` (4), `public-change-history` (1, historical
  row reconstruction), `p1-change-crawl-perf` (release-diff cache source check), and
  `policy-reference-preview` (15).

## 10. Content-language URLs and UI locales (owner decision 2026-11-22)

**Evidence (from the requesting session, checked):** `/fr/universities/university-of-york` was
1.1 MB of HTML with English policy prose in a French interface, `noindex`, no hreflang; GSC
2026-10-22..11-20: 147 pages with impressions, 294 impressions, 2 clicks. My GSC page-level pull
(read-only) for the same window: the 80 non-en/zh pages with impressions (ms 47, fr 12, es 9,
pl 7, nl 5; 112 impressions, 1 click) are all changes pages or school pages in a language that is
not the school's own (e.g. `/ms/universities/columbia`, `/fr/universities/saarland-university`).
**Why ms had impressions:** before this change a base-tier school was indexed in fr/pl/es/nl/ms
whenever that was a "legacy UI locale" (`LEGACY_INDEX_LOCALES` = the seven supported locales),
even with English prose, and the localized changes pages were indexed in the seven locales; Google
kept those URLs. None of them is authored native-language content, so no genuinely authored
indexed page is lost.

**Model** (`apps/web/lib/content-locales.ts`):
- `CONTENT_LOCALES = en, zh`: every route; hreflang en/zh/x-default.
- Native-language hook (data-driven, nothing lists schools): `/<l>/universities/<slug>` stays a
  page when `universityReadingIndexLocales` includes `l`, i.e. the locale-index policy applies
  the language to the school **and** the content release has complete accepted display prose in
  it (`isNativeSchoolLocale`). The legacy-locale shortcut is gone (country languages need complete
  prose like every other locale). Local data: 57 native pages (fr 11, nl 8, pl 8, de 7, ja 5,
  ko 4, ms 4, sv 2, es 2, one each da/it/nb/pt/ru/zh-Hant) instead of 170 legacy-indexed ones.
  A school gets an indexable `/ms/` page as soon as its Malay prose is accepted and published.
- The other 31 reading locales are UI preferences.

**Old URLs:** `proxy.ts` answers `/<uiLocale>/<path>` with **301** to
`https://eduaipolicy.org/<path>?<query>#ui=<uiLocale>` (`Cache-Control: public, max-age=86400,
s-maxage=31536000`, no cookie). The fragment never reaches nginx or Cloudflare, so it adds no
cache-key variant and the 301 itself is cacheable (nginx stores it, Cloudflare caches it).
`/<uiLocale>/universities/<slug>` is decided by the page: a native page, or `permanentRedirect`
→ **308** (Next has no 301 for page redirects; search engines treat 308 like 301). An old link
with its own fragment (`#claims`) loses it on the redirect.

**UI in the browser** (`components/ui-locale-overlay.tsx`, `lib/ui-locale-preference.ts`,
`lib/ui-text-dictionary.ts`, `app/ui-text/[file]/route.ts`):
- the preference is in `localStorage` (`uapt-ui-locale`); `#ui=<l>` sets it and is removed from
  the address bar; `#ui=en` or choosing English/中文 clears it;
- `/ui-text/manifest.json` (`max-age=300`) names `/<l>.<sha256-16>.json` (`immutable`); pages never
  embed the hash, so a dictionary change touches no page; built once per content release in the
  process (memoized by contentId, so reading-package changes are picked up at the switch) and
  cached by nginx (generation key) and Cloudflare; unknown names are a cheap `no-store` 404;
- a dictionary is English source → translation from: the content release's accepted shared UI
  bundle (all entries), the source-controlled public-UI additions (31 locales), and for fr/pl/es/
  nl/ms also the surface/page/shell message files and the component copy modules; fr 2,934
  strings, 356 KB raw / 102 KB gzip (ja 110 KB, ar 113 KB gzip);
- applied after hydration (idle callback, ≤ 1.5 s): exact matches of whole text nodes and of
  `aria-label`/`title`/`placeholder`/`alt`; never text whose own element or parent is
  `data-i18n="preserve"`, anything under `translate="no"` or another `lang`, code/pre; an element
  whose only child was replaced gets `lang` and `dir` (RTL locales); the English original is kept
  and restored exactly; a MutationObserver re-applies after React updates;
- the language switcher offers all 33 languages: en/zh/native are links, the rest `#ui=` links;
  it shows the active UI language; in-page links never point at a UI-only prefix
  (`localizeHref`).
- Measured parity (local build, same content): `/ar` home and `/universities/university-of-toronto`
  in fr show the same headings as the old server-rendered `/ar` and `/fr/` pages (one fr heading
  uses another accepted translation); claims and quotations stay as authored. Before the page is
  hydrated the interface shows English for a moment.

**Everything that listed locale URLs:** hreflang (`getLocalizedAlternates`, school metadata) en/zh
(+ native); sitemaps (`zh` section for static and event pages, `/<uiLocale>` sections hold native
school pages only, core no longer lists es/nl/ms static pages); robots (the 26 `/<locale>/changes/`
disallows are removed so crawlers can follow the 301s); `switch.ts` ISR expiry and Cloudflare
lists (non-school routes in en/zh only; school pages keep every locale because a UI-locale school
URL is a native page or its redirect); `render-once.py urls/refresh` (changes pages en/zh, school
pages all locales); `validate:i18n` (UI-only locales are not link prefixes). The public API, MCP
and `llms.txt` list no locale URLs (checked). The three i18n message systems are unchanged and
`validate:i18n` passes.

## 11. Page weight

Measured on the local build (local content is older and lighter than production; York is 329 KB
here, 1.1 MB in production as `/fr/`):

| Page | Before (HTML / gzip / RSC in HTML / visible chars) | After |
|---|---|---|
| `/fr/universities/university-of-york` | 340 KB / 37 KB / 187 KB / 40,275 | gone: 308 to the English page |
| `/universities/university-of-toronto` | 915 KB / 106 KB / 492 KB / 186,979 | 850 KB / 101 KB / 460 KB / 146,599 |
| `/zh/universities/university-of-toronto` | 925 KB / 139 KB / 451 KB / 116,622 | 893 KB / 134 KB / 444 KB / 103,641 |
| `/universities/ghent-university` | 320 KB / 36 KB / 173 KB / 40,939 | 316 KB / 37 KB / 170 KB / 35,585 |

Where the bytes are (Toronto): the RSC payload inlined for hydration is the whole rendered tree
again (App Router: HTML + flight), so weight follows rendered text; 75 % of its long text was
duplicated. Topic-evidence popovers held 47 % of the visible text, the claim cards 18.5 %, the
student guide 15.5 %. Change made (`lib/evidence-dedup.ts`): the claim cards are the one full
copy of each quotation and claim text (always in the server HTML, so crawlers and no-JS readers
keep all evidence); topic-evidence popovers show a 120-character excerpt of a text a claim card
holds and fill the full text from that card when opened (`fillDeferredQuotes`, verified: 11 of 11
excerpts in a Toronto popover filled to the 612-character original). The 1.1 MB pages were the
UI-locale copies, which no longer exist.

Next lever (not done, needs its own change): load topic-evidence popover bodies on demand from a
per-school evidence fragment (`/universities/<slug>/evidence`, noindex, no-JS link), which would
remove most of the remaining 47 %; and the student guide (a client component) could take claim
ids instead of full evidence rows.

## 12. Phase 2 re-measured with the content-language set (this Mac, 2026-11-22)

| | Before (33 locales) | After (content languages) |
|---|---|---|
| School/changes URL space | ~27k school + changes in 33 locales | 815 × 2 school + 57 native + changes in en/zh; the rest are cached 301/308 |
| Indexable set (sitemap) | 3,968 URLs (3,326 school/changes + 642 other) | **3,385** (1,573 school + 1,625 changes + 187 other) |
| Full pre-render (6 Node processes) | 3,326 pages, 88 s, 457 CPU-s | **3,198 pages, 81 s, 444 CPU-s** |
| Tree size | 132 MB gzip (921 MB raw) | **126 MB gzip** (863 MB raw); production estimate 150–300 MB |
| Non-tree warm-up, 1 process | 642 URLs, 72 s | **187 URLs, 33 s** → host ≈ 2–4 min |
| Candidate warm-up without a tree | 23–43 min | ≈ 20–35 min (3,385 URLs) |
| Origin load | ~80 % of origin requests were the 32 locale prefixes (audit §3.3) | those become 301/308 answered from Cloudflare or nginx after the first hit; Node renders en/zh/native pages and store misses only. Estimate **≤ 0.1–0.2 core** steady |
| Web slot memory | 4.5 GB after warm-up | ≈ 3.0–3.5 GB; the 1 GiB ISR LRU now holds most en/zh pages (~1,700 school pages at ~0.5 MB HTML+RSC) |
| nginx store working set | — | ≈ 2–4 GB (en/zh/native documents + RSC + cached redirects), well under 6 GB |
| Per UI-locale reader | 1 page render per locale per URL (server) | one dictionary download (~100–115 KB gzip, cached a year) |

CPU and memory are estimates from these measurements and the audit's host figures; check them in
the 24 h after R2.

## 13. Coordination

- PR #49 (`full-project-audit`: scripts/, CI) is separate. This branch touches
  `scripts/content-release/switch.ts` (the `localized()` helper only), `scripts/validate-i18n.ts`
  (two link assertions), `scripts/nginx-minimal-routing.py`, `scripts/release/render-once.py`
  (new) and `package.json` (`test:render-once`). Expect small conflicts in `switch.ts` and
  `package.json` if #49 moves them; rebase onto #49 only when it lands.
- `docs/release-routing-policy.md` is historical (AGENTS.md); "one authoritative build" means one
  `program-build.yml` artifact released through the lifecycle controller (§8 R2).
