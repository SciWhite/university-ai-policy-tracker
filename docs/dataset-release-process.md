# Dataset Release Process

This process turns promoted public records into reusable dataset artifacts
without weakening the evidence boundary.

## Scope

P5 distribution assets include:

- `/api/public/v1/datasets/latest.json`
- `/api/public/v1/datasets/universities.jsonl`
- `/api/public/v1/datasets/claims.jsonl`
- `/api/public/v1/datasets/sources.jsonl`
- `/api/public/v1/datasets/changes.jsonl`
- `/api/public/v1/datasets/checksums.txt`
- `/api/public/v1/datasets/data-dictionary.md`
- `DATA_DICTIONARY.md`
- `CITATION.cff`
- `CONTRIBUTING.md`
- release notes or monthly reports under `/reports`

Tracker metadata is reusable with attribution. Official university source
documents, PDFs, screenshots, and page text retain their original rights.

## Release Checklist

Before publishing a dataset release:

1. Promote only reviewed staged artifact directories through
   `data/public-releases/current.json`.
2. Run `pnpm validate:openclaw-artifacts`.
3. Run `pnpm validate:dataset-release`.
4. Run `pnpm audit:public-data`.
5. Run `pnpm check`.
6. Confirm `/datasets` links to the latest manifest and every artifact listed in
   the manifest.
7. Confirm `checksums.txt` includes SHA-256, byte size, row count where
   applicable, filename, and public path.
8. Confirm `DATA_DICTIONARY.md` and the public
   `/api/public/v1/datasets/data-dictionary.md` describe any new public field.
9. Confirm report and outreach pages do not turn candidate records into final
   policy conclusions.

## Release State Semantics

Release manifests have three distinct roles:

- `data/public-releases/candidates/*.json` is pre-promotion state. Every file
  must set `candidateOnly: true`, describe itself as a candidate, and may list
  gates that still need to pass.
- `data/public-releases/history/*.json` is an immutable published snapshot. It
  must not set `candidateOnly: true` or retain wording that says promotion is
  still pending.
- `data/public-releases/current.json` is the active public release. It follows
  the same published-state rules as history and must be the newest published
  manifest by `publishedAt`.

`previousReleaseId` describes the public release chain, not the baseline used
to assemble a scoped candidate. If a candidate was built from an older
immutable data bundle while a maintenance release was already public, the
promoted manifest must still point to that intervening public release.

AI-tools counts also have two separate scopes. A release-scoped candidate
bundle counts only the audited QS bundle named by that release. The public
`/api/public/v1/tools.json` endpoint merges every promoted source-backed tool
record, so its total may be larger. Release notes must label which count they
are reporting.

## Artifact Rules

- Public JSON and JSONL must be versioned under `/api/public/v1/...`.
- Additive fields can be added to `v1`; breaking changes require a new version.
- Original-language evidence remains canonical.
- Translated or localized display text is helper-only.
- Confidence and review state must remain separate.
- Staging artifacts and internal knowledge summaries are not public evidence.
- Excel/reference-sheet summaries are non-authoritative benchmarks only.

## GitHub Release Notes

Each GitHub release should include:

- release ID and release period;
- public dataset manifest URL;
- artifact list with row counts and checksums;
- reviewed/candidate/needs-review counts;
- source-language distribution;
- methodology and citation links;
- no legal advice / no academic integrity advice boundary;
- source rights caveat for official university materials.

## Zenodo Archive Plan

Zenodo should be used after the public contract is stable enough for external
research reuse. Archive only tracker metadata artifacts, not raw source
documents or screenshots.

Recommended Zenodo package:

- dataset release manifest JSON;
- public JSONL exports;
- checksums file;
- data dictionary;
- citation file;
- monthly report markdown or PDF if available;
- release notes with source-rights caveat.

The DOI should point back to the canonical dataset page and latest release
manifest. The website remains the current access point; Zenodo is a dated
archive, not the canonical live feed.

## Acceptance Criteria

- `/datasets` exposes release artifacts and checksums.
- `CITATION.cff` is present for GitHub citation workflows.
- `DATA_DICTIONARY.md` explains public fields and evidence rules.
- Public JSON and JSONL URLs resolve from the versioned API path.
- Reports cite the exact release ID and public data links used.
- External users can cite the dataset without copying official source text.
