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

The shared RootDocument mounts a small client integration after hydration. Both web and the shared zone import this composition. The hosted Clarity script loads only on `eduaipolicy.org`/`www.eduaipolicy.org`, after a separate explicit adult opt-in. Localhost never sends data to Microsoft.

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

## Production release boundary

This modifies a global document composition. `docs/release-routing-policy.md` therefore requires an authoritative OCI full build plus coordination of existing zone overrides. A shared-zone-only build would leave the main service and legacy page/identity services uninstrumented, including privacy disclosures, so it is insufficient to claim a whole-site installation.

Read-only production inspection found the main service still runs code `622e996d1375f43fb70eacfaaee0f364ab164f20` on 3100; current shared V6 routes run `f4347c0d880d3e04c214f9e59ba902b687c1e204` on 3163. The registry retains nine legacy dynamic/history dependencies. Fixed candidate slots currently cover shared web and MCP. The main service remains a canonical API dependency of zones. Retiring/replacing it requires preserving that dependency and the existing historical responses.

The source candidate is based on `e820a7bb`; origin/main advanced during this task to `3ada2ae1` with independent Tsinghua policy/data changes. Those changes are not silently adopted into this analytics release. The release must freeze code and the exact currently served policy/content bases before building, measure capacity, accept the full candidate, switch through the lifecycle controller, read back publicly, and retire only the replaced active roles. No new per-version service, legacy allowlist growth or mixed .next patch is permitted.

No production source/build/env/nginx/service/content pointer was changed. No push to main, cutover, search notification or full-site build was performed by this task. Candidate source is reviewable separately; this report does not mark production integration complete.

## Official implementation references

- [Consent management](https://learn.microsoft.com/en-us/clarity/setup-and-installation/consent-management)
- [ConsentV2 API](https://learn.microsoft.com/en-us/clarity/setup-and-installation/clarity-consent-api-v2)
- [Masking/client API](https://learn.microsoft.com/en-us/clarity/setup-and-installation/clarity-api)
- [Data retention](https://learn.microsoft.com/en-us/clarity/setup-and-installation/data-retention)
- [Citation domain verification](https://learn.microsoft.com/en-us/clarity/ai-visibility/ai-citations-overview)
