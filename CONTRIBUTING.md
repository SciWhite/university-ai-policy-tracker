# Contributing

University AI Policy Tracker accepts contributions that improve public, evidence-backed university AI policy records.

## Good Contributions

- official university AI policy URLs
- official teaching, academic integrity, privacy, procurement, or security guidance URLs
- corrections to source metadata
- staged OpenClaw artifact PRs that pass validation
- documentation improvements
- issue reports about incorrect claims, stale sources, or missing citations

## Evidence Rules

Every public claim must have evidence.

Evidence should include:

- source URL
- source language
- original-language evidence snippet
- source snapshot hash
- retrieval or checked date
- review state
- confidence
- source rights caveat

Translations are display helpers only. Do not replace original-language evidence with translated text.

## Review Rules

Do not present candidate data as final policy conclusions.

Current review states are:

- `machine_candidate`
- `agent_reviewed`
- `human_reviewed`
- `needs_review`
- `rejected`

OpenClaw and other automation may propose `machine_candidate`, `agent_reviewed`, or `needs_review` records. Automation must not mark its own output as `human_reviewed`.

## OpenClaw PR Rules

OpenClaw can help with crawl planning, source discovery, snapshot generation, claim extraction, evidence binding, review assistance, report writing, and PR generation.

OpenClaw must not:

- write the production database directly
- publish canonical claims without review
- push `main`
- deploy the public website
- bypass robots.txt, login walls, paywalls, or access controls
- stage raw HTML, PDFs, or screenshots as Git dataset output unless explicitly approved

See:

- `docs/openclaw-data-prs.md`
- `docs/agent-workflow.md`
- `docs/crawler-policy.md`
- `docs/data-contract.md`

## Local Validation

Before opening or merging a code/data PR, run:

```bash
pnpm check
pnpm --filter @uapt/web build
git diff --check
```

For staged OpenClaw output, also make sure `pnpm validate:openclaw-artifacts` passes.

## Public Boundary

This project is not legal advice, not academic integrity advice, and not an official university statement unless the linked source is the university's own official page.

Contributions should preserve that boundary in code, docs, page copy, and public JSON.
