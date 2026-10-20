# V6 core pages: local review, 2026-10-19

Scope: Changes index, university directory and search index. Local-only, isolated worktree based on `57845573`; primary dirty checkout preserved. No push, production build, deployment, restart, cutover, content/snapshot re-pin or search notification.

## Preview

| Page | Chinese | English |
| --- | --- | --- |
| Changes | http://127.0.0.1:3270/zh/changes | http://127.0.0.1:3270/changes |
| Universities | http://127.0.0.1:3270/zh/universities | http://127.0.0.1:3270/universities |
| Search | http://127.0.0.1:3270/zh/search | http://127.0.0.1:3270/search |

Search example: http://127.0.0.1:3270/zh/search?q=harvard

All seven existing locales are supported: EN, ZH, FR, PL, ES, NL, MS. The header/mobile menu retains language and system/light/dark controls. Source policy text stays in its original language.

## Implementation

Shared discovery cards, filters, empty/loading/error states, pagination and comparison tray extend the existing V6 CSS tokens. University filtering preserves URL state and supports country/region, themes, ranking source/year, coverage, sort/order and grid/list. Full-index loading is demand-driven and abortable; request failure retains the initial records and supports retry.

Search separates university records, evidence excerpts and official source links. Evidence uses actual public claim IDs, original snippets and source URLs; source attribution controls the official-source label. Suggestions require focus on this search page. The existing autocomplete behavior on other pages keeps its default.

Changes uses a timeline and selected-record preview. On tablet/mobile the preview appears inside the selected item; phone filters collapse. Record correction, comparable policy text, source update and extracted-claim changes remain distinct. Where comparable text is absent, the page links to real history rather than fabricating a before/after pair. API/citation/version references remain available in disclosures.

The comparison tray reuses the existing V6 comparison UI. A development-only API adapter uses the same V6-zone handler; it is 404 outside development. The adapter does not alter runtime routing or policy eligibility.

## Verification evidence

Private evidence lives in `.local/v6-core-pages-20261019/` and `output/playwright/`. The final browser matrix covered 156 locale/viewport/theme combinations with zero layout failures, console errors or warnings. Another 23 functional checks passed, including URL/back navigation, real filtering/search/evidence, compare, API retry, theme persistence and tablet/mobile controls. Screenshots cover desktop light, portrait iPad dark and phone dark. Testing used headless Chromium with emulated viewport sizes; physical devices and Safari were not tested. `pnpm check`, scoped web typecheck and `git diff --check` were run; no whole-site build was requested or performed.

The legacy `smoke:universities-index` script expects `.next/server/app/universities.html`, a production-build artifact. Its missing-artifact result is preserved and does not represent dev/browser acceptance. Browser tests use real local API responses to verify the directory instead.

Historical private inventory, policy text, claims, source hashes, public packages, held decisions and historical acceptance are not changed by this UI task. A synchronization event records local UI evidence and explicitly excludes production surfaces.
