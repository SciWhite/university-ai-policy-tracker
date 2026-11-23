# Agent Notes

Binding rules, kept short. Read the doc for your task first (index at the end;
`docs/README.md` lists all current docs). `docs/HISTORY.md` lists removed docs;
do not revive them as guidance.

## Authority and review
- **Agent review only** (owner, 2026-11-18). There is no human review step; never
  wait for one. Any request for human or manual review, confirmation or sign-off
  means independent agent review: a different (preferably stronger) agent run
  checks the output against the source, the validators and quote/hash gates pass,
  and the decision is recorded with evidence. That decision resolves approval
  flags and held items. Anything unresolved stays held with a reason and a next action.
- `agent_reviewed` is publication-ready. Never assign `human_reviewed`; never
  claim human or institutional review in public copy.
- Push, merge, deploy, restart, cutover, Cloudflare/DNS changes and search
  notifications need the owner's go-ahead, asked once with a concrete plan. A
  request to publish authorizes that release with its cutover and purges (quote it in
  receipts). Docs, review and local-validation tasks authorize only their own scope.
- **IndexNow is opt-in.** Each submission needs its own authorization and comes after
  public readback (`pnpm indexnow:dry-run|latest --content-root <root>`).
- Secrets live only in `.env.agents.local` (GSC, Cloudflare tokens) and
  `.local/secrets/`, both gitignored. Never print, commit or log them. For GSC data,
  run `node scripts/gsc-query.mjs` (read-only).

## Evidence and synchronization
- Keep original quotations, scope, language fallbacks, gaps, Claim IDs and held
  decisions. Never relax the quote/hash gates or the validators. A quote match does not prove
  meaning or currency; a failed fetch does not prove a policy is absent.
- Languages: English, then Simplified Chinese, then the school's country language.
- Crawl, review and repair follow `docs/policy-evidence-integration-runbook.md`. Check
  the private inventory first (`scripts/policy-inventory-status.py`); a host without it
  records `inventory_not_available_on_host` and cannot complete an audit.
- Every task records a sync event, with evidence or an exclusion reason for each surface (API,
  tools, snapshots, MCP, search, sitemap). A policy change ships with that school's
  change/history/diff pages. **Sync contract 2.1.0**; unknown versions fail closed;
  legacy mutation scripts run only via `scripts/run-synchronized-policy-mutation.ts`.
- Private inventories and candidates never become production or public data.

## V6 schools and marks
- Schools go through `scripts/v6-pipeline/` with the V6 guide, templates and
  prompt. Use the shared composition; no per-school JSX/CSS, no pages rebuilt from screenshots.
  Each school or fingerprint gets its own review. V4/V5 code still backs V6: change it only
  via `docs/v4-v5-retirement-plan.md`.
- Marks: start at `docs/university-marks-current.md` and the main checkout's
  `.local/university-marks/current.json`. Verify hashes, keep every size and use limit,
  and record an agent review of source and licence before public use.

## Releases
Host `hermes-agent-prod` runs web in fixed slots 3101/3102 (check `systemctl
is-active`) and MCP on 3161.
- **Data only** → content release (`docs/content-release.md`): build, validate, 2.1.0
  event, `content:bundle`, then on the host `content-release.py check → activate →
  complete` and `classify-content-releases`. No build, no restart, no per-batch scripts.
- **Code, UI, schemas, UI copy** → program release (`docs/program-release.md`): an Actions
  build from a frozen SHA, then `uapt-program-release.py` install → candidate (warm-up)
  → static → capacity → routing → ledger → plan → cutover → mcp → complete.
- Zone packages, zone builds and OCI full builds are pre-R1 history.
- Never build on the server. The installed controller
  `/usr/local/libexec/uapt-release-lifecycle.py` owns the gates (capacity, disk,
  retention, sync, journal, recovery). No hand-run cutovers or routing edits, no old controllers,
  no per-school services.
- Order: fix blockers → preflight tools → build once → accept that artifact → cutover
  → public readback → complete → retire the old active. A source fix needs a new SHA;
  never patch `.next`. One candidate, with a deadline frozen at 8 h (build or static plan: 4 h).
  Restarts do not reset it. Unfinished transactions block the next release.
- Keep only active + previous accepted rollback + one bounded candidate. Packages carry
  only runtime files. Accept cold renders, not just warm hits.
- Memory: MemoryHigh = MemoryMax = 8 GiB per slot, heap 4608 MiB, no swap. Raise only with the owner.
- After a switch: `purge-html-cache`, then purge the whole Cloudflare zone (HTML is
  cached at the edge for 7 days), then do public readback.
- **Retention:** holds keep their first `heldSince`/`reviewBefore`/`nextAction`. A hold blocks
  after 14 days (7 if it started before 2026-11-21). Read `hold-status.json` (the early warning) first; `rescan`
  refreshes only a stale receipt. Delete only by exact allowlist, after a hash-verified off-server archive.
- Locales (owner, 2026-11-22/23; `docs/index-languages.md`, `docs/render-once.md` §10): whatever its tier, a
  school is indexed in English, in Simplified Chinese, and in **its own language** (the institution's,
  else its region's or country's: Université de Montréal → French) once its prose in that language is
  complete (limits, also for zh: the doc). Never index a page in a language its package or view does
  not cover. Moving a school to V6, or rewriting its page, must never drop an indexed language: run
  `pnpm content:index-locales --against <parent>` on every candidate. Other UI locales redirect to the
  English page with `#ui=<locale>`: no per-locale URLs, hreflang or sitemap entries for them.
- The render-once page store is installed (nginx 1.18: no `min_free`); until
  `content-release.py` calls `uapt-render-once.py generation` + `refresh`, a content switch keeps
  `purge-html-cache` + the Cloudflare purge.
- Local gates: `pnpm check`, the affected tests, `git diff --check`. Integrate on the latest
  main and never overwrite other sessions' uncommitted work.

## Read when
| Task | Doc |
|---|---|
| Release, gates, holds | `docs/content-release.md`, `docs/program-release.md`, `docs/release-lifecycle.md`, `docs/release-storage-policy.md` |
| V6 school | `docs/v6-pipeline.md`, `docs/policy-v6-integration-guide.md` |
| Crawl, OpenClaw | `docs/policy-evidence-integration-runbook.md`, `docs/maintenance-oci-runbook.md` |
| Data, citations | `docs/data-contract.md`, `docs/citation-policy.md` |
| Overview | `docs/architecture.md`, `docs/audit-20261121/REPORT.md` |
