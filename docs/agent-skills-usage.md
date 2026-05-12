# Agent Skills Usage

This project may use external Codex skills to improve local retrieval, review, and interface work. Skills are helper workflows only. They do not change the project data contract, review boundary, crawler policy, or publication workflow.

## Installed Global Skills

The following skills are expected to be available globally in Codex:

- `kb-retriever`
- `web-design-engineer`

If a Codex thread cannot see these skills, restart Codex after installation.

## `kb-retriever`

Use `kb-retriever` for local knowledge lookup and post-run analysis.

Appropriate uses:

- Find information across `knowledge/`, docs, run summaries, ranking notes, and reference spreadsheets converted to text or Markdown.
- Compare validated OpenClaw run outputs against non-authoritative reference material.
- Produce review briefs, source gap notes, and missing-coverage summaries.
- Inspect PDFs or Excel-derived references with bounded, local retrieval instead of loading whole files into context.

Required boundaries:

- Do not treat reference spreadsheets, benchmark files, or old crawl notes as official policy evidence.
- Do not create canonical claims from local knowledge files.
- Do not replace `sourceUrl`, `sourceLanguage`, `snapshotHash`, or `evidenceSnippetOriginal` with a local summary.
- Do not use a reference sheet as a source for public policy claims unless the source itself is an official university URL and is fetched into the normal evidence chain.
- Do not bypass `pnpm validate:openclaw-artifacts`.

Recommended workflow:

1. Start from `knowledge/data_structure.md`.
2. Navigate to the most relevant subdirectory index before searching files directly.
3. Use local references to identify questions or likely gaps.
4. Send any source-discovery gap back to OpenClaw or the relevant crawler stage.
5. Keep final public claims grounded in official source snapshots and review decisions.

Current project knowledge indexes:

- `knowledge/crawl-runs/current-public-release.md` - promoted public release contents.
- `knowledge/crawl-runs/unpromoted-staging-runs.md` - staging runs not in the public release manifest.
- `knowledge/rankings/qs-2026-coverage.md` - QS 2026 target coverage, keeping QS separate from THE, ARWU, U.S. News, and CWTS.
- `knowledge/reference-sheets/plsc-edtechai-policy-v4-summary.md` - non-authoritative benchmark summary of the manual Excel workbook.
- `knowledge/reviews/2026-05-12-public-vs-staging-vs-qs.md` - current planning review.

Refresh workflow:

1. Run `pnpm validate:dataset-release`.
2. Run `pnpm audit:public-data`.
3. Validate any candidate staging run with `pnpm validate:openclaw-artifacts <run-dir>`.
4. Regenerate the relevant knowledge Markdown.
5. Treat the Markdown as a planning snapshot, not as evidence.

## `web-design-engineer`

Use `web-design-engineer` for public reference-page design, information architecture, and visual polish.

Appropriate uses:

- Improve `/universities/[slug]`, `/universities`, `/datasets`, `/methodology`, `/citation`, `/changes`, ranking pages, region pages, and theme pages.
- Design reusable layouts for claim/evidence blocks, official source tables, review-state badges, public JSON links, citation modules, and change history.
- Create or refine design-system documentation for the public evidence database.
- Improve responsive readability and crawler-visible content.

Required boundaries:

- Do not change schema, staged artifact contracts, validator behavior, crawler policy, review states, or citation rules as part of visual work.
- Do not hide source URLs, original-language evidence, review state, confidence, source rights caveats, or public JSON links for visual simplicity.
- Do not turn evidence pages into generic SaaS landing pages.
- Do not add fabricated metrics, fake testimonials, fake partner logos, or unsupported claims.
- Do not create thin SEO pages without evidence-backed content.

Design direction for this project:

- The product should feel like an open data reference system, not a marketing funnel.
- Prefer dense but readable evidence layouts over oversized hero sections.
- Prioritize trust signals: official sources, last checked, last changed, review state, confidence, citation, and public JSON.
- Preserve SSR/SSG indexability and visible text parity with structured data.

## OpenClaw Interaction

OpenClaw remains the crawler/orchestration system. These Codex skills do not give OpenClaw permission to:

- write the production database;
- publish canonical claims;
- push `main`;
- deploy;
- bypass review, robots, login walls, paywalls, CAPTCHA, WAF, or access controls.

For formal crawl runs, OpenClaw outputs must still pass the repository validator before data is merged.

## Review Rule

When a skill output conflicts with the project contract, the project contract wins. The controlling documents are:

- `docs/data-contract.md`
- `docs/crawler-policy.md`
- `docs/openclaw-data-prs.md`
- `packages/shared/src/openclaw-artifacts.ts`
- `packages/shared/src/claims.ts`
