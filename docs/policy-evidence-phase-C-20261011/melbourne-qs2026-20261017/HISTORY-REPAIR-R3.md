# Melbourne QS 2026 #19 V6 R3 Calibration & Evidence Alignment

- **Revision**: `melbourne-v6-r3-20261018`
- **Slug**: `university-of-melbourne`
- **Date**: 2026-10-18
- **Status**: PARTIAL (Evidence verified, student summary snapshot held in needs_review)

## Summary of Remediations

1. **Restored Original Claim Semantics (Claim 9 & Claim 13)**:
   - `claim-university-of-melbourne-9`: Restored to "use of GenAI tools for marking or grading should never be a substitute for staff exercising their own evaluative judgement" supported by Melbourne CSHE verbatim evidence.
   - `claim-university-of-melbourne-13`: Restored to "staff should consider and provide advice on the limits of acceptable use of AI-powered translation and editing tools (e.g. Grammarly, Google Translate)" supported by Melbourne CSHE verbatim evidence.
   - Displaced CSHE assessment strategies and secure vs open assessment distinctions moved to dedicated claims (`claim-university-of-melbourne-cshe-assessment-enhancement` and `claim-university-of-melbourne-secure-vs-open-assessment`), preventing semantic drift across public API and historical diffs.

2. **Real Student Examination Rules (Exams Topic Calibration)**:
   - Captured and bound official `open-book-exams` student guidance (`claim-university-of-melbourne-student-exam-rules`): students must verify whether GenAI is authorised for the specific exam and use only permitted tools and scopes.
   - Reclassified the 50% secure assessment requirement (`claim-university-of-melbourne-exam-rules`) to assessment design under teaching guidance.
   - Exams dimension calibrated to `conditionally_allowed`.

3. **Active MPF1318 Section 5.11 and Graduate Research Theses**:
   - Captured official `Responsible Use of AI in Research` policy guidance.
   - Bound active MPF1318 Section 5.11 requirements (`claim-university-of-melbourne-research-integrity-mpf1318`): documentation of DATs, disclosure in outputs/theses, and required privacy/ethics/security approvals.
   - Added `claim-university-of-melbourne-graduate-thesis-editing`: graduate research theses editing strictly limited to minor language/expression under Australian Standards for Editing Practice, with supervisor AI review requiring explicit candidate written consent.

4. **LMS Privacy & Investigation Access (AILA)**:
   - Captured official `University of Melbourne LMS Privacy Collection Notice`.
   - Bound `claim-university-of-melbourne-aila-lms-privacy`: LMS interaction metadata, assessment activity, and conversation records are retained and reviewable by authorized decision-makers in misconduct investigations.

5. **Citation vs Declaration Dual Framework**:
   - Calibrated `claim-university-of-melbourne-citation-vs-declaration`: citing/referencing AI output does not substitute for an acknowledgement declaration; students must provide both.

6. **Tool Endorsement Calibration**:
   - SparkAI and AILA updated to `self_hosted_system` ("校内托管服务"), with SparkAI explicitly noted as staff-only.
   - Turnitin AI detection updated to `institutionally_licensed_or_procured` ("校方提供／采购许可"), explicitly noted as staff diagnostic.
   - Avoided mislabeling internal tools as "officially_endorsed" ("官方推荐").
