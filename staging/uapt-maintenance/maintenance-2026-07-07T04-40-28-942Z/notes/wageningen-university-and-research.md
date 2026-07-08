# Maintenance Note: wageningen-university-and-research

**Run ID:** maintenance-2026-07-07T04-40-28-942Z
**Target source URL:** https://support.wur.nl/esc?id=kb_article&sysparm_article=KB0016528
**Target source title:** Artificial intelligence for searching & screening literature | Library guide
**Entity slug:** wageningen-university-and-research
**Date:** 2026-07-07

## Assessment

**No clear policy-content update.** The maintenance signal reflects only metadata/chrome/noise expansion, not a substantive change in WUR's AI research guidance policy content.

## Evidence

1. **Source still reachable.** The KB0016528 URL resolves (with an added `/en/` path segment in the friendly redirect — `support.wur.nl/esc/en/search-the-collections/artificial-intelligence-for-searching-screening`). No meaningful source relocation.

2. **Existing evidence preserved verbatim.** The core guidance captured in the existing run's evidence snippet (`ev-wur-library-ai-research-guidance`):
   - "It is important to always document your use of AI"
   - "do not cite AI as if it were a source or an author"
   - "WUR Library urges you to be transparent in your use of AI tools and to always check a publisher's policy before including AI-generated content in your publication"
   - "For confidentiality and proprietary reasons, WUR Library advises reviewers never to upload a non-published manuscript into any externally hosted tool"

   These are all present in the current live page with no change in meaning or wording.

3. **Chrome/noise expansion observed.** Additional sections have been added to the page since the existing snapshot (Evaluating AI outputs with lateral reading/paper mills; Selecting an AI tool framework; Updated "Policies and resources" section). These expand the guidance with examples and tool references but do not alter or replace the existing policy-advisory content.

4. **No source-snapshot content-hash comparison possible.** The private snapshot at `f28c7e41a2e57bf3` captured only 86 bytes of ServiceNow loading boilerplate; the actual page content was captured by Firecrawl in the staging run's fetch_attempt. The existing claim/evidence remains fully supported by the live page.

## Existing Claim Status

- **Claim `cl-wur-library-ai-research-guidance`** (approved, `agent_reviewed`): remains accurate. No update needed.
- The page is correctly classified as `research_guidance` / `university_guidance` with policy specificity 0.79. The expanded content does not change this classification.
- The new "Policies and resources" section links to the same set of already-known WUR sources (student support, teacher support, PhD/EngD Brightspace, researcher KB, Viva Engage). The researcher KB page (`KB0016738`) remains listed as a link but its content was previously verified as inaccessible/retired — this is unchanged.

## Recommendation

No artifact bundle needed. No changes to staged claims or evidence. Close maintenance item as `no_update` for this source.

## Next Maintenance

Revisit this URL after the 2026-2027 academic year starts (around September 2026) when WUR typically updates its Student Charter and GenAI rules for the new academic cycle.
