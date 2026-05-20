# Frontend UI Redesign Development Plan

This document is the execution spec for the next public UI redesign of University AI Policy Tracker. It replaces the earlier GitHub-style revision plan and keeps the work phased so implementation does not widen beyond the approved priority.

Canonical public domain: `https://eduaipolicy.org`.

## 1. Product Direction

The public site should feel like a clean, inspectable research database: fast to search, easy to cite, and calm enough for researchers, journalists, university staff, students, and AI answer systems to trust.

The visual language may borrow from GitHub and Primer:

- compact tabs,
- bordered panels,
- dense tables,
- neutral surfaces,
- small labels,
- code/API rows,
- release-style artifact lists.

The public UI must not use GitHub product language as the main metaphor. Avoid public labels such as `Repository`, `Issues`, `Pull Requests`, `Commits`, or `README` unless the page is literally talking about GitHub. Use neutral product terms instead: `Records`, `Sources`, `Claims`, `Changes`, `Data`, `Citation`, and `Methodology`.

The redesign is not a marketing refresh. It is a product clarity pass for an open evidence database.

## 2. Audience And Success Criteria

Primary audience:

- researchers,
- journalists,
- policy analysts,
- university staff,
- AI/LLM systems retrieving source-backed records.

Secondary audience:

- developers using the public JSON/API,
- contributors submitting official source URLs or corrections,
- internal review operators checking coverage and source health.

Success criteria:

- A first-time visitor can search for a university, source domain, policy term, or AI tool from the first screen.
- Core records remain crawlable and citation-ready.
- Top navigation is short and legible on desktop and mobile.
- Secondary pages remain reachable without crowding the top navigation.
- Page copy is minimal, factual, and database-like.
- Necessary caveats remain visible without turning every page into an explainer.

## 3. Design Decisions

### Visual System

Use a GitHub/Primer-like base without copying GitHub branding:

- white/gray canvas with token-driven dark mode,
- blue accent for links and primary actions,
- semantic success/attention/danger labels,
- 6-8px border radius,
- low or no shadows,
- visible borders instead of floating cards,
- compact tables and list rows,
- tab navigation with strong active states,
- monospace only for hashes, API paths, and code values.

Do not add Tailwind, shadcn/ui, lucide, Recharts, chart libraries, or a diff viewer by default. The current plain TSX/CSS approach is the default until a later implementation ticket proves a dependency is necessary.

### Copy Style

Use minimal, factual UI text:

- headings,
- short labels,
- metrics,
- table columns,
- compact helper text,
- badges,
- short notices where misunderstanding would be risky.

Avoid long educational paragraphs on core pages. Move deeper context to `Methodology`, `Citation`, and `Datasets`.

Keep these boundaries visible but concise:

- the tracker is not legal advice,
- the tracker is not academic integrity advice,
- official university sources remain canonical,
- original-language evidence remains canonical,
- review state is separate from confidence,
- candidate records are not final conclusions.

### Homepage Role

The homepage `/` should become a modern search-first database entry, closer to a clean search page or assistant-style search surface than a landing page.

First screen requirements:

- prominent search input for fuzzy search across universities, aliases, official source titles, claims, domains, AI tools, and policy themes,
- short product title or one-line positioning,
- a few compact entry links for `Universities`, `Analysis`, `Datasets`, `Methodology`, and `Citation`,
- lightweight metrics that help trust and SEO/GEO without visual clutter.

Do not use a large marketing hero, decorative illustration, fake stats, testimonials, or broad explanatory blocks.

## 4. Information Architecture

### Primary Navigation

Use repo-tab-style visual treatment, but neutral labels.

Recommended primary tabs:

```text
Search
Universities
Analysis
Changes
Datasets
Methodology
Contribute
```

Rules:

- `Search` should be first because the homepage and `/search` are the main entry paths.
- `Overview` should not be a primary tab; the site name already links home.
- `AI Policy Database` should not be a primary tab; keep the route for SEO/GEO and link it from page-level secondary entry groups.
- `Citation` should move out of primary navigation unless later analytics show it is a top task. It remains prominent inside `Datasets`, `Methodology`, footer, and secondary entry groups.
- `Coverage`, `Reports`, `Widgets`, `API docs`, `MCP`, `Source health`, and `Review workflow` should be secondary entries.

### Secondary Entrances

Use page-level index groups rather than a crowded top nav. Place secondary entrances on the homepage and other appropriate hub pages.

Recommended groups:

- `Data and API`: Datasets, API docs, Public API index, MCP alpha, widgets.
- `Trust and citation`: Methodology, Citation, AI Policy Database, llms.txt.
- `Updates`: Changes, Reports, Reports RSS, recent changes feed.
- `Coverage and review`: Coverage, Source health, Review workflow, Review queue.
- `Contribute`: Contribute, GitHub issue templates, contribution policy.

Secondary entrances should look like compact rows or small link groups, not large explanatory cards.

### Route Preservation

Do not delete existing public routes as part of the redesign. Demoted pages remain reachable through secondary entrances, footer links, sitemap, and existing direct URLs.

Important preserved routes include:

- `/university-ai-policy-database`,
- `/coverage`,
- `/reports`,
- `/widgets`,
- `/api-reference`,
- `/mcp`,
- `/source-health`,
- `/review`,
- `/review/queue`,
- `/citation`.

## 5. Core Page Direction

### `/`

Priority: P2 after the global shell.

Design:

- search-first layout,
- compact metrics,
- minimal secondary entry groups,
- no marketing hero,
- SEO/GEO-friendly links to key public routes,
- server-rendered fallback content for crawlers.

Behavior:

- The search input should route to `/search?q=...`.
- Fuzzy search can initially reuse the existing public search/index logic.
- If client-side autocomplete is added later, the page must still work without JavaScript.

### `/search`

Priority: P2.

Design:

- same visual language as the homepage search,
- compact results rows,
- visible match reason, review state, claim count, source count, and canonical record link,
- concise empty state.

Copy:

- no long explanation of what search includes,
- keep one short boundary note: search is a routing aid, not a policy conclusion.

### `/universities`

Priority: P3.

Design:

- compact database table or dense list,
- filters kept small and useful,
- clear rank/source/claim/review metadata,
- no card grid unless data density requires it on mobile.

Acceptance:

- table/list remains readable on mobile,
- no fake filters,
- public JSON links remain versioned and visible.

### `/universities/[slug]`

Priority: P3 only if touched after search and index work.

Design:

- preserve the current server-rendered evidence-first record,
- tighten copy and spacing,
- keep anchor tabs for overview, policy profile, claims, sources, changes, JSON, citation,
- make review state visually stronger than confidence,
- keep candidate and needs-review records visibly non-final.

Do not create thin subroutes until data depth supports them.

### `/analysis`

Priority: P3.

Design:

- present analysis as derived, source-backed dimensions,
- keep coverage score caveat short,
- use tables/lists instead of long explanatory sections,
- link to per-university analysis JSON and profile pages.

Copy:

- use `Policy analysis` and `Coverage score`,
- do not imply quality, safety, legality, compliance, or official policy approval.

### `/changes`

Priority: P3.

Design:

- compact timeline or data-list,
- institution, checked/changed date, review state, claims, sources, record link, JSON link,
- source freshness and change history should be scannable.

Copy:

- one short note that freshness is metadata, not advice.

### `/datasets`

Priority: P3.

Design:

- release/artifact page,
- grouped API rows,
- compact artifact lists with format, status, and URL,
- citation and rights summary kept short.

Acceptance:

- JSON-LD remains valid,
- public API paths remain real and versioned,
- release manifest and checksum links remain discoverable.

### `/methodology`

Priority: P3.

Design:

- clean documentation page,
- short workflow sections,
- no long prose where a list or table works,
- visible review-state definitions.

### `/citation`

Priority: P3 as a secondary trust page.

Design:

- compact copy-ready citation examples,
- required citation fields,
- public JSON links,
- rights and no-advice boundaries.

Acceptance:

- copy actions continue to work,
- tracker metadata and official source rights remain clearly separated.

## 6. Secondary Surface Direction

Priority: P4.

These pages should not drive the first redesign ticket, but the document should guide later work:

- `/reports`: compact report index and public distribution assets.
- `/widgets`: developer/reference page for embeddable read-only widgets.
- `/api-reference`: endpoint reference, not marketing.
- `/mcp`: alpha integration reference, not product promotion.
- `/coverage`: collection coverage and crawl/review planning, not policy quality.
- `/source-health`: source access and repair planning metadata.
- `/review` and `/review/queue`: internal/public review workflow surfaces.
- `/university-ai-policy-database`: SEO/GEO landing surface that points users into Search, Universities, Datasets, Methodology, and Citation without duplicating those pages.

Secondary surfaces must stay reachable but should not crowd the primary navigation.

## 7. Implementation Priorities

### P0: Documentation Rewrite And Design Contract

Scope:

- replace this document with the current redesign plan,
- state priorities and non-goals,
- lock the navigation model,
- lock the copy-density rule,
- document the homepage search-first role.

Acceptance:

- no frontend implementation,
- no public API changes,
- no data pipeline changes,
- document is English and decision-complete enough for the first implementation ticket.

### P1: Global Shell, Primary/Secondary Navigation, Token Cleanup

Scope:

- revise `apps/web/app/layout.tsx` primary tabs,
- keep the site name as the home link,
- keep theme toggle,
- keep GitHub/API action links only if they remain visually quiet,
- add or refine page-level secondary entry groups,
- tighten global CSS tokens and spacing without changing route behavior.

Acceptance:

- top nav contains only the approved primary tabs,
- all demoted pages remain reachable,
- desktop and mobile nav are clean,
- dark and light mode remain token-driven,
- no new UI framework dependency.

### P2: Search-First Homepage And Search Results

Scope:

- redesign `/` around a prominent search entry,
- connect the search form to `/search?q=...`,
- simplify `/search` results into dense, scannable rows,
- preserve SSR-visible links and text for SEO/GEO.

Acceptance:

- search works without JavaScript,
- first screen is clean and useful,
- key secondary routes are discoverable,
- no long explanatory copy on the homepage.

### P3: Core Public Page Cleanup

Scope:

- refine `Universities`, `Analysis`, `Changes`, `Datasets`, `Methodology`, and `Citation`,
- reduce explanatory text,
- convert large blocks into tables, labels, compact rows, and short notices,
- keep evidence, source, review, citation, and JSON access visible.

Acceptance:

- core pages remain crawlable,
- page titles and metadata stay accurate,
- original-language evidence and review state remain clear where records appear,
- no thin new pages are introduced.

### P4: Secondary Surface Cleanup

Scope:

- align `Reports`, `Widgets`, `API docs`, `MCP`, `Coverage`, `Source health`, and review pages with the same compact reference style,
- keep these surfaces secondary in navigation,
- avoid duplicating core-page explanations.

Acceptance:

- secondary pages are reachable from page-level indexes and footer,
- they read like reference pages, not landing pages,
- public JSON/API links stay correct.

### P5: Visual QA, Accessibility, And Production Verification

Scope:

- validate type/build/checks,
- browser-check representative pages on desktop and mobile,
- verify no horizontal overflow,
- verify dark/light mode,
- verify SSR-visible critical content.

Acceptance:

- no console errors on checked pages,
- no obvious text overflow,
- no inaccessible focus traps,
- no broken internal trust/API links,
- production verification is done only after explicit deploy approval.

## 8. Testing Plan

For this documentation-only change:

```bash
git diff -- docs/github-style-frontend-plan.md
```

Confirm the document includes:

- priorities P0-P5,
- search-first homepage requirement,
- primary navigation model,
- secondary entrance model,
- copy-density rule,
- route preservation,
- non-goals,
- implementation acceptance criteria.

For later implementation tickets:

```bash
pnpm check
pnpm --filter @uapt/web build
git diff --check
```

Browser checks:

- `/`,
- `/search`,
- `/universities`,
- one `/universities/[slug]` page,
- `/analysis`,
- `/changes`,
- `/datasets`,
- `/methodology`,
- `/citation`.

Browser acceptance:

- desktop and mobile navigation work,
- no horizontal overflow,
- no console errors,
- readable contrast in light and dark mode,
- critical content is present in server-rendered HTML,
- public API and trust links are not broken.

## 9. Non-Goals

Do not do these as part of the redesign unless a later task explicitly changes scope:

- no public API/schema/type changes,
- no OpenClaw or crawler pipeline changes,
- no database or dataset release changes,
- no login/account features,
- no new broad UI framework dependency,
- no new chart/diff/icon dependency by default,
- no deletion of existing public routes,
- no new thin SEO pages,
- no legal or academic integrity advice positioning,
- no replacement of original-language evidence with translation,
- no deployment or production change without explicit approval.

## 10. First Implementable Ticket

The first implementation ticket after this documentation step should be:

```text
P1 + P2: Global shell, repo-tab-style primary navigation, page-level secondary entrances, and search-first homepage/search results.
```

This should be implemented before broader page cleanup because it establishes the site-wide interaction model and immediately resolves the current over-crowded navigation.

The first ticket should not touch OpenClaw, public JSON contracts, dataset release logic, or unrelated untracked files.
