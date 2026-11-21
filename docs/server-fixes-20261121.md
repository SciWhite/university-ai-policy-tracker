# Server fixes after the V6 batch-3 release (2026-11-21)

Status: code, tests and docs on branch `claude/laughing-murdock-3c9e56`. **Nothing on the
host has been changed.** The production plan in §3 waits for the owner's go-ahead.

## 1. Web slot memory hang: findings

Host `hermes-agent-prod` (aarch64, 4 cores, 24 GB, **no swap**), slot
`uapt-mcp-v6-candidate` (127.0.0.1:3101). Read-only evidence:

| When (UTC) | Evidence | Source |
|---|---|---|
| 11-19 14:52 → 11-21 18:21 | Process up 51 h; six content switches in that time (pointer history) | journal, `pointer-history.jsonl` |
| 11-20, 11-21 | 504s: ~19,000 and ~26,000 a day (week before: 300–800 a day); bursts at 01, 07–16, 21 h on 11-20 and 03, 06, 08, 15–18 h on 11-21 | `/var/log/nginx/uapt-access.log*` |
| 11-21 17:40–18:21 | ~100 % of uncached requests 504 (1,938–2,735 per 10 min) | access log |
| 11-21 18:21:12 | `Memory cgroup out of memory: Killed process 2077489 (next-server) … anon-rss:6197720kB`; memcg usage = limit 6,291,456 kB, failcnt 139, `pgscan_direct` 347,649 | `journalctl -k` |
| 11-21 18:21:18 | systemd started a new process (`Restart=on-failure`) | unit journal |
| 11-21 18:30:19 | Manual restart: it stopped that **new** process 9 min into its warm-up (SIGTERM timed out, SIGKILL) | unit journal |
| 11-21 19:13 | Warm-up finished: 4,021 requests, 2,581 s | unit journal |
| 11-21 19:46–19:58 | Flat at 4.55 GB anonymous memory (memory.current 4.68 GB) | 60 s samples of the cgroup |
| 11-21 19:58:31 | Content switch to `c-20261121-v6-batch12-zh` (another session) | pointer history |
| 11-21 19:59–20:09 | Step to 5.0 GB, peaks 5.40 and **5.50 GB** (MemoryHigh = 5.90 GB) | samples |

Unit limits: `MemoryHigh=5905580032` (5.5 GiB), `MemoryMax=6442450944` (6 GiB),
`NODE_OPTIONS=--max-old-space-size=4608`, Next `cacheMaxMemorySize` 2 GiB,
`UAPT_WARMUP_ON_START=1`. The process uses ~95 % of one core steadily.

**Why it hung instead of restarting.** Without swap, `MemoryHigh` cannot reclaim anonymous
memory; once usage crosses it the kernel throttles the process in direct reclaim (D state,
memory.pressure full ~88 %). The process kept running too slowly to answer anything, for 41
minutes, until the memcg OOM killer fired at `MemoryMax`. `MemoryHigh` below the real
footprint turned "kill and restart in 5 s" into "41 minutes of 504".

**Why the footprint exceeded MemoryHigh.** Heap cap 4,608 MiB, yet 6.2 GB anonymous memory at
the kill, so ≥ 1.6 GB was off-heap (RSC Buffers of the 2 GiB ISR LRU, malloc arenas, code).
Heap cap + off-heap > MemoryHigh.

**What grows (root cause).** Content switches. Each switch adds ~0.4 GB that does not come
back: the in-process caches key their entries by `contentId` (`readContentJson`,
`contentScoped`, and the `BoundedAsyncCache`s for datasets, release diffs, change records and
monthly reports). After a switch the old release's entries can never be hit again but stay
until LRU eviction, and the LRU budgets count raw JSON bytes, several times smaller than the
parsed objects. Warm-up and the ISR cache explain the 4.5 GB base, not the growth.

Secondary: the slot is CPU-bound at ~1 core (single Node thread). Uncached crawler traffic
(two Tencent Cloud /16 ranges sent ~85,000 requests in 44 h) produces 504 bursts even without
memory pressure. Not changed here (follow-up).

## 2. Changes on this branch

| Area | Change | Tests |
|---|---|---|
| Root cause | A content switch drops the replaced release's cache entries (`registerContentKeyedCache`, `releasePreviousContent`); refresh `GET` reports `releasedOnSwitch` and `process.memoryUsage()` | `pnpm test:content-release` |
| Limits | `MemoryHigh = MemoryMax = 6 GiB`; candidate env gets `--max-old-space-size=4096` + `MALLOC_ARENA_MAX=2`, refuses a heap cap leaving < 2 GiB off-heap; ISR cache 2 → 1.5 GiB | `pnpm test:program-release` |
| Watchdog | `scripts/release/uapt-web-watchdog.py` + `infra/systemd/uapt-web-watchdog.{service,timer}`: probe the routed slot every 60 s, restart after 3 consecutive failures, never during a lifecycle transaction or 15 min start-up grace, ≤ 1 per 30 min and 3 per day, receipt with memory evidence | `tests/test_web_watchdog.py` |
| Holds | `retention`/gate enforce content-hold deadlines and clocks; `classify-content-releases`; `record-retention` cannot adopt a hold whose `heldSince` is later than on-disk evidence + 24 h; per-hold limits by start time (`holdLimitHistory`) | `ContentHoldEnforcementTests` |
| Early warning | `hold-status [--write]` (read-only, lock-free) + `infra/systemd/uapt-hold-status.{service,timer}` daily → `release-lifecycle/hold-status.json`; 48 h warning | same |
| 14 days | Docs + AGENTS.md: 336 h for holds that start after the policy change; older holds keep 168 h | — |
| Release traps | `scripts/content-release/warm-changed-pages.py` (warm changed pages over loopback before purge/readback); `scripts/release/remote-bg.sh` (pid/exit/log in `~/uapt-ops/<op>/`) | `tests/test_content_warmup.py` |

Simulated on copies of today's register, clocks, policy and pointer history: the new controller
passes `retention` with the installed policy; with the proposed policy it refuses until the 9
unregistered content releases are classified, then passes; `hold-status` flags all 9 as
`warning` 47 h before their 14-day deadline.

## 3. Production plan (needs the owner's go-ahead; one step at a time)

Preconditions for every step: `transaction.json` stage `complete`, no content or program
release running (the batch 1–2 Chinese fix session must have finished), files copied from
the reviewed commit to `~/uapt-ops/server-fixes-20261121/` and their SHA256 checked. Receipts
go to `/srv/uapt/operations/server-fixes-20261121/` (root). The SHA256 values are in the
receipt list of the hand-over message.

**A. Stop the throttle zone now (no restart).**
```bash
D=$(ls /etc/systemd/system/uapt-mcp-v6-candidate.service.d/*-uapt-program-release.conf)
sudo cp -p "$D" /srv/uapt/operations/server-fixes-20261121/dropin-before.conf
sudo sed -i 's/^MemoryHigh=5905580032$/MemoryHigh=6442450944/' "$D"
sudo systemctl daemon-reload
sudo systemctl set-property --runtime uapt-mcp-v6-candidate.service MemoryHigh=6442450944
cat /sys/fs/cgroup/system.slice/uapt-mcp-v6-candidate.service/memory.high   # 6442450944
systemctl show uapt-mcp-v6-candidate -p MainPID -p ActiveState               # same PID, active
```
Rollback: copy the backup back, `daemon-reload`, `set-property --runtime … MemoryHigh=5905580032`.
Effect: above 6 GiB the kernel kills the process and systemd restarts it within seconds (then
~40 min warm-up; nginx and Cloudflare keep serving cached HTML).

**B. Install the watchdog.**
```bash
cd ~/uapt-ops/server-fixes-20261121
sudo install -o root -g root -m 0755 uapt-web-watchdog.py /usr/local/libexec/uapt-web-watchdog.py
sudo install -o root -g root -m 0644 uapt-web-watchdog.service uapt-web-watchdog.timer /etc/systemd/system/
sudo systemctl daemon-reload
sudo /usr/local/libexec/uapt-web-watchdog.py --dry-run     # expect "action": "ok"
sudo systemctl enable --now uapt-web-watchdog.timer
systemctl list-timers uapt-web-watchdog.timer; sudo cat /run/uapt-web-watchdog/state.json
```
Rollback: `sudo systemctl disable --now uapt-web-watchdog.timer`, remove the two unit files
and the script, `daemon-reload` (receipts in `/srv/uapt/operations/web-watchdog/` stay).

**C. Reinstall the lifecycle controller and the program-release tool.**
```bash
sudo cp -p /usr/local/libexec/uapt-release-lifecycle.py /srv/uapt/operations/release-lifecycle/controller-before-holds-7e14b708.py
sudo cp -p /usr/local/libexec/uapt-program-release.py /srv/uapt/operations/server-fixes-20261121/program-release-before-5735585b.py
sudo install -o root -g root -m 0755 uapt-release-lifecycle.py /usr/local/libexec/uapt-release-lifecycle.py
sudo install -o root -g root -m 0755 program-release.py /usr/local/libexec/uapt-program-release.py
sha256sum /usr/local/libexec/uapt-release-lifecycle.py /usr/local/libexec/uapt-program-release.py   # = reviewed commit
sudo /usr/local/libexec/uapt-release-lifecycle.py retention        # must pass with the unchanged policy
sudo /usr/local/libexec/uapt-release-lifecycle.py hold-status      # read-only
```
Then write `holds-controller-install-<sha8>.json` (before/after SHA256, commit, time, the
owner's words). Rollback: copy both backups back. Without step C the next program release
would write `MemoryHigh` 5.5 GiB again.

**D. 14-day limit, content classification, daily early warning.**
```bash
T=$(date -u +%Y-%m-%dT%H:%M:%S+00:00); L=/srv/uapt/operations/release-lifecycle
sudo cp -p $L/policy.json $L/policy.json.before-hold-14d-$(date -u +%Y%m%dT%H%M%SZ)
sudo cp -p $L/hold-clocks.json $L/hold-clocks.json.before-classify-$(date -u +%Y%m%dT%H%M%SZ)
sudo python3 - "$T" <<'PY'
import json, sys; from pathlib import Path
p = Path('/srv/uapt/operations/release-lifecycle/policy.json'); d = json.loads(p.read_text()); g = d['retentionEnforcement']; t = sys.argv[1]
g['holdLimitHistory'] = [{'until': t, 'maxHoldHours': 168, 'blockAfterHours': 168}]
g.update(maxHoldHours=336, blockAfterHours=336, contentHoldsSince=t, holdLimitChangedAt=t,
         holdLimitAuthorization='<owner words, quoted>')
tmp = p.with_suffix('.json.tmp'); tmp.write_text(json.dumps(d, indent=2) + '\n'); tmp.replace(p)
PY
sudo /usr/local/libexec/uapt-release-lifecycle.py classify-content-releases --dry-run --reason "server fixes 2026-11-21: register installed content releases"
sudo /usr/local/libexec/uapt-release-lifecycle.py classify-content-releases --reason "server fixes 2026-11-21: register installed content releases"
sudo python3 -c "import json;from pathlib import Path;p=Path('$L/policy.json');d=json.loads(p.read_text());d['retentionEnforcement']['contentReleaseRoot']='/srv/uapt/content/runtime';t=p.with_suffix('.json.tmp');t.write_text(json.dumps(d,indent=2)+'\n');t.replace(p)"
sudo /usr/local/libexec/uapt-release-lifecycle.py retention
sudo install -o root -g root -m 0644 uapt-hold-status.service uapt-hold-status.timer /etc/systemd/system/
sudo systemctl daemon-reload && sudo systemctl enable --now uapt-hold-status.timer
sudo systemctl start uapt-hold-status.service && sudo cat $L/hold-status.json | head -40
```
Existing holds keep their clocks and their 7-day limit (`uapt-program-987cbda4201d…` still
blocks 2026-11-26 15:22 UTC). The 9 old content releases get first clocks at `T` and block 14
days later unless archived. Rollback: restore the policy, `current-retention.json.before-classify-*`
and `hold-clocks.json.before-classify-*` backups (only if nothing else wrote them since),
disable and remove the timer.

**Not in this plan (separate go-ahead):** push/merge of the branch; a program release of the
merged code (cache drop on switch, 1.5 GiB ISR cache, heap 4096 MiB, `MALLOC_ARENA_MAX=2`);
archiving the 9 old content releases; crawler rate limiting.
