# eduaipolicy.org: incident inventory (read-only audit, compiled 2026-11-21)

> Note (2026-11-22): several `docs/` files cited below as evidence were removed from the tree; `docs/HISTORY.md` gives the commit that still has each one.

Sources: git history of worktree `clever-shirley-462b54` (HEAD b59ae274 = origin/main), unmerged branches
`claude/laughing-murdock-3c9e56` / `claude/modest-bun-549899`, `docs/` (116 entries), memory notes
(`~/.claude/projects/-Users-newvolume-Documents-university-ai-policy-tracker/memory/`), the three V6 batch
RESULT.md files under `/Users/newvolume/Documents/uapt-v6-source-metadata/.local/policy-v6/`, and the
sibling side-session notes. Nothing was modified, no host or public site was contacted.

Abbreviations: `B1` = `.../policy-v6/pilot-qs130-140-20261119/RESULT.md`, `B2` = `.../batch-qs145-155-20261120/RESULT.md`,
`B3` = `.../batch3-20261120/RESULT.md`, `SF` = `git show claude/laughing-murdock-3c9e56:docs/server-fixes-20261121.md`,
`MEM:psd` = memory `production-server-deploy.md`, `SN:` = side-session note.
"n/s" = time lost not stated in the source. Estimates are marked "est.".

Categories: data-volume | memory-caching | tooling-sprawl | duplicate-legacy-paths | manual-steps | gate-design |
translation-template-gaps | environment-drift | crawler-load | other

## 1. Incident table (newest first)

| # | Date | Incident | Evidence | Time lost / impact | Primary | Secondary |
|---|---|---|---|---|---|---|
| 1 | 2026-11-21 | Web slot 3101 (next-server, up 51 h) throttled at MemoryHigh 5.5 GiB with no swap (state D, memory.pressure full ~88 %); ~100 % of uncached requests 504 from 17:40 to 18:21, then the memcg OOM killer fired at MemoryMax and systemd restarted it. No /healthz, no watchdog. | SF §1 table; B3 L265-274 "Incident: origin web service stalled" | **41 min full origin outage** for uncached pages (cached HTML still served); then ~43 min warm-up | memory-caching | gate-design |
| 2 | 2026-11-21 | Root cause of the growth: each content switch adds ~0.4 GB that never returns (caches keyed by contentId stay until LRU eviction; LRU budgets count raw JSON bytes, not parsed objects). The killed process had served 6 switches. | SF §1 "What grows"; commit 51357bc7 (branch, not merged) | causes #1 and #4 | memory-caching | data-volume |
| 3 | 2026-11-20/21 | 504 surge: ~19,000 and ~26,000 504s per day (week before 300-800), in bursts; the slot is CPU-bound on about one core. Two Tencent Cloud /16 ranges sent ~85,000 uncached requests in 44 h. | SF §1 table and "Secondary" | ~45,000 504 responses over 2 days; crawler rate limiting not done | crawler-load | memory-caching |
| 4 | 2026-11-21 | Manual "Restart now" at 18:30:19 stopped the **new** process that systemd had already started 9 min earlier (it was mid warm-up; SIGTERM timed out, SIGKILL). Warm-up then took 2,581 s. | SF §1 table rows 18:21:18 and 18:30:19; SN:server-fixes-memory-holds.md | ~9 min of warm-up thrown away (est.) | manual-steps | memory-caching |
| 5 | 2026-11-21 | After the batch12-zh switch, memory rose 4.55 to 5.0 GB, memory.peak 5.98 GB (above MemoryHigh 5.90 GB): a repeat stall was close. Owner then authorised an 8 GiB slot budget. Not installed. | SN:server-fixes-memory-holds.md "Update 20:25"; commit 89c105ae (branch) | near-miss | memory-caching | gate-design |
| 6 | 2026-11-21 | Batch-3 activation refused at its first gate: `Retention receipt is stale` (checkedAt 2026-11-19 15:22, older than 24 h). Content releases never refresh checkedAt; only a program `complete` did. | B3 L172-181; commit 84081739 message | release blocked until an owner decision the same day (hours n/s) | gate-design | manual-steps |
| 7 | 2026-11-21 | Retention deadlock: the installed controller had no rescan action, and `record-retention` refuses a stale register. The only way out was a hand rewrite of `checkedAt`, which release-storage-policy.md says cannot clear the debt. A second stop and owner decision followed. | B3 L183-201, L217-225; MEM:psd "Retention receipt goes stale" | 2nd release stop; owner escalation | gate-design | manual-steps |
| 8 | 2026-11-21 | Overdue content hold `c-20261106-9schools-r1`: its block deadline (2026-11-13 07:30Z) had passed 8 days earlier. It was not in hold-clocks.json, and the controller did not enforce it on the 11-20 releases. | B3 L192-196, L208-216 | 8-day silent overdue; 198 MB archive + restore check needed | gate-design | data-volume |
| 9 | 2026-11-21 | 9 installed content releases are not in the retention register (it classifies only active/rollback). They become a latent block once content holds are enforced. | SF §2/§3D; SN:retention-rescan-controller.md "Follow-ups" | latent release block (14 days after classification) | gate-design | data-volume |
| 10 | 2026-11-21 | Production lifecycle controller installed from an unpushed, unmerged branch commit (84081739, sha 7e14b708) under an owner "if you think it is necessary" approval. Production no longer matches origin/main. | SN:retention-rescan-controller.md "INSTALLED 2026-11-21 18:38 UTC" | config drift until merged | environment-drift | gate-design |
| 11 | 2026-11-21 | Public readback after the purge: 2 × HTTP 524 (Cloudflare origin timeout on cold renders of Chalmers and Ghent). The batch12-zh warm pass also had 1 × 524. | B3 L232-234, L356-357 | readback rerun; pages warmed by hand | memory-caching | manual-steps |
| 12 | 2026-11-21 | /zh/ evidence rows (Do/Don't, 复核与申诉) rendered in English: the V6 input contract had no zh field and the pipeline never set `summaryZh`. Affected rows: pilot 79/79, batch 2 118/118. Found by the ChatGPT live check, not by a gate. | B3 L259-261, L277-281, L316-319, L324-359 | 2 extra releases (batch3-r2, batch12-zh), 197 rows, 3 Opus review rounds (r1: 2 blockers + 13 fixes) | translation-template-gaps | gate-design |
| 13 | 2026-11-21 | Batch-3 ChatGPT live check found 14 omissions/defects (York acceptable-assistance policy, Hokkaido appeal, MSU byline used as issuer, UB tools, Chalmers 404). Applied in a page-only r2 release. | B3 L247-306; batch3 chatgpt-live-check.md | 1 r2 release, 3 review rounds | other (source coverage) | translation-template-gaps |
| 14 | 2026-11-21 | First Cloudflare purge used the wrong environment variable name and was rejected with an auth error; nothing was purged. Retried. | B3 L355-356 | minutes (est.) | manual-steps | tooling-sprawl |
| 15 | 2026-11-21 | OpenClaw r2 remote wait loop never got a PID (pidfile write "Permission denied"). The leftover loop was killed by its exact PID. | B3 L312-315 | n/s | manual-steps | — |
| 16 | 2026-11-21 | Quote gate requires the Gregorian year in the quote, so Japanese era dates (令和7年 etc.) are dropped. Source cards cannot show metadata `fetch_failed` gaps. | B3 L133-135, L289-290 | 3 dates lost; code follow-up | gate-design | translation-template-gaps |
| 17 | 2026-11-21 | A batch-3 packets.ts change (per-claim scopes) was tried and reverted because the production loader requires a linked claim's topic scope. The data was reworked instead. | B3 L100-104 | extra review round | gate-design | other |
| 18 | 2026-11-19..21 | Batch pipeline lives outside the repo and is copied per batch (discover, capture, render_capture, select_sources, build_view, finalize, packets, receipts, assemble, sync_basis, `deploy*/host-release.py`), plus per-batch one-offs (assemble_update.ts, apply_zh.ts, diff_release.ts, which mislabelled 65 lines "UNEXPECTED"). | B3 L34-42, L334-339; `ls .../batch3-20261120` | 3 forks of the pipeline; fixes don't propagate (see #12, #22) | tooling-sprawl | duplicate-legacy-paths |
| 19 | 2026-11-21 | The independent review of the server fixes found 2 hold-clock bugs (a re-selected release got its expired clock back; the program gate adopted unclocked holds), a watchdog false-restart risk and a lost cooldown. | SF §2 last paragraph; commit 6465f379 | about 1 extra fix cycle; nothing installed | gate-design | tooling-sprawl |
| 20 | 2026-11-20 | Batch-2 first activation stopped at its pre-check: the live runtime endpoint timed out once (same days as the 504 surge in #3). | B2 "Release"; MEM:v6-pilot-pipeline "Host activation can time out once" | rerun | memory-caching | crawler-load |
| 21 | 2026-11-20 | Batch-2 omissions: 21+5 ChatGPT pre-release findings, then 17 more on the live pages (8 high) led to a page-only r2. Opus review needed 3-5 rounds (Cape Town 5). | B2 "Review", "ChatGPT check of the live pages"; batch-qs145 chatgpt-live-check.md | 1 r2 release | other (source coverage) | — |
| 22 | 2026-11-20 | Pilot r2 (page-only): the server's switch tool (old helper) expired nothing because only records are diffed. 14 tags and 136 locale paths were expired by hand before the purges. Batch 2 put the fix into its own copied `host-release.py`. | B1 "Update release" ("old helper reports record changes only"); B2 L46 | manual ISR expiry; stale pages risk | duplicate-legacy-paths | manual-steps |
| 23 | 2026-11-19/20 | Content switches run from a **copied helper** (`/srv/uapt/operations/content-priority-six-20261109/helper`, 4676487f tooling), not from git or the program artifact. After PR #47 a fresh helper must be built by `git archive`, but creating it early starts a 7-day hold clock. | MEM:psd "The content switch runs from a copied helper" | n/s; root of #22/#24 | duplicate-legacy-paths | environment-drift |
| 24 | 2026-11-19 | Source-metadata release `c-20261118-source-metadata` changed every V6 page with claims unchanged. The ISR entries were not expired, so pages warmed on the candidate kept serving the parent until a manual refresh POST. Fixed in ff3d8218, but only for that one data file. | commit ff3d8218 body; MEM:psd "A non-claim content change leaves stale ISR pages" | stale public pages for n/s | gate-design | memory-caching |
| 25 | 2026-11-19 | Program release d9f6b480: `pgrep -f "<cmd>"` inside `ssh '...'` matched its own command line, so the wait loop never ended. | MEM:psd "Waiting on host steps" | **17 h lost + expired candidate** | manual-steps | tooling-sprawl |
| 26 | 2026-11-19 | Expired retention holds (279a5081, bce1fefe, d7adac4c) blocked `plan`. Off-host archive, per-file restore check and register update were needed first. | MEM:psd "Expired retention holds block plan" | program release blocked until archived (n/s) | gate-design | data-volume |
| 27 | 2026-11-19 | Pilot ChatGPT live check: 3 omissions (UNC Code of Conduct, USTC thesis declaration, UNAM 2026 guides). They needed new captures and an r2. | B1 "ChatGPT check" and "Update release" | 1 r2 release | other (source coverage) | — |
| 28 | 2026-11-19..21 | Access gaps on target sites: Humboldt (Anubis), TU/e (Type-3 font PDF), King Saud (broken Arabic PDF), TU Berlin (403 even in a browser), Barcelona (16 Cloudflare challenges), MSU (28 Incapsula pages), Vienna (5 URLs 404). | B1 "Not published"; B2 "Not published"; B3 L69-77 | 4 schools held/dropped; thin pages | other | — |
| 29 | 2026-11-19 | The monthly registry test pinned 2026-09 and had failed on main since the October report. | commit ff3d8218 body | broken test on main for weeks (est.) | other | environment-drift |
| 30 | 2026-11-19 | The source-metadata script all three batches depend on (`scripts/v6-source-metadata.py`, "PR #48", commit fbd8e84e on `claude/v6-source-metadata-contract`) is not in origin/main. | `git merge-base --is-ancestor fbd8e84e origin/main` -> not ancestor; B1 "Source metadata" | drift | environment-drift | tooling-sprawl |
| 31 | 2026-11-17 | About 75 GB of `.local` run folders deleted. Hidden dependencies (marks provenance chain, georgia-tech bundle pointer, RESTORE scripts) had to be found and kept by hand. | MEM local-storage-cleanup-20261117.md | n/s; near-loss of current deps | data-volume | tooling-sprawl |
| 32 | 2026-11-09 / 11-18 | Approval friction: AGENTS.md had to be amended twice ("explicit publication request = release authorization"; "no human review anywhere") because agents stopped to wait for review or sign-off gates. | commit 87e14a0f; AGENTS.md "Review Policy"; MEM no-human-review-anywhere | n/s (stalls) | gate-design | manual-steps |
| 33 | 2026-11-07 | Candidate refused: PR #43 made the shared localized-metadata helper await searchParams on every page, so static zh university pages threw DYNAMIC_SERVER_USAGE (500). Live unaffected. | commit 3c6347b2 | 1 release attempt lost | other (code regression) | gate-design (caught) |
| 34 | 2026-11-07 | `/sources` exported both `metadata` and `generateMetadata`, so `next build` failed. | commit 017b2b1b | 1 build lost | other | — |
| 35 | 2026-11-07 | The verify-sync helper workspace lived inside the retired eea1eb21 release root. A fallback to `/srv/uapt/release-helper` was needed. | commit 68310277 | n/s | duplicate-legacy-paths | environment-drift |
| 36 | 2026-11-06 | Release d7adac4c: `complete` kept the retired root bce1fefe active because MCP still ran from it. The register was corrected by hand. | commit 89e7cbf2 body | manual register edit | manual-steps | gate-design |
| 37 | 2026-11-06 | First real use of the new program-release tooling found three bugs. The nginx test with `-p <copy>` broke `load_module`, so every routing stage was refused. `complete` failed with "Release helper unknown". The MCP trial's telemetry directory was root-owned, so the trial exited at start. | commits 59cd0c87, e78a5c3c, 0bd7fdef | n/s (each a stopped release step) | tooling-sprawl | environment-drift |
| 38 | 2026-11-06 | /changes crawl storm: release change pages took 30-127 s and 375 of 3,906 URLs timed out. Crawlers walked 26 noindex reading locales (6,160 of 15,953 requests/h). The release-diff cache held 8 of 40 diffs (thrash, HistoryCapacityError -> 500/499). The 256 MB page cache evicted its own warm-up. | commit 301386a6 body | 375 timeouts in one sweep; degraded /changes | crawler-load | memory-caching |
| 39 | 2026-11-05/06 | R1 launch (~3 h), R1 fixes (~50 min) and the dashboard release each took 1.5-2 h of hand-run steps. Time went to per-release glue scripts, two full 132-school readbacks, 40-80 min warm-up and hand edits to the retention register; one forgotten edit blocked a later release. | docs/program-release.md §7 L254-262, §7.2 L315-320 | **~5-6 h** of release time across 3 releases; 1 release blocked | manual-steps | tooling-sprawl |
| 40 | 2026-11-06 | The dashboard release was routed ~75 min before its own warm-up finished (4,852 s), so users got cold 60-110 s renders. | docs/program-release.md L317, L336-337 | ~75 min degraded latency | memory-caching | manual-steps |
| 41 | 2026-11-06 | Web slot memory raised to MemoryHigh 5.5 GiB / MemoryMax 6 GiB with a 2 GB Next page cache and heap 4,608 MiB. This set up the throttle-instead-of-kill behaviour in #1. | commit 9b3140f4; 7ea66d6e; MEM:psd "Earlier (2026-11-07)" | latent cause of #1 | memory-caching | gate-design |
| 42 | 2026-11-05 | No page is prerendered and the ISR cache is in memory, so every restart is cold. On the host, cold renders take 60-110 s (sitemaps, /reports), longer than the 60 s proxy timeout. `UAPT_WARMUP_ON_START` was added, costing about 40 min per start. | commit 66b15c57; docs/program-release.md L168-173 | 40-80 min warm-up per restart/release | memory-caching | data-volume |
| 43 | 2026-11-05 | Development seed placeholder pages (mit, harvard, stanford, oxford) were reachable in production as one-claim duplicate university pages. `/source-health` read data from the program directory. | commit 66b15c57 body | SEO duplicates, duration n/s | duplicate-legacy-paths | — |
| 44 | 2026-11-05 | The host's Python 3.10.12 tarfile `data` filter resolves links from the archive root, so it refused the valid Next standalone symlink and program artifact extraction failed. | commit fc6aa828 | n/s | environment-drift | — |
| 45 | 2026-11-05 | `/changes/<v6 revision>/<slug>` returned only a title: 22 indexed pages had no canonical, hreflang or description. | commit 78147778 | SEO; duration n/s | translation-template-gaps | duplicate-legacy-paths |
| 46 | 2026-11-04/05 | Nginx: the ~134k-line routing config took about a minute to reach the public site after a reload, and Cloudflare keep-alives hit old workers in that window. Proxy targets were hidden in shared include snippets. | MEM:psd "Traps seen (2026-11-04/05)" | readback flakiness, n/s | tooling-sprawl | duplicate-legacy-paths |
| 47 | 2026-11-04 | Hand-added nginx detail-routes snippet (`uapt-eea1eb21-detail-routes.conf`) outside the lifecycle controller. | docs/program-release.md L154-157 | manual config to reconcile | manual-steps | duplicate-legacy-paths |
| 48 | 2026-11-04 | R1 consolidation regressions: index coverage for base schools and the changes sitemap were lost, and V6 revision IDs lost their release diff pages under /changes. R1-c fixes followed. | commits 8096b60a, a6819736 | caught before launch; n/s | duplicate-legacy-paths | translation-template-gaps |
| 49 | 2026-11-03/04 | The lifecycle controller was installed on the host with an 8 h candidate window that was never committed; it was synced back a day later. | commit a5b07757 | 1 day of drift | environment-drift | — |
| 50 | 2026-10-28 | The disk audit exceeded the configured project limit before the multilingual release. An exact 4-item off-server archive and cleanup had to come first. | docs/multilingual-seo-geo-20261028.md L84-90 | release blocked until cleanup (n/s) | data-volume | gate-design |
| 51 | 2026-10-28 | Machine translation defects: untranslated tool-condition sentences, recommendations turned into obligations, a truncated Arabic JSON and a dropped `conditionally_allowed` literal. Concurrency was limited to 2 and false positives fixed. | docs/multilingual-seo-geo-20261028.md L110-128; commits d6b6e4c0, f6c28e07, 8c5b8557 | regeneration + review rounds | translation-template-gaps | — |
| 52 | 2026-10-26 | The index-measurement candidate timed out on the newly owned legacy diff path: every single-school lookup inflated the whole-cohort summary. Candidate discarded. | docs/index-measurement-release-20261026.md L40-47 | 1 candidate lost | data-volume | duplicate-legacy-paths |
| 53 | 2026-10-26 | MCP export dropped published V6 claims and needed a parity repair. During the Prisma 7 work, 2 baseline MCP failures turned up and the private inventory pointer failed its 7-day freshness check. | commit 95bc68fd; docs/prisma7-migration-20261026.md L5-10, L24 | n/s | duplicate-legacy-paths | gate-design |
| 54 | 2026-10-25 | 21 of 38 held items were past their 24 h review reminder, so the window was widened to 168 h (7 days) rather than resolved. | docs/retention-window-20261025-result.md | gate loosened; debt carried forward (#8, #26) | gate-design | data-volume |
| 55 | 2026-10-25 | 6 failed or superseded program dirs and 11 staging items archived (10.71 GiB freed). The derived restore sample first failed (stale PAX linkpath), and an unrelated AP Precalculus nginx change stopped the script. | docs/release-storage-20261025-result.md | n/s | data-volume | environment-drift |
| 56 | 2026-10-24 | 41 idle program directories had accumulated (27.25 GiB, 9.98 GiB archive). Disk/retention gates were introduced as a result. | docs/changes-v6-storage-20261024-result.md | n/s; disk at risk | data-volume | duplicate-legacy-paths |
| 57 | 2026-10-24 | Readback tooling: the server's Python HTTP client got 403 from the edge, and the first static curl used bad bracket URL encoding. Re-verified with Node, curl and a browser. | same doc, "原始失败记录" paragraph | rework | environment-drift | tooling-sprawl |
| 58 | 2026-10-19..22 | Repeated re-releases of the same cohorts: QS20-24 reached r6/r7 (UNSW, EPFL R6 fixes, stale `entity.summary` counts), QS23-24 r3, UQ/HKUST/Michigan r4. | commits e0425c20, 456ccebb, f179ff38, 461124d5, 49c494ee; docs/qs20-24-audit-followup-20261020.md L8 | ≥7 extra releases | other (data accuracy) | manual-steps |
| 59 | 2026-10-19 | 13 alias university identities (828 slugs -> 815 schools) created by the 2026-07 AI-tools batch. Dedup needed. | docs/local-v6-identity-dedup-20261019.md | n/s | duplicate-legacy-paths | data-volume |
| 60 | 2026-10-18 | Melbourne r2 and r3 on the same day. A separate SEO runtime repair fixed an API-root redirect cycle, broken localized share images and duplicate ETH sitemap URLs. | commits c594fc3e, dc0cd964, 3bae1439; docs/seo-runtime-repair-20261018.md | 3 releases | other | duplicate-legacy-paths |
| 61 | 2026-10-17 | Berkeley r2 and r3 on the same day. | commits a00af87d, 77dab37d, 6f3098de | 2 extra releases | other | — |
| 62 | 2026-10-17 | V6 runtime release: the first cutover failed the public semantic check and was auto-rolled back. The second run saw a stale first response during graceful reload and passed on retry. | docs/v6-runtime-release-20261017.md "回滚与故障记录" | 1 failed cutover | tooling-sprawl (nginx exact-path routing) | gate-design |
| 63 | 2026-10-16 | **Cornell r2 cutover: origin unreachable** (Cloudflare 522, SSH timed out at banner exchange, no completion receipt). This is the "2026-10-16 OOM incident": 31 resident app services (per-school/version Next+MCP), host memory around 50 %. Retirement brought it to 12. | docs/cornell-v6-r2-release-20261016.md L28; docs/release-lifecycle.md L3; docs/release-lifecycle-20261016-result.md | outage duration n/s; release blocked; lifecycle rework | memory-caching | duplicate-legacy-paths |
| 64 | 2026-10-16 | `/tools` and the QS directory were still served by the older main-service artifact (1,514 vs 1,603 records) while the shared zone served corrected detail records. | docs/cornell-v6-r2-release-20261016.md L18; docs/v6-directory-payload-fix-20261016.md L9-12 | wrong public counts, n/s | duplicate-legacy-paths | — |
| 65 | 2026-10-16 | Shards/caches: a cold MIT legacy-diff request took over 60 s; full-package JSON endpoints still allocate whole responses. | docs/v6-shards-cache-20261016.md L133-137 | n/s | memory-caching | data-volume |
| 66 | 2026-10-16 | Penn: the final browser gate caught a missing tools-module allowlist entry, forcing rebuild and repush. 3 historical tests still expect the superseded layout. Old-connection responses appeared after the reload. | docs/upenn-v6-release-20261016.md L278, L282-284 | 1 rebuild | other | tooling-sprawl |
| 67 | 2026-10-15 | The PKU V5 history page linked a diff JSON that returned 404 (handler only knew the legacy journal), and the 1,146-path route matrix did not include it. | docs/pku-v5-diff-fix-20261015.md L146, L162 | 1 repair release | duplicate-legacy-paths | gate-design |
| 68 | 2026-10-15 | PKU V5 candidate hit OCI disk pressure and an nginx large-response buffering failure. Build ownership and old-Git-alternate failures followed. | docs/pku-v5-release-20261014.md L223; docs/pku-v5-diff-fix-20261015.md L166 | candidate rerun | data-volume | environment-drift |
| 69 | 2026-10-15 | PKU V6 homepages: the cutover guard caught an incorrect prior-snippet path in the private deploy scripts. | docs/pku-v6-homepages-release-20261015.md L249 | replan | manual-steps | tooling-sprawl |
| 70 | 2026-10-14 | HKU candidate: the first OCI changes request timed out computing global history. r2 superseded by r3, and 7 mistakenly proposed routes removed. | docs/hku-v6-release-20261014.md L69-71 | 1 extra revision | data-volume | memory-caching |
| 71 | 2026-10-14 | NTU/Chicago r2 followed by another runtime re-release (fb76f882: actual change dates, duplicate RSS announcements). Chicago readback during an nginx reload got 4 old-worker responses. | docs/ntu-chicago-v6-release-20261014.md L37-41; docs/chicago-tools-release-20261014.md L89; commit fb76f882 | 2 extra releases | other | tooling-sprawl |
| 72 | 2026-10-14/15 | Direct local and OCI fetches blocked: UChicago tools table 403, Imperial HTML 403, NUS PDF returned HTML. | docs/chicago-tools-release-20261014.md L83; docs/imperial-v6-ux-20261015.md L11; docs/hku-v6-release-20261014.md L63 | evidence gaps | other | — |
| 73 | 2026-10-10/11 | Evidence-repair releases for MIT, Imperial, Stanford and Oxford. | commits 9881de1c, b466afa6, abe211bd, a94d7943 | 4 repair releases | other (data accuracy) | — |
| 74 | 2026-09-12/13 | Post-Aug-16 Google Search Console impression loss with unverified root cause. The generic description claimed a snapshot for ~804 schools that lack one. 828 × 6 locale alternates were declared but not localized. A local production build took ~25 min. | docs/google-index-recovery-p0-review.md L25, L239-262 | weeks of lost impressions (n/s) | translation-template-gaps | data-volume |
| 75 | 2026-07-27 | Build-on-server failure: the build on disk was newer than the running process, and Cloudflare was debugged first. | MEM:psd "Old build-on-server failure (2026-07-27)" | n/s | environment-drift | manual-steps |
| 76 | 2026-07-27 | L0 high-severity identity and citation-provenance findings (858 -> 828 universities), 16 non-verbatim snippets, P1 dead links (link-health release 014). | commits 0583075a, ac3c8f17; MEM l0-residual-findings | n/s | other (data quality) | duplicate-legacy-paths |
| 77 | 2026-06-13 | Vercel build breakage: 5 Prisma/typing/build fixes in one day, then production moved to OCI on 06-20. | commits 9396ab9d, 0fb3d9c8, e410cba8, c057c9f3, 70289474; 50465402 | ~1 day (est.) | environment-drift | — |
| 78 | 2026-05-10..19 | Early production route breakage on Vercel: API route module loading, search/widget/coverage rewrites, search index loading. | commits 21090aab, 27692085, 2ee8cf83, b3981b3d | n/s | environment-drift | — |
| 79 | 2026-11-21 (state) | Main checkout drift: local `main` stuck at 14b874c6 (2026-09-24), 291 commits behind origin/main, 139 dirty entries, 91 Finder " 2" duplicates, an untracked 14 KB stale copy of `scripts/uapt-release-lifecycle.py`. See §3. | §3 commands | risk of acting on stale code/docs | environment-drift | tooling-sprawl |

## 2. Per-category tally and impact

Row counts use the primary category (secondary in brackets).

| Category | Primary (secondary) | Measured / stated impact | Main rows |
|---|---|---|---|
| memory-caching | 10 (5) | **41 min full uncached outage** (11-21). ~45k 504s over 11-20/21. Origin unreachable at the 10-16 Cornell r2 cutover (duration not stated). ~75 min of cold 60-110 s renders after the 11-06 dashboard cutover. 40-80 min warm-up per restart/release. 524s on 2 of 3 batch readbacks. 1 batch activation timed out. | 1, 2, 5, 11, 20, 40, 41, 42, 63, 65 |
| gate-design | 11 (11) | Releases blocked: batch 3 twice (stale receipt, then no rescan path), program d9f6b480 (expired holds), multilingual release (disk). Gates loosened instead of fixed (24 h -> 168 h). Silent misses: 8-day overdue hold, 9 unregistered content releases, stale ISR after metadata-only changes, Japanese dates dropped, /zh/ English rows passed every gate. | 6, 7, 8, 9, 16, 24, 26, 32, 54 |
| manual-steps | 8 (8) | **17 h lost + expired candidate** (pgrep loop). ~5-6 h of hand-run R1-era releases. 1 release blocked by a forgotten register edit. 2 hand register corrections. 2 hand ISR expiries. Wrong CF variable. pidfile failure. Restart that killed a warming process. | 4, 14, 15, 22, 25, 36, 39, 47, 69 |
| duplicate-legacy-paths | 9 (9) | 31 resident services before 10-16 (now 9 legacy + fixed slots). Old main artifact served wrong directory counts. Old content helper copy did not expire page-only changes. Seed pages in production. Legacy diff path timeouts. MCP export parity loss. 13 alias identities. | 22, 23, 35, 43, 48, 53, 59, 64, 67 |
| data-volume | 7 (9) | 27.25 GiB + 10.71 GiB of stale program dirs on the host; ~75 GB of local run folders deleted 11-17. `.local` still 47 GB (main) + 38 GB (uapt-v6-source-metadata). Each content release ~116 MB / 20-22k files. Whole-cohort/global-history computations caused 3 candidate timeouts. | 31, 50, 52, 55, 56, 68, 70 |
| tooling-sprawl | 4 (11) | Batch pipeline forked 3× outside git. 21 release-related scripts plus ~100 package.json scripts. 4 superseded release methods still documented. ~134k-line nginx config before 11-06. 3 bugs on first use of the new release tool. | 18, 37, 46, 62 |
| translation-template-gaps | 4 (3) | 197 /zh/ rows shipped English (2 extra releases). 22 indexed pages missing canonical/hreflang. 828×6 untranslated alternates, plausibly tied to the GSC loss. MT defects needed regeneration. | 12, 45, 51, 74 |
| environment-drift | 9 (6) | Production controller ≠ origin/main. Source-metadata script unmerged. Main checkout 291 commits stale. Python 3.10 host vs local. Controller installed before commit. Vercel-era breakage. | 10, 30, 44, 49, 57, 75, 77, 78, 79 |
| crawler-load | 2 (1) | 375/3,906 timeouts (11-06). ~85k Tencent requests in 44 h, part of ~45k 504s. Public readback limited to 1 worker (2 concurrent -> nginx 503 on /api/public/v1, MEM:psd). | 3, 38 |
| other | 15 (1) | Source-coverage omissions forced an r2 in **3 of 3** V6 batches. Access gaps (4 schools held or dropped). ≥15 data-accuracy re-releases in Oct. Code regressions caught by gates (2). | 13, 21, 27, 28, 58, 60, 61, 73 |

Cross-cutting: the 11-21 outage (#1) chains through four categories. Memory limits were set without swap (memory-caching), there was no health watchdog (gate-design), and every content switch leaked (data-volume). The recovery restart was manual (manual-steps).

## 3. Environment drift: exact commands and numbers (read-only, run 2026-11-21)

Main checkout `M=/Users/newvolume/Documents/university-ai-policy-tracker`:

| Command | Result |
|---|---|
| `git -C $M log -1 --format='%h %ad %s' --date=short main` | `14b874c6 2026-09-24 fix(smoke): dynamically verify dateModified in pilot pages smoke test` |
| `git -C $M rev-parse --abbrev-ref HEAD` | `main` (the checked-out branch is the stale one) |
| `git -C $M log -1 --format='%h %ad' origin/main` | `b59ae274 2026-11-19` |
| `git -C $M rev-list --count main..origin/main` | **291** commits behind |
| `git -C $M status --porcelain \| wc -l` | **139** (99 untracked `??`, 40 modified `M`) |
| breakdown by top-level dir (`status --porcelain -z`, cut path, first segment) | docs 68, apps 24, scripts 20, tests 10, knowledge 3, and 1 each for supabase, pnpm-workspace.yaml, pnpm-lock.yaml, package.json, outputs, data, content, apush-official-materials, README.md, GOVERNANCE.md, DATA_DICTIONARY.md, CONTRIBUTING.md, Anonymous.docx, .workbuddy (foreign files: `apush-official-materials`, `Anonymous.docx`, `.workbuddy`) |
| dirty entries with " 2." in the path | 32 |
| `find $M -path '*/node_modules' -prune -o -path "$M/.git" -prune -o -name '* 2.*' -print \| wc -l` | **91** Finder duplicates (.local 56, docs 20, apps 13, tests 1, .playwright-mcp 1). 35 outside `.local`/`.claude` |
| `du -sh $M/.local` | **47 G** (96 top-level entries). `.local/uapt-release-archives` 597 M |
| `git -C $M status --porcelain scripts/uapt-release-lifecycle.py` | `?? scripts/uapt-release-lifecycle.py` (14,152 B, dated Oct 16): stale untracked copy of the production controller, whose repo version is 1,488 lines / 106,625 B |
| `git -C $M worktree list` | 9 worktrees: main, `uapt-policy-scene-batch`, `uapt-v6-source-metadata` (branch `claude/v6-source-metadata-contract` fbd8e84e, **not in origin/main**), 3 under `.claude/worktrees` (5.7 G), 3 inside `.local/` (georgia-tech, v6-five-publish, v6-source-metadata pilot) |
| `git -C $M branch \| wc -l` | 127 local branches |
| `du -sh /Users/newvolume/Documents/uapt-v6-source-metadata/.local` | 38 G (all three V6 batch workspaces live here, outside any checked-in path) |
| `du -sh ~/Documents/uapt-offhost-archive` | 12 G (the only off-host copy of archived server releases, on the laptop) |

Production vs repo:
- The installed `/usr/local/libexec/uapt-release-lifecycle.py` is sha 7e14b708… = commit 84081739 on the unmerged local branch
  `claude/modest-bun-549899` (SN:retention-rescan-controller.md). origin/main still has sha e6ef581f….
- `claude/laughing-murdock-3c9e56` holds 5 unmerged commits over origin/main (84081739, 51357bc7, d28a3a0e, 6465f379,
  89c105ae; 29 files, +2,123/-49). They contain the memory-leak fix, watchdog, hold enforcement and 8 GiB budget. Nothing is installed except
  the rescan action.
- The content switch helper on the host is a copy at `/srv/uapt/operations/content-priority-six-20261109/helper` (4676487f),
  and batch-specific copies of `host-release.py` live in each batch's `deploy*/` dir (MEM:psd; B2).
- The host runs Python 3.10.12 / glibc 2.35 (MEM:psd). Local tooling runs py3.15 / Node 26, and tests had to be run on both (#44, SF §2).

## 4. Counts

Commits per month (all 643 commits incl. merges; non-merge in brackets):

| 2026-05 | 06 | 07 | 08 | 09 | 10 | 11 (to 11-19 on main) |
|---|---|---|---|---|---|---|
| 209 (204) | 44 (44) | 63 (61) | 19 (17) | 18 (16) | 211 (194) | 79 (54) |

- Subjects starting with "fix" (case-insensitive): **108** of 643 (17 %). Strict conventional `fix(`/`fix:`: 92.
  Including subjects starting with or containing repair/restore/correct: 127.
  Fix commits by month: May 7, Jun 3, Jul 9, Aug 6, Sep 6, **Oct 59**, Nov 18. October = 55 % of all fixes.
- Revert/hotfix/rollback in subjects: 2 (rollbacks were done by nginx snapshot, not git revert).
- Docs describing a release, repair or result: **37** in `docs/` (35 by filename keyword
  release/repair/fix/result/rollout/recovery/followup/deployment/acceptance, excluding 13 runbooks/policies, plus
  imperial-v6-ux and mit-v6-student-guide-pilot). Add the 3 batch RESULT.md files outside the repo and
  `docs/server-fixes-20261121.md` on the unmerged branch.
- Follow-up releases after a first release (distinct r2+/repair IDs found):
  - Repo, Oct: cornell-v6-r2; berkeley-v6-r2, r3; melbourne-v6-r2, r3; v6-hku-20261014-r3 (r2 superseded); pku-v5-20261014-r3;
    v6-ntu-chicago-20261014-r2 (+ fb76f882 runtime re-release); qs23-24-v6-r3; qs20-24-v6-r6, r7; uq-hkust-michigan-v6-r4;
    qs51-70 repair-r3. That makes **13 IDs**, and the r6/r7/r4 numbering implies further unpublished/local rounds.
  - Nov program: R1 launch followed by the "R1 fixes" release the same night (03:27 UTC), then the dashboard release; candidate refused (3c6347b2).
  - Nov V6 content: c-20261120-v6-pilot10-r2, c-20261120-v6-batch-qs145-r2, c-20261121-v6-batch3-r2, c-20261121-v6-batch12-zh.
    **4**, so every V6 batch (3/3) needed a correction release within 24 h, plus one cross-batch backfill.
  - Total identified: **≥ 18 follow-up releases** (13 + R1 fixes + 4).
- Opus review rounds per V6 batch: pilot 3, batch 2 up to 5, batch 3 4 (+3 update rounds, +3 zh-backfill rounds).
- Release-related scripts in `scripts/`: 21 names matching release/publish/cutover/deploy/switch/promote. ~100 npm scripts in package.json.
