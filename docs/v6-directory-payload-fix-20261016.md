# Current directories and bounded V6 first-paint data

Stage: LOCAL_PREPARED. Base: `65ff0fce0e8c216fa90d34cca28b1e5603991e19`.
Branch: `codex/v6-directory-payload-fix`. No push, production build, deployment,
content-pointer selection, snapshot re-pin or search notification was performed.
Gemini review remains pending at the user's request.

## Behavior

The production QS directory was rendered by the older main application while
the shared V6 zone served corrected detail records. Reuse the existing university
directory and QS composition inside the shared zone, with dynamic route wrappers
for English and the six existing localized routes. Both directories consume
`getStagedPublicDataset()` and its existing `applyV6RecordCorrections()` overlay,
the same effective summaries used by the zone's detail JSON. Counts, reviewed
counts, sources and check/change dates are derived from those records. The full
university-index endpoint is already dispatched by the zone's dynamic public API
handler. No second summary store, HTTP fan-out per school or policy rewrite was
introduced. Other ranking families remain with their existing application.

Published V6 first-paint props now contain one complete `LabSchool`, plus a
slug-to-name dictionary for the comparison picker. The existing comparison
effect fetches missing selected schools through `/api/policy-v6/compare`, including
schools restored from the URL. Original evidence, topic wording, held state and
student-action projections are unchanged. Private development previews keep
their existing behavior. This changes transport size, not the full-package
server loader or historical cache architecture.

## Local validation

- `pnpm check` and explicit `apps/tulsa-zone` TypeScript check passed.
- Five new integration regressions and seven related bundle/compact-template
  regressions passed. New coverage includes all published schools/locales,
  complete current-school objects, no other school's Claim IDs, immutable cached
  data, two/four-school comparison responses, invalid comparison requests, all
  effective directory rows and full-index JSON, and rendered QS counts.
- 128 local HTTP paths passed: 16 schools × seven locales, both directories ×
  seven locales, full-index JSON and Chinese two-school comparison. The scope is
  derived from the frozen pointers, rather than assumed by the implementation.
- Harvard, UCL and Cornell main-element SSR text was identical before/after,
  including evidence text. Tests also compare full current-school objects.
- Browser: add UCL from Cornell search; intentionally fail comparison with 503;
  show error/retry; retry successfully and open the two-school table. Restore a
  Chinese four-school URL with differences enabled, export CSV, and check
  document overflow at 390/720/1440px. Filter the university directory for Cornell
  and verify 47 claims, 17 sources and Oct 16, 2026 after full-index loading.
- Development-only analytics and favicon endpoints returned 404; the deliberate
  comparison 503 was removed after verifying retry. No production performance,
  memory, Lighthouse, candidate build or public cutover acceptance is claimed.

Measurements below are from the same local Next development server. Gzip sizes
were computed over saved responses; they are not production network transfer
measurements. Development scaffolding changes total HTML size.

| Page | Largest inline script before → after | Saved HTML gzip before → after |
| --- | ---: | ---: |
| Harvard | 863,591 → 113,052 bytes | 369,605 → 238,961 bytes |
| UCL | 917,455 → 133,724 bytes | 273,392 → 140,054 bytes |
| Cornell | 899,684 → 150,704 bytes | 299,508 → 173,079 bytes |

Private receipts and before/after HTML:
`.local/directory-payload-fix-20261016/`. Review screenshots and CSV are under
`output/playwright/` and `.playwright-cli/`; these are local artifacts.
The primary checkout's inventory pointer was verified against its frozen caches;
it remains requirements 1.0.0. This implementation task uses the 1.1.0 registry
without upgrading any earlier semantic review or approval.

## Release requirements after review and authorization

The directory defect remains live until route selection is changed. Updating
only the existing detail routes will not fix the production directories.

Use the existing shared zone and the current release-lifecycle entry point.
The bounded directory additions and published first-paint change are code changes
requiring a zone build and candidate acceptance; do not use Mode A for this work.
Register all fourteen exact directory paths:

- `/universities` and `/rankings/qs-2026`;
- each of those paths prefixed by `/zh`, `/fr`, `/pl`, `/es`, `/nl`, `/ms`.

Retain the existing `/api/public/v1/university-index.json` and comparison API
dispatch, assets, hard cross-zone navigation, and unrelated main-service routes.
Do not switch a broad `/universities/` or `/rankings/` prefix. Check filter query
strings, localized links, RSC requests, metadata, full-index responses and the
unmodified controls on the candidate. Run the synchronization/capacity gates and
public readback, then retire the old active through the lifecycle controller.
Use a code-specific asset prefix when freezing a future artifact; that release
configuration change has not been made here. Preserve all old artifacts and
content hashes; this fix does not publish a new university policy revision.

## Review entry

Review only this branch's diff against the base above. Focus on the dynamic
wrappers overriding the original static route policy, correct localized metadata,
the zone's existing effective-record overlay and index dispatch, and comparison
restore/error/retry/CSV behavior after removing preloaded school evidence.
No university content JSON or approval fingerprints should differ.
