# GitHub-Style Frontend Revision Plan

This document defines a revised front-end direction for University AI Policy Tracker: a GitHub-inspired, evidence-database interface. It is a planning document only. It does not implement code, migrations, deployments, OpenClaw changes, or new data contracts.

Canonical public domain: `https://eduaipolicy.org`.

## 1. Goal

The site should feel less like a marketing page and more like an inspectable public evidence repository.

The intended user mental model:

```text
university page = repository/entity record
claim = reviewable issue-like evidence item
review state = status label
source snapshot hash = commit-like provenance
changes page = commit/change history
diff page = file/claim diff
datasets page = releases/artifacts
methodology and citation = README/docs
```

This direction fits the product positioning in `docs/exposure-distribution-architecture.md`: the project is an open, evidence-backed database, not a blog, link directory, or login SaaS.

## 2. Current Repo Baseline

The current web app is small and well suited to an incremental redesign.

Relevant files:

- `apps/web/app/globals.css` centralizes semantic tokens, dark mode, card styles, badges, claim cards, evidence blocks, copy buttons, and responsive rules.
- `apps/web/app/layout.tsx` owns the global header, footer, trust navigation, and theme toggle.
- `apps/web/app/page.tsx` currently behaves like a lightweight landing/dashboard page.
- `apps/web/app/universities/page.tsx` is a card-grid university index.
- `apps/web/app/universities/[slug]/page.tsx` already renders summary, citation record, official sources, reviewed claims, candidate claims, public JSON links, and claim evidence cards.
- `apps/web/components/claim-evidence-card.tsx` is the most important reusable evidence component.
- `apps/web/components/citation-copy-actions.tsx` already provides client-side copy actions without making the main content client-only.
- `apps/web/components/json-ld.tsx` supports structured data on public pages.
- `packages/crawler-core/src/index.ts` already contains text diff utilities that can support future source/claim diff views.
- `apps/web/package.json` currently has only Next, React, React DOM, and `@uapt/shared`. There is no Tailwind, shadcn/ui, lucide, Recharts, or React Diff Viewer installed in the current web package.

Implication: the first redesign pass should not add a large UI dependency stack. Use the existing CSS/token approach first, then add dependencies only when a feature justifies them.

## 3. Design Principles

### 3.1 GitHub-Inspired, Not GitHub-Branded

The design may borrow interaction patterns:

- repo-style headers,
- tab navigation,
- boxed sections,
- labels,
- timeline rows,
- file/diff panels,
- release artifact lists,
- compact tables,
- copyable code/API blocks.

It should not copy GitHub branding, logos, exact page structure, or product language where it would confuse users.

Use plain product terms:

- `Reviewed claims`, not `Pull requests`.
- `Source history`, not `Commits` unless a Git-backed artifact is literally being shown.
- `Review state`, not `Issue status`.
- `Public JSON`, not `Raw file` unless linking to a raw file.

### 3.2 Preserve The Evidence Contract

The visual system must reinforce the existing data model:

- original-language evidence is canonical,
- translations are display helpers only,
- confidence and review state are separate,
- claims without evidence should not look authoritative,
- public pages must remain SSR/SSG friendly,
- no legal advice or academic integrity advice should be implied.

### 3.3 Dense But Readable

This project benefits from GitHub-like density, but the audience includes researchers, journalists, university staff, students, and AI agents. The interface should be compact, scannable, and calm, not developer-only.

## 4. Revised Information Architecture

### 4.1 Global Shell

Replace the current simple header with a public database shell:

- top bar:
  - site name,
  - short positioning phrase,
  - GitHub repo link, if public,
  - API index link,
  - theme toggle.
- secondary tab nav:
  - Overview,
  - Universities,
  - Changes,
  - Datasets,
  - Methodology,
  - Citation.

Footer should stay trust-focused:

- no advice boundary,
- methodology,
- citation,
- datasets,
- changes,
- `llms.txt`,
- public API index.

### 4.2 Homepage

Reframe `/` as an open-data overview, not a marketing hero.

Suggested sections:

- compact project header:
  - "Open university AI policy evidence database",
  - coverage metrics,
  - public API link,
  - methodology link.
- repository-style overview boxes:
  - tracked universities,
  - source-backed claims,
  - recent changes,
  - reviewed versus candidate records.
- "Start here" panel:
  - browse universities,
  - view changes,
  - cite the dataset,
  - inspect public JSON.
- "Trust model" panel:
  - evidence layer,
  - reference layer,
  - distribution layer,
  - contribution and review layer.

Avoid a large decorative hero.

### 4.3 University Detail Pages

Make `/universities/[slug]` the primary repo-record page.

Proposed layout:

```text
Entity header
  Harvard University / AI Policy
  region, country, review state, confidence, last checked, last changed

Tabs
  Overview | Claims | Sources | Changes | JSON | Citation

Main column
  README-style citation-ready summary
  Reviewed claims
  Candidate claims
  Evidence notes and limitations

Right sidebar
  Public JSON
  Suggested citation
  Official sources
  Source rights caveat
  Dataset license
  Review state legend
```

Near-term implementation can keep one route and use anchor links instead of adding tabbed subroutes. Later, high-value pages can grow into:

- `/universities/[slug]/claims`
- `/universities/[slug]/sources`
- `/universities/[slug]/changes`
- `/universities/[slug]/json`

Only create extra routes when the data is strong enough to avoid thin pages.

### 4.4 Claim/Evidence Cards

`ClaimEvidenceCard` should become the visual core of the product.

GitHub-inspired shape:

- boxed item with header row,
- claim type label,
- review state label,
- confidence badge,
- last checked/changed metadata,
- original evidence block,
- source attribution row,
- snapshot hash in monospace,
- localized display helper clearly separated,
- copy source URL/hash actions later.

The card should visually distinguish:

- human reviewed or agent reviewed,
- machine candidate,
- needs review,
- rejected/audit-only.

Review state should be more prominent than confidence.

### 4.5 University Index

Change `/universities` from cards to a repository-like list or table.

Suggested controls after enough records exist:

- search input,
- country/region filter,
- review state filter,
- last checked sort,
- source count,
- claim count,
- policy status,
- tool treatment.

Near-term without client-side complexity:

- server-rendered table/list,
- simple links,
- compact metadata labels,
- no heavy filtering until there are enough records.

### 4.6 Changes

`/changes` should become a change timeline.

Each row should show:

- institution,
- changed or checked date,
- affected claim/source count,
- review state,
- source URL,
- snapshot hash,
- public JSON link,
- future diff link.

Future diff pages should use `packages/crawler-core` diff utilities before adding a front-end diff dependency. Add React Diff Viewer only if the internal diff renderer becomes too costly to maintain.

### 4.7 Datasets

`/datasets` should look like a releases/artifacts page.

Current live API links can be rendered as artifact rows:

- API index JSON,
- universities JSON,
- per-university JSON example,
- recent changes JSON.

Future release artifacts:

- monthly claims JSONL,
- sources JSONL,
- changes JSONL,
- data dictionary,
- checksums,
- release notes,
- DOI/Zenodo link.

### 4.8 Methodology And Citation

`/methodology` and `/citation` should look like high-quality README/docs pages:

- narrow readable body,
- sticky or inline table of contents when useful,
- callout boxes,
- code blocks for examples,
- copy buttons for citation/API snippets,
- visible no-advice boundary,
- source-rights caveat.

## 5. Component Plan

Add small, repo-local components before adding a UI library.

Recommended components:

- `ReferenceBox`
  - GitHub-like bordered section with optional header, actions, and body.
- `ReferenceTabs`
  - route/anchor tabs for Overview, Claims, Sources, Changes, JSON, Citation.
- `StateLabel`
  - semantic review-state label using existing `reviewState` values.
- `MetaLabel`
  - small neutral metadata badge for dates, country, language, counts.
- `EntityHeader`
  - title, subtitle, metadata labels, primary actions.
- `EntitySidebar`
  - public JSON, citation, source rights, official source count.
- `DataList`
  - compact rows for universities, changes, endpoints, sources.
- `TimelineList`
  - change/event timeline for `/changes` and future entity changes.
- `ApiEndpointRow`
  - endpoint path, method, status, copy/open actions.
- `EvidenceBlock`
  - optionally split out of `ClaimEvidenceCard` for source/diff pages.
- `DiffBlock`
  - first version can render `TextDiffLine[]` from `crawler-core`.

Do not create a generic component system larger than current needs.

## 6. Token And CSS Plan

Keep semantic CSS variables, but align the palette with a GitHub/Primer-style reference UI.

Suggested token groups:

```css
--color-canvas-default
--color-canvas-subtle
--color-canvas-inset
--color-fg-default
--color-fg-muted
--color-border-default
--color-border-muted
--color-accent-fg
--color-accent-emphasis
--color-success-fg
--color-success-subtle
--color-attention-fg
--color-attention-subtle
--color-danger-fg
--color-danger-subtle
--color-diff-addition
--color-diff-deletion
```

Keep current product tokens as aliases:

```css
--color-page-background: var(--color-canvas-default);
--color-surface: var(--color-canvas-default);
--color-surface-elevated: var(--color-canvas-subtle);
--color-text: var(--color-fg-default);
--color-text-muted: var(--color-fg-muted);
--color-border: var(--color-border-default);
```

This allows incremental migration without changing every page at once.

Design details:

- max width can increase from `1080px` to around `1120px` or `1280px` for repo-style two-column layouts.
- use 6-8px border radius, not large rounded cards.
- use low shadows or no shadows; GitHub-style UI relies on borders and background contrast.
- keep letter spacing at `0`.
- keep font stack system-first; no extra font dependency is necessary.
- dark mode must be token-driven, not page-specific overrides.

## 7. Dependency Strategy

Do not add Tailwind, shadcn/ui, lucide, Recharts, or React Diff Viewer in the first GitHub-style pass unless the implementing task explicitly needs them.

Reason:

- current web package is minimal,
- current CSS is centralized,
- the redesign can be done with low-risk CSS and server components,
- extra dependencies increase maintenance cost before the data surface is mature.

Potential later additions:

- `lucide-react` for compact icons in navigation/actions, once action density grows.
- a diff viewer library only after real source snapshot diff pages exist.
- Recharts only after dataset/report pages have stable metrics.
- shadcn/ui only if the project adopts Tailwind and needs a broader UI kit.

## 8. Execution Roadmap

### F0: Design Contract And Safety Pass

Scope:

- Confirm no existing untracked OpenClaw/staging data is modified.
- Keep the public data contract unchanged.
- Do not create new routes that could become thin pages.
- Document visual non-goals and terminology.

Acceptance:

- no schema changes,
- no API contract changes,
- no deployment changes,
- working tree changes limited to docs or frontend files for later phases.

### F1: Token And Primitive CSS Revision

Scope:

- revise `globals.css` token groups,
- alias old tokens to new GitHub-style primitives,
- update base typography, boxes, labels, links, code, tables, and buttons,
- keep dark mode working through existing theme toggle.

Files likely touched:

- `apps/web/app/globals.css`
- possibly `apps/web/components/theme-toggle.tsx`

Acceptance:

- all current pages remain readable in light and dark mode,
- no content disappears behind client-only rendering,
- no horizontal overflow on mobile,
- `pnpm check`, web build, and diff check pass.

### F2: Global Shell And Navigation

Scope:

- revise `layout.tsx` into a public database shell,
- add repo-style top bar and secondary tab nav,
- keep footer trust links,
- add API index and GitHub repo link only if real URLs are known.

Files likely touched:

- `apps/web/app/layout.tsx`
- `apps/web/app/globals.css`

Acceptance:

- primary routes stay reachable,
- active/hover states are clear,
- mobile nav wraps cleanly,
- no excessive marketing copy.

### F3: Shared Reference Components

Scope:

- add small local components for boxes, labels, headers, data lists, and endpoint rows,
- refactor only where duplication is already obvious.

Possible files:

- `apps/web/components/reference-box.tsx`
- `apps/web/components/reference-tabs.tsx`
- `apps/web/components/state-label.tsx`
- `apps/web/components/entity-header.tsx`
- `apps/web/components/data-list.tsx`
- `apps/web/components/api-endpoint-row.tsx`

Acceptance:

- components are server components unless interactivity requires client code,
- no generic abstraction that obscures content,
- existing pages compile unchanged or with low-risk replacements.

### F4: University Detail Repo-Record Layout

Scope:

- refactor `/universities/[slug]` into entity header, tabs/anchors, main column, and sidebar,
- keep all existing evidence, citation, source, limitations, and JSON links visible,
- improve claim/evidence card presentation.

Files likely touched:

- `apps/web/app/universities/[slug]/page.tsx`
- `apps/web/components/claim-evidence-card.tsx`
- new shared components from F3
- `apps/web/app/globals.css`

Acceptance:

- source-backed claims remain visible in server-rendered HTML,
- original evidence remains visually primary,
- localized display remains clearly secondary,
- review state is visually stronger than confidence,
- candidate claims are clearly not final conclusions.

### F5: Index And Changes Surfaces

Scope:

- convert `/universities` to a compact list/table,
- convert `/changes` to a timeline/data-list layout,
- preserve sparse-data empty states.

Files likely touched:

- `apps/web/app/universities/page.tsx`
- `apps/web/app/changes/page.tsx`
- shared list/timeline components,
- CSS.

Acceptance:

- pages remain useful with current seed/catalog data,
- no fake filters that do not work,
- no client-only search until needed,
- public JSON links remain correct and versioned.

### F6: Datasets, Citation, Methodology Docs UI

Scope:

- make `/datasets` artifact/release-like,
- make `/citation` and `/methodology` README-like,
- add endpoint rows and copy affordances where already supported.

Files likely touched:

- `apps/web/app/datasets/page.tsx`
- `apps/web/app/citation/page.tsx`
- `apps/web/app/methodology/page.tsx`
- `apps/web/components/citation-copy-actions.tsx`, only if needed.

Acceptance:

- JSON-LD on `/datasets` stays valid,
- public API links stay real and versioned,
- no advice boundary remains visible,
- source rights caveat remains clear.

### F7: Diff And Source History Preview

Scope:

- introduce a minimal `DiffBlock` using existing `crawler-core` diff data shape,
- add preview sections only where real change data exists,
- defer full route expansion until OpenClaw provides enough reviewed artifacts.

Possible files:

- `apps/web/components/diff-block.tsx`
- future `/universities/[slug]/changes` route only when data supports it.

Acceptance:

- additions and deletions are accessible in light/dark mode,
- diff lines do not overflow mobile screens,
- no route is indexed if it lacks useful evidence-backed content.

### F8: Visual QA And Production Verification

Scope:

- run local validation,
- use Playwright screenshots/checks on desktop and mobile,
- verify production after push/deploy.

Checks:

```bash
pnpm check
pnpm --filter @uapt/web build
git diff --check
```

Manual/browser checks:

- `/`
- `/universities`
- one `/universities/[slug]` page,
- `/changes`
- `/datasets`
- `/citation`
- `/methodology`
- `/api/public/v1/index.json`
- `/llms.txt`
- `/sitemap.xml`

Acceptance:

- zero console errors on key pages,
- no mobile horizontal overflow,
- readable contrast in light and dark mode,
- server-rendered HTML contains critical evidence content,
- no broken internal trust/API links.

## 9. Suggested Implementation Order

Recommended first implementation ticket:

```text
F1 + F2 only: GitHub-style tokens and global shell.
```

Reason:

- low risk,
- creates visual foundation,
- avoids touching claim rendering before the shell is stable,
- gives immediate site-wide improvement.

Recommended second ticket:

```text
F3 + F4: shared reference components and university detail repo-record layout.
```

Recommended third ticket:

```text
F5 + F6: university index, changes timeline, datasets/releases, README-style docs pages.
```

Recommended fourth ticket:

```text
F7: diff/source history preview after enough OpenClaw-reviewed change artifacts exist.
```

## 10. Open Questions

- Should the public GitHub repo link be shown in the global header now, or only after README/CITATION/CONTRIBUTING are polished?
- Should the site use "repository" language publicly, or only internally as a design metaphor?
- Should entity sub-tabs be anchor links first, or route links later?
- Should the first table/filter pass remain server-only, or should client search be added once there are 20-50 high-quality university pages?
- Should the future diff viewer be custom-built from `crawler-core` output or use a maintained diff viewer dependency?

## 11. Non-Goals

This revision should not:

- change the public JSON contract,
- change OpenClaw operating rules,
- create new thin SEO pages,
- introduce login/account features,
- imply legal or academic integrity advice,
- replace original-language evidence with translation,
- add a broad UI framework before the product needs it,
- deploy automatically without separate approval.

