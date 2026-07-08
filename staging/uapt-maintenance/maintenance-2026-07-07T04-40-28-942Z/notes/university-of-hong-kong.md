# Maintenance Note: university-of-hong-kong

**Run ID:** maintenance-2026-07-07T04-40-28-942Z
**Target slug:** university-of-hong-kong
**Source URL:** http://www.rss.hku.hk/integrity/generative-ai
**Checked at:** 2026-07-07T12:45 UTC
**Verdict:** No clear policy-content update — minor chrome/content additions only

## Current Source Status

- **HTTP 200** — source live and accessible at expected URL.
- **finalUrl unchanged** — `http://www.rss.hku.hk/integrity/generative-ai`, no redirect.
- **Title:** "Responsible Use of Generative AI in Research at HKU" — unchanged.
- **Core policy content unchanged** — all 7 General Principles, Best Practices, and Related HKU Policies sections identical to snapshot captured 2026-05-24.

## Changes Detected (metadata/chrome/additions)

1. **Navigation/site template change** — the page appears to use a simplified top-level navigation (About Us, Funding Resources, IPR & Contracts, Research Integrity) versus the prior deep sidebar linking to individual sub-pages. Likely a site-wide template refresh by HKU Research Services.

2. **New "Events and Training" section** — added after "References and Further Reading." Contains a single link: `HKU - Research Integrity in the GenAI Era Symposium` → `https://www.rss.hku.hk/ai_integrity_2026/`. This is a forward-looking event listing, not policy content.

3. **New reference link** — `HKU - Research Grant Proposal Writing Tips` (PDF) added to "References and Further Reading" section.

4. **"Last updated" line removed** — the prior snapshot showed "Last updated : May 18, 2026". Current page omits this line entirely.

5. **Copyright notice absent from fetched text** — the prior snapshot included "Copyright © 2026 HKU Research Services. All Rights Reserved." at page foot; may have been stripped by extraction or removed by the site.

## Assessment

The page received minor additions (events/training, one reference link) and a navigation template refresh between late May and early July 2026. None of these changes alter the substantive policy text (the 7 principles, best practices, disclosure/accountability requirements, or related policies). The linked PDF guidelines (`https://www.rss.hku.hk/research-integrity/GenAI-research-guidelines.pdf`) were not inspected — no evidence of change to the formal Senate-approved document.

**Recommendation:** No production update needed. Routine re-check in the next maintenance cycle is sufficient. If the "Events and Training" symposium page later yields new policy statements, it could be captured as a secondary source.

## Related Artifacts (prior run)
- Crawl plan: `staging/uapt-runs/uapt-repair-qs-top-policy-seeds-20260506/crawl-plan-university-of-hong-kong.json`
- Existing snapshot (primary): `.local/source-snapshots/public-release-20260524-001/snapshots/university-of-hong-kong__bb7fab08bd7ff7ed/`
- Existing snapshot (secondary): `.local/source-snapshots/public-release-20260524-001/snapshots/university-of-hong-kong__63f1b1dd307c820a/`
