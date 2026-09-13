# P0 Google index recovery — release readiness

Prepared 2026-09-13 for final Codex review. This document decides commit scope,
records the verified release path, and defines deploy-day checks and rollback.

**State: not staged, not committed, not pushed, not deployed. D0 = 待部署.**
No PR, no deployment, no service restart, no production config or data change,
no Google re-index request and no scheduled task was created in this pass. No
product code was modified; the only files written were this report, the
`docs/google-index-recovery-p0-evidence/` copies, and the evidence-link updates
described in section 4.

## 1. Current source vs the accepted candidate

Recorded state:

| Item | Value |
| --- | --- |
| HEAD | `900ddd54888603abf1ba74600ebc3281b9df2757` |
| `origin/main` | `900ddd54888603abf1ba74600ebc3281b9df2757` (identical — no unpushed commits) |
| Branch | `main` |
| Working tree | 9 tracked modifications; 31 pre-existing untracked files (19 `git status` entries, since it collapses directories). See section 2. |
| `apps/web/.next/BUILD_ID` | `ZE2EotqUV9aYNm4ymToNc` — still the build the acceptance report names |

Fingerprint comparison against
[source-sha256.json](./google-index-recovery-p0-evidence/source-sha256.json):
**7 of 7 match**, so no accepted file changed after verification.

| Path | Result |
| --- | --- |
| `apps/web/lib/index-recovery-pilot.ts` | match |
| `apps/web/lib/index-recovery-basis.ts` | match |
| `apps/web/lib/index-recovery-dates.ts` | match |
| `apps/web/lib/sitemap-sections.ts` | match |
| `apps/web/app/(default)/universities/[slug]/page.tsx` | match |
| `tests/index-recovery-pilot.test.ts` | match |
| `apps/web/.runtime-data/data/public-releases/current.json` | match |

Re-run in this pass on the current tree, all passing:

- `pnpm test:index-recovery-pilot` — 14/14.
- Existing snapshot suites (`policy-snapshot`, `policy-snapshot-independent-review`,
  `student-policy-snapshot`, with `--tsconfig apps/web/tsconfig.json`) — 16/16.
  Combined 30/30, matching the acceptance report.
- `pnpm --filter @uapt/web typecheck` — exit 0.
- `git diff --check` — clean.

**Conclusion: the candidate has not drifted.** The acceptance evidence still
describes exactly this tree, and no accepted item needs re-verification because
of a later edit.

Retained limitation (unchanged from the acceptance report): the baseline ran
`next dev --webpack` on port 3108 while the candidate ran the production build
on port 3107. That is a same-data rendered-UI comparison, not a comparison of
two production build pipelines and not a performance benchmark. Local acceptance
is not deployment and is not Google index recovery.

Two things the local `.next/BUILD_ID` does **not** prove: it is gitignored and
local-only, so it says nothing about the OCI host; and this pass deliberately
did not re-run the ~25-minute production build, because rebuilding would
overwrite the accepted `.next` output that BUILD_ID identifies.

## 2. Proposed commit scope

Scope was determined from the actual diffs, not from filenames. Every included
file's diff was read in full.

### 2.1 Include — product code, tests, manifest (16 paths)

Modified (8):

| Path | Diff content |
| --- | --- |
| `apps/web/app/(default)/universities/[slug]/page.tsx` | +167/−33: pilot branches in `generateMetadata` (title/description/alternates), `buildPilotDescription`, claims-summary block, grouped claims, related-university section, JSON-LD `description`/`dateModified`. All gated by `isIndexRecoveryPilotSlug`; non-pilot paths keep the previous expressions. |
| `apps/web/app/globals.css` | +57, additive only: `.index-recovery-summary`, `.claim-dimension-groups`, `.claim-dimension-group`, `.claim-dimension-group__count`, `.related-university-list`, `.related-university-list__meta`. No existing selector was modified or removed. |
| `apps/web/lib/i18n-metadata.ts` | +19/−4: new optional `LocalizedAlternatesOptions.restrictLocales`; default argument behavior unchanged for existing callers. |
| `apps/web/lib/sitemap-sections.ts` | +20/−6: pilot-only `getIndexRecoveryLastModified` branch in the universities and locale sections; other entries keep `latestSourceDate ?? publishedAt`. |
| `apps/web/lib/surface-localization.tsx` | +16/−1: locale-route metadata applies the pilot locale restriction so default and locale routes stay self-consistent. |
| `apps/web/components/student-policy-snapshot.tsx` | +12: exports existing titles as `STUDENT_SNAPSHOT_DIMENSION_TITLES`. No rendering change. |
| `apps/web/components/claim-evidence-card.tsx` | 1 line: `formatClaimType` becomes exported. No rendering change. |
| `package.json` | 1 line: adds `test:index-recovery-pilot`. No dependency or lockfile change (`pnpm-lock.yaml` is unmodified, so `--frozen-lockfile` on the host is unaffected). |

New (8):

| Path | Purpose |
| --- | --- |
| `apps/web/lib/index-recovery-pilot.ts` | 232 lines: the 10-slug allowlist, `INDEX_RECOVERY_CONTENT_VERSION = "2026-09-13"`, title themes, the four curated claims summaries, description/title builders, path resolution, locale restriction. Static and deterministic. |
| `apps/web/lib/index-recovery-basis.ts` | 38 lines: pinned SHA-256 basis for the ten records; excludes `lastCheckedAt`/`retrievedAt`; fail-closed on empty, changed, downgraded or added reviewed claims. |
| `apps/web/lib/index-recovery-dates.ts` | 29 lines: substantive-date derivation shared by sitemap and JSON-LD. |
| `apps/web/lib/university-claims-organization.ts` | 125 lines: deterministic grouping by snapshot dimension or claimType. |
| `apps/web/lib/related-universities.ts` | 88 lines: deterministic related-record selection. |
| `apps/web/components/university-claim-groups.tsx` | 55 lines: grouped rendering, reuses `ClaimEvidenceCard`. |
| `apps/web/components/related-universities.tsx` | 43 lines: related-links section. |
| `tests/index-recovery-pilot.test.ts` | 407 lines, 14 cases. |

### 2.2 Include — acceptance reports and preserved evidence (4 paths)

- `docs/google-index-recovery-p0-review.md` (untracked; contains the Codex
  correction record that supersedes its own earlier gating/date claims).
- `docs/google-index-recovery-p0-final-acceptance.md` (untracked; the corrected
  report — evidence links updated in this pass, conclusions untouched).
- `docs/google-index-recovery-p0-release-readiness.md` (this file).
- `docs/google-index-recovery-p0-evidence/` — 20 files, 1.9 MB (section 4).

### 2.3 Exclude — unrelated or unsafe

| Path | Reason |
| --- | --- |
| `docs/policy-snapshot-contract.md` (modified, +25/−4) | Pre-existing Wave 1 documentation work: replaces the "index is intentionally empty" statement and adds a "Rolling additions after Wave 1" validator-migration section. Nothing in the diff relates to the P0 pilot. Belongs to that separate task. |
| `docs/prompts/hku-student-first-snapshot.md`, `docs/templates/student-first-university-agent-prompt.md`, `docs/student-first-university-rollout-playbook.md` | Pre-existing snapshot-authoring material. P0 authored no new snapshots and did not expand the pilot. |
| `apps/web/app/apple-icon 2.png`, `apps/web/app/favicon 2.ico`, `apps/web/app/icon 2.png` | macOS copy artifacts, byte-identical to the tracked originals (24298 B, 10266 B, 188207 B; SHA-256 equal). Committing them would ship duplicate icon routes. |
| `apps/web/public/llms 2.txt` | **Not** a duplicate: 8502 B vs the tracked `llms.txt` at 8688 B. It is a stale pre-August variant — it still points at `/reports/monthly/2026-07` and its chart-data URL, and lacks the two `/llms-full.txt` pointer lines the tracked file has. Anything under `apps/web/public/` is served publicly, so committing it would publish outdated retrieval guidance at `/llms%202.txt`. |
| `docs/index-recovery-p0-screenshots/` (6 PNGs, 12.6 MB) | Prior-candidate captures (written 2026-09-12 22:52–23:42, listed in the pre-correction report). The corrected report states earlier build/screenshots describe the prior candidate and do not certify the corrected revision. Superseded by section 4's evidence; must not be mixed with valid evidence. Largest single item in the tree. |
| `supabase/.temp/` (8 files) | Local Supabase CLI state: `project-ref`, `pooler-url`, `linked-project.json`, version stamps. **Not gitignored** (`git check-ignore` returns nothing), so a blanket `git add -A` would commit infrastructure identifiers. P0 needs no database change, so nothing here belongs in this commit. Recommended follow-up: add `supabase/.temp/` to `.gitignore` — Codex decision, not done here. |
| `apps/web/.runtime-data/`, `apps/web/.next/`, `output/`, `node_modules/` | Already gitignored (`.gitignore:13`, `:14`, `:51`). Derived at build time; never commit. |
| `.env.agents.local`, `.local/secrets/gsc-eduaipolicy-service-account.json` | Credentials, intentionally outside Git per `AGENTS.md`. Never printed or staged in this pass. |

Staging must be explicit per path (`git add <path>` for each entry in 2.1 and
2.2). Do not use `git add -A`, `git add .` or `git commit -a`: the tree mixes
this pilot with unrelated in-progress work and with `supabase/.temp/`.

## 3. Suggested commit messages (not executed)

Two commits keep the reviewable code diff separate from 1.9 MB of binaries.

Commit 1 — product code:

```text
feat: pilot content-expression recovery on ten university pages

Ten allowlisted university detail pages get unique SSR titles and
descriptions, reviewed-claim grouping, a related-university section and
substantive-date sitemap/JSON-LD values. All additions are gated by
isIndexRecoveryPilotSlug and by pinned SHA-256 claim-basis fingerprints,
so a data change fails closed to a neutral title and a description that
never claims a student snapshot exists. Non-pilot pages keep the previous
templates and the full locale alternate set.

Adds test:index-recovery-pilot (14 cases). No dependency, schema,
migration or environment change.
```

Commit 2 — reports and evidence:

```text
docs: record P0 index-recovery acceptance, evidence and release readiness

Preserves the subset of local acceptance evidence that the reports link
(checksums, pixel comparison, RSC responses, and the six differing
baseline/candidate pairs plus the Cambridge control pair), because the
original captures live under the gitignored output/ directory.
```

If Codex prefers one commit, use commit 1's message and append the docs
paragraph; the file list is unchanged.

## 4. Acceptance evidence: accessibility and preserved location

Problem found: `output/` is gitignored (`.gitignore:51`), so **all twelve
evidence links in the corrected acceptance report would have been dead** for
anyone reading it after a commit.

Preserved into `docs/google-index-recovery-p0-evidence/` (20 files, 1.9 MB):

- `source-sha256.json` — the seven acceptance fingerprints plus the release
  manifest hash.
- `pixel-comparison.json` — all 14 pairs with their difference bounds.
- `rsc.json` — the three RSC probes (200 / `text/x-component`); contains only
  slug, status and content type.
- Both images of the six pairs whose pixels differ: Harvard claims
  desktop/mobile, Manchester first-screen desktop/mobile, Manchester claims
  desktop/mobile (12 files).
- The pixel-identical Cambridge desktop first-screen control pair (2 files).
- The remaining images the report links by name: the pixel-identical Harvard
  mobile first-screen pair (2 files) and the supplementary
  `candidate-manchester-mobile-footer.png` (1 file). Together with the three
  JSON records, the six differing pairs and the Cambridge control pair, this is
  the 20-file total.

Every copy was SHA-256 verified against its source: 20/20 identical. A scan for
`/Users/` and `/var/folders/` across the directory returns nothing, so no
machine-specific absolute path is committed.

Deliberately **not** copied: `capture.js`, `capture-claims.js`, `capture.log`,
`capture-claims.log` and `baseline-location.json`. Each embeds absolute local
paths (`/Users/newvolume/...` screenshot targets, a `/var/folders/...` baseline
directory). They remain in the local gitignored `output/playwright/p0-final/`,
which still holds all 34 captures; the acceptance report now says so explicitly
instead of linking them, and records the baseline commit inline.

Report edits made in this pass (links and evidence locations only):

- `docs/google-index-recovery-p0-final-acceptance.md`: seven links repointed to
  the new directory; the baseline-location sentence reworded; the evidence block
  now states which artifacts are committed and which stay local, and that only
  evidence locations changed. No conclusion, measurement or correction altered.
- `docs/google-index-recovery-p0-review.md`: one bullet appended to the existing
  Codex correction record noting that `docs/index-recovery-p0-screenshots/` is
  excluded, so its three path references will not resolve in the repository.

## 5. Verified GitHub → OCI release path

Read-only inspection of the repository and its runbooks. No host was contacted.

**There is no CI gate.** `.github/` contains only `ISSUE_TEMPLATE/` and
`PULL_REQUEST_TEMPLATE.md`; there is no `workflows/` directory. The only CI
mention in the docs is aspirational — `docs/exposure-distribution-architecture.md:971-981`
proposes that `main` should require review and CI, and that document declares
itself non-implementing. So nothing runs between a push to `origin/main` and the
host build; every gate is a human step.

Code path to production (`docs/deployment.md:31-38`,
`docs/oci-production-deployment.md:101-120`):

1. Push to GitHub `origin/main` — the single source of truth.
2. SSH to the shared OCI host (public IP `129.153.56.227`, behind Cloudflare and
   nginx). SSH key is documented in the CELPIP repository README, not here.
3. In `/srv/uapt/app`, as user `uapt`: `git fetch origin main`,
   `git checkout main`, `git reset --hard origin/main`.
4. `pnpm install --frozen-lockfile` with `PATH=/opt/node-v22/bin`.
5. `pnpm --filter @uapt/web build` with `/srv/uapt/env/production.env` sourced
   and `UAPT_DISABLE_INTERNAL_FETCH=1`.
6. `sudo systemctl restart uapt-web.service`.

Runtime shape: `Cloudflare → nginx → uapt-web.service → Next.js on
127.0.0.1:3100`. Isolation from the CELPIP co-tenant is by user `uapt`,
directories `/srv/uapt/app` and `/srv/uapt/env`, port 3100, and separate nginx
site/cache paths. Env file is mode `0600` and must never be printed or
committed. Toolchain pins are compatible: `packageManager: pnpm@10.0.0`,
`engines.node >= 20`, host runs Node v22.

**How policy data reaches the release.** `apps/web/package.json:7` defines
`build` as `pnpm --filter @uapt/db generate && node
../../scripts/prepare-web-runtime-data.mjs && next build`. That script deletes
and rebuilds `apps/web/.runtime-data/` from tracked repository content:
`data/public-releases/`, `data/rankings`, `data/entity-aliases.json`,
`data/policy-snapshots`, `DATA_DICTIONARY.md`, plus every directory the release
manifest lists under `includeStagedArtifactDirectories` — restricted to
`staging/uapt-runs/*` and `data/openclaw-staging/*` and copied JSON-only
(`scripts/prepare-web-runtime-data.mjs:14-28,47-53`). Both `data/` (256 tracked
files) and `staging/` (4048 tracked files) are in Git and are clean in this
working tree, and `.gitignore` only excludes `data/raw/`, `data/snapshots/` and
`data/browser-profiles/`. Production therefore regenerates the same data the
local acceptance build used — quantified in section 7.

**Atomicity: none.** The deploy is an in-place `reset --hard` + build + restart.
No release directory, versioned symlink, artifact archive or previous-build
backup is documented anywhere. The only host-side backups are nginx config dumps
in `/etc/nginx/backups/uapt/<timestamp>/`. Rollback is Git-based
(`docs/oci-production-deployment.md:242-254`).

**Caching.** Documented nginx origin cache locations are `/api/public/v1/*`,
`/api/public/v1/search.json`, `/datasets*`, `/feeds/*`, `/sitemap.xml`,
`/robots.txt`, `/search*`, `/sources*`, stored in `/var/cache/nginx/uapt`
(`docs/oci-production-deployment.md:148-159`). `/universities/*` and
`/sitemaps/*` are not in that documented list. TTLs and any purge procedure are
**not documented anywhere**, and no nginx configuration is committed in this
repository. App-side: `apps/web/app/sitemap.xml/route.ts:8` and
`apps/web/app/sitemaps/[section]/route.ts:8` are `force-static`, so sitemap
`lastmod` values are baked at build time;
`apps/web/app/(default)/universities/[slug]/page.tsx:54-55` sets
`dynamicParams = true` and `revalidate = 3600`.

**Migrations and environment: none required.** No Prisma migration step exists
in the deploy flow (the web build only runs `@uapt/db generate`); Supabase
changes are manual, additive, idempotent SQL per
`docs/supabase-analytics-inbound-source-migration.md`. Verified from the code:
no P0 file reads `process.env`, and no added diff line introduces an env var,
schema or migration. This commit needs no `production.env` edit and no SQL.

## 6. Gates, deploy-day checks, rollback

### 6.1 Pre-push gates

Already satisfied in this pass: 14/14 pilot tests, 16/16 existing snapshot
tests, web typecheck, `git diff --check`, 7/7 fingerprints, allowlist gating
confirmed on live data (section 7).

Still to run before pushing, per `docs/oci-policy-update-from-crawl-data.md:212-222`:

- `pnpm --filter @uapt/web build` — a fresh production build of **this** tree.
  Not re-run here to avoid destroying the accepted `.next` output; expect
  ~25 minutes locally. Its exit status and page count must be recorded, because
  the acceptance report notes the earlier 5279-page build log was not
  independently recovered.
- `pnpm validate:policy-snapshot` and `pnpm smoke:policy-snapshot` — expect
  24 indexed / 17 strong / 7 `needs_review`, unchanged.
- `pnpm validate:public-contract`, `pnpm audit:public-data`, and `pnpm check`
  when time allows.
- Confirm the staged set is exactly section 2.1 + 2.2 (`git status` after
  staging, before committing).

### 6.2 D0 — deploy-day verification (D0 = 待部署)

Measured production "before" state on 2026-09-13 by read-only public HTTP, as
the comparison baseline:

| Probe | Production value before deploy |
| --- | --- |
| `/universities/harvard-university` title | `Harvard University AI policy | University AI Policy Tracker` |
| Harvard alternates | 8: `en`, `zh`, `fr`, `pl`, `es`, `nl`, `ms`, `x-default` |
| Harvard JSON-LD `dateModified` | `2026-07-18T21:54:39.689Z` |
| `sitemaps/universities.xml` Harvard lastmod | `2026-07-18T21:54:39.689Z` |
| … Manchester | `2026-07-19T00:42:39.689Z` |
| … Bristol | `2026-05-12T05:50:30.000Z` |
| … Cambridge (control) | `2026-07-18T21:58:39.689Z` |
| HTTP status `/`, both pilot pages, `/sitemap.xml` | 200 |

Expected after deploy, computed from the current tree and current data (all ten
basis-verified, all lastmod `2026-09-13T00:00:00.000Z`):

| Slug | Strong snapshot | Basis | Reviewed | Sources | Title chars | Description chars |
| --- | --- | --- | ---: | ---: | ---: | ---: |
| `harvard-university` | yes | pass | 30 | 13 | 108 | 272 |
| `unsw-sydney` | yes | pass | 35 | 9 | 119 | 199 |
| `university-of-sydney` | yes | pass | 11 | 9 | 92 | 203 |
| `national-university-of-singapore` | yes | pass | 14 | 4 | 115 | 241 |
| `university-of-oxford` | yes | pass | 15 | 7 | 103 | 251 |
| `utrecht-university` | yes | pass | 9 | 7 | 92 | 195 |
| `university-of-bristol` | no | pass | 4 | 4 | 94 | 353 |
| `manchester` | no | pass | 15 | 7 | 116 | 243 |
| `edinburgh` | no | pass | 19 | 10 | 113 | 267 |
| `deakin-university` | no | pass | 8 | 6 | 97 | 262 |

Titles are `<Name> AI policy: <theme> | University AI Policy Tracker`, e.g.
`University of Bristol AI policy: four-category assessment rules | University AI
Policy Tracker`.

D0 checklist:

1. **Service and identity.** `systemctl is-active uapt-web.service nginx`;
   `sudo ss -tulpn | grep ':3100'` (must be `127.0.0.1:3100` only);
   `curl -fsS -I http://127.0.0.1:3100/`. Record the deployed commit with
   `git -C /srv/uapt/app rev-parse HEAD` and confirm it equals the pushed SHA.
   Confirm the CELPIP co-tenant is untouched:
   `systemctl is-active clb-pro-mock-exam`,
   `curl -fsS http://127.0.0.1:9000/api/ai-score/health`.
2. **Documented public checklist** (`docs/deployment.md:44-56`): `/`,
   `https://www.eduaipolicy.org/`, `/zh`, `/api/public/v1/index.json`,
   `/api/public/v1/universities.json`, `/api/public/v1/search.json?q=stanford`,
   `/sitemap.xml`, `/internal/analytics` with basic auth.
3. **Ten pilot pages, SSR.** For each slug: HTTP 200; `<title>` equals the
   expected value above; meta description equals the expected text and length;
   canonical is the clean self URL `https://eduaipolicy.org/universities/{slug}`;
   alternates are exactly `en` + `x-default`. Verify in the origin HTML
   (`curl` with `Host: eduaipolicy.org` against `127.0.0.1`) as well as through
   Cloudflare, and treat a mismatch between the two as caching, not as a code
   defect.
4. **Sitemap and JSON-LD agreement.** `/sitemaps/universities.xml` and the
   `zh`/`fr`/`pl` locale sections show lastmod `2026-09-13T00:00:00.000Z` for
   exactly the ten pilots and nothing else; each pilot's JSON-LD `dateModified`
   equals its sitemap lastmod; JSON-LD `description` equals the meta
   description. Because the sitemap routes are `force-static` and `/sitemap.xml`
   is nginx-cached with undocumented TTLs, check the section URLs directly and
   note the index separately.
5. **Bristol's permission exception.** Bristol's SSR description must retain the
   "unless assessment instructions allow more comprehensive use" exception, and
   the visible prose and the reviewed claim must agree. This was the specific
   defect Codex corrected; it is the highest-value single assertion on D0.
6. **Strong-snapshot and no-snapshot pages.** Harvard (strong) shows the reviewed
   snapshot summary as its description and dimension-grouped claims, with no
   curated summary block. Manchester (no snapshot) shows the "No reviewed summary
   yet" fail-closed state, the curated summary with its
   "No student policy snapshot has been published…not an official university
   statement" disclaimer, claimType groups, and no `machine_candidate` card.
7. **At least three non-pilot controls.** `university-of-cambridge`,
   `stanford-university`, `monash`, `university-of-birmingham`: generic title and
   description, all 8 alternates, flat ungrouped claim list, no summary block, no
   related section, JSON-LD `dateModified` still the data date (Cambridge
   `2026-07-18T21:58:39.689Z`), sitemap lastmod unchanged. Verified locally that
   all four return no pilot title and no pilot description.
8. **Role switching and RSC.** Click a `?for=researcher` link in a real browser
   on a pilot page: `data-snapshot-role="researcher"` renders and canonical stays
   clean. Repeat an `RSC: 1` request on Harvard, Bristol and Cambridge: expect
   `200` and `text/x-component` — in production, internal fetching is enabled, so
   this also exercises the path that could not be fully tested locally.
9. **Mobile first screen and official sources.** On a 390×844 viewport, confirm
   no horizontal overflow (`document.documentElement.scrollWidth === innerWidth`),
   the header and Snapshot area match the accepted captures, and official source
   links resolve to real external URLs.
10. **Production data vs summary basis.** Confirm the deployed host's
    `.runtime-data` release manifest hash equals
    `6ea988a5c65ffd54fd375336ff777b66d64e422da99370a17beb0f432db947c9`, and that
    pilot pages render their curated text rather than the neutral fallback — a
    fallback in production would mean the basis gate failed against host data.
    **Do not regenerate `index-recovery-basis.ts` to make it pass.** A mismatch
    is a stop-and-investigate signal: it means host data differs from the
    reviewed data the prose was written against.

### 6.3 Observation plan (unchanged, starts at the real deploy)

- **D+7** — URL Inspection on the ten canonical URLs: was the new version
  crawled; is the canonical as declared; is the hreflang set as declared.
- **D+14** — pilot index rate (indexed/10), index rate within the re-crawled
  subset reported separately, impressions, and control-group movement from GSC
  (aggregate locale and alias rows per entity).
- **D+28** — clicks, CTR, position, and query-mix composition versus the control
  group and a matched pre-period.
- **Thresholds** — ≥70% of all ten indexed is a reference for considering a
  second small batch, subject to exposure and control results; below 30% pause
  expansion; 30–70% continue observation. Pages not re-crawled are "not yet
  evaluated", not repair failures. No automatic expansion. Metadata changes are
  not a confirmed root-cause fix and must never be reported as one.

### 6.4 Rollback

Rollback is Git-based and requires a full rebuild, so recovery time is
approximately one production build.

1. **Capture the rollback target before deploying.** Because the deploy is an
   in-place `reset --hard` with no retained previous version, record
   `git -C /srv/uapt/app rev-parse HEAD` and the current `apps/web/.next/BUILD_ID`
   *before* step 3 of the deploy. Without that, the known-good commit has to be
   inferred from GitHub afterwards. Expected current value: `900ddd5`.
2. On the host:
   `sudo -u uapt env HOME=/srv/uapt git -C /srv/uapt/app reset --hard <known-good-commit>`,
   then the documented build command with `production.env` sourced and
   `UAPT_DISABLE_INTERNAL_FETCH=1`, then `sudo systemctl restart uapt-web.service`.
3. Re-run 6.2 items 1, 2 and 7: service healthy on `127.0.0.1:3100`, public
   checklist green, and controls still generic. Confirm the ten pilot pages
   reverted to the generic title, 8 alternates and data-derived JSON-LD date.
4. Confirm sitemaps reverted: pilot lastmods back to the "before" values in 6.2.
   Expect lag from the nginx and Cloudflare caches whose TTLs are undocumented;
   verify at the origin first and only then in public.
5. Revert on GitHub with a `git revert` of the pushed commit rather than a force
   push, so `origin/main` stays the reproducible source of truth and the host
   `reset --hard origin/main` cannot re-apply the bad state.
6. Nothing to roll back in data: no migration, no SQL, no env change, no
   `data/` or `staging/` edit. `.runtime-data` is derived and is rebuilt by the
   rollback build.
7. Never "fix forward" a basis mismatch by editing
   `apps/web/lib/index-recovery-basis.ts`. Those hashes are authored-content
   bindings pinned at review time.

## 7. Data and fingerprint consistency

- **Source fingerprints:** 7/7 match (section 1).
- **Runtime data equals tracked sources:** all **4134** files under
  `apps/web/.runtime-data/` are byte-identical (SHA-256) to their counterparts
  in the tracked tree; 0 drifted, 0 without a repository counterpart. Since the
  host regenerates this directory from `data/` and `staging/` at build time, the
  deployed data will match the data the summaries and fingerprints were written
  against. `data/` and `staging/` are clean in the working tree.
- **Release manifest:** local `.runtime-data` copy and tracked
  `data/public-releases/current.json` both hash to `6ea988a5…b947c9`, the value
  recorded in `source-sha256.json`.
- **Basis gate against live data:** `hasCurrentIndexRecoveryBasis` returns true
  for all ten pilots and false for all four sampled controls, so every pilot
  keeps its authored title and summary and no control can acquire one.
- **Allowlist actually bounds the change:** `INDEX_RECOVERY_PILOT_SLUGS` has
  exactly ten entries; `buildIndexRecoveryTitle` and
  `buildIndexRecoveryDescription` both return `undefined` unless the slug is in
  the allowlist *and* the basis verifies (`index-recovery-pilot.ts:208,228`);
  `getIndexRecoveryPilotLocaleRestriction` returns `[DEFAULT_LOCALE]` only for
  allowlisted slugs (`:187`); `getIndexRecoveryPilotSlugFromPath` matches only
  `^/universities/{slug}/?$` after locale stripping (`:178`), so alias slugs
  cannot bypass the gate — they permanent-redirect first. Sitemap changes are
  behind the same `isIndexRecoveryPilotSlug` test in both sections.
- **Dates:** all ten pilots compute lastmod `2026-09-13T00:00:00.000Z` from
  `INDEX_RECOVERY_CONTENT_VERSION` and substantive dates only.

A local-only re-verification helper used for the tables above is at
`output/p0-release-check.mts` (gitignored, not part of the commit).

## 8. Risks, unverified items, and Codex decisions

### Unverified in this pass

1. **Host state was not inspected.** No SSH alias for this host exists in the
   local SSH config (only an unrelated `hermes-agent-prod`), and the deploy key
   is documented in the CELPIP repository. The currently deployed commit, the
   live nginx configuration, the cache TTLs and the on-host `.runtime-data` are
   therefore unconfirmed. Section 6.2 item 1 and 6.4 item 1 exist to close that
   gap at deploy time.
2. **No production build was run here.** The accepted `ZE2EotqUV9aYNm4ymToNc`
   build was not reproduced; rebuilding would have destroyed the evidence that
   identifies it. Section 6.1 requires a fresh build before push.
3. **The "Antigravity" screenshot directory could not be located.** The
   corrected report withdraws two images from it as 1280×720 desktop duplicates.
   No directory of that name exists under the repository, and no 1280×720 PNG
   exists anywhere under `docs/` or `output/`. The six images in
   `docs/index-recovery-p0-screenshots/` are genuine 1440-wide and 390-wide
   captures, so they are not the withdrawn pair — but they are still prior-
   candidate evidence and are excluded either way. Codex may want to confirm
   where that directory lives before accepting the correction's wording.
4. **Cache TTLs and purge procedure are undocumented**, for both nginx
   (`/var/cache/nginx/uapt`) and Cloudflare. Public sitemap and page visibility
   after deploy or rollback may lag by an unknown interval, with no documented
   way to force it.
5. **Analytics persistence untested.** Local acceptance ran without
   `DATABASE_URL`; both servers logged analytics mirror failures. D0 should
   confirm analytics still records on pilot pages.

### Risks

6. **In-place build while the service is running.** The documented flow runs
   `next build` in `/srv/uapt/app` while `uapt-web.service` is still serving from
   the same `.next` directory, and only restarts afterwards. `next build`
   rewrites `.next` in place, so the running server can serve missing or
   mismatched static chunks during a build that takes tens of minutes. This is a
   pre-existing property of the documented runbook, not something this commit
   introduces, but this deploy is a good moment to decide whether to stop the
   service first or build in a separate directory. Flagged, not changed.
7. **Long titles and descriptions.** Measured 92–119 characters for titles and
   195–353 for descriptions (Bristol 353). Both exceed typical SERP display
   limits (~60 and ~160 characters), so Google will truncate them. This does not
   affect correctness or the basis gate, but it does affect the CTR outcome the
   D+28 observation is meant to measure. Reproduce with
   `output/p0-release-check.mts`. Shortening is a product decision for Codex;
   not done here.
8. **Curated content has no second review.** The four summaries and ten title
   themes are newly authored text derived from reviewed claims. The pre-correction
   report already flags phrase-level review as open. It remains the main
   substantive risk in this commit: a scope error in prose is not caught by any
   test or fingerprint.
9. **hreflang asymmetry is intentional but unresolved.** Pilot pages declare
   `en` + `x-default` only, while pilot `zh`/`fr`/`pl` URLs remain in the locale
   sitemaps and stay self-canonical. Non-pilot pages keep all 7 locales even
   though their substantive body is not localized. A site-wide decision is needed
   and is out of P0 scope.
10. **Non-pilot sitemap lastmod still uses check dates** site-wide
    (`max(lastCheckedAt, lastChangedAt)`), which can overstate freshness for the
    other ~818 universities. Deliberately not changed, to avoid altering every
    other page's experiment conditions.
11. **1.9 MB of PNG evidence enters Git history** if section 2.2 is committed as
    proposed. This is the smallest defensible subset; the alternative is to keep
    all images out of Git and let the reports cite checksums only. Codex's call.
12. **`supabase/.temp/` is not gitignored** and holds a project ref and a pooler
    URL. Any future `git add -A` in this repository leaks them. Recommend adding
    it to `.gitignore` in a separate hygiene commit.
13. **Root cause remains unverified.** This pilot is a content-expression and
    crawlability improvement. Nothing here confirms why impressions fell after
    2026-08-16, and the shared-template hypothesis is still untested.

### Explicitly out of scope for this release

No new university snapshots, no expansion beyond the ten pilots, no further UI
work, no database migration, no environment-variable change, no Google
re-index request, no scheduled task.

## 9. State

- **Not staged.** No `git add` was run; `git status` is unchanged apart from the
  new untracked `docs/google-index-recovery-p0-evidence/` and
  `docs/google-index-recovery-p0-release-readiness.md`.
- **Not committed.** HEAD is still `900ddd5`, equal to `origin/main`.
- **Not pushed. No PR. Not deployed.** No host was contacted, no service
  restarted, no production config or data touched.
- **No Google re-index request, no scheduled task.**
- **D0 = 待部署.** The observation plan in 6.3 starts only at the real deploy;
  nothing in it has been measured.
- Existing user changes were preserved: nothing was stashed, reset, cleaned,
  reverted or overwritten. The unrelated modifications and untracked files in
  section 2.3 are still in the working tree exactly as found.
