# Stop-bleed set 2: nginx and Cloudflare (audit phase 0.2–0.5), 2026-11-21

Status: owner approved the whole set ("Approve all of set 2", 2026-11-21). **nginx part (0.2,
0.3, 0.5a) applied 21:38 UTC** — receipt `/srv/uapt/operations/stop-bleed-set2-20261121/RESULT-nginx.json`
(sha256 `3aef9f4e…`): `nginx -t` ok, one reload, workers at 65,536 open files, a `returnTo`
variant hits the plain page's cache entry, log lines end with `uc= ut= rt=`. **Cloudflare part applied 22:1x UTC** with the owner-created token
`uapt-eduaipolicy-edge-config` (`CLOUDFLARE_EDGE_CONFIG_TOKEN`) — receipt `RESULT-cloudflare.json`
(sha256 `514999cb…`), before/after rulesets in `cloudflare-before/` and `cloudflare-after/`:
WAF managed challenge for 43.172/16 + 43.173/16 (not verified bots); rate limit 60 requests /
10 s per IP on `/universities/` and `/changes/` paths → block 10 s; cache rule edge TTL 2 h →
7 days (expression unchanged); Smart Tiered Cache on. **Refused by the Free plan:** the
custom cache key (`returnTo` exclusion); those variants stay separate at the edge and are
merged at the nginx origin cache (0.5a). Checked: a school page MISS then HIT (`age 3`).
Measurement:
`scripts/release/origin-log-stats.py`; baseline `baseline-before-20261121T2138Z.json` in the
same directory. Source: audit report
`docs/audit-20261121/REPORT.md` §3.3, §6.4, §7 phase 0 (branch `claude/clever-shirley-462b54`).

## Baseline (measured before any change)

| Metric | 11-20 | 11-21 (to 20:29) | Source |
|---|---|---|---|
| Origin requests (after Cloudflare) | 314,735 | 263,687 | `uapt-access.log` |
| 504 | 19,256 | 26,308 | same |
| Requests from 43.172/16 + 43.173/16 | 50,166 | 36,825 | same |
| Requests with `returnTo` | 57,586 | 60,219 | same |
| `Too many open files` in `uapt-error.log` | — | 8,468 (whole day so far) | `grep -c` |

Measurement after the change: the same counts for the next full UTC day, plus, from the new
log fields, the nginx cache hit share (`uc=HIT|STALE|UPDATING`) and p50/p95 of `ut=` per
route family (`/<lang>/universities/*`, `/<lang>/changes/*`), written to
`/srv/uapt/operations/stop-bleed-set2-20261121/measure-<date>.json`.

## 0.2 nginx file descriptors

Cause: nginx workers run with a soft `nofile` of 1,024 while `worker_connections` is 4,096
(each proxied request needs two descriptors). When the upstream slows, connections pile up and
`socket() failed (24: Too many open files)` follows. The systemd hard limit is 524,288.

```diff
 # /etc/nginx/nginx.conf (main context; nginx is shared with the other sites on the host)
 worker_processes auto;
+worker_rlimit_nofile 65536;
```

## 0.3 Access log with cache status and timings

New file `/etc/nginx/conf.d/uapt-log-format.conf` = `infra/nginx/uapt-log-format.conf`
(combined format + `uc=$upstream_cache_status ut=$upstream_response_time rt=$request_time`,
appended at the end so existing `awk '$9'` parsing keeps working).

```diff
 # /etc/nginx/snippets/uapt-proxy-locations.conf line 29
-access_log /var/log/nginx/uapt-access.log;
+access_log /var/log/nginx/uapt-access.log uapt_timed;
```

## 0.5a nginx HTML cache key without `returnTo`

`returnTo` is read only by client components (`location.search`), so every `returnTo`
variant of a page has the same HTML. The map in `infra/nginx/uapt-html-cache.conf` strips it
from the key (8 cases checked: lone, first, middle, last param; `myreturnTo`/`notreturnTo`
untouched; `_rsc` kept).

```diff
 # /etc/nginx/conf.d/uapt-html-cache.conf: add the map $request_uri $uapt_html_cache_uri { ... }
 # /etc/nginx/snippets/uapt-proxy-locations.conf, location / :
-    proxy_cache_key "$uapt_html_cache_epoch|$scheme|$host|$request_uri|rsc=$http_rsc";
+    proxy_cache_key "$uapt_html_cache_epoch|$scheme|$host|$uapt_html_cache_uri|rsc=$http_rsc";
```

Pages without `returnTo` keep their exact key, so the existing cache stays valid. The generator
`scripts/nginx-minimal-routing.py` emits the new key, so a regenerated routing keeps it.

Rule note: `uapt-proxy-locations.conf` is a routing file of the release tooling, and AGENTS.md
says not to hand-edit routing outside the `routing` step. These two lines change no upstream,
port or location. They are a recorded, owner-approved exception with backup and receipt. The
next program release's `routing` step takes the file's hash at plan time, so there is no drift.

Checked: the full change passes `nginx -t` on a copy of `/etc/nginx` on the host (2026-11-21).

### Commands (0.2, 0.3, 0.5a together; one reload)

```bash
OP=/srv/uapt/operations/stop-bleed-set2-20261121; sudo mkdir -p $OP/backup
for f in /etc/nginx/nginx.conf /etc/nginx/conf.d/uapt-html-cache.conf /etc/nginx/snippets/uapt-proxy-locations.conf; do sudo cp -p $f $OP/backup/; done
sudo nginx -T > /dev/null && sudo sh -c "nginx -T > $OP/nginx-T.before.txt"
sudo sed -i 's/^worker_processes auto;$/worker_processes auto;\nworker_rlimit_nofile 65536;/' /etc/nginx/nginx.conf
sudo install -o root -g root -m 0644 ~/uapt-ops/stop-bleed-set2/uapt-log-format.conf /etc/nginx/conf.d/uapt-log-format.conf
sudo install -o root -g root -m 0644 ~/uapt-ops/stop-bleed-set2/uapt-html-cache.conf /etc/nginx/conf.d/uapt-html-cache.conf
S=/etc/nginx/snippets/uapt-proxy-locations.conf
sudo sed -i 's#^access_log /var/log/nginx/uapt-access.log;$#access_log /var/log/nginx/uapt-access.log uapt_timed;#' $S
sudo sed -i 's#|\$host|\$request_uri|rsc=\$http_rsc";#|$host|$uapt_html_cache_uri|rsc=$http_rsc";#' $S
grep -c 'uapt_html_cache_uri' $S; grep -c 'uapt_timed' $S                      # 1 and 1
sudo nginx -t && sudo systemctl reload nginx
for p in $(pgrep -f 'nginx: worker'); do grep 'Max open files' /proc/$p/limits; done | sort | uniq -c   # 65536
curl -sk -o /dev/null -w '%{http_code}\n' -H 'Host: eduaipolicy.org' 'https://127.0.0.1/universities/columbia?returnTo=%2Fx'
tail -1 /var/log/nginx/uapt-access.log                                         # ends with uc=… ut=… rt=…
```
Rollback: copy the three backups back, remove `conf.d/uapt-log-format.conf`, `nginx -t`,
reload. The log format change is not reversible in the old log lines (they stay combined).

## 0.4 and 0.5b Cloudflare (Free plan)

**Token.** `CLOUDFLARE_CACHE_PURGE_TOKEN` in `.env.agents.local` can only read the zone and
purge (checked read-only 2026-11-21: `/zones/<zone>` OK; rulesets, WAF, rate limit, cache
rules and Tiered Cache endpoints answer "Authentication error"). Do not widen it. Either:

- **Option 1 (I apply by API):** the owner creates a second token at
  dash.cloudflare.com → My Profile → API Tokens → Create Token → Custom token, name
  `eduaipolicy edge config`, Zone resources: Include → Specific zone → `eduaipolicy.org`,
  permissions: **Zone · Zone WAF · Edit**, **Zone · Cache Rules · Edit**, **Zone · Zone
  Settings · Edit**, **Zone · Zone · Read**; TTL optional. Save it in `.env.agents.local` as
  `CLOUDFLARE_EDGE_CONFIG_TOKEN=` (I never print it). Revoke it after the change if wanted.
- **Option 2 (the owner clicks):** the dashboard steps below, then I verify by response
  headers only.

**Rules** (each read back first; existing rules are kept and their JSON saved to `$OP/cloudflare-before-*.json`):

| # | Where | Rule |
|---|---|---|
| 0.4a | Security → WAF → Custom rules | "Challenge Tencent 43.172-173": `(ip.src in {43.172.0.0/16 43.173.0.0/16}) and not cf.client.bot` → **Managed Challenge** |
| 0.4b | Security → WAF → Rate limiting rules (Free: 1 rule, 10 s period, 10 s timeout, action Block) | "School/changes pages per IP": `(http.request.uri.path wildcard r"/*universities/*" or http.request.uri.path wildcard r"/*changes/*") and not cf.client.bot`; 60 requests / 10 s per IP → Block 10 s |
| 0.5b | Caching → Cache Rules → existing "Cache public HTML" | Edge TTL: override origin, **7 days** (was 2 h); browser TTL unchanged (respect origin `no-store`); cache key → query string → **exclude `returnTo`** |
| 0.5c | Caching → Tiered Cache | **Smart Tiered Caching Topology: on** |

If the Free plan refuses a field or action (cache-key query exclusion, the `cf.client.bot`
field in a rate limit, or a challenge action), I drop only that part, apply the rest and say
which. The nginx key normalization (0.5a) already removes the origin render cost of
`returnTo` variants.

**7-day edge TTL and content releases.** Every release must still purge: content releases
follow `docs/content-release.md` §5 (refresh → warm → origin purge → Cloudflare purge →
readback; today `purge_everything`), program cutovers purge the whole zone. With a 7-day TTL a
missed purge shows stale HTML for up to 7 days instead of 2 hours, so the content-release
docs make the purge a required step and the readback checks the live page after it.
Time-dependent text ("updated N days ago") ages on the edge for up to 7 days; known and
accepted in the audit.

**Verify:** `curl -sI` from outside on a school page twice (`cf-cache-status: HIT`,
`age` growing); a `returnTo` variant right after → HIT (if the key exclusion was accepted);
Security → Events shows challenges for 43.172/43.173; the next day's measurement above.

**Rollback:** disable/delete the two WAF rules; restore the cache rule from
`$OP/cloudflare-before-cache-rules.json` (edge TTL 2 h, no key change); Tiered Cache off.
