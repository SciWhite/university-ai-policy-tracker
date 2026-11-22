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

## 2. Stages

`python3 scripts/v6-pipeline/status.py --workspace <dir> [--init]` shows where a
batch stands and names the next step. The `pnpm v6:*` scripts wrap each stage.

| Stage | Command | Output |
|---|---|---|
| S0 inputs (G0) | `status.py --init`; provide `<slug>/public.json` (live API record, 1 worker), `public-tools.json`, `historical-inventory.json` (private inventory revision) | workspace skeleton |
| S1a crawl | `v6:discover` (Crawl4AI venv in `UAPT_CRAWL4AI_PYTHON`) | `discovery/<abbr>.json` |
| S1b Firecrawl | `v6:firecrawl`, `v6:firecrawl-sources [--cap N]` | `firecrawl/<abbr>/leads.json` (candidates marked), `firecrawl-sources.tsv` |
| S1c ChatGPT audit | one chat per school with `prompts/CHATGPT-AUDIT.txt`; `save-clip.sh <ws> <abbr>`; `v6:chatgpt-sources` | `chatgpt-audit/<abbr>.json`, `chatgpt-sources.tsv` |
| S1d select + capture | `v6:select`, `v6:capture [rows.tsv]`, `v6:render-capture abbr:key` | `sources.tsv`, `captures/<abbr>/<key>.{json,body,txt}` |
| **G1 discovery** | `v6:gate discovery` | `gates/discovery.json` |
| S3 draft | research agent per school with `prompts/DRAFT-BRIEF.md` + `prompts/INPUT-SPEC.md`; `v6:build-view`, `v6:finalize` | `inputs/<abbr>.json`, `<slug>/view.json`, `selection.json` |
| **G3 locale** | `v6:gate locale` | `gates/locale.json` |
| S4 review | `v6:packets`; independent reviewer per school with `prompts/REVIEW-SPEC.md` until accept; optional `v6:chatgpt-brief` pre-release pass; `v6:receipts` | `<reviewDir>/*.json`, `independent-review.json` |
| S5 source metadata | `scripts/v6-source-metadata.py` (two runs + tie-break), `v6:check-meta` | `source-metadata/public-v6-source-metadata.json` |
| S6 assemble | `v6:assemble` (re-runs the Chinese gate on the assembled pages) | `<outDir>/runtime/releases/<contentId>` |
| S6 candidate | local preview, `v6:readback` (local), `v6:sync-basis`, `sync-proof.py materialize`, `v6:event candidate` | candidate sync package |
| S7 bundle | `pnpm content:bundle` | op dir + bundle SHA256 for the owner |
| S8 release | `content-release.py remote check/activate` (its `refresh` step: page-store `generation` + `refresh`, fallback `purge-html-cache`; check `receipts/refresh.json`), Cloudflare `purge_everything`, `content-release.py readback`, then `v6:readback` (public, 1 worker, each paced ≤ 5 requests/s, wait out 429), `v6:event complete`, `remote complete` | live release, receipts |
| S9 live check | ChatGPT check of the live pages → findings into the next batch (`update` mode only for high-severity findings) | `chatgpt-live-check.md` |

**S8 in detail (since 2026-11-22).**

1. `content-release.py remote check`, then `remote activate --bundle-sha256 <approved sha>`. The
   activate step ends with `refresh`: a new nginx content generation and a loopback refresh of the
   batch's changed URLs in the page store (en, zh, and the UI-locale school URLs the switch plan
   lists). Read `receipts/refresh.json`: `origin.mode` `page-store` is the normal case;
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
  has a capture receipt (any HTTP outcome; non-200 is a typed access gap) or a
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
