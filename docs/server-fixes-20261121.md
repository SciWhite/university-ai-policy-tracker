# Server fixes after the V6 batch-3 release (2026-11-21)

Status: code, tests and docs on branch `claude/laughing-murdock-3c9e56` (not pushed). Plan §3
steps A–D **applied 2026-11-21 21:21–21:23 UTC** with the owner's go-ahead ("Yes, apply A–D";
memory budget 8 GiB). Receipts: §4.

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
| Limits | `MemoryHigh = MemoryMax = 8 GiB` (owner-authorized raise); candidate env keeps `--max-old-space-size=4608`, adds `MALLOC_ARENA_MAX=2`, refuses a heap cap leaving < 3 GiB off-heap; ISR cache 2 → 1.5 GiB | `pnpm test:program-release` |
| Watchdog | `scripts/release/uapt-web-watchdog.py` + `infra/systemd/uapt-web-watchdog.{service,timer}`: probe the routed slot every 60 s; restart after 3 consecutive failures with memory evidence or 10 without; never during a lifecycle transaction, while the release lock is held or before the warm-up finished; ≤ 1 per 30 min and 3 per day; receipt with memory evidence | `tests/test_web_watchdog.py` |
| Holds | `retention`/gate enforce content-hold deadlines and clocks; `classify-content-releases`; `record-retention` and the program gate cannot adopt a hold whose `heldSince` is later than on-disk evidence + 24 h; a content hold ends when its release is selected again (new hold after it leaves); per-hold limits by start time (`holdLimitHistory`, a raise without it is refused) | `ContentHoldEnforcementTests` |
| Early warning | `hold-status [--write]` (read-only, lock-free) + `infra/systemd/uapt-hold-status.{service,timer}` daily → `release-lifecycle/hold-status.json`; 48 h warning | same |
| 14 days | Docs + AGENTS.md: 336 h for holds that start after the policy change; older holds keep 168 h | — |
| Release traps | `scripts/content-release/warm-changed-pages.py` (warm changed pages over loopback before purge/readback); `scripts/release/remote-bg.sh` (pid/exit/log in `~/uapt-ops/<op>/`) | `tests/test_content_warmup.py` |

Simulated on copies of today's register, clocks, policy and pointer history: the new controller
passes `retention` with the installed policy; with the proposed policy it refuses until the 9
unregistered content releases are classified, then passes; `hold-status` flags all 9 as
`warning` 47 h before their 14-day deadline.

An independent review (Opus agent) of the first version found two hold-clock bugs (a
re-selected release came back with its old, expired clock; the program gate adopted
unclocked holds without evidence), a watchdog false-restart risk (grace shorter than the
warm-up; CPU saturation alone could restart) and a lost-cooldown case, plus plan-command
issues. All were fixed with tests on this branch.

## 3. Production plan (needs the owner's go-ahead; one step at a time)

Preconditions for every step: `transaction.json` stage `complete`, no content or program
release running (the batch 1–2 Chinese fix session must have finished), files copied from
the reviewed commit to `~/uapt-ops/server-fixes-20261121/` and their SHA256 checked. Receipts
go to `/srv/uapt/operations/server-fixes-20261121/` (root). The SHA256 values are in the
receipt list of the hand-over message.

**A. Stop the throttle zone and raise the slot to 8 GiB (no restart).** The owner authorized a
memory budget raise on 2026-11-21 (8 or 12 GiB, the coordinating session chose 8: two slots
coexist during a program release and 2 × 12 GiB does not fit 23.4 GiB without swap).
```bash
OP=/srv/uapt/operations/server-fixes-20261121; sudo mkdir -p $OP
D=$(ls /etc/systemd/system/uapt-mcp-v6-candidate.service.d/*-uapt-program-release.conf)
sudo cp -p "$D" $OP/dropin-before.conf
sudo sed -i -e 's/^MemoryHigh=5905580032$/MemoryHigh=8589934592/' -e 's/^MemoryMax=6442450944$/MemoryMax=8589934592/' "$D"
grep -x 'MemoryHigh=8589934592' "$D" && grep -x 'MemoryMax=8589934592' "$D"
sudo systemctl daemon-reload
cat /sys/fs/cgroup/system.slice/uapt-mcp-v6-candidate.service/memory.{high,max}   # 8589934592 twice
systemctl show uapt-mcp-v6-candidate -p MainPID -p ActiveState                   # same PID, active
# capacity policy: a candidate may use its slot limit
L=/srv/uapt/operations/release-lifecycle
sudo cp -p $L/policy.json $L/policy.json.before-memory-8g-$(date -u +%Y%m%dT%H%M%SZ)
# python edit (mode/owner kept): candidatePeakMaxBytes 4294967296 -> 8589934592, plus
# memoryBudgetChange {at, from, to, authorization (owner words), reason}; uaptPeakMaxBytes unchanged
sudo /usr/local/libexec/uapt-release-lifecycle.py audit > $OP/audit-after-memory.json
```
Only if `memory.high` still shows the old value after the reload:
`sudo systemctl set-property --runtime uapt-mcp-v6-candidate.service MemoryHigh=8589934592 MemoryMax=8589934592`
(runtime override under `/run/systemd/system.control/`, gone at reboot; record it).
Rollback: copy the drop-in and policy backups back, `daemon-reload` (remove a runtime
override if one was created). Effect: the process is killed and restarted at 8 GiB instead of
stalling at 5.5 GiB. Heap stays 4608 MiB; `MALLOC_ARENA_MAX=2` waits for the next restart
(program release).

**B. Install the watchdog.**
```bash
cd ~/uapt-ops/server-fixes-20261121
sudo install -o root -g root -m 0755 uapt-web-watchdog.py /usr/local/libexec/uapt-web-watchdog.py
sudo install -o root -g root -m 0644 uapt-web-watchdog.service uapt-web-watchdog.timer /etc/systemd/system/
sudo systemctl daemon-reload
sudo /usr/local/libexec/uapt-web-watchdog.py --dry-run     # expect "action": "ok"
sudo systemctl enable --now uapt-web-watchdog.timer
sleep 75; systemctl list-timers uapt-web-watchdog.timer; sudo cat /run/uapt-web-watchdog/state.json   # first run 60 s after enable
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
would write `MemoryHigh` 5.5 GiB / `MemoryMax` 6 GiB again.

**D. 14-day limit, content classification, daily early warning.**
```bash
T=$(date -u +%Y-%m-%dT%H:%M:%S+00:00); L=/srv/uapt/operations/release-lifecycle
sudo cp -p $L/policy.json $L/policy.json.before-hold-14d-$(date -u +%Y%m%dT%H%M%SZ)
sudo cp -p $L/hold-clocks.json $L/hold-clocks.json.before-classify-$(date -u +%Y%m%dT%H%M%SZ)
sudo python3 - "$T" <<'PY'
import json, os, sys; from pathlib import Path
p = Path('/srv/uapt/operations/release-lifecycle/policy.json'); d = json.loads(p.read_text()); g = d['retentionEnforcement']; t = sys.argv[1]
g['holdLimitHistory'] = [{'until': t, 'maxHoldHours': 168, 'blockAfterHours': 168}]
g.update(maxHoldHours=336, blockAfterHours=336, contentHoldsSince=t, holdLimitChangedAt=t,
         holdLimitAuthorization='<owner words, quoted>')
st = p.stat(); tmp = p.with_suffix('.json.tmp'); tmp.write_text(json.dumps(d, indent=2) + '\n')
os.chmod(tmp, st.st_mode & 0o7777); os.chown(tmp, st.st_uid, st.st_gid); tmp.replace(p)
PY
sudo /usr/local/libexec/uapt-release-lifecycle.py classify-content-releases --dry-run --reason "server fixes 2026-11-21: register installed content releases"
sudo /usr/local/libexec/uapt-release-lifecycle.py classify-content-releases --reason "server fixes 2026-11-21: register installed content releases"
sudo python3 -c "import json,os;from pathlib import Path;p=Path('$L/policy.json');st=p.stat();d=json.loads(p.read_text());d['retentionEnforcement']['contentReleaseRoot']='/srv/uapt/content/runtime';t=p.with_suffix('.json.tmp');t.write_text(json.dumps(d,indent=2)+'\n');os.chmod(t,st.st_mode&0o7777);os.chown(t,st.st_uid,st.st_gid);t.replace(p)"
ls -l $L/policy.json $L/policy.json.before-hold-14d-*                     # same mode and owner
sudo /usr/local/libexec/uapt-release-lifecycle.py retention
sudo install -o root -g root -m 0644 uapt-hold-status.service uapt-hold-status.timer /etc/systemd/system/
sudo systemctl daemon-reload && sudo systemctl enable --now uapt-hold-status.timer
sudo systemctl start uapt-hold-status.service && sudo cat $L/hold-status.json | head -40
```
From then on every content `complete` is followed by
`classify-content-releases --reason "complete <id>"` (the replaced rollback becomes a hold);
otherwise the next activation refuses it as unclassified. The batch helpers
(`host-release.py`) validate the register before installing the new release, so their own
hold is not affected; add the classify call to their `complete` phase.
Existing holds keep their clocks and their 7-day limit (`uapt-program-987cbda4201d…` still
blocks 2026-11-26 15:22 UTC). The 9 old content releases get first clocks at `T` and block 14
days later unless archived. Rollback: restore the policy, `current-retention.json.before-classify-*`
and `hold-clocks.json.before-classify-*` backups (only if nothing else wrote them since),
disable and remove the timer.

**Not in this plan (separate go-ahead):** push/merge of the branch; a program release of the
merged code (cache drop on switch, 1.5 GiB ISR cache, `MALLOC_ARENA_MAX=2`);
archiving the 9 old content releases; crawler rate limiting.

## 4. Applied 2026-11-21 (receipts)

Overall receipt `/srv/uapt/operations/server-fixes-20261121/RESULT.json` (sha256 `603b8367…`).

| Step | Result |
|---|---|
| A | 3101 `memory.high` = `memory.max` = 8,589,934,592 after `daemon-reload`, no restart (PID 3206567 kept, probe 200). Policy `candidatePeakMaxBytes` 4 → 8 GiB with `memoryBudgetChange` (owner's words); only these two keys changed. Backups `A-dropin-before.conf`, `policy.json.before-memory-8g-20261121T212121Z`. |
| B | `/usr/local/libexec/uapt-web-watchdog.py` (`975bc09a…`) + units; dry run `ok`; timer runs every 60 s, first runs `ok`. |
| C | Controller `7e14b708` → `bc4d3d18`, program-release `5735585b` → `b5a3ee20`; `retention` passed; receipt `release-lifecycle/holds-controller-install-bc4d3d18.json`. |
| D | `holdLimitHistory` until `2026-11-21T21:22:17Z` (168 h), 336 h after; `contentHoldsSince` same; 10 content releases classified (block 2026-12-05T21:22:17Z); `contentReleaseRoot` set; `retention` and `rescan --dry-run` passed; `uapt-hold-status.timer` daily 06:00 UTC, first run `ok` (11 holds, none overdue or warning). Backups `policy.json.before-hold-14d-…`, `hold-clocks.json.before-classify-…`, `current-retention.json.before-classify-…`. |

Not applied: `MALLOC_ARENA_MAX=2` (needs a restart; comes with the next program release), the
1.5 GiB cache and the cache drop on switch (program release), push/merge.

### Archiving the program hold `uapt-program-987cbda4201d-nn5iG9cQ0iY1hgfzTGAag` (not done)

It blocks releases from **2026-11-26 15:22 UTC** (heldSince 11-19 15:22, 7-day rule). 172 MB,
4,689 files; no unit, nginx snippet or running process references it (2026-11-21). Same route
as `c-20261106-9schools-r1`:

1. `sudo /usr/local/libexec/uapt-release-lifecycle.py rescan --dry-run --reason "archive 987cbda4"`
   and read its `references`: the root must appear in no unit, nginx, symlink or process.
2. On the host: `sudo tar -C /srv/uapt/releases -cpzf <op>/uapt-program-987cbda4.tar.gz uapt-program-987cbda4201d-nn5iG9cQ0iY1hgfzTGAag`,
   `sha256sum` it and write a per-file SHA256 manifest of the tree.
3. Copy off-host (`~/Documents/uapt-offhost-archive/program-987cbda4-<date>/` on the Mac),
   check the SHA256 there, extract into a temp directory and compare the manifest (isolated
   restore check).
4. Re-check references, then remove exactly that directory; write `deletion-receipt.json`
   (before/after disk, sha of the archive, manifest, removed path).
5. Add an `archivedOutsideServer` record (name, path, location, sha256, `removalReceipt` +
   `removalReceiptSha256`) and run `rescan --reason "archived 987cbda4"`, then `retention`.

The same steps apply to the 10 content holds before 2026-12-05 (link trees; objects are shared
and are not deleted).
