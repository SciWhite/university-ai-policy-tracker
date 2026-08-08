# Student policy snapshot v1

`uapt-policy-snapshot-v1` is an independent, display-oriented contract for a
student-first summary of one university's public policy claims. It does not
replace claim, evidence, source, or machine-analysis records.

## Files and public JSON

Author one university per file to reduce merge conflicts:

```text
data/policy-snapshots/v1/index.json
data/policy-snapshots/v1/universities/{slug}.json
```

The Wave 1 index is intentionally empty. The Bristol file under
`examples/fixtures/` is a validator fixture, not a promoted public snapshot.

Public routes are:

```text
/api/public/v1/policy-snapshots/index.json
/api/public/v1/policy-snapshots/universities/{slug}.json
```

The existing university JSON may add an optional `policySnapshot` link and
effective status. Existing claim/evidence fields and meanings are unchanged.

## Contract rules

- English (`canonicalLocale: "en"`) is canonical. Localized prose is optional,
  display-only, and each locale must include `review.status`, reviewer, date,
  `sourceLocale: "en"`, and `displayOnly: true`.
- Every file has six dimensions: `coursework`, `exams`, `disclosure`,
  `privacy_data`, `approved_tools`, and `research_publication`. Academic-
  integrity facts remain represented through the coursework, exams, or
  disclosure dimensions rather than a separate dimension.
- A non-`not_mentioned` dimension must carry claim IDs and source URL/hash
  pairs. `not_mentioned` carries no actions and no basis.
- `do`/`dont` actions are short reviewed display guidance. They are not legal,
  academic-integrity, or university-authoritative advice.
- Every snapshot review records `reviewMethod: "dual_agent"`; an approving
  secondary review is required before a snapshot can become `strong`.
- `strong` requires two agreeing approving agent reviews, a non-empty basis,
  and reviewed localized prose when translations are present.

The independent UAPT 6 review is retained at
`data/policy-snapshots/v1/reviews/uapt-6-independent-review.json`. It has one
machine-readable decision and evidence-pointer set for each indexed snapshot;
its notes are issue summaries only and do not replace claim or source records.

## Fail-closed status

The loader checks a snapshot against the current public university summary and
`data/public-releases/current.json`:

- `strong`: the dual-agent gate passes and the basis fingerprint matches the
  current release, claim content, and source snapshot hashes.
- `stale`: the release, referenced claim content, source hash, or fingerprint
  changed. Consumers must not treat the snapshot as current guidance.
- `needs_review`: a basis claim is missing/unreviewed, the review gate is
  incomplete, or the file is otherwise not eligible for strong publication.

The fingerprint is SHA-256 over canonical JSON containing the current release
ID, the sorted referenced claim IDs with current claim type/text/value/review
state and evidence source/hash pairs, and the sorted basis source/hash pairs.
This makes a strong snapshot fail closed when its public basis moves.

Run the Wave 1 checks with:

```bash
pnpm validate:policy-snapshot
pnpm test:policy-snapshot
pnpm smoke:policy-snapshot
```

These checks validate the fixture, assert stale behavior after a release
change, inspect the versioned index, and do not promote data or deploy.
