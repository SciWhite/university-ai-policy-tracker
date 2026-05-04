# Taxonomy

The taxonomy should keep official policy conclusions separate from machine or student-generated interpretations.

## Document Status

- `university_wide_policy`
- `specific_unit_policy_or_guidance`
- `external_policy_or_guidance`
- `no_policy`
- `inaccessible`

## Policy Authority

- `university_wide`
- `faculty_or_school`
- `department`
- `course_level`
- `it_or_security_office`
- `library`
- `teaching_and_learning_center`
- `research_office`
- `procurement_or_legal`

## AI Service Status

- `institutionally_licensed_or_procured`
- `third_party_service`
- `self_hosted_system`
- `restricted_or_prohibited`
- `no_specific_ai_service_named`

## Service Treatment

- `allowed`
- `conditionally_allowed`
- `restricted_or_blocked`
- `not_mentioned`

## Governance Themes

- `data_entry`
- `privacy`
- `copyright`
- `academic_integrity`
- `teaching`
- `research`
- `security_review`
- `login_or_authentication`
- `procurement`

## Audience

- `students`
- `faculty`
- `staff`
- `researchers`
- `administrators`

## Academic Context

- `assignment`
- `exam`
- `thesis`
- `research`
- `teaching_preparation`
- `administrative_work`

## Data Sensitivity

- `public_data`
- `internal_data`
- `student_records`
- `personally_identifiable_information`
- `confidential_research`
- `regulated_data`

## Evidence Quality

- `official_source`
- `archived_official_source`
- `pdf`
- `third_party_mention`
- `unclear`

## Review State

- `machine_extracted`
- `agent_reviewed`
- `human_reviewed`
- `needs_review`

## Overclaiming Rule

If a source does not clearly say a tool is allowed, prohibited, licensed, or restricted, classify the service treatment as `not_mentioned` or set review state to `needs_review`. Do not infer permission from silence.
