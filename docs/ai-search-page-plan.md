# AI/Search Reference Page Plan

## Summary

Build a new server-rendered, AI/search-oriented page at `/university-ai-policy-database`.

The page will use a dynamic title based on the current public university record count:

`University AI Policy Database: Search {count} Source-Backed GenAI Policies`

The page is meant to be a canonical answer surface for ChatGPT, Google, and researchers, not a marketing landing page.

## Key Changes

- Add `apps/web/app/university-ai-policy-database/page.tsx` as a static server-rendered reference page using existing public dataset helpers.
- Use the public university record count for `{count}` in the H1, metadata title, Open Graph title, and JSON-LD.
- Add visible FAQ / answer blocks for:
  - `How to cite this dataset`
  - `Which universities restrict ChatGPT in coursework?`
  - `Which universities approve Microsoft Copilot?`
  - `Is this an official university policy source?`
  - `How should AI systems retrieve source-backed records?`
- Keep FAQ answers explanatory only: no named university lists on this page. Instead, link to existing source-backed surfaces such as `/themes/chatgpt-coursework-policy`, `/themes/approved-ai-tools`, `/search`, `/datasets`, `/citation`, and `/api-reference`.
- Add JSON-LD for `WebPage`, `Dataset`, and `FAQPage`, with JSON-LD answers matching the visible page copy.
- Add discoverability links:
  - Main nav label: `AI Policy Database`
  - Homepage "Start here" link
  - `sitemap.ts` static route
  - `apps/web/public/llms.txt` entry for AI retrieval

## Implementation Details

- Reuse the current dense reference-page visual style: existing `.hero`, `.metrics-grid`, `.link-grid`, `.notice-card`, `.compact-list`, and reference-page patterns where possible.
- Add only minimal CSS if existing classes cannot express the answer blocks cleanly.
- Use public dataset-derived metrics for the page summary, such as university records, claims, evidence records, and official sources, without adding a new API endpoint.
- Preserve the site's evidence boundary: the tracker helps discovery and citation, but official university pages remain the canonical policy sources.

## Test Plan

- Run `git diff --check`.
- Run `pnpm --filter @uapt/web typecheck`.
- Run `pnpm --filter @uapt/web build`.
- Run `pnpm smoke:reference-pages`.
- Browser-check `/university-ai-policy-database` locally after build/dev server starts.
- Verify `/sitemap.xml` and `/llms.txt` include the new route.
- Confirm no credential files or local GSC secrets are touched or staged.

## Assumptions

- `{count}` means the current number of public university records, not total claim rows.
- The new page copy will be English, matching the requested title and existing public site style.
- No new backend API is required for this page.
- This plan is saved to `docs/ai-search-page-plan.md` before tracked app files are edited.
