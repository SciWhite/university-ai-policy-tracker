# V6 five-page mockup implementation — local only

This revision corrects the earlier style-based implementation by checking each page against its original ImageGen image. The original five PNGs remain frozen in the primary checkout at `.local/v6-site-review-20261019/mockups/`; their hashes and 1672 × 941 dimensions are recorded in `.local/v6-mockup-alignment-20261019/reference-manifest.json`. A recoverable archive of the pre-alignment UI is stored alongside the new evidence. No production operations are authorized or performed.

## Reference contract

| Original image | Local implementation | Required composition |
| --- | --- | --- |
| 01-home.png | `/` | Full-width search hero with no illustration; four question cards; Harvard/Imperial/NUS navigation cards; three recent record cards |
| 02-search.png | `/search?q=Harvard` | Three result tabs; left filters; one prominent record card; compact evidence rows with actual source links |
| 03-changes.png | `/changes` | No directory sidebar; boundary/data disclosure; four-part top filter row; timeline and selected preview; RSS and copy link |
| 04-rankings.png | `/rankings/usnews-2025-2026` and other editions | Five edition tabs; horizontal search/country/topic/sort bar; five-column table; one compare checkbox per row; selected-school tray |
| 05-universities.png | `/universities` | Sidebar aligned to top heading; search on right; four topic chips; six cards in a two-column grid; numbered pagination and selection tray |

The ranking root now opens the same edition-table composition rather than the earlier five large source cards. Different source years, tied rank notation and the CWTS derived metric distinction remain intact. On phones the ranking table becomes stacked rows; on portrait tablets Changes uses an inline preview. Theme and existing locale controls stay available.

## Actual content and approval boundaries

Mockup sample prose, school order and dates are not policy evidence. Rendered university names/order, original claim text, dates, source URLs and source-change counts come from the existing public dataset. Directory pages use actual alphabetical/ranking order rather than a fabricated six-school alphabetical cohort. The existing accepted mark registry is retained; some marks therefore differ from the illustrative mockup artwork. No private mark package or approval state is imported.

Homepage policy-guide cards are neutral navigation links to existing public records, without illustrated-guide, strong-snapshot or assessment-permission approval labels. The previous gated Home V4 preview remains unchanged. Homepage recent cards use real tracker change records and omit publication dates, as required by the refined image.

When an actual Changes record has no comparable previous/current text, it displays the existing limitation and links to history rather than copying the mockup's placeholder text. Original claim text and snippets remain accessible in Search disclosures. Source notes and public JSON remain accessible. The four visible discovery topics are presentation facets over unchanged published claim types/text; raw types remain recognized for existing query URLs. No policies, Claim IDs, quotations, held decisions, source fingerprints, snapshots, review state, public data packages or publication pointers changed.

## Local review and evidence

Preview server remains at http://127.0.0.1:3270, with `/zh` and the other supported language prefixes. A separate loopback-only comparison gallery serves copies of the five reference images and actual browser screenshots. It has no production application route and no private policy inventory.

Final evidence is stored under `.local/v6-mockup-alignment-20261019/`, with browser captures in `output/playwright/aligned-*.png`. Exact validation counts, final readbacks and the synchronization event are recorded in the completion receipt. Browser testing uses Chromium and emulated viewports, not physical-device/Safari acceptance. No whole-site production build, push, deployment, server cutover, production service operation or search notification is performed.

## Completed validation

- `pnpm check`, final web typecheck and `git diff --check`: passed; no production build.
- Layout matrix: 560 cases, seven locales and ten affected routes, zero layout failures and zero browser errors. Includes 320px phones, phone landscape, half screen, portrait/landscape iPad, the exact reference dimensions and 1920px desktop in both themes. The development layout matrix recorded one Next CSS-preload warning; subsequent 59-flow acceptance and the five final screenshot readbacks recorded zero errors or warnings.
- Functional acceptance: 59 checks passed, including actual complete-index filters and retry, numbered pagination/back, original excerpts/Claim IDs, real before/after text, dates, clipboard, ranking facets/years/ties, real V6 compare, language state and theme persistence.
- All five final screenshots use 1672 × 941 and the original images' hashes were independently rechecked. Comparison selections are actual URL-controlled state; no synthetic selected school names are injected.
- Gallery: http://127.0.0.1:3271/ — five image pairs, image decode, live links and opacity/overlay controls verified. Final local pages return HTTP 200. The main preview remains at http://127.0.0.1:3270.

Final selected-state check also verified that the directory pager remains above the fixed compare tray at the reference viewport. The final matrix, 59-flow report and final screenshot/galleries are bound in the task receipt.
