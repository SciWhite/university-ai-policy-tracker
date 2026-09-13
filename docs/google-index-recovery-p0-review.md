# P0 Google index recovery pilot — local acceptance report

> 2026-09-13 correction: the dated implementation/verification narrative below
> describes the Trae candidate, not the final corrected code. The correction
> record at the end supersedes its summary gating and lastmod descriptions.

Status: **local, verifiable, not committed, not pushed, not deployed.**
Prepared for independent Codex review of the working-tree diff only. No
Google recrawl request, deployment, or production data change has been made.

- Report date: 2026-09-12
- Working state at start: HEAD `900ddd5` ("feat: add Bing AI citation
  snapshots to analytics"), branch `main` (up to date with `origin/main`)
- Pre-existing working-tree changes preserved untouched:
  - modified: `docs/policy-snapshot-contract.md` (Wave 1 documentation update)
  - untracked: `apps/web/app/apple-icon 2.png`, `apps/web/app/favicon 2.ico`,
    `apps/web/app/icon 2.png`, `apps/web/public/llms 2.txt`, `docs/prompts/`,
    `docs/student-first-university-rollout-playbook.md`, `docs/templates/`,
    `supabase/`
- No reset/clean/stash/overwrite was performed at any point.

## Scope and non-goals

This pilot improves content expression and crawlability of ten university
detail pages. It does **not** claim to fix the root cause of the post-Aug-16
GSC impression loss; the shared-template hypothesis remains unverified. No
new university snapshots were authored, no existing snapshot's publication
scope changed, and no claim/evidence/source data was modified.

## Pilot allowlist (verified slugs, snapshot status, canonical)

| University | Slug | Snapshot (effective) | Summary basis |
| --- | --- | --- | --- |
| Harvard | `harvard-university` | strong | dual-agent snapshot summary (13 sources, 30 reviewed claims) |
| UNSW Sydney | `unsw-sydney` | strong | snapshot summary (assessment category framework) |
| Sydney | `university-of-sydney` | strong | snapshot summary (two-lane assessment) |
| NUS | `national-university-of-singapore` | strong | snapshot summary (acknowledgement + approved tools) |
| Oxford | `university-of-oxford` | strong | snapshot summary (assessment declarations + PGR) |
| Utrecht | `utrecht-university` | strong | snapshot summary (AI index + allow-listing) |
| Bristol | `university-of-bristol` | none | curated summary of 4 agent-reviewed claims |
| Manchester | `manchester` | none | curated summary of 15 agent-reviewed claims |
| Edinburgh | `edinburgh` | none | curated summary of 19 agent-reviewed claims |
| Deakin | `deakin-university` | none | curated summary of 8 agent-reviewed claims |

Target canonical (production): `https://eduaipolicy.org/universities/{slug}`.
`manchester` and `edinburgh` are the canonical slugs per
`data/entity-aliases.json` (aliases `the-university-of-manchester` and
`the-university-of-edinburgh` resolve to them and already permanent-redirect).
The pilot intentionally mixes six strong-snapshot and four no-snapshot pages;
no pilot is in `needs_review`, but that case is handled fail-closed by the
same code path (a non-strong snapshot suppresses both the summary and the
snapshot-derived description).

## Control group (matched, explicitly unmodified)

Country / snapshot-status / reviewed-content matching; no recent page-level
GSC data was available locally, so traffic/rank matching is **not** claimed.

| Control slug | Country | Snapshot | Reviewed claims | Matches pilot |
| --- | --- | --- | ---: | --- |
| `university-of-cambridge` | UK | strong | 16 | Oxford |
| `imperial-college-london` | UK | strong | 14 | Oxford |
| `stanford-university` | US | strong | 15 | Harvard |
| `cornell-university` | US | strong | 29 | Harvard |
| `massachusetts-institute-of-technology` | US | strong | 21 | Harvard |
| `university-of-melbourne` | AU | strong | 21 | UNSW, Sydney |
| `adelaide-university` | AU | strong | 9 | UNSW, Sydney |
| `university-of-birmingham` | UK | none | 15 | Bristol, Manchester, Edinburgh |
| `university-of-glasgow` | UK | none | 13 | Bristol, Manchester, Edinburgh |
| `monash` | AU | none | 12 | Deakin |

Limitation: NUS (Singapore) and Utrecht (Netherlands) have no same-country
control in the dataset with comparable reviewed volume; nearest-country
matching was not fabricated.

## What changed (files and purpose)

Modified:

- `apps/web/app/(default)/universities/[slug]/page.tsx` — pilot branches in
  `generateMetadata` (unique title/description, restricted alternates) and in
  the page body (claims summary block, grouped claims, related-university
  section, JSON-LD description/dateModified). Non-pilot rendering is
  byte-identical to the previous template paths.
- `apps/web/lib/i18n-metadata.ts` — `getLocalizedAlternates` accepts an
  optional `restrictLocales` subset; default behavior unchanged.
- `apps/web/lib/surface-localization.tsx` — locale-route metadata rebuild
  applies the pilot locale restriction so default and locale routes emit
  self-consistent alternate sets.
- `apps/web/lib/sitemap-sections.ts` — pilot universities' lastmod raised to
  the fixed content-version date (see below) in both the universities and
  locale sitemap sections; all other entries unchanged.
- `apps/web/components/student-policy-snapshot.tsx` — exports the existing
  dimension titles as `STUDENT_SNAPSHOT_DIMENSION_TITLES` (single source; no
  rendering change).
- `apps/web/components/claim-evidence-card.tsx` — exports the existing
  `formatClaimType` (no rendering change).
- `apps/web/app/globals.css` — additive classes only for the summary block,
  claim group headings, and related-university list. No existing selector was
  modified.
- `package.json` — adds `test:index-recovery-pilot`.

New:

- `apps/web/lib/index-recovery-pilot.ts` — the allowlist, the fixed content
  version `2026-09-12`, curated title themes and (for the four snapshot-less
  pilots) claims summaries, description builders, pilot-path resolution, and
  locale restriction. All static, deterministic; no model calls.
- `apps/web/lib/university-claims-organization.ts` — deterministic claim
  grouping (see design decision below).
- `apps/web/lib/related-universities.ts` — deterministic related-university
  selection.
- `apps/web/components/university-claim-groups.tsx` — grouped claims
  rendering (reuses `ClaimEvidenceCard`; preserves anchors, evidence links,
  and analytics attributes).
- `apps/web/components/related-universities.tsx` — related links section.
- `tests/index-recovery-pilot.test.ts` — targeted tests (10 cases).
- `docs/index-recovery-p0-screenshots/` — verification screenshots
  (untracked evidence, listed below).

## Design decisions worth reviewing

1. **Six-dimension grouping is backed by review, not by a classifier.** A
   deterministic claimType→dimension mapping was prototyped and measured
   against the 113 claims bound across the 17 strong snapshots: agreement was
   only 48.7% (e.g. UNSW's core assessment-framework claims are typed
   `other`; Auckland assessment rules are typed `ai_tool_treatment`). Mapping
   by type would misstate reviewed semantics. Therefore:
   - strong-snapshot pilots group claims using the **dual-agent-reviewed
     snapshot dimension basis** (a claim bound to several dimensions renders
     once, under the first dimension in the contract order);
   - snapshot-less pilots group claims under the record's **own claimType
     taxonomy** with honest labels (the taxonomy is the existing
     classification; the six-dimension organization for these pages is
     documented as requiring snapshot authoring per the rollout playbook,
     not approximated);
   - claims not bound to any snapshot dimension render under "Additional
     reviewed claims" — nothing is dropped or duplicated.
2. **Claims summaries are curated static data, not runtime-generated
   text.** Each of the four summaries was authored once from the current
   agent-reviewed claim texts (scope-preserving; tool listings are never
   described as coursework permission; "no evidence" statements stay absent
   rather than inferred). They render only when the page has **no effective
   strong snapshot**, alongside an explicit "No student policy snapshot has
   been published for this university yet" note, so the fail-closed snapshot
   contract is preserved. Strong-snapshot pilots keep their reviewed snapshot
   summary as the unique page summary (no duplicate block).
3. **hreflang (pilot pages only).** Audit: university locale routes render
   translated UI chrome, but the substantive body — claim text, evidence
   snippets, snapshot prose — remains English/original (verified by rendering
   `/zh/universities/harvard-university`; the reviewed snapshot summary
   appears verbatim in English; `html lang="zh"` with English body). Per the
   task's rule, only locales with substantively localized, review-passed
   content may be declared. For the ten pilots, both the default and locale
   routes now declare only `en` + `x-default` (canonical stays self
   per-route, so canonical/noindex/language-routing are unchanged).
   Reciprocity: pilot en↔locale pairs are self-consistent (both sides declare
   only en). Site-wide scope: non-pilot pages keep the full 7-locale set,
   including their `es`/`nl`/`ms` declarations; whether university locale
   routes should be declared as alternates at all is a product decision
   recommended for a separate site-wide review (see Open items). Removing
   hreflang is not treated as solving any duplicate-content question.
4. **Sitemap lastmod.** Baseline audit: `getSitemapLastPublishedAt` uses the
   latest release `publishedAt` (stable, not request time) and per-university
   lastmod used max(source `lastCheckedAt`/`lastChangedAt`). `lastCheckedAt`
   alone can overstate freshness — a known site-wide property, recorded here
   but not changed. For the ten pilots only, lastmod is
   `max(existing source date, 2026-09-12)` where `2026-09-12` is
   `INDEX_RECOVERY_CONTENT_VERSION`, a fixed constant tied to this
   content-expression revision (traceable, changes only with a substantive
   version bump; never build/request time). Verified stable across repeated
   requests. Non-pilot entries are byte-identical.
5. **Parameter URLs (audit result: no change needed).** `?for=` role links
   are same-path query links with the page canonical emitting the clean URL
   (verified with `?for=researcher`: canonical remains
   `/universities/harvard-university`); sitemap and the new related links use
   clean canonical paths; `_rsc` requests return 200 and do not appear in
   sitemap or canonical. No blocking or canonical changes were warranted.

## Verification performed (commands and results)

| Check | Command | Result |
| --- | --- | --- |
| Web typecheck | `pnpm --filter @uapt/web typecheck` | pass |
| Web lint | `pnpm --filter @uapt/web lint` (tsc) | pass |
| Repo typecheck | `pnpm -r typecheck` | pass (web, api, worker, packages) |
| Production build | `UAPT_DISABLE_INTERNAL_FETCH=1 pnpm --filter @uapt/web build` | success (exit 0); `/universities/[slug]` is dynamic ISR (uses `searchParams`) |
| Pilot test suite | `pnpm test:index-recovery-pilot` | 10/10 pass |
| Existing snapshot tests | `tsx --tsconfig apps/web/tsconfig.json --test tests/policy-snapshot.test.ts tests/policy-snapshot-independent-review.test.ts tests/student-policy-snapshot.test.ts` | 16/16 pass |
| Snapshot validation/smoke | `pnpm validate:policy-snapshot`, `pnpm smoke:policy-snapshot` | 24 indexed, 17 strong, 7 needs_review; unchanged |
| Visual assets test | `pnpm test:visual-assets` | 3/3 pass |

Runtime verification on the production build (`next start`,
`UAPT_DISABLE_INTERNAL_FETCH=1`, base URL `http://localhost:3000`):

- All 10 pilot pages return 200 with unique titles and unique
  content-grounded descriptions; strong pilots quote the reviewed snapshot
  summary; snapshot-less pilots quote the curated summary and contain no
  snapshot claims (`/snapshot/i` does not match).
- Harvard: hreflang `en` + `x-default` only; canonical clean; JSON-LD
  `dateModified` 2026-09-12 and description equal to the meta description;
  claim groups `coursework/disclosure/privacy_data/approved_tools/research_publication`
  + `additional`; 5 related US records.
- Manchester: "No reviewed summary yet" fail-closed state preserved; summary
  block present with the not-a-snapshot disclaimer; claimType groups; 5
  related UK records.
- Bristol, Edinburgh, Deakin: summary + claimType groups; no
  `machine_candidate` cards anywhere.
- Utrecht, UNSW: snapshot-dimension groups + `additional` group.
- Control `university-of-cambridge`: pre-existing title/description, full
  7-locale hreflang + `x-default`, flat ungrouped claim list, no summary
  block, no related section, JSON-LD `dateModified` = data date
  (2026-07-18), i.e. completely unmodified rendering.
- `/zh/universities/harvard-university`: canonical self (`/zh/...`),
  alternates `en` + `x-default` only; confirms English substantive body on
  the locale route (hreflang audit evidence).
- `?for=researcher`: role switch renders `data-snapshot-role="researcher"`
  with researcher dimension priority; canonical stays clean.
- Sitemaps: `universities.xml` and `zh.xml`/`fr.xml`/`pl.xml` pilot entries
  have lastmod `2026-09-12T00:00:00.000Z`; `university-of-cambridge` and
  `manchester-metropolitan-university` keep their prior data-derived
  lastmods; exactly 10 bumped entries per locale sitemap.
- Screenshots (`docs/index-recovery-p0-screenshots/`, 1440x900 and 390x844,
  full-page): `harvard-desktop.png`, `manchester-desktop.png`,
  `cambridge-desktop.png`, `harvard-mobile.png`, `manchester-mobile.png`,
  `harvard-researcher-role.png`. First screen (header + snapshot cards)
  unchanged; no layout breakage, overlap, or console errors across checks;
  role switch works. (Screenshot capture used headless Chrome CDP at exact
  viewports.)

Environment notes for the reviewer:

- `tests/student-policy-snapshot.test.ts` fails when run via the plain
  `pnpm test:policy-snapshot` script in this environment (tsx does not
  resolve the `@/*` alias from `tests/` without a tsconfig). This is
  pre-existing (reproduces on the unmodified tree) and not a regression; the
  new test script pins `--tsconfig apps/web/tsconfig.json` and the suite
  passes with that flag.
- The web production build takes ~25 minutes locally because each render
  worker rebuilds the staged dataset; expected, not a regression.

## Implemented / reviewed-only / open

Implemented: A (SSR summaries: strong via snapshot, snapshot-less via curated
claims summaries), B (grouped claims; reviewed-binding for strong pilots,
existing taxonomy for snapshot-less pilots), C (unique titles/descriptions;
no false snapshot claims), D (pilot hreflang restriction, self-consistent on
all routes of pilot slugs), E (pilot lastmod bump to a fixed traceable
version date), F (audited — no change needed), G (related-university links).

Reviewed only (site-wide, not implemented):

- The generic description template claims "a student-first policy snapshot"
  for **every** university, including the ~804 without one — the pilot fixed
  this only for its ten pages. Recommend a template-level fix (drop the
  snapshot clause or gate it on effective snapshot status).
- University locale routes (all 828 × 6 non-en locales) are declared as
  language alternates while their substantive body is not localized. The
  pilot restricted this for ten slugs only; a site-wide decision is needed
  (either drop non-en alternates for university pages, or complete
  translation review per the snapshot contract, or accept the presentation
  layer as an alternate — a product call).
- Sitemap lastmod for non-pilot universities still uses
  max(`lastCheckedAt`, `lastChangedAt`); a check-only date can overstate
  freshness. Not changed to avoid altering all 828 experiments' conditions.
- Locale-sitemap inclusion of pilot zh/fr/pl URLs was kept even though their
  hreflang alternates were trimmed (the URLs still exist and are
  self-canonical); noted as intentional, revisit with the site-wide hreflang
  decision.

Open / not resolved:

- Root cause of the Aug-16 index loss is unverified; this pilot is an
  expression/crawlability improvement, not a confirmed fix.
- No `needs_review`-snapshot university is in the pilot; the code path is
  fail-closed (verified by unit test on the fixture) but not exercised in a
  live page render.
- The curated summaries and title themes are new authored content derived
  from reviewed claims; they have not had an independent second review —
  flagged for Codex to check phrase-by-phrase against the claim texts
  (evidence: the full claim dumps in this report's session log; the source
  claims are in the release manifest's staged runs, e.g.
  `staging/uapt-runs/uapt-university-of-bristol-20260512`,
  `staging/uapt-runs/uapt-manchester-20260510`,
  `staging/uapt-runs/uapt-edinburgh-20260510`,
  `staging/uapt-runs/uapt-deakin-university-20260515`, and the bulk
  `staging/uapt-runs/uapt-ai-tools-qs-top-857-20260719-012` for Deakin's
  tool claims).

## Risks and reviewer focus points

- Summary accuracy: verify each curated sentence preserves scope (e.g.
  Manchester's "must be used whenever there is a risk of inappropriate
  disclosure" — from the enterprise-tools claim; Bristol's PGR thesis rule;
  Edinburgh's VLE/translation-app restrictions; Deakin's HDR
  copyediting-only rule).
- hreflang: confirm the en-only restriction matches the intended policy for
  the pilot; check that no non-pilot page's alternates changed (verified
  locally for Cambridge; spot-check more slugs if desired).
- The claims-section visual change on pilot pages (group headings + counts)
  is below the fold; confirm the screenshots show no first-screen impact.
- `getIndexRecoveryPilotSlugFromPath` matches only
  `/universities/{slug}`; alias slugs redirect before metadata, so no alias
  can bypass the pilot gate.

## Undo scope

All pilot changes are additive to the working tree and gated by
`isIndexRecoveryPilotSlug`. To revert this pilot manually, restore the eight
modified files (`git checkout -- <file>` is safe for the files this pilot
modified, but **do not** run a blanket `git checkout .`/`git clean` — the
tree contains pre-existing modifications and untracked files that must
survive) and delete the new files:
`apps/web/lib/index-recovery-pilot.ts`,
`apps/web/lib/university-claims-organization.ts`,
`apps/web/lib/related-universities.ts`,
`apps/web/components/university-claim-groups.tsx`,
`apps/web/components/related-universities.tsx`,
`tests/index-recovery-pilot.test.ts`,
`docs/index-recovery-p0-screenshots/`. Note that
`docs/policy-snapshot-contract.md` and all other pre-existing changes predate
this pilot and are not part of its undo scope.

## Observation plan (starts at the future production deploy, D0 = 待部署)

No production observation has started; nothing below has been measured. Do
not fill these in before real data exists.

- D+7: URL Inspection on the ten canonical URLs — has the new version been
  crawled; canonical as declared; hreflang set as declared.
- D+14: pilot index rate (indexed/10), index rate among re-crawled pages,
  impressions and control-group movement (GSC, aggregate locale/alias rows by
  entity).
- D+28: clicks, CTR, position, and query-mix composition vs the control
  group and vs a matched pre-period.
- Operational thresholds: ≥70% of all ten pilot pages indexed is a reference
  for considering a second small batch, subject to exposure and control-group
  results. Below 30%, pause expansion; at 30%–70%, continue observation.
  Report the re-crawled subset separately. Pages not re-crawled are
  "not yet evaluated", not repair failures. No automatic expansion. Metadata changes are not a confirmed
  root-cause fix and must not be reported as one.


## Codex correction record — 2026-09-13

Local only; no commit, push, PR, deployment or Google indexing request.
This section supersedes the earlier candidate's gating/date claims.

- Restored Bristol's assessment-instruction exception in metadata (also used
  by JSON-LD), matching the reviewed claim and visible prose.
- Added `apps/web/lib/index-recovery-basis.ts`: pinned SHA-256 fingerprints
  of the ten universities' reviewed claim records, including text, scope,
  review state and evidence. Check/retrieval timestamps are excluded.
  Empty, removed, downgraded, changed or newly added reviewed claims fail
  the match. These hashes are authored-content bindings, not independent
  review certificates; never regenerate them automatically on data updates.
- Static summaries and descriptions require the current basis. Static titles
  also require the basis; the six snapshot-backed titles additionally require
  an effective strong snapshot. A failed gate falls back to a neutral title
  and pilot description without a claim that a student snapshot exists.
  Existing validated strong Snapshot UI retains its own validation gate.
- Added `apps/web/lib/index-recovery-dates.ts`: pilot sitemap and JSON-LD
  share explicit source/claim lastChangedAt dates, effective-strong Snapshot
  generatedAt, and fixed expression version 2026-09-13. Aggregate summary
  dates, check timestamps and generic release dates are not inputs. Invalid
  dates are ignored. Non-pilot sitemap behavior is preserved.
- Corrected observation thresholds: 70% of all ten as an expansion reference,
  below 30% pause, 30%–70% continue observation; report re-crawled pages
  separately and do not classify unvisited new versions as repair failures.

Verification of corrected source:

- Web typecheck passed.
- Combined pilot and existing Snapshot suites: 30/30 passed (14 pilot,
  16 existing). Includes ten-university basis checks, downgraded claims,
  changed evidence/text, empty basis, Bristol exception, substantive-date
  changes, snapshot dates and check-only date stability.
- Local `next dev` on port 3107, internal API fetch disabled: Bristol,
  Harvard and Cambridge returned 200. Bristol's SSR metadata retained the
  permission exception; Harvard retained its reviewed Snapshot description;
  Cambridge retained its generic metadata, flat claims and no pilot summary.
- English universities and zh sitemaps returned Bristol lastmod
  2026-09-13T00:00:00.000Z and Cambridge's original
  2026-07-18T21:58:39.689Z.
- Diff whitespace check passed. The temporary dev server was stopped and
  its generated next-env import change restored.
- No new full production build or before/after visual comparison was run
  for this correction. Earlier build/screenshots describe the prior candidate
  and do not certify this corrected revision for production.
- 2026-09-13 release-readiness note: the `docs/index-recovery-p0-screenshots/`
  directory referenced above holds those prior-candidate full-page captures and
  is proposed for exclusion from the commit, so the paths mentioned in this
  report will not resolve in the repository. The corrected candidate's evidence
  is preserved in `docs/google-index-recovery-p0-evidence/`; commit scope is
  decided in `docs/google-index-recovery-p0-release-readiness.md`.
