# P0 Google Index Recovery — Deployment & Production Verification Report

- Status: **Production Deployed & Verified. Ready for Codex Independent Acceptance.**
- Deployment Time (D0): **2026-09-13 13:06 UTC** / **2026-09-13 21:06 Asia/Shanghai**
- Public URL: `https://eduaipolicy.org`
- Host: OCI `hermes-agent-prod` (`129.153.56.227`) behind Cloudflare and nginx

---

## 1. Release Provenance & Commit Traceability

| Item | Value | Note |
| --- | --- | --- |
| Baseline Commit | `900ddd54888603abf1ba74600ebc3281b9df2757` | Initial production state before deploy |
| Baseline `BUILD_ID` | `51h4iO_TJYnZRSRmRYHPz` | Restorable from backup |
| Product Code Commit | `a9b7b3017f69460010996841fa16db664b54b0fc` | Branch `codex/google-index-recovery-p0` |
| Docs & Evidence Commit | `a2076365bfef70d249f6b92a2a07c1b48b94871b` | Branch `codex/google-index-recovery-p0` |
| Pull Request | [#13](https://github.com/SciWhite/university-ai-policy-tracker/pull/13) | Merged cleanly into `main` |
| **Deployed Commit SHA** | `533be9a7bb6a2de1c50e2bf330da7d746121158d` | `origin/main` merge commit |
| **Deployed Production `BUILD_ID`** | `o0qe3kKtLOZOHAcnWjWjS` | Built on host, verified in production |
| Active Service PID | `3869286` (node) / `3869299` (`next-server v16.2.4`) | Listening on `127.0.0.1:3100` |

---

## 2. Exact File Scope

### 2.1 Included in Product Scope (16 paths)
- **Modified (8 paths)**:
  - `apps/web/app/(default)/universities/[slug]/page.tsx`
  - `apps/web/app/globals.css`
  - `apps/web/lib/i18n-metadata.ts`
  - `apps/web/lib/sitemap-sections.ts`
  - `apps/web/lib/surface-localization.tsx`
  - `apps/web/components/student-policy-snapshot.tsx`
  - `apps/web/components/claim-evidence-card.tsx`
  - `package.json`
- **New (8 paths)**:
  - `apps/web/lib/index-recovery-pilot.ts`
  - `apps/web/lib/index-recovery-basis.ts`
  - `apps/web/lib/index-recovery-dates.ts`
  - `apps/web/lib/university-claims-organization.ts`
  - `apps/web/lib/related-universities.ts`
  - `apps/web/components/university-claim-groups.tsx`
  - `apps/web/components/related-universities.tsx`
  - `tests/index-recovery-pilot.test.ts`

### 2.2 Included in Reports & Preserved Evidence (23 paths)
- `docs/google-index-recovery-p0-review.md`
- `docs/google-index-recovery-p0-final-acceptance.md`
- `docs/google-index-recovery-p0-release-readiness.md`
- `docs/google-index-recovery-p0-evidence/` (20 files, including `source-sha256.json`, `pixel-comparison.json`, `rsc.json`, and 17 baseline/candidate comparison images)

### 2.3 Preserved Untouched in Working Tree (Excluded)
- `docs/policy-snapshot-contract.md` (unrelated Wave 1 document edits preserved)
- `docs/prompts/`, `docs/templates/`, `docs/student-first-university-rollout-playbook.md` (untracked authoring material preserved)
- `apps/web/app/apple-icon 2.png`, `favicon 2.ico`, `icon 2.png`, `apps/web/public/llms 2.txt` (local copy artifacts excluded)
- `supabase/` (local Supabase CLI state preserved)
- `docs/index-recovery-p0-screenshots/` (prior candidate images excluded)
- `.env.agents.local`, `.local/secrets/` (credentials outside git)

---

## 3. Data & Fingerprint Verification

### 3.1 Source Fingerprints (`source-sha256.json`)
All 8 checksums matched before packaging:
- `apps/web/lib/index-recovery-pilot.ts`: MATCH
- `apps/web/lib/index-recovery-basis.ts`: MATCH
- `apps/web/lib/index-recovery-dates.ts`: MATCH
- `apps/web/lib/sitemap-sections.ts`: MATCH
- `apps/web/app/(default)/universities/[slug]/page.tsx`: MATCH
- `tests/index-recovery-pilot.test.ts`: MATCH
- `apps/web/.runtime-data/data/public-releases/current.json`: MATCH (`6ea988a5c65ffd54fd375336ff777b66d64e422da99370a17beb0f432db947c9`)

### 3.2 Real Production Data Check against OCI Public API
Before cutover, the live public API on `127.0.0.1:3100` was queried for all ten pilot universities.
All 10 universities matched their pinned SHA-256 claims-basis fingerprints:
- `harvard-university`: 30 claims, fingerprint MATCH, dual-agent strong snapshot verified
- `unsw-sydney`: 35 claims, fingerprint MATCH, dual-agent strong snapshot verified
- `university-of-sydney`: 11 claims, fingerprint MATCH, dual-agent strong snapshot verified
- `national-university-of-singapore`: 14 claims, fingerprint MATCH, dual-agent strong snapshot verified
- `university-of-oxford`: 15 claims, fingerprint MATCH, dual-agent strong snapshot verified
- `utrecht-university`: 9 claims, fingerprint MATCH, dual-agent strong snapshot verified
- `university-of-bristol`: 4 claims, fingerprint MATCH, snapshot 404 (snapshot-less pilot)
- `manchester`: 15 claims, fingerprint MATCH, snapshot 404 (snapshot-less pilot)
- `edinburgh`: 19 claims, fingerprint MATCH, snapshot 404 (snapshot-less pilot)
- `deakin-university`: 8 claims, fingerprint MATCH, snapshot 404 (snapshot-less pilot)

---

## 4. Isolated Build & Cutover Procedure

### 4.1 Isolated Build Location
- Build directory: `/srv/uapt/builds/uapt-533be9a` (created via `git worktree add` from commit `533be9a7bb6a2de1c50e2bf330da7d746121158d`)
- Dependency install: `pnpm install --frozen-lockfile` (3.4s)
- Environment: Node `v22.22.3`, pnpm `10.0.0`, user `uapt`, `UAPT_DISABLE_INTERNAL_FETCH=1`, `production.env` sourced
- Full static generation: 5,141 pages prerendered
- Exit code: `0` (BUILD_OK)
- Generated `BUILD_ID`: `o0qe3kKtLOZOHAcnWjWjS`
- Build log preserved at: `/srv/uapt/builds/uapt-533be9a/build.log`

### 4.2 Pre-Cutover Verification on Temporary Port (127.0.0.1:3107)
The candidate was booted on idle port `3107` with `INTERNAL_NEXT_BASE_URL=http://127.0.0.1:3107` and verified:
- All 10 pilot universities: HTTP 200, unique titles and descriptions, `en` + `x-default` alternates, `2026-09-13` dateModified, zero machine candidate leaks.
- Bristol exemption: verified SSR metadata and HTML contain "unless assessment instructions allow more comprehensive use".
- Controls: 4 sampled controls verified to retain generic titles, 8 alternates, and original data dates.
- RSC: HTTP 200 with `text/x-component` on Harvard, Bristol, and Cambridge.
- Role switch: `?for=researcher` rendered `data-snapshot-role="researcher"` with clean canonical.
- Mobile viewport: verified `scrollWidth === innerWidth === 390` (no horizontal overflow).

### 4.3 Rollback Preparation & Artifact Backup
Before touching the active directory, existing production artifacts were archived:
- Backup directory: `/srv/uapt/build-backups/uapt-backup-pre-index-recovery-51h4iO`
- Preserved `.next` (BUILD_ID `51h4iO_TJYnZRSRmRYHPz`)
- Preserved `.runtime-data`
- Preserved commit `900ddd54888603abf1ba74600ebc3281b9df2757`
- Immediate rollback plan: atomic restore of backup directory and `git reset --hard 900ddd5` in < 5 seconds without rebuild.

### 4.4 Cutover Execution
1. Candidate on 3107 stopped.
2. `/srv/uapt/app` git tree reset to `533be9a7bb6a2de1c50e2bf330da7d746121158d`.
3. `pnpm install --frozen-lockfile` verified.
4. Incoming artifacts copied to `.next.incoming` and `.runtime-data.incoming`.
5. Atomic directory swap:
   - `/srv/uapt/app/apps/web/.next` -> `.next.old-51h4iO`
   - `.next.incoming` -> `.next`
   - `.runtime-data` -> `.runtime-data.old`
   - `.runtime-data.incoming` -> `.runtime-data`
6. `sudo systemctl restart uapt-web.service` (restarted cleanly in 297ms).

---

## 5. Post-Deploy Verification Results

Both **Origin Direct** (`127.0.0.1:3100` & nginx `127.0.0.1`) and **Public Cloudflare** (`https://eduaipolicy.org`) were probed and verified 100% passing.

### 5.1 Ten Pilot Universities

| University | Canonical Slug | HTTP | SSR `<title>` Theme | Meta Description | Hreflang Alternates | JSON-LD `dateModified` |
| --- | --- | :---: | --- | --- | :---: | :---: |
| Harvard | `harvard-university` | 200 | course-level rules and confidential-data limits | Dual-agent snapshot summary (272 chars) | `en`, `x-default` | `2026-09-13T00:00:00.000Z` |
| UNSW Sydney | `unsw-sydney` | 200 | assessment-category framework | Snapshot summary (204 chars) | `en`, `x-default` | `2026-09-13T00:00:00.000Z` |
| Sydney | `university-of-sydney` | 200 | two-lane assessment model | Snapshot summary (203 chars) | `en`, `x-default` | `2026-09-13T00:00:00.000Z` |
| NUS | `national-university-of-singapore` | 200 | assessment and approved-tool rules | Snapshot summary (241 chars) | `en`, `x-default` | `2026-09-13T00:00:00.000Z` |
| Oxford | `university-of-oxford` | 200 | assessment declarations and thesis rules | Snapshot summary (251 chars) | `en`, `x-default` | `2026-09-13T00:00:00.000Z` |
| Utrecht | `utrecht-university` | 200 | AI index and tool allow-listing | Snapshot summary (195 chars) | `en`, `x-default` | `2026-09-13T00:00:00.000Z` |
| Bristol | `university-of-bristol` | 200 | four-category assessment rules | Curated summary (358 chars; retains exception) | `en`, `x-default` | `2026-09-13T00:00:00.000Z` |
| Manchester | `manchester` | 200 | five principles and school-level course rules | Curated summary (243 chars) | `en`, `x-default` | `2026-09-13T00:00:00.000Z` |
| Edinburgh | `edinburgh` | 200 | assessment-level rules and the ELM platform | Curated summary (272 chars) | `en`, `x-default` | `2026-09-13T00:00:00.000Z` |
| Deakin | `deakin-university` | 200 | acknowledgement and HDR thesis limits | Curated summary (262 chars) | `en`, `x-default` | `2026-09-13T00:00:00.000Z` |

- **Bristol Permission Exemption**: Verified in SSR `<meta name="description">` and body text: `"unless assessment instructions allow more comprehensive use"`.
- **Machine Candidate Leakage**: Probed all 10 pages; 0 leaks found (`leak: false`).
- **Claim Grouping**: Strong-snapshot pilots group claims by reviewed dimension; snapshot-less pilots group claims by claim taxonomy type.
- **Summary Blocks**: Render only on snapshot-less pilots alongside the explicit non-snapshot disclaimer.
- **Official Source Links**: Verified on live site (e.g. Harvard: 43 links, Bristol: 8 links, Manchester: 22 links) with `data-analytics-event="official_source_click"` and direct official `.edu`/`.ac.uk` URLs.

### 5.2 Control Universities (Unmodified Baseline)
- `university-of-cambridge`: HTTP 200, generic title, 8 alternates, `dateModified: 2026-07-18T21:58:39.689Z`, ungrouped flat claims, no summary block.
- `stanford-university`: HTTP 200, generic title, 8 alternates, `dateModified: 2026-07-18T21:34:39.689Z`.
- `monash`: HTTP 200, generic title, 8 alternates, `dateModified: 2026-07-19T00:45:39.689Z`.
- `university-of-birmingham`: HTTP 200, generic title, 8 alternates, `dateModified: 2026-07-19T02:48:39.689Z`.

### 5.3 Sitemaps
- `https://eduaipolicy.org/sitemaps/universities.xml`:
  - Exactly the 10 pilot universities have `lastmod` raised to `2026-09-13T00:00:00.000Z`.
  - Control universities retain original dates (e.g., Cambridge `2026-07-18T21:58:39.689Z`).
  - Public Cloudflare response: HTTP 200 (`cf-cache: DYNAMIC`).

### 5.4 Interactions, RSC, & Protection
- **Role Switching**: Real click and HTTP fetch on `?for=researcher` rendered `data-snapshot-role="researcher"` while keeping clean canonical `/universities/harvard-university`.
- **RSC Probes**: Probed `harvard-university`, `university-of-bristol`, and `university-of-cambridge` with header `RSC: 1` -> HTTP 200 `Content-Type: text/x-component`.
- **Private Route Protection**: `/internal/analytics` returns HTTP 401 Unauthorized.
- **Co-hosted CELPIP Service**: `systemctl is-active clb-pro-mock-exam` is `active`, health check `http://127.0.0.1:9000/api/ai-score/health` returns `{"ok": true, "status": "ok"}`.

---

## 6. Real D0 & Evaluation Schedule

- **D0 (Real Deployment)**: **2026-09-13**
  - UTC: `2026-09-13T13:06:00Z`
  - Asia/Shanghai: `2026-09-13T21:06:00+08:00`
- **D+7 Observation** (**2026-09-20**):
  - Google URL Inspection on the 10 canonical URLs.
  - Assert crawl timestamp, indexing status, canonical declaration, hreflang evaluation.
- **D+14 Observation** (**2026-09-27**):
  - 10-pilot index rate (indexed/10).
  - Re-crawled subset indexing rate reported separately.
  - GSC Impressions compared against the 10 matched control universities.
- **D+28 Evaluation** (**2026-10-11**):
  - Clicks, CTR, average position, and query-mix composition.
  - Expansion thresholds:
    - $\ge 70\%$ indexed: positive reference for batch 2 expansion.
    - $30\% - 70\%$: continue observation.
    - $< 30\%$: pause expansion.
    - Pages not yet re-crawled are categorized as "not yet evaluated", not failure.

> [!NOTE]
> Per task rules: No Google Search Console reindexing requests were submitted, and no crons/automated tasks were created.

---

## 7. Delivery for Codex Independent Acceptance

The P0 Google Index Recovery Pilot is completely deployed to OCI production and verified on `https://eduaipolicy.org`.
This report is provided for independent Codex acceptance.
