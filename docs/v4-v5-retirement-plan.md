# V4/V5 retirement plan

Status: **plan only** (2026-11-22). Nothing is removed yet. This plan follows up
the 2026-11-21 audit (`audit-20261121/REPORT.md` §4, tooling-inventory §"V4/V5/V6").
Removing anything takes a program release with the owner's go-ahead.

## 1. What is true today

The audit counted "54 non-full-V6 schools still served by V4/V5". A recheck on
2026-11-21 changes that picture:

- **All 54 schools already render V6.**
  - All 54 slugs in `apps/web/lib/enforcement-v4-refresh-data.json` are in the
    repo's published V6 set (`data/public-v6-pages/current.json`, 132 slugs).
  - A public readback of all 54 `/universities/<slug>` pages returned
    `data-policy-layout="v6"`. None of the V4 enforcement block's English heading
    was found.
- So no school still needs a V4/V5 page. What remains is **code and data that V6
  still imports**:

| V4/V5 piece | Still used by | Live effect |
|---|---|---|
| `lib/enforcement-v4-refresh-data.json` (54 schools) | `components/enforcement-v4-refresh.tsx`; `lib/policy-v6-student-actions.ts` (MIT procedure rows); `scripts/policy-inventory.py` | `enforcementPage = isPublished && slug ∈ data && (!fullV6 \|\| slug === "harvard-university")`. With all 54 schools on full V6, only the Harvard branch can still render it. MIT's V6 student actions read their procedure rows from it |
| `components/enforcement-v4-refresh.tsx` | `universities/[slug]/page.tsx` | Harvard only (see above) |
| `lib/enforcement-v5-ui.ts` (`v5Ui`, `v5Display`, ...) | `universities/[slug]/page.tsx`, `policy-reference-layout.tsx`, `enforcement-v4-refresh.tsx` | Accepted UI strings on **every** university page |
| `lib/enforcement-v5-scene-zh.ts` (`localizeV5Scene`) | `universities/[slug]/page.tsx` | zh enforcement pages (Harvard only) |
| `lib/enforcement-v5-new-scenes.json`, `lib/policy-scene-ready-v4.ts` | `lib/policy-scene-pilot.ts` | Fallback scene data behind the V6 illustrated scene |
| `lib/home-v4-copy.ts` | `components/home-v6-view.tsx`, `lib/public-ui-sources.ts` | Homepage copy on V6 |
| `components/home-v4-view.tsx`, `lib/home-v4-guides.ts`, `lib/home-v4-preview.ts` | `app/(default)/page.tsx` | Development preview only (`isHomeV4Preview`) |
| `public/assets/policy-scenes/*v5*` (105 files), `public/assets/home-v4/` (4 files) | Scene and preview modules | Not referenced by the sampled live pages; check nginx logs before removal |
| `app/api/public/v1/policy-pages/v5.json` | Public API | Live, but returns `{"schemaVersion":"uapt-bounded-v5-pages-v1","releaseId":"v6-batch12-zh-20261121","slugs":[]}` with `no-store` |
| `apps/tulsa-zone` (1,781 files, 118 MB) | Not deployed. `tests/published-compact-marks.test.ts` reads its `public/` marks; `tests/web-zone-independence.test.ts` guards against imports from it; `scripts/export-public-change-history.ts` lists it as a workspace dir; `pnpm-lock.yaml` has an importer | None. `public-history-basis.ts` pins three of its files only as **frozen hash constants**, so deleting the files does not change the history basis |
| Trust pages (`components/trust-page.tsx`, `scripts/check-trust-pages-http.ts`) | Live trust pages | Use the V4 shared layout class names (`data-trust-layout="v4"`, `home-v4__title`) |
| Tests | `tests/homepage-v4.test.tsx`, `tests/v4-ready-expansion.test.tsx`, `tests/fullweb-published-zone-compat.test.ts` | — |

`data/public-v6-*/**/pku-v5-20261014*` are published V6 history revisions under an
old name. They are history: **never delete them.**

### The 54 schools

All 54 render V6 as of the 2026-11-21 readback.

university-of-bristol, university-of-auckland, manchester, stanford-university,
university-of-sydney, university-of-oxford, unsw-sydney, anu, harvard-university,
massachusetts-institute-of-technology, university-of-cambridge, ubc,
national-university-of-singapore, imperial-college-london, edinburgh,
university-of-queensland, adelaide-university, university-of-glasgow, ucl,
yale-university, princeton-university, university-of-chicago, university-of-toronto,
university-of-california-san-diego, trinity-college-dublin-the-university-of-dublin,
university-of-illinois-urbana-champaign, university-of-texas-at-austin,
university-of-birmingham, lund-university, brown-university,
pennsylvania-state-university, university-of-washington,
kth-royal-institute-of-technology, university-of-california-berkeley,
carnegie-mellon-university, the-university-of-western-australia,
university-of-amsterdam, the-london-school-of-economics-and-political-science, cuhk,
university-of-michigan-ann-arbor, ucla, university-of-alberta,
the-university-of-warwick, california-institute-of-technology, yonsei-university,
duke-university, nanyang-technological-university, ku-leuven,
northwestern-university, universite-psl, new-york-university,
city-university-of-hong-kong, the-hong-kong-polytechnic-university, peking-university.

## 2. Options

### Option A: re-run the 54 through the V6 pipeline in batches

Run the 54 schools through `scripts/v6-pipeline/` in about five batches of 10–12
(discover → capture → gates → assemble → content release). Their enforcement
and procedure material becomes V6 records with fresh evidence. Then remove the
modules as in option B, steps 2–5.

- **Effort:** about five content releases, plus crawl and review budget for 54 schools.
  At the recent pace (batch 3 and batch 12) this is about one to two weeks of
  agent time, then the same code removal as option B.
- **Risk:** medium.
  - Fresh crawls change claims. That is a content change, with its own review,
    history entries and sync events for each school.
  - Code removal waits on all five batches.
  - It does nothing for the Harvard branch, `v5Ui` or the homepage copy. Those
    still need option B's code work.
- **Benefit:** fresher evidence for 54 high-traffic schools. That is worth doing,
  but it is maintenance, not retirement.

### Option B: fold the remaining V4/V5 inputs into V6, then remove V4/V5

Keep every school's published claims as they are; nothing is re-crawled. The
pages already render V6.

1. **Move the live inputs into V6-owned modules.** No visible change.
   - `v5Ui`/`v5Display` strings go into the V6 UI string table (UI copy, so it is a
     program release).
   - The MIT procedure supplement rows go into a V6 data file read by
     `policy-v6-student-actions.ts`.
   - `home-v4-copy` goes into `home-v6-copy`.
   - The fallback scene data that `policy-scene-pilot.ts` still needs moves into V6
     scene data, or is dropped where the V6 illustrated scene always wins.
   - The trust-page class names get renamed in the CSS, the component and the
     smoke check together.
   - Prove it with a byte-for-byte rendered-HTML comparison (minus build IDs) of the
     54 pages plus a sample of base-tier pages, in en and zh.
2. **Remove the Harvard enforcement branch.** Decide whether its procedure
   content belongs in Harvard's V6 record (then it is a content release with agent
   review) or is already covered by V6 student actions.
3. **Delete the V4/V5 modules:**
   - `enforcement-v4-refresh.*`, `enforcement-v5-*`, `policy-scene-ready-v4.ts`
     and `home-v4-*`;
   - the dev-only previews and their tests;
   - the 105 `*v5*` scene assets and `home-v4/` assets, after 14 days of nginx logs
     show no requests.
4. **Remove `apps/tulsa-zone`:**
   - delete the workspace and its `pnpm-lock.yaml` importer;
   - drop it from `export-public-change-history.ts` `workspaceDirs`;
   - point `tests/published-compact-marks.test.ts` at the marks the web app serves;
   - keep `web-zone-independence.test.ts` as a guard, or retire it with the
     directory;
   - leave the frozen hash constants in `public-history-basis.ts`. They are
     history identity and need no source files.
   - The lifecycle controller's `apps/tulsa-zone` paths refer to installed server
     release roots, not to this repo; change them only through the retention plan.
5. **Retire `v5.json`** using the deprecation window in §3.

- **Effort:** one program release.
  - Steps 1–4 are about 1–2 days of agent work plus tests.
  - The rendered-HTML comparison is the main cost.
  - The asset log check and the v5.json window add calendar time, not work.
- **Risk:** low to medium.
  - The main risk is a visual or text regression on live pages; the HTML
    comparison and readback of the 54 pages contain it.
  - No claim, history or sync contract changes.
  - Rollback is the previous program release.
- **Benefit:**
  - Removes about 120 MB of the repo (mostly `apps/tulsa-zone` and the
    scene assets).
  - Removes three generations of page code.
  - Removes the last public V5 surface.

## 3. Deprecation window for `/api/public/v1/policy-pages/v5.json`

The endpoint already returns an empty slug list, so no client can be relying on
its content. It is still a published URL, so retire it in stages:

1. **Announce (from the program release in step 1, at least 30 days).**
   - Add `Deprecation` and `Sunset` response headers (RFC 9745 / RFC 8594), and a
     `Link: </api/public/v1/policy-pages/v6.json>; rel="successor-version"`.
   - Mention the change in the API docs and the public changelog.
2. **Gone (after the sunset date, 90 days).**
   - Return `410 Gone` with a JSON body that points to the V6 endpoints.
   - Count requests from nginx logs; GSC is not relevant for an API.
3. **Remove** the route after the 90 days, if traffic is negligible. Otherwise
   extend the 410 period.

## 4. Recommendation

Do **option B** now; it is the actual retirement work. The schools are already
on V6, so option A is not a precondition. Schedule the 54 schools for fresh
evidence through the normal V6 pipeline cadence (option A's batches) as
maintenance, independent of the code removal. Start step 1 after the render-once
work on `claude/pensive-elion-2fc75f` has landed, because both touch
`universities/[slug]/page.tsx` and the shared UI strings.
