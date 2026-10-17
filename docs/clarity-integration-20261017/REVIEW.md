# Microsoft Clarity integration — candidate, 2026-10-17

Status: account configured; source candidate locally verified; production deployment and AI Citations acceptance pending.

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
