# V6 pipeline: crawl → draft → review → release (since 2026-11-21)

One versioned pipeline in `scripts/v6-pipeline/` replaces the per-batch script
copies under `.local/policy-v6/<batch>/` (112 copies in three batches; see
`docs/audit-20261121/REPORT.md`). It ports the batch-3 scripts, the superset of
the three batches. Review is agent-only (AGENTS.md); a release needs one owner
approval of the bundle (`docs/content-release.md` §5.1).

## 1. Workspace and `batch.json`

A batch is a workspace directory outside git (normally
`.local/policy-v6/<batchId>/`). It holds data and receipts only: inputs,
captures, discovery leads, drafts, reviews, gates, the release candidate. Every
script takes `--workspace <dir>` (or `UAPT_V6_WORKSPACE`) and reads
`<workspace>/batch.json`. Start from `scripts/v6-pipeline/batch.example.json`.

| Field | Meaning |
|---|---|
| `batchId`, `revision`, `contentId` | workspace id, V6 revision id, content release id |
| `mode` | `add` (new V6 schools) or `update` (page-only update of V6 schools; public claims unchanged) |
| `parentRelease` | a local release directory (`manifest.json` + `tree/`) equal to the live release |
| `schools[]` | `slug`, `rank`, `abbr`, `language`, optional `extraDomains` (parent bodies), `extraSources`, `firecrawl` {`domain`, `mapQuery`, `queries`} |
| `englishOnlySlugs` | must stay empty: English-only V6 is on the unmerged branch `codex/v6-english-first-20261117` |
| `discovery` | extra `keywords`, `contentPattern`, `multiPartSuffixes`, `extraPerSchool`, `parallelSchools` |
| `changeSummary` {`en`,`zh`}, `pageUpdate` | public change text of the release |
| `review` {`reviewer`,`method`} | written into the review receipts |
| `release` {`opId`,`authorization`,`continuity`,`pagesScope`,`policyScopeMeaning`,`notRequired`} | sync event text; `authorization` quotes the release request |
| `sourceMetadataFile`, `reviewDir`, `outDir`, `readback.controls` | paths and readback controls |
| `capture.workers` | capture worker count (default 12, 1–32); the 4 s same-host spacing is fixed |
| `run.timeoutMinutes`, `discovery.firecrawlCap` | per-stage timeouts of `v6:run` (discover 90, firecrawl 60, capture 240, render-capture 90); Firecrawl rows queued per school (25) |

## 2. Stages

`python3 scripts/v6-pipeline/status.py --workspace <dir> [--init]` shows where a
batch stands and names the next step. The `pnpm v6:*` scripts wrap each stage;
S1a, S1b, S1c's lead queueing, S1d and G1 run as one command, `v6:run` (§2.1).

| Stage | Command | Output |
|---|---|---|
| S0 inputs (G0) | `status.py --init`; provide `<slug>/public.json` (live API record, 1 worker), `public-tools.json`, `historical-inventory.json` (private inventory revision) | workspace skeleton |
| **S1–G1 (one command)** | `v6:run --workspace <ws>` runs S1a, S1b, S1d, the S1c queueing and G1 (§2.1) | `run/summary.json`, `gates/discovery.json` |
| S1a crawl | `v6:discover` (Crawl4AI venv in `UAPT_CRAWL4AI_PYTHON`) | `discovery/<abbr>.json` |
| S1b Firecrawl | `v6:firecrawl`, `v6:firecrawl-sources [--cap N]` | `firecrawl/<abbr>/leads.json` (candidates marked), `firecrawl-sources.tsv` |
| S1c ChatGPT audit | one chat per school with `prompts/CHATGPT-AUDIT.txt`; `save-clip.sh <ws> <abbr>`; then rerun `v6:run` (it runs `v6:chatgpt-sources` and captures the new rows) | `chatgpt-audit/<abbr>.json`, `chatgpt-sources.tsv` |
| S1d select + capture | `v6:select [--append]`, `v6:capture [rows.tsv ...]`, `v6:render-capture abbr:key` | `sources.tsv`, `captures/<abbr>/<key>.{json,body,txt}`, `logs/capture.jsonl` |
| **G1 discovery** | `v6:gate discovery` | `gates/discovery.json` |
| S3 draft | one Sonnet subagent per school with `prompts/DRAFT-BRIEF.md` + `prompts/INPUT-SPEC.md` (§2.2); `v6:build-view`, `v6:finalize` | `inputs/<abbr>.json`, `<slug>/view.json`, `selection.json` |
| **G3 locale** | `v6:gate locale` | `gates/locale.json` |
| S4 review | `v6:packets`; ChatGPT reviews each school with `prompts/REVIEW-SPEC.md` (from `v6:chatgpt-brief`), at most two rounds (§2.2); `v6:receipts` | `<reviewDir>/*.json`, `independent-review.json` |
| S5 source metadata | `scripts/v6-source-metadata.py` (two runs + tie-break), `v6:check-meta` | `source-metadata/public-v6-source-metadata.json` |
| S6 assemble | `v6:assemble` (re-runs the Chinese gate on the assembled pages) | `<outDir>/runtime/releases/<contentId>` |
| S6 candidate | local preview, `v6:readback` (local), `v6:sync-basis`, `sync-proof.py materialize`, `v6:event candidate` | candidate sync package |
| S6b index languages | `pnpm content:index-locales --out … --against <parent>` ([index-languages.md](index-languages.md)) | exit 0: no school loses an indexed language |
| S7 bundle | `pnpm content:bundle` | op dir + bundle SHA256 for the owner |
| S8 release | `content-release.py remote check/activate` (its `refresh` step: page-store `generation` + `refresh`, fallback `purge-html-cache`; check `receipts/refresh.json`), Cloudflare `purge_everything`, `content-release.py readback`, then `v6:readback` (public, 1 worker, each paced ≤ 5 requests/s, wait out 429), `v6:event complete`, `remote complete` | live release, receipts |
| **S8b OpenClaw enrollment** | after `remote complete`: `v6:openclaw-enroll --workspace <ws>` (plan: live API + read-only monitor state + payload), `… dry-run`, owner approves the payload SHA256, `… install --approve <sha> --authorization "<quote>"`, `… readback` (§2.4) | `openclaw/<contentId>/receipt.json`, `payload/coverage.json`, `host/*.json` |
| S9 live check | ChatGPT check of the live pages → findings into the next batch (`update` mode only for high-severity findings). A page-only `update` release that cites new sources runs S8b again under its own contentId (adds only the missing watches and bindings) | `chatgpt-live-check.md` |

### 2.1 S1–G1 in one command: `v6:run` (since 2026-11-22)

Batch 4's first turn took 179 agent turns of hand-driven stage calls, then sat idle for 1.5 h on a
detached capture that had died on one PDF. The mechanical stages now run as one foreground command:

```
pnpm v6:run --workspace <ws> [--until <stage>] [--skip <stage>[,<stage>]]
```

Stages, in order: 1 `discover` (schools without `discovery/<abbr>.json`) → 2 `firecrawl` (schools with
a `firecrawl` config and no `map.json`) → 3 `select` (`--append`) → 4 `firecrawl-sources` → 5
`chatgpt-sources` (only when `chatgpt-audit/<abbr>.json` exist; otherwise G1 reports the ChatGPT
layer missing) → 6 `capture` (every queue file, rows without a receipt) → 7 `render-capture` (challenge,
000, 401/403/406/429/503 rows without a render attempt) → 8 `g1` (`gates.py discovery`). Default `--until g1`.
A school with a typed gap in `discovery-gaps.json` is not crawled for that layer.

- **Run it as a harness background command** (the Bash tool's background mode, which reports when the
  process exits), never with `nohup`, `&`, `setsid` or a detached terminal. The driver never detaches;
  each tool runs in the foreground under a stage timeout (`run.timeoutMinutes`) and is killed when it
  hangs. One run per workspace at a time (`run/lock`).
- **Read only the summary.** stdout is one short JSON object (also `run/summary.json`): status of each
  stage, per-school counts (queued, pending, captured, access and text gaps, disposed, open G1 problems,
  missing layers), gaps, and `next`, the next manual step. Do not read raw captures, stage logs or
  `public-tools-full.json` to find out where the batch stands; open `gates/discovery.json` only for the
  leads to dispose. Stage output is in `run/stage-<n>/log.txt`, capture progress in `logs/capture.jsonl`.
- **Resume.** Every stage does only what is missing, and `select`, `firecrawl-sources` and
  `chatgpt-sources` only append (a key never changes its URL once queued). Each stage writes
  `run/stage-<n>/receipt.json`. After a crash, a fix or new ChatGPT audits, rerun the same command.
- **Exit codes.** 0: every stage that ran finished; a failing G1 is a normal outcome, `next` says what
  to do. 1: a stage failed (missing tool, no crawl or Firecrawl output, capture errors, timeout); later
  stages still ran, and `next` names the fix. 2: usage, `batch.json`, missing `public.json`, or the lock.
- **Capture never aborts on one source.** A `pdftotext` failure or timeout, an unreadable DOCX or a
  non-Word office archive keeps the receipt with `textError` {type, detail}: a typed text gap (G1 counts
  it as `textGap`), never evidence. Any other error leaves no receipt, so the rerun retries the row. A
  receipt whose URL differs from its row's URL is a key conflict: exit 1, nothing overwritten.
- Without a Crawl4AI interpreter (`UAPT_CRAWL4AI_PYTHON`) the render stage is skipped and its rows stay
  access gaps (listed in `gaps`); the crawl stage fails instead, unless the school has a crawl gap.

The manual steps between runs: S1c ChatGPT audits (`save-clip.sh`), dispositions and typed gaps.

### 2.2 Agent budget (owner, 2026-11-21)

- Mechanical stages: `v6:run`, one call per round, read the summary only.
- Drafting (S3): one Sonnet subagent per school, given the brief, the input spec and that school's
  capture list; the coordinating agent does not read captures itself.
- Review (S4): ChatGPT (online) reviews each school from the `v6:chatgpt-brief` file against
  `prompts/REVIEW-SPEC.md`, at most two rounds. Findings still open after round two stay held with a
  reason and a next action. Agent review only; never a human review step (AGENTS.md).

### 2.3 S8 in detail (since 2026-11-22)


1. `content-release.py remote check`, then `remote activate --bundle-sha256 <approved sha>`. The
   activate step ends with `refresh`: a new nginx content generation and a loopback refresh of the
   batch's changed URLs in the page store (en and zh; every UI-locale URL of the batch's schools,
   since record, reading or V6 page data can make a native page appear or turn into a 308; other
   UI-locale school URLs are probed and re-rendered only when the store holds a native page). Read `receipts/refresh.json`: `origin.mode` `page-store` is the normal case;
   `epoch-purge-fallback` means `generation` or `refresh` failed and the whole origin store was
   purged instead (`fallbackReason`; record it in the batch notes, the release is still correct).
2. Cloudflare `purge_everything` (token in `.env.agents.local`; covered by the release request).
3. Public readback, paced at ≤ 5 requests/s because Cloudflare blocks an IP for 10 s after 60
   requests in 10 s on `*/universities/*` and `*/changes/*`:
   `python3 scripts/release/content-release.py readback --op-dir <local op dir>` (changed URLs,
   content languages, a UI-locale sample) and `pnpm v6:readback --workspace <ws> https://eduaipolicy.org …`
   (Claim IDs, source metadata, V6 layout), one after the other (each paces only itself).
   `v6:readback` checks fr/es/de for four schools: each must be a native V6 page or a 308 to the
   English page (only content languages have URLs). A page must render as many metadata blocks
   as it shows documented source cards; a page of a school with metadata documents must show a documented
   card, unless every displayed card is a `fetch_failed` gap (`fetchFailedSourceCards`; 0 blocks
   is then exact, e.g. Wuhan University 2026-11-22). Both wait out a 429 (`Retry-After`, 12–60 s),
   never follow redirects, and report a 5xx/524 even when a retry succeeded (`retriedAfter`).
4. `v6:event complete`, then `remote complete`.
5. OpenClaw enrollment (S8b, §2.4).

### 2.4 S8b OpenClaw enrollment: `v6:openclaw-enroll` (since 2026-11-22)

Every released batch adds its schools' sources to the OpenClaw source monitor (changedetection.io on the
OCI host, `/home/openclaw/.local/share/uapt-monitor`). Until batch 3 this was a per-batch copy of
`build.py`/`install.py`/`dry_run.py`/`readback.py` (`.local/policy-v6/<batch>/openclaw-enrollment*/`);
`scripts/v6-pipeline/openclaw_enroll.py` (operator machine) and `openclaw_install.py` (host) replace
them with the same rules. Regression: on batch 3's frozen monitor state the port rebuilds the 2026-11-21
enrollment (1,663 → 2,009 watches, same source IDs, intervals, bindings and skipped URLs; the York PDF →
Google Docs change of r2 aside) and the r2 follow-up (2,010, byte-for-byte the same sources and York status).

```
pnpm v6:openclaw-enroll --workspace <ws>            # plan (default)
pnpm v6:openclaw-enroll --workspace <ws> dry-run
pnpm v6:openclaw-enroll --workspace <ws> install --approve <payload-manifest sha256> --authorization "<owner quote>"
pnpm v6:openclaw-enroll --workspace <ws> readback
pnpm v6:openclaw-enroll --workspace <ws> status     # local receipt only
```

- **Only after the release is live.** `plan` reads each school's public API record (1 request per school,
  ≤ 5/s, 429 waited out) and refuses unless `recordRevision.universityRevisionId` is the batch `revision`.
  These bytes become the baseline of a new school group.
- **Host access is read-only except `install`.** `plan` tars the monitor state (`sources.json`,
  `watch-bindings.json`, `source-resolutions.json`, `fetch-policy.json`, `monitor_control.py`,
  `monitor_noise.py`, existing baselines of the batch's schools) into `parent/`; `dry-run` runs the
  installer from a temporary copy that is removed afterwards and only GETs the monitor API; `readback`
  only GETs. SSH: `OPENCLAW_HOST`, `OPENCLAW_USER`, `OPENCLAW_SSH_KEY` from the environment, `--env-file`
  or `.env.agents.local` (only these keys are read; never printed). Commands run as `openclaw` via `sudo -n`.
- **What is watched** (per school): public claim evidence URLs, `officialSources` and the V6 bundle sources.
  A URL gets a watch or a binding only with an HTTP 200 capture in `captures/`. Not watched, listed in
  `coverage.json` `skippedUrls` with the reason: non-200 or challenge captures, browser-rendered captures
  whose plain HTTP answer is not 200 (`rendered_only_plain_http_*`; a watch would only make access-gap
  packages), eduaipolicy.org (`self_site`), URLs settled in `source-resolutions.json` (relocations map to
  their replacement watch; retired probes and paused self-site URLs are never revived) and ten-day
  control URLs. Cited URLs get 3-day watches, official-only ones 7 days; `html_requests`, script/style/
  nav/footer removed, per-school muted tags, created paused and muted, journaled, then unpaused (the
  native scheduler makes the first check). Monitor noise rules (2026-11-06) stay as they are.
- **Claims.** Every live public Claim ID of the batch must end up bound to a watched source. If its only
  source is not watchable, `plan` refuses until `batch.json` `openclaw.unboundClaims` `{claimId: reason}`
  holds it (listed in `coverage.json` `unboundClaims`).
- **Additive and idempotent.** New schools become new groups; a school already in the monitor (local
  candidate, or an earlier release for `update` mode) gets only the status fields (`publishedContentId`,
  `localViewRevision` and its history, `sourcePublishedV6`, `candidateOnly`) and its existing baseline must
  equal the live data (a baseline refresh is separate monitor maintenance). An already watched URL gains a
  binding only when this school/source/Claim binding is missing. Existing URLs, metadata, bindings,
  pauses, intervals, ten-day controls, baselines and `fetch-policy.json` never change (the installer
  refuses otherwise and checks them again after install). Rerunning `plan` after `install` (with
  `--refresh-parent`) gives `nothing_to_enroll`; a second `install` reports `already_installed`.
- **One approval.** The payload is deterministic; the owner approves `payloadManifestSha256` once (a host
  write: AGENTS.md go-ahead rule) and `install` refuses other bytes, a payload without a passed dry-run, and
  a host whose state moved since `plan` (`Concurrent state change`: run `plan --refresh-parent` again). It
  stages the payload in `<monitor>/enrollment-<contentId>/` (new or byte-identical), takes the collect and
  review locks, and writes `before.json`, `creation-journal.json` and `installed.json` there (copied to
  `host/`). A journal without `installed.json` means a partial install: recover from the journal by hand.
- **Receipts.** `<ws>/openclaw/<contentId>/receipt.json` (`uapt-v6-openclaw-enrollment-receipt-v1`) records
  each step with time, status, next action, payload SHA256 and the quoted authorization.
- **After readback.** Record the counts in the batch `RESULT.md` and in the OpenClaw notes
  (`~/Documents/OpenClaw/docs/UAPT_DEDICATED_MONITOR_20261025.md`, `AGENTS.md`). The enrollment never
  approves a policy, a package or a publication (`publicationApproved` stays false).

## 3. Gates

Each gate writes `gates/<name>.json` with `status`, per-school counts, failures,
`nextAction` and `inputsSha256`. The next stage refuses unless the gate passed
on exactly the current inputs.

**G1 discovery complete before drafting.** Per school:

- all three layers (Crawl4AI crawl, Firecrawl leads, ChatGPT audit) are done, or
  each missing layer has a typed gap in `discovery-gaps.json`;
- every official URL a layer named (ChatGPT documents, omissions, topic
  documents, tools on the school's official domains; every Firecrawl candidate)
  has a capture receipt (any HTTP outcome; non-200 is a typed access gap, a 200
  with `textError` a typed text gap) or a
  disposition in `discovery-dispositions.json`
  (`covered | not_material | duplicate | out_of_scope | superseded` + note;
  a key ending in `*` covers a URL prefix);
- every row queued in `sources.tsv`, `chatgpt-sources.tsv`,
  `firecrawl-sources.tsv` or `extra-sources.tsv` has a receipt.

`build_view.py` refuses until G1 passes on the current captures. A new capture
after the gate changes the hash and forces a rerun. The only override is
`UAPT_V6_DRAFT_WITHOUT_DISCOVERY_GATE="<reason>"`, recorded in each school's
`audit.json`.

**G3 Chinese on every shown row.** For every school not in `englishOnlySlugs`:

- the input's `zh` block: hero, nine topics (label, summary, scope), every Do/Don't,
  every tool, and `zh.claims` for every ref used in Do/Don't/procedures;
- the built `view.json`: topic labels, status labels, summaries and scopes; hero
  title and scope; every Do/Don't; `summaryZh` on every evidence row linked from
  Do/Don't/procedures; tool display copy.

`packets.ts`, `receipts.py` and `assemble.ts` refuse without it, and
`assemble.ts` checks the assembled zh pages again (`locale-gate.ts`). To audit
any release: `pnpm v6:zh-gate <release-dir> [slug ...]`.
The release audit also counts the approved zh reading-translation package (`translations/current.json`,
hash- and record-checked, with pinned record deltas), as the site does for the 132 older V6 schools, and
reports `coveredOnlyByReadingPackage`; `--no-reading-package` gives the strict count. Rows the page never
renders (the hero of `v6_presentation_integration` pages, tools without any description/access/cost text)
are not counted; `historical_discovery` tool lists are checked on their own record text. `assemble.ts`
passes no package, so a new school must carry its own Chinese. Check of the 1,526 phase-1 rows:
`docs/audit-20261121/ZH-COVERAGE.md`.

The country-language check is not automated yet: V6 inputs carry en and zh,
while the 33 reading locales come from the translation pipeline
(`content-release.md` §12.4).

## 4. What a batch no longer does

- Copy scripts into the workspace, or edit constants in them.
- Write a `host-release.py` (use `content-release.py`, §5.1 of content-release.md).
- Expire ISR paths by hand for page-only updates (the bundle carries `isr-expiry-request.json`).
- Copy 1.16 GB sync proofs (`sync-proof.py`).
- Refresh the retention receipt by hand (`complete` runs the governed `rescan`).
- Wait on host jobs with `pgrep -f` (`content-release.py remote` waits on the exact PID).
- Drive S1 stage by stage, or launch a capture with `nohup`/`&` and poll it (`v6:run`, §2.1).
- Copy `openclaw-enrollment/` scripts into the workspace or edit their constants (`v6:openclaw-enroll`, §2.4).
