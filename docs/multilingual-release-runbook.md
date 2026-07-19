# Multilingual public-content release

## Release wording

> University AI Policy Tracker now provides expanded multilingual interface and public-content support in English, Chinese, French, Polish, Spanish, Dutch, and Malay. This is a presentation-layer release: original policy evidence, source titles, university names, review states in public data, record IDs, URLs, dataset version, and record counts are unchanged.

Do not describe this work as a new policy-data release. API, MCP, widgets, review, internal analytics, and machine feeds remain English-only.

## Rollout gates

1. Run `pnpm validate:i18n`, `pnpm check`, and a production build.
2. Verify the homepage, one university record, and the latest monthly report in all seven locales at desktop, 768 px, and 360 px widths.
3. Release the first public-content group and observe production for at least 72 hours before enabling the remaining public surfaces.
4. During observation, check localized 404s, server-rendered `html[lang]`, canonical and `hreflang`, sitemap discovery, browser-language redirects, locale persistence, and analytics events.
5. Confirm that matching university pages expose identical canonical university names, source titles, evidence snippets, record IDs, source URLs, and public JSON links in every locale.

## Phase gate

`NEXT_PUBLIC_MULTILINGUAL_PHASE_TWO` is the production exposure gate. Keep it
unset during the first-stage observation window. In that state, phase-two
localized routes return `404`, stay out of the sitemap and `hreflang`, and
phase-two navigation remains on the existing English pages.

After the first-stage checks have remained healthy for at least 72 hours, set
`NEXT_PUBLIC_MULTILINGUAL_PHASE_TWO=1` for the production build and runtime,
rebuild, restart, and rerun the seven-language HTTP smoke test before announcing
the second stage.

## Rollback boundary

Translation and localized-route changes can be rolled back independently of public data. Never replace or promote `/api/public/v1` data as part of a multilingual UI rollback.
