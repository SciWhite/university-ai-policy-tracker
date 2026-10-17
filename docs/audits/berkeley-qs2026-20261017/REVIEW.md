# University of California, Berkeley (UCB) Audit & Release Reconciliation

- **Institution**: University of California, Berkeley (`university-of-california-berkeley`)
- **QS 2026 Rank**: =17 (tied with Tsinghua University)
- **Release Designation**: `berkeley-v6-r4-20261017` (Release infrastructure reconciliation)
- **Content Basis**: 44 Claims, 13 official sources, 8 licensed tools, 0 approved student snapshot (`needs_review` / not published)
- **Exams Dimension**: `insufficient_public_evidence` (strictly non-tool evidence, syllabus and instructor discretion)

---

## 1. Audit Baseline & Content Summary

The public baseline for UC Berkeley on 2026-10-17 recorded 30 Claims (22 classified as `other`), 6 official sources, 8 licensed tools, and a conditionally allowed exam status improperly derived from 5 licensed tool records (Adobe Firefly, ChatGPT Edu, Gemini, etc.).

Across subsequent review cycles, primary sources were systematically audited and validated:
- **Baseline Claims Preserved**: All 30 original Claim IDs (`claim-university-of-california-berkeley-1` to `30`) are preserved with exact continuous verbatim quotes and source hashes.
- **Claims Expansion (44 Claims Total)**:
  - 30 baseline claims updated with precise classification (`teaching`, `academic_integrity`, `privacy`, `research`, `other`).
  - 14 added claims covering:
    - Undergraduate & general student conduct framework under the July 1, 2026 Berkeley Campus Code of Student Conduct, implementing revised PACAOS 100.00 and Appendix H (`claim-student-conduct-2026-framework`, `claim-student-conduct-academic-misconduct`, `claim-student-conduct-cheating-definition`).
    - Graduate student academic misconduct under GAMP, including Early Resolution, formal hearing committees, and the 10-day appeal window (`claim-grad-academic-misconduct-scope`, `claim-grad-misconduct-appeal-rights`).
    - 2026 Research Misconduct Policy covering assessment, inquiry, and investigation stages (`claim-research-misconduct-three-stages`).
    - Turnitin AI writing detector unreliability and pilot non-deployment (`claim-turnitin-ai-writing-detection-status`).
    - Third-party student data upload prohibition without an institutional MOU (`claim-third-party-ai-privacy-mou`).
- **Exams Status Calibration**: Tool claims were completely excised from exam evidence. Because campus-wide guidance delegates specific exam authorizations to individual instructor syllabi and proctored examination rules, the exams dimension is classified as `insufficient_public_evidence` grounded in course discretion and student conduct standards.
- **Tone Calibration**:
  - Research disclosure reflects official guidelines using "should" and compliance with specific grant sponsor requirements rather than an inaccurate universal "must".
  - Privacy data restrictions distinguish general public/confidential data guidance from specific institutional tool exceptions and MOU requirements.

---

## 2. Release & Audit Evolution (R1 -> R2 -> R3 -> R4)

### R1 (`berkeley-v6-r1-20261017`)
- Established 40 claims, 13 official sources, and 8 licensed tools.
- Integrated into shared V6 multi-school package (18 schools, 595 claims, 214 tools).
- **Independent Review Findings**:
  - P1 tone distortion in research disclosure (used "must" instead of source's "should").
  - P1 privacy data over-simplification (omitted tool exceptions and third-party MOU context).
  - Recommended calibrating exams dimension from `conditionally_allowed` to `insufficient_public_evidence`.

### R2 (`berkeley-v6-r2-20261017`)
- Corrected research disclosure tone and third-party privacy MOU wording.
- Calibrated exams dimension to `insufficient_public_evidence`.
- Added 4 procedural misconduct claims, bringing total to 44 claims.
- **Independent Review Findings**:
  - P1 Public URL configuration: `publicJsonUrl` and `canonicalUrl` in rankings JSON generated `http://localhost:3000/...` rather than the public origin `https://eduaipolicy.org/...`.
  - 3 minor evidence snippet character/newline discrepancies.

### R3 (`berkeley-v6-r3-20261017`)
- Resolved `publicJsonUrl` and canonical URL metadata to `https://eduaipolicy.org`.
- Reconciled snippet strings across all 44 claims.
- Successfully verified MCP readbacks (44 claims, 8 tools).
- **Independent Review Findings (`.local/berkeley-r3-independent-review/REVIEW.md`)**:
  - **P1 Release Basis Mismatch**: The candidate and completion sync ledgers referenced R2's code SHA (`a00af87d`), R2 `BUILD_ID`, and R2 pointer hashes (40 claims), while the running service was R3 (`77dab37d`, 44 claims). The lifecycle gate lacked validation to detect basis-vs-candidate drift.
  - **P1 Unmeasured Late Build**: The `.next` output was rebuilt at 21:02 UTC while the candidate service was already running, bypassing the `uapt-build.scope` memory sampling session.
  - **P2 Documentation & Notification**: Documentation was stuck on R1, and notification exclusion reason contained contradictory wording ("will send later").

### R4 (`berkeley-v6-r4-20261017` - Current Infrastructure Reconciliation)
- **Policy Content**: Kept strictly identical to the verified R3 baseline (44 claims, 13 sources, 8 tools, exams `insufficient_public_evidence`). No artificial policy revisions or false inspection date bumps.
- **Lifecycle Sequence**: Enforced strict ordered lifecycle:
  $$\text{audit} \longrightarrow \text{prebuild} \longrightarrow \text{受限构建} \longrightarrow \text{四阶段实测} \longrightarrow \text{gate} \longrightarrow \text{cutover} \longrightarrow \text{公网验收} \longrightarrow \text{complete} \longrightarrow \text{退役后复查}$$
- **Controller Identity Validation**: Implemented `validate_candidate_identity` in `scripts/uapt-release-lifecycle.py`, verifying:
  - Exact `BUILD_ID` match between basis and candidate `.next/BUILD_ID`.
  - Exact match of `pagePointer`, `recordPointer`, and `historyPointer` in `current.json` and revision files.
  - Mechanical verification of `source-manifest.json` file entries and `codeSha`.
  - Verification of `build-artifact-manifest.json` and `mcp-catalog.json`.
  - Verification of running candidate services: `ActiveState=active`, valid `MainPID`, `InvocationID`, and `WorkingDirectory` within release directory.
  - Regression tested in `tests/test_release_lifecycle.py` proving that old R2 credentials paired with R3/R4 artifacts fail admission immediately.
- **Capacity Sampling Binding**: Capacity receipts strictly record `uapt-build.scope` peak RSS, stage peaks (`build`, `startup`, `cold_history`, `steady`), `BUILD_ID`, and candidate service `MainPID` / `InvocationID`. Overwriting `.next` in a running directory is forbidden.
- **Notification Reason**: Factually documented as a release infrastructure reconciliation with no public policy content changes compared to live production.
- **Historical Evidence**: All previous operational directories and transaction records are preserved.
