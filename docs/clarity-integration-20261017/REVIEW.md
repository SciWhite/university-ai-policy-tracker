# Microsoft Clarity integration — V6 production acceptance, 2026-10-17

Status: corrected V6 integration deployed and independently accepted; lifecycle complete and previous web retired. AI Citations dashboard activation remains pending in Microsoft’s UI.

## Account readback

- Existing project `eduaipolicy.org`, Project ID `ye6c4h9822`, website `https://eduaipolicy.org/`.
- Completed the emailed verification link and unlocked the existing project. No duplicate project was created.
- Bing Webmaster explicitly displays **Your site is added to Clarity**. This is account association evidence, not proof that AI Citations is activated.
- Clarity Setup: **Cookies Off** (Consent Mode); bot detection remains enabled.
- Masking: **Strict** checked; all text masked. The UI warns changes can take up to an hour.
- AI Visibility > Citation still redirects to installation onboarding. Neither citation metrics nor live SDK ingestion has been accepted.
- No API token, advertising connection, CDN logging subscription or additional user access was created.

## Source behavior

The shared zone opts into a small client integration after hydration. The main RootDocument defaults to disabled. The hosted Clarity script loads only on `eduaipolicy.org`/`www.eduaipolicy.org`, after a separate explicit adult opt-in. Localhost never sends data to Microsoft.

Consent expires after 180 days. Missing, malformed, expired, future or inaccessible preferences fail closed. Website analytics opt-out, Global Privacy Control and Do Not Track override the Clarity preference. Advertising storage is always denied. No custom identity, raw search event or first-party analytics identifier is mirrored to Clarity.

The whole body is masked. Internal/API/search/review/contribution/account/auth pages, URL query parameters and query-bearing referrers are excluded. When an SDK is already loaded, navigation into an excluded surface uses a full document navigation; a history/back transition stops recording and reloads. Withdrawal denies storage, clears Clarity first-party cookies, stops the SDK and reloads to unload its listeners. Global website analytics opt-out also removes the previous Clarity grant.

All seven privacy pages have a dedicated Clarity disclosure, Microsoft privacy/retention links and a persistent opt-in/withdrawal control. The existing Supabase paragraph and its separate retention period are preserved. The consent prompt uses the existing site tokens and equally styled allow/decline buttons.

## Verification

- `pnpm check`: passed (validators, workspace typechecks and lint; no production build).
- `pnpm --filter @uapt/web typecheck`: passed.
- `pnpm exec tsc --noEmit -p apps/tulsa-zone/tsconfig.json`: passed.
- `pnpm exec tsx --test tests/clarity-consent.test.ts tests/analytics-preference.test.ts`: 5 passed.
- Browser: all seven privacy URLs render the disclosure and Microsoft links; Chinese analytics opt-out disables the Clarity control. Allow and withdrawal update the controls in a local test document.
- Browser: the user's actual Edge Do Not Track signal is `1`; Clarity is suppressed. For the local consent-UI test only, the signal was temporarily simulated as `0` in one document, then restored by reloading. No browser-wide setting was changed. No local consent grant remains after cleanup.
- Chinese mobile consent prompt at 390×844: no horizontal overflow (clientWidth = scrollWidth = 390); screenshot inspected.
- Local browser console: no application error during control interaction. Existing first-party analytics persistence fails without DATABASE_URL in this isolated checkout; a 204 ingest response is not persistence acceptance.
- SDK loading/queue/navigation/withdrawal tests use controlled fakes. They do not prove Microsoft received a production session.

## Authorized bounded release

User-approved scope: the 17 published V6 universities, including the completed Tsinghua release, and necessary seven-language privacy controls. Future formally published V6 universities inherit the same integration through the published-school registry and shared zone composition. Main/legacy page templates do not enable the integration by default.

The active policy baseline is `3ada2ae14f13fc0bec64f819e04d1991033f8c7c`, paired revision `tsinghua-v6-r2-20261017`. Page/record/history source bytes and Claim IDs remain unchanged. Tsinghua stays PARTIAL, and student snapshot holds stay needs_review.

Only the shared `@uapt/tulsa-zone` is built on OCI, with a distinct `/policy-clarity-v6-20261017` asset prefix. The fixed shared-web candidate replaces the current shared web; main, MCP and the frozen legacy dependencies remain active. Existing exact shared routes and historical/static compatibility are retained. Privacy paths are explicitly added to the same route transaction. No university policy publication, snapshot re-pin or search notification is part of this UI release.

Candidate and public matrices must cover all 17 × 7 university pages, all seven privacy routes, unchanged policy JSON/Claims and histories, and necessary route controls. SDK, consent, withdrawal and Microsoft receipt require browser/network evidence in addition to structural HTML readback. Capacity, static archive, contract 2.0.0 and old-active retirement are mandatory lifecycle gates.

Production acceptance is still pending at this source freeze. Final results will be appended after actual cutover and public verification.

## Official implementation references

- [Consent management](https://learn.microsoft.com/en-us/clarity/setup-and-installation/consent-management)
- [ConsentV2 API](https://learn.microsoft.com/en-us/clarity/setup-and-installation/clarity-consent-api-v2)
- [Masking/client API](https://learn.microsoft.com/en-us/clarity/setup-and-installation/clarity-api)
- [Data retention](https://learn.microsoft.com/en-us/clarity/setup-and-installation/data-retention)
- [Citation domain verification](https://learn.microsoft.com/en-us/clarity/ai-visibility/ai-citations-overview)

## Public consent QA found and corrected before acceptance

The first candidate `8a47e8a9` passed the route matrix (539 checks), 119 browser page renders and 85 MCP calls covering 555 claims. A deliberately consented single-document browser probe loaded the hosted tag/SDK (200) and received `https://u.clarity.ms/collect` 204. However, withdrawing on the SDK-free privacy page left existing `_clck`/`_clsk` cookies. The lifecycle transaction was recovered to the previous active before acceptance; this attempt is not a completed release.

Cookie expiration now runs on withdrawal even when no SDK has been loaded in that document, and runs after SDK stop. Excluded surfaces and initial effective opt-out also clear residual first-party Clarity cookies. A regression assertion covers withdrawal without any SDK. Source revision, build, candidate and public acceptance are repeated for the corrected artifact; prior evidence is preserved separately.


## Corrected production acceptance

- Deployed source: `eb0139d876f7b867699126751ff4dd64c5a94f72` (PRs #19 and #20); BUILD_ID `xTzvZFPkLfwN-1JHik3zS`. Only the shared zone was built. This documentation closeout is not another application release.
- Coverage: 17 schools × 7 languages = 119 V6 detail pages, plus seven existing privacy routes. The shared published-school registry provides the same opt-in integration to future formally published V6 schools.
- Candidate: 539 route/data checks passed; all 119 school pages and seven privacy pages rendered in Edge. Explicit consent/withdrawal regression tests: 5 passed; `pnpm check`, zone typecheck and diff check passed.
- Public: 539 route/data checks passed; all 126 affected HTML routes returned the frozen code release header. Seventeen school pages and seven privacy pages received additional browser readback. All 1,110 frozen build files were still byte-identical after acceptance.
- MCP: candidate and public each ran 85 calls covering all 555 Claim IDs across 17 schools, with exact claim/evidence comparison and no remaining IDs. The MCP service and catalog were retained unchanged. Tsinghua remains 48 claims, 15 sources and one tool; its snapshot is unavailable with `pending_review`, and `needs_review` is preserved. This integration does not upgrade PARTIAL audit status.
- Real SDK probe: default DNT=1 had no hosted SDK or residual Clarity cookies. In one controlled test document only, DNT was simulated as 0, then the visible adult opt-in was clicked. The hosted tag and SDK returned 200; `i.clarity.ms/collect` returned 204. This establishes endpoint receipt, not dashboard processing or recorded-session availability.
- Real withdrawal: navigation from Cornell to privacy unloaded the SDK and cleared both `_clck` and `_clsk`. Clicking withdrawal kept both cookies absent. Website analytics opt-out removed the Clarity grant; a granted preference on a query-bearing Tsinghua page still did not load an SDK. Test preference keys were restored to their original absent state, cookies cleared, document DNT restored to 1 by navigation, and viewport overrides reset. No browser-wide privacy setting was changed.
- Responsive proof: the public Chinese Tsinghua consent prompt at a measured 390px viewport has 390px scrollWidth and no horizontal overflow; [screenshot](public-consent-mobile.png). No application warnings/errors were captured during the public browser checks.
- Capacity: fixed build scope peak 1,270,476,800 bytes; startup 183,906,304; cold history 231,571,456; steady 1,015,361,536. All within the admitted 2 GiB candidate budget; no OOM kills or candidate restarts. Historical cold/warm requests were serialized.
- Static compatibility: 24 retiring-release files and 25 new files passed individual SHA256, production TLS, MIME and immutable-cache checks; all 49 passed again after retirement. Prior unsuccessful candidate static files remain available through the same controlled prefix for already-open documents.
- Lifecycle: contract 2.0.0 candidate and completion ledgers passed. Transaction completed at `2026-10-17T06:14:00.917365+00:00`; previous shared web `uapt-shared-v6-r2.service` is inactive/disabled; replacement fixed slot `uapt-shared-v6-candidate.service` is active/enabled, NRestarts=0. Main and MCP were not restarted; the legacy set did not grow. Full loaded Nginx has no retiring `127.0.0.1:3161` endpoint.
- After retirement: six exact semantic public checks, six unrelated controls and all 49 static files passed. Cold rollback retains prior release, unit/env and Nginx bytes without rebuilding.
- No policy mutation, snapshot re-pin, inventory promotion, IndexNow, advertising integration, paid CDN logging or API token was performed.

Server evidence is preserved under `/srv/uapt/operations/clarity-v6-r2-20261017/`: `release-plan.json`, `capacity.json`, `sync-candidate/`, `sync-public/`, public and browser proofs, and `final-acceptance.json`. The first rolled-back attempt remains separately under `/srv/uapt/operations/clarity-v6-20261017/`. Local private evidence is in the isolated worktree’s `.local/clarity-v6-release-r2-20261017/`.

## Remaining Microsoft-side acceptance

Bing Webmaster previously confirmed **Your site is added to Clarity**. The final AI Visibility → Citation navigation still shows the first-install welcome screen and “It may take up to two hours.” The SDK’s successful 204 collection receipt does not establish that the Citations dashboard is enabled or that any citations exist. No duplicate project, extra credentials or speculative account change was used to bypass this state. Website integration is accepted; AI Citations activation/data visibility remains unverified until Microsoft exposes the dashboard.
