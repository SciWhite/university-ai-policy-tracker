# Maintenance Note: maastricht-university

**Maintenance run:** maintenance-2026-06-06T05-20-38-614Z
**Entity:** maastricht-university
**Reviewed at:** 2026-06-06T21:12:00Z

## Status

The lightweight review unit for the first Maastricht source timed out and did
not produce a no-change note or a valid staged artifact bundle.

## Decision

Do not promote Maastricht University from this maintenance run.

The maintenance scan queued four Maastricht source rows, but no row produced a
confirmed policy-content update represented by a validated
`openclaw-artifact-v1` bundle. The remaining Maastricht source rows were also
held back because the current lightweight launcher keys output paths by entity
slug and cannot safely review multiple Maastricht source URLs concurrently
without overwriting notes, logs, prompts, or artifact directories.

## Follow-Up

Re-run Maastricht with a source-specific review path, or sequentially review one
source at a time with source-specific output names. Do not treat the timeout,
source-health hash changes, or unreviewed duplicate-source rows as public policy
changes.
