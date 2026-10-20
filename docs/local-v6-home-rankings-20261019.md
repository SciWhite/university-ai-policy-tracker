# V6 homepage and ranking directory — local review

Local-only continuation in `/Users/newvolume/.codex/worktrees/v6-core-pages-local/university-ai-policy-tracker`, based on `57845573`, alongside the previously accepted local Changes, university directory and Search UI. No push, production build, deployment, production service operation, content promotion, snapshot re-pin or search notification.

## Open locally

- Homepage: http://127.0.0.1:3270/zh
- Rankings directory: http://127.0.0.1:3270/zh/rankings
- QS: http://127.0.0.1:3270/zh/rankings/qs-2026
- THE: http://127.0.0.1:3270/zh/rankings/the-2026
- ARWU: http://127.0.0.1:3270/zh/rankings/arwu-2025
- U.S. News: http://127.0.0.1:3270/zh/rankings/usnews-2025-2026
- CWTS: http://127.0.0.1:3270/zh/rankings/cwts-leiden-2025

English uses the same paths without `/zh`; FR/PL/ES/NL/MS use their existing locale prefix. These loopback URLs work on this Mac. Theme controls stay in the header/mobile menu.

## Presentation and data boundaries

The homepage shares the discovery pages' V6 tokens, typography, form controls and layout widths. It retains existing localized copy, original artwork, verified guide eligibility, topic entry points, coverage counts, recent-check semantics, open-data links and FAQ/structured data. The original Home V4 preview remains available in development with `?layout=home-v4`; `?layout=legacy` remains intact. The all-regions browse link now leads to the university directory's country/region filters rather than the absent regions index.

The new `/rankings` index presents five independently sourced cohorts. All five existing ranking detail routes share one filter/list component, with URL-backed search, country filter, sort and pagination. Search includes the existing localized institution alias registry while display names remain canonical. Original tied/banded rank strings, source years and the CWTS derived-metric distinction remain intact. Ranking order is not an AI-policy quality rating. Source notes/public JSON stay accessible in a disclosure. All added interface copy supports the existing seven languages; names, source text and policy evidence preserve their original language/fallbacks.

Only accepted marks in the existing public mark registry are reused. No private mark package, policy inventory, approval state, policy text, public data, evidence or historical policy surfaces changed.

## Verification

Evidence and final receipts: `.local/v6-home-rankings-20261019/`; screenshots: `output/playwright/v6-*.png`. The private current inventory pointer was inspected read-only in the primary checkout. A task synchronization event binds the local code manifest to actual local readbacks and records the exclusions for production surfaces.

`pnpm check`, the final scoped web typecheck and `git diff --check` passed. All 364 locale/viewport/theme cases passed without layout failures, console errors or warnings. All 36 functional checks passed with no browser errors/warnings, including API count reconciliation, canonical/Chinese-alias search, filtering, sorting, pagination, browser back, deep links, ties/year/derived-order preservation, language and theme persistence, original source disclosures, FAQ and previous-page controls. Browser sizes emulate phones, landscape, half-screen, portrait/landscape iPad and desktop/wide layouts. Physical devices and Safari are outside this acceptance. No whole-site build is needed for this local preview.
