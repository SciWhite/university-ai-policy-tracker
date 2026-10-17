# University of California, Berkeley audit correction and shared V6 integration

Status: local validated; OCI/public acceptance still required. Institution audit remains PARTIAL.

Fresh public baseline on 2026-10-17: 30 Claims (22 classified as `other`), 6 official sources, 8 licensed tool records; student snapshot has no approved version meeting publishing requirements (`snapshotPublished: false`, held as `needs_review`). The independent audit report was treated as investigative leads and verified against primary sources. The frozen private inventory pointer and parent revision (`tsinghua-v6-r2-20261017`) were verified without regression; this task establishes candidate package revision `berkeley-v6-r1-20261017`.

The prepared correction preserves all 30 baseline Claim IDs (`claim-university-of-california-berkeley-1` through `30`) and publishes 40 Claims from 13 URL/captured-version official sources, plus the 8 canonical licensed tool records. All 22 baseline `other` claims were audited individually against `policyClaimTypeSchema` (`teaching`, `privacy`, `security_review`, `procurement`, `academic_integrity`, `research`, `other`), maintaining `other` strictly for overarching community and campus guidance principles (`1`, `9`, `12`, `14`, `21`) rather than mechanically zeroing it out. Original-language quotes are continuous verbatim text, bound to retained raw HTML/PDF text, character ranges, line locators, and SHA256 hashes in `.local/berkeley-20261017/sources/manifest.json`.

Major audited issues and resolutions:
1. Exams Dimension Grounding (P1): The prior public Analysis derived `conditionally_allowed` for exams from five licensed tool records (Adobe Firefly, ChatGPT Edu, Gemini, etc.). Campus tools do not establish exam authorization. Tool claims were 100% excised from exam evidence. Exams status remains `conditionally_allowed`, strictly grounded in syllabus and instructor discretion (`claim-5`, `claim-18`, `claim-student-conduct-cheating-definition`).
2. Student Conduct & Academic Misconduct Governance (P1): Added dual-track procedural coverage:
   - Undergraduate & General Student Conduct: Berkeley Campus Code of Student Conduct, revised July 1, 2026, implementing PACAOS 100.00 and revised Appendix H (`claim-student-conduct-2026-framework`, `claim-student-conduct-academic-misconduct`, `claim-student-conduct-cheating-definition`).
   - Graduate Division Misconduct: Graduate Student Academic Misconduct Policy (GAMP), establishing Early Resolution and Hearing Committee tracks, and a 10-day appeal window based on new evidence or procedural error (`claim-grad-academic-misconduct-scope`, `claim-grad-misconduct-appeal-rights`).
3. Licensed AI Tools Qualification & P-Levels: Refined all 8 tools with verbatim continuous quotations from `ai-hub-licensed-tools.txt`, recording CalNet SSO requirements, recharge fees, employee vs. student eligibility, and P1–P3 data protection levels.
4. Research Misconduct & Disclosure: Added the 2026 Research Misconduct Policy (effective Jan 1, 2026) governing allegations through assessment, inquiry, and investigation stages (`claim-research-misconduct-three-stages`), and researcher GenAI responsibility and federal ORI disclosure principles (`claim-research-ai-responsibility`, `claim-research-ai-disclosure-standards`).
5. Detection & Privacy: Added RTL pilot findings that Turnitin AI writing detection does not provide conclusive evidence and remains unenabled for general use (`claim-turnitin-ai-writing-detection-status`), and confirmed instructors must not upload student work to third parties without an institutional MOU (`claim-third-party-ai-privacy-mou`).

Shared V6 composition, topics, FAQ, three Do/Don't actions, and the concerns dialog are reused. Student snapshots remain `needs_review` and not published; no artificial approval was fabricated. English and Chinese UI and guide projections are reviewed for this input. Other locale routes preserve original/English evidence; seven routes are not seven reviewed policy translations. No other university's policy or existing held decision changes.

Paired input: `berkeley-v6-r1-20261017`, passed `pnpm v6:pack` (`inputSha256: 6fd7f7b0d9218cf5e7a98a98e91cd1c6a2f3dd50c6cf482a938716c571be2be9`, reconstructed identically through the actual shard loader). The co-package contains 18 V6 schools, 595 Claims, 214 tools, and 7 held Claims. Shards installed:
- `data/public-v6-pages/sharded/revisions/berkeley-v6-r1-20261017-8f830c155ad854e30eeef3286fdd3a4e64541bc68d2d449f669d105d48c7a5f5.json`
- `data/public-v6-records/sharded/revisions/berkeley-v6-r1-20261017-4f60955f970f468fcef8c1bd9c34423dee161458d4401f2c82beaa531e1d7f12.json`
- `data/public-v6-history/sharded/revisions/berkeley-v6-r1-20261017-e32db8c452737123b2f49db2c905724d80603614dae5aa79e18ba3368345a7a5.json`

Remaining evidence gaps: full Academic Senate course guidelines beyond public snippets; live authenticated verification of campus recharge billing and student employee quotas; commercial detector agreement status remains absent / MOU required; student snapshot held as `needs_review` pending formal dual-agent approval.

Local validation:
- `pnpm check` passed 100% (Prisma, i18n, entity aliases, public contract, tool records, analysis contract, policy snapshot, audit policy analysis, analysis pages smoke, entity search smoke, source diffs smoke, OpenClaw artifacts, dataset release, v6 shards, v6 release [18 schools/595 claims], public data audit, workspace typecheck across 8 projects, and workspace lint).
- `pnpm --filter @uapt/tulsa-zone exec tsc --noEmit` passed with 0 errors.
- 17 unit and regression tests passed:
  - `tests/qs-coverage-identity.test.ts` (3/3 passed)
  - `tests/assessment-evidence-gate.test.ts` (5/5 passed, verifying zero tools in Berkeley's exams dimension)
  - `tests/indexnow.test.ts` (9/9 passed)
- Local contract check (`.local/berkeley-20261017/local-contract.ts`) passed: 40 claims, 13 sources, 8 tools, 16 untouched universities, coverage score 100, exams status conditionally_allowed with valid non-tool evidence, guide validated.
- Local history shard check (`.local/berkeley-20261017/check-history-direct.ts`) passed: cold and warm reads for Berkeley (`berkeley-v6-r1-20261017`, `public-release-20260715-005`, `public-release-20260614-001`), Tsinghua, and Harvard.
- Local HTTP readback matrix (`.local/berkeley-20261017/local-qa.ts`) passed all 20 checks across English, Chinese, French, Polish, Spanish, Dutch, and Malay locale pages, API summaries, analysis profiles, QS coverage identity (=17), revision diffs, tools index, search, and control schools.

Synchronization surfaces status:
1. Public entity summary API: Evidenced (40 claims, 13 sources).
2. Analysis API: Evidenced (conditionally_allowed, 0 tools in exams dimension).
3. Tools API: Evidenced (8 licensed tools with CalNet/P-level limits).
4. Student snapshots: Evidenced (held as absent/needs_review, 404 cleanly returned).
5. University change history API: Evidenced (3 revisions in per-school history shard).
6. Revision diff API: Evidenced (`baseline-berkeley-v6-20261017.json`).
7. Latest change API: Evidenced (`changes/latest/university-of-california-berkeley.json`).
8. University pages (EN/ZH/FR/PL/ES/NL/MS): Evidenced (200 OK across 7 locales).
9. Changes / History UI: Evidenced (`/changes/university-of-california-berkeley`, `/changes/berkeley-v6-r1-20261017/university-of-california-berkeley`).
10. QS coverage endpoint: Evidenced (Rank =17, 100 distinct entities).
11. Search index: Evidenced (`/api/public/v1/search.json?q=Berkeley`).
12. MCP Server: Contract verified via public API equivalence and shard loaders.
13. Sitemaps: Verified via `test:indexnow` sitemap intersection suite.
14. Search engine notification (IndexNow): Dry-run verified; live submission deferred until authorized release.

Release Boundary & Hold:
In strict adherence to user instructions ("按照这个意见开始修改 完成后先不上线 验收通过后通知你上线"), all work is complete and validated locally. No git push, no server deployment, no service restart, no route cutover, and no IndexNow submission has been executed. All artifacts are prepared and ready for production promotion upon explicit user approval.
