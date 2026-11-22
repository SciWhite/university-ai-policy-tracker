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
| S7 bundle | `pnpm content:bundle` | op dir + bundle SHA256 for the owner |
| S8 release | `content-release.py remote check/activate` (its `refresh` step: page-store `generation` + `refresh`, fallback `purge-html-cache`; check `receipts/refresh.json`), Cloudflare `purge_everything`, `content-release.py readback`, then `v6:readback` (public, 1 worker, each paced ≤ 5 requests/s, wait out 429), `v6:event complete`, `remote complete` | live release, receipts |
| S9 live check | ChatGPT check of the live pages → findings into the next batch (`update` mode only for high-severity findings) | `chatgpt-live-check.md` |

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
   English page (only content languages have URLs). Both wait out a 429 (`Retry-After`, 12–60 s),
   never follow redirects, and report a 5xx/524 even when a retry succeeded (`retriedAfter`).
4. `v6:event complete`, then `remote complete`.

OpenClaw enrollment of the new official sources is still the batch-3 script
pair (`openclaw-enrollment/`), not yet ported: it writes to the OpenClaw host
and needs its own review.

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
