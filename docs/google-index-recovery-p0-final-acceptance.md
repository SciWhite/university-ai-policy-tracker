# P0 Google index recovery — corrected final acceptance

Status: local acceptance passed for the checked P0 scope. Not committed,
not pushed, not deployed. D0 remains 待部署.

## Verification provenance

- Corrected by Codex on 2026-09-13 after reviewing the Opus 4.6 report.
- Source HEAD: `900ddd54888603abf1ba74600ebc3281b9df2757`, with the existing
  uncommitted P0 changes. No product source changes were needed in this pass.
- Candidate: existing production build `ZE2EotqUV9aYNm4ymToNc`, running with
  `next start` on port 3107 and `UAPT_DISABLE_INTERNAL_FETCH=1`.
- Opus reported a successful 5279-page build. Codex verified BUILD_ID,
  source checksum matches and that the resulting production server works;
  this pass did not repeat the full build or independently recover its exit log.
- Prior independent checks: 30/30 combined tests, Web typecheck and diff
  whitespace checks passed. This pass changes evidence/reporting only.
- Full current source checksums: [source-sha256.json](./google-index-recovery-p0-evidence/source-sha256.json).

## Corrections to the Opus report

1. The two images labelled mobile in the Antigravity screenshot directory
   were actually 1280×720 and byte-identical to their desktop counterparts.
   They are superseded and are not mobile acceptance evidence.
2. Baseline comparison was required, not optional. It is now completed below.
3. “RSC 500 is expected with disabled internal API” was unsupported and is
   withdrawn. Three repeated candidate probes returned 200 text/x-component.
4. Claims summaries are not always below the first viewport. Manchester is
   short enough that the approved summary begins within the first viewport.
   The acceptance boundary is preservation of the existing header/Snapshot
   area, with approved additions in Reviewed claims and related links.

## Baseline and comparability

A `git archive HEAD` checkout was created in an isolated temporary directory.
Its location record (`baseline-location.json`) stays in the local gitignored
`output/playwright/p0-final/` because it holds a machine-specific temporary
path; the baseline commit is `900ddd54888603abf1ba74600ebc3281b9df2757`.
It used the same installed dependency tree and the exact same `.runtime-data`
directory as the candidate, through symlinks. No data was refetched or edited.
The current release manifest hash is included in source-sha256.json.

The baseline ran `next dev --webpack` on port 3108; the candidate ran the
production build. Only the baseline's developer indicator was disabled in
its temporary config. This is a same-data rendered-UI comparison, not a
comparison of two production build pipelines or a performance benchmark.
The temporary location was kept for reproducibility; both servers were stopped.

Browser settings: Chromium, light scheme, reduced motion; fonts loaded before
capture; matching language-suggestion state. Exact viewports: desktop
1440×900 and mobile 390×844. All six page/viewport combinations had
`document.documentElement.scrollWidth === innerWidth`.

## Visual results

14 matched baseline/candidate pairs were compared with Pillow pixel differences.
Eight were pixel-identical:

- Harvard desktop/mobile first screen (2).
- Harvard desktop/mobile researcher view (2).
- Cambridge desktop/mobile first screen and Reviewed claims (4).

The six differing pairs are Harvard's two claims views and Manchester's
first-screen/claims views at both sizes. Differences correspond to the approved
claim grouping and claims-summary insertion. Manchester first-screen differences
begin at y=516 desktop and y=645 mobile; the preceding header and empty-Snapshot
state are unchanged. No horizontal overflow or visible overlap was found.

The first Harvard desktop baseline capture preceded the client language banner;
it was recaptured after explicitly waiting for the banner. The replacement is
pixel-identical to the candidate. The initial metrics in capture.log are retained
as historical raw output and must not be treated as the replacement's geometry.

Evidence, committed subset in `docs/google-index-recovery-p0-evidence/`:

- [Pixel comparison](./google-index-recovery-p0-evidence/pixel-comparison.json)
- [Harvard mobile first screen](./google-index-recovery-p0-evidence/candidate-harvard-mobile-first.png)
- [Manchester mobile first screen](./google-index-recovery-p0-evidence/candidate-manchester-mobile-first.png)
- [Harvard mobile claims](./google-index-recovery-p0-evidence/candidate-harvard-mobile-claims.png)
- [Manchester mobile footer](./google-index-recovery-p0-evidence/candidate-manchester-mobile-footer.png)

That subset also contains the matching `baseline-` image for each of the six
pairs whose pixels differ, and the pixel-identical Cambridge desktop
first-screen control pair, so the bounds in pixel-comparison.json can be
re-checked without the local capture set. Candidate footer captures are
supplementary, not matched pairs.

The capture scripts and their raw output (`capture.js`, `capture-claims.js`,
`capture.log`, `capture-claims.log`) are not committed because they embed
machine-specific absolute paths. They remain in the local gitignored
`output/playwright/p0-final/`, which still holds every paired image prefixed
`baseline-` or `candidate-`. No screenshots in the old Antigravity directory
were overwritten, and none of its images are part of this evidence subset.

Only these evidence locations changed during release-readiness preparation on
2026-09-13; no conclusion, measurement or correction above was altered.

## Runtime and interaction

- Actual browser click on Harvard's Researcher link navigated successfully to
  `?for=researcher`. Both baseline and candidate rendered
  `data-snapshot-role="researcher"` at desktop and mobile sizes.
- Harvard, Bristol and Cambridge RSC requests, using `RSC: 1`, each returned
  `200` and `text/x-component` with internal API fetching disabled.
  [Recorded responses](./google-index-recovery-p0-evidence/rsc.json).
- Earlier production-mode review confirmed Bristol's permission exception
  in SSR and the corrected trial metadata; these source files remain unchanged.

Local environment limitation: both servers logged analytics mirror failures
because DATABASE_URL was absent. This pass verifies UI interaction, not analytics
persistence; no production database connection was configured.

## Scope of conclusion

The missing mobile evidence and baseline comparison are now supplied, and the
incorrect RSC explanation is corrected. No additional product-code repair was
indicated by this verification. The checked candidate can proceed to a separately
authorized commit/release step; production verification remains necessary then.
This does not prove Google indexing recovery or certify all untested devices.

No commit, push, PR, deployment, Google indexing request or scheduled task.
Existing user changes were preserved. No dependencies or lockfile were changed.
