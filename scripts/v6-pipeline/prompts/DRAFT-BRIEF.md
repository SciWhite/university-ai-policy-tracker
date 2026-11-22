# Drafting brief: one school's V6 input from captures, with the ChatGPT audit as a checklist

Working directory (the batch workspace): <workspace>
Checkout root (for build commands): <repository checkout>

## Read first
1. `scripts/v6-pipeline/prompts/INPUT-SPEC.md` — exactly what to write and the rules. Follow it strictly.
2. `<slug>/public.json` (current public claims, in order), `<slug>/public-tools.json`, `<slug>/historical-inventory.json`.
3. `captures/<abbr>/` — only receipts with `"status": "200"` and a `.txt`. Keys: `o*` current official sources,
   `d*`/`p*` crawl discovery, `c*` official URLs that ChatGPT listed (captured by us, raw bytes + sha256), `x*` extra.
   Use `nl -ba` / `grep -n`. Long PDFs: search them. List every capture first (url + first lines) and triage.
4. `chatgpt-audit/<abbr>.json` — ChatGPT's audit of this school (documents with rules and quotes, nine topic drafts,
   tools, gaps, claimReview of our public claims, omissions). **This is a checklist of leads, never evidence.**
   ChatGPT quotes may be paraphrased, mis-sectioned or from older versions. Every statement you write must be supported
   by lines of a capture. If ChatGPT says something that no capture supports, do not use it.

## What to write
- `inputs/<abbr>.json` per INPUT-SPEC (all nine topics, one claims entry per public claim in order, 1–3 Do and 1–3
  Don't, tools, toolmap covering every public tool rawToolName, gaps, and the Simplified Chinese `zh` block).
- `inputs/<abbr>.chatgpt-check.json`: one entry for every ChatGPT `omissions` item of severity high or medium and every
  `claimReview` item whose verdict is not `correct`:
  `{"item": "<short>", "source": "omission|claimReview", "severity": "...", "disposition": "used|already_covered|not_supported_by_capture|not_captured|out_of_scope|superseded", "captureKeys": ["c12"], "note": "one line"}`.
  `not_captured` = the URL has no 200 capture (blocked, 404, login). Material items that stay unverified go in `gaps`
  as a plain statement of what is unknown (never repeat ChatGPT's unverified claim as fact).

## Quality rules (from the last batch's reviews; reviewers reject on these)
- No stronger modality than the source (may ≠ must; recommended ≠ required; guidance ≠ rule).
- No invented exceptions, conditions, deadlines, penalties, prices, entitlements or tool permissions.
- Keep unit scope: a faculty, department, programme, course, doctoral-school or staff document stays scoped to that unit;
  a tool licence is not permission to use it in assessment; a proposal/draft is not an adopted rule.
- Do/Don't: each `refs` entry must point to evidence that itself contains the quoted support for that action.
- Chinese must say exactly what the English says (same scope, same modality, no additions or omissions).
- Prefer the newest official version; when an older and a newer document differ, follow the newer, say which is current,
  and add a gap noting the difference. Cover the newest university-wide rules you have: AI policy/guidelines, code of
  conduct / academic integrity or misconduct rules (procedures, penalties), exam/assessment regulations, appeals and their
  deadlines, thesis/dissertation rules and AI declarations, approved tools and how students get them, data/privacy rules,
  research guidance — not only the AI hub page.
- Appeal deadlines and procedures: state them only with the exact wording/numbers of a capture, with its scope.

## Build and check (from the checkout root)
- `python3 scripts/v6-pipeline/build_view.py --workspace <workspace> <abbr>`
- `node node_modules/tsx/dist/cli.mjs --tsconfig apps/web/tsconfig.json scripts/v6-pipeline/finalize.ts --workspace <workspace> <abbr>`
- `python3 scripts/v6-pipeline/gates.py --workspace <workspace> locale` (Chinese on every /zh/ row; must pass)
To rebuild after fixing your input, first remove only this school's outputs:
`rm -rf <dir>/<slug>/{bundle,mapping.json,view-adapted.json,view-prehash.json,view.json,audit.json}`.
Iterate until both succeed. If an error is clearly a script bug rather than your input, stop and report the exact error.

## Constraints
Evidence only from captured files (no web browsing, no outside knowledge). Do not edit other schools' files, the scripts,
selection.json, captures, or anything outside `inputs/` and your school's directory; do not run git; no network.

## Final answer (short)
build/finalize result; claim status counts; each topic's status in one line; Do/Don't texts; tools; gaps; counts of
chatgpt-check dispositions; anything you were unsure about.
