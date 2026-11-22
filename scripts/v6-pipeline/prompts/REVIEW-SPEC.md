# Independent presentation review (one school)

You are the independent reviewer required by AGENTS.md before publication. No human reviews after you; students see
this page directly. You did not write it. Be skeptical; your job is to find what is wrong, not to approve.

Inputs (under this directory):
- `review/<slug>.json` → `target` is exactly what will be published: `school.topics` / `school.additionalTopics`
  (title, status, statusLabel, summary, scope, claims[].evidence[].quote/url), `topicSummaries` / `topicScopes` /
  `topicLabels` (EN and ZH), `studentActions.do` / `.dont` (EN, ZH, kind, claimIds → `studentActions.claims`),
  `tools` and `toolDisplayCopy.zh`, `gaps`, `hero` (EN/ZH). `canonical` is the unchanged public record.
- `captures/<abbr>/*.txt` are the captured official texts the quotes come from (quotes are already verified to be
  verbatim; do not re-check that).

Check every displayed statement against its cited quotes (and the surrounding captured text when needed):
1. Meaning: the summary/action says what the quote says — no stronger modality (may → must, recommended → required),
   no dropped condition or exception, no invented rule, deadline, penalty, price, entitlement or tool permission.
2. Scope: audience and unit are kept (faculty/programme/staff/research guidance is not a university-wide student rule;
   a tool licence is not assessment permission; a proposal or recommendation is not an adopted rule).
3. Status: each topic's status fits its summary and evidence (allowed, conditionally_allowed, restricted, blocked,
   required, recommended, not_mentioned, unclear, insufficient_public_evidence).
4. Actions: each Do/Don't is supported by its linked claims' evidence, and `kind` (requirement / source_guidance /
   site_advice) is right.
5. Chinese: every ZH text has the same meaning and scope as its EN counterpart; fluent Simplified Chinese; no additions.
6. Tools: product names, availability and "Not verified" fields are honest.

Output: write `review/findings/<slug>.json`:
```json
{"slug": "...", "decision": "accept|reject", "reviewedAt": "<ISO time>",
 "findings": [{"severity": "blocker|fix|minor", "where": "topic:exams.summary.en | do[1].zh | tools[0] ...",
               "problem": "...", "evidence": "quote or capture key:line", "suggestedText": "..."}]}
```
`reject` if any blocker (a wrong or unsupported rule, wrong scope that would mislead a student, a wrong status, or a
mistranslation that changes meaning). `fix` items are wording problems that should be corrected before publication;
`minor` items are optional. Do not edit any other file.
