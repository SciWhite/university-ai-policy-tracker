# Reviewed maintenance policy delta staged artifacts

Run ID: `uapt-maintenance-policy-delta-reviewed-20260523`

This bundle is a release-reviewed subset of `uapt-maintenance-policy-delta-20260523`. It keeps only candidate claims with clear public value after comparison against current promoted records. It is suitable for release-manifest validation as `agent_reviewed` metadata, not as human or institution verification.

## Decision summary

- Source candidates reviewed: 19
- Candidate claims reviewed: 56
- Claims selected for promotion: 25
- Claims held out as duplicate, weak, or already covered: 31
- Public release state: not public unless this directory is included in `data/public-releases/current.json`

## Selected claims by entity

- edinburgh: 2
- emory-university: 4
- leiden-university: 2
- the-university-of-sheffield: 2
- ubc: 3
- university-of-auckland: 5
- university-of-california-davis: 1
- university-of-toronto: 2
- university-of-wollongong: 2
- university-of-york: 1
- utrecht-university: 1

## Held-out entities

University of Queensland and University of Nottingham candidates were held out because the current public records already cover the relevant assessment-permission, false-authorship, and Turnitin/AI-indicator points. Other held-out claims were mostly duplicate, generic, or less precise than existing promoted claims.

## Boundaries

- No raw HTML, PDF full text, screenshots, or secrets are included.
- Original-language evidence remains canonical.
- This bundle does not provide legal advice or academic integrity advice.
- Claims remain `agent_reviewed`; none are `human_reviewed` or `institution_verified`.
