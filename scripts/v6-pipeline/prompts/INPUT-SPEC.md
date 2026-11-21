# Per-school V6 input: `inputs/<abbr>.json`

You write one JSON file for one university. `build_view.py` turns it into the local V6 view; every evidence
selector is re-checked against the captured text, so a wrong line number fails the build.

## What you read (all under this directory)

- `<slug>/public.json` → `data.claims` (current public claims, in order, each with `id`, `claimType`, `claimText`, evidence snippets) and `data.officialSources`.
- `<slug>/public-tools.json` (current public tool records) and `<slug>/historical-inventory.json` (older private records: `records[].id`, `layer`, `record`).
- `captures/<abbr>/<key>.json` (receipt: url, status, kind, language) and `captures/<abbr>/<key>.txt` (extracted text).
  Read text with line numbers, for example `nl -ba captures/<abbr>/o01.txt | sed -n 100,180p`, or search with `grep -n`.
  Use only captures whose receipt has `"status": "200"` and a `.txt` file. Never browse the web; never use your own knowledge
  of the university as evidence.

## Rules

- Evidence selectors are `["<key>", firstLine, lastLine]` (1-based, inclusive). Pick the shortest line range that fully
  supports the statement; one to eight lines is typical. A selector may use a string instead of a number: the first line
  containing that exact string (use this only when line numbers are awkward).
- Write for students, in plain English. Keep the official scope (which faculty, programme, level or tool a rule covers).
  A rule that covers one faculty or course is not a university-wide rule. A tool licence is not permission to use it in
  assessment. A recommendation is not a requirement. Do not invent deadlines, penalties, prices or entitlements; say what
  is unknown in `gaps`.
- Every statement must be supported by the cited lines. When the captured sources do not establish something, use status
  `not_mentioned` or `insufficient_public_evidence` with a summary saying what was checked, and add a gap.
- Statuses: `allowed`, `conditionally_allowed`, `restricted`, `blocked`, `required`, `recommended`, `not_mentioned`,
  `unclear`, `insufficient_public_evidence`.
- Summaries: 1–3 sentences, at most about 60 words. Labels: 2–6 words. Scopes: one sentence on who/what it covers.

## Shape

```json
{
  "scope": "One sentence: what these sources cover overall and what governs the individual task.",
  "titles": {"o01": "Official title of the captured document", "d03": "..."},
  "topics": [
    {"key": "coursework", "status": "conditionally_allowed", "label": "Follow course instructions",
     "summary": "...", "scope": "...", "evidence": [["o01", 40, 46], ["d02", 12, 15]]},
    {"key": "exams", ...}, {"key": "disclosure", ...}, {"key": "privacy_data", ...},
    {"key": "approved_tools", ...}, {"key": "research_publication", ...},
    {"key": "academic_integrity", ...}, {"key": "teaching_guidance", ...}, {"key": "security_procurement", ...}
  ],
  "claims": [
    {"claimId": "<data.claims[0].id>", "status": "VERIFIED", "text": "Reviewed English statement of the same claim, scoped.",
     "scope": "optional narrower scope", "evidence": [["o02", 10, 12]], "reason": "optional; required when status is not VERIFIED"}
  ],
  "facts": {
    "exam": {"topic": "academic_integrity (one of academic_integrity|privacy|research|teaching)", "text": "A bounded current fact used by actions/procedures.", "scope": "...", "evidence": [["o03", 5, 7]]}
  },
  "do":   [{"kind": "requirement|source_guidance|site_advice", "text": "Imperative, one sentence.", "refs": ["p1", "exam"]}],
  "dont": [{"kind": "...", "text": "...", "refs": ["p3"]}],
  "procedures": {"investigation": [], "outcomes": ["discipline"], "appeal": []},
  "tools": [
    {"key": "copilot", "tool": "microsoft_copilot", "rawToolName": "Microsoft Copilot Chat", "availability": "allowed|conditionally_allowed|restricted_or_blocked|under_review|not_recommended|not_mentioned",
     "endorsementType": "officially_endorsed|institutionally_licensed_or_procured|self_hosted_system|third_party_service|explicitly_not_endorsed|not_specified", "description": "...", "howToObtain": "... or 'Not verified.'",
     "costToUser": "... or 'Not verified.'", "evidence": [["d04", 20, 24]]}
  ],
  "toolmap": {"<every rawToolName in public-tools.json>": ["copilot", "VERIFIED", "reason"]},
  "historical": {"<suffix of a historical-inventory record id>": "p2 | factName | tool:key"},
  "gaps": ["What remains unknown or could not be read."],
  "zh": {
    "hero": ["<学校中文名>的 AI 使用指引", "中文的总体范围说明"],
    "topics": [["中文标签", "中文摘要", "中文范围"], "... nine entries in topic order"],
    "do": ["与 do 一一对应的中文"],
    "dont": ["与 dont 一一对应的中文"],
    "tools": {"<rawToolName>": ["中文说明", "中文获取方式", "中文费用"]},
    "claims": {"<every ref used in do/dont/procedures: pN or fact key>": "该证据行所显示英文的忠实中文译文"}
  }
}
```

### Field notes

- `claims`: exactly one entry per `data.claims` item, same order, `claimId` equal to its `id`. Status is one of
  `VERIFIED`, `OVERSTATED`, `UNDERSTATED` (with a corrected `text`), `STALE`, `CONTRADICTED`, `BROKEN_SOURCE`, `UNVERIFIED`
  (the last four with `reason` and possibly no evidence). `text` is the corrected or confirmed English statement.
- `refs` in actions/procedures: `pN` is the N-th public claim (1-based, only when that claim is VERIFIED/OVERSTATED/UNDERSTATED
  with evidence), or a key of `facts`. Do and Don't: 1–3 each, every one tied to this school's evidence.
  `kind`: `requirement` (the source requires/prohibits it), `source_guidance` (the source recommends it), `site_advice`
  (our practical advice that follows from cited evidence).
- `facts[].topic` must be one of `academic_integrity`, `privacy`, `research`, `teaching` (a claim type, not a topic key).
- Tool `tool` codes must be a known public code (e.g. `microsoft_copilot`, `chatgpt`) or `proposed:<slug>` for anything else.
- `tools`: only products the captured sources name for this university. `toolmap` must list every `rawToolName` in
  `public-tools.json` and map it to a tool `key` (or to `null` with status `UNVERIFIED` and a reason).
- `historical`: optional. Map a historical record (by id suffix) to the current claim/fact/tool that covers it; anything
  unmapped is kept as HELD automatically. Do not force mappings.
- `zh.claims` (required since batch 3; the locale gate fails without it): one entry per distinct ref used in `do`, `dont` and `procedures`. It is shown on /zh/ instead of the
  English evidence-row text. Translate exactly the English the row shows: for a fact key that is the fact's `text`; for
  `pN` it is your reviewed `claims[N-1].text` (check `<slug>/view.json` → `studentActions.claims[<id>].text` after building). Same meaning, scope, modality, numbers and deadline units/start events.
- Chinese: natural Simplified Chinese for students, same meaning and scope as the English, no extra claims. Keep product
  names in their original form. Official quotes are never translated (they are not in this file).
