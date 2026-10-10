# MIT scoped published repair — 2026-10-10

This is a current-record correction, authorized separately from the original read-only audit. The historical global release ID remains `public-release-20260924-002`; that release's artifacts and review decisions are unchanged. The current MIT revision is `mit-20261010`, pinned by `../current.json` and its SHA256.

- `baseline.json`: original public record and evidence preserved before repair; original 21 Claim IDs are retained.
- `record.json`: 28 claims, 26 currently reviewed and 2 historical IS&T provisions held as `needs_review` / `source_status`. Removal from a current page does not establish repeal.
- `historical-student-snapshot.json`: prior snapshot to which the historical independent-review decision applies. The corrected current snapshot is `needs_review`; no new independent secondary review is claimed.
- `source-provenance.json`: retrieval times and raw/normalized SHA256 for current official sources. Normalized lines identify captured text, not university-issued line numbers. PDF locations use actual PDF page plus printed page/section.

Current-source corrections cover public-tool Medium Risk prohibition, procurement requirements, tool eligibility/cost/access, writing citation/accuracy guidance, classroom-policy scope, detector evidence limitations, thesis recommendations, COUHES consent and general COD accommodations/return conditions. Five supplementary COD display records have separately recaptured exact evidence, including the revised permission-to-return procedure.

The original audit remains PARTIAL for historical source-byte authenticity. Current recapture is not proof of the old snippets. Neither extraction confidence nor quote matching constitutes an accuracy rate or independent semantic review. The original audit is preserved in `docs/audits/mit-qs2026-20261010/PRE-REPAIR-AUDIT.md`.

Reproduction requires private captured official documents in `.local/mit-repair-evidence` (never served or committed). `scripts/capture-mit-record-repair.py` retrieves current sources with BeautifulSoup/pypdf; recapture changes hashes and requires a new immutable revision and review. `scripts/prepare-mit-record-repair.ts` prepares the public records, held snapshot and sanitized runtime content from reviewed captures. These scripts do not deploy.

Release method: bounded shared-zone build on OCI, exact MIT page routes plus enumerated affected public API routes. Other university records and runtime content must compare unchanged. Preserve active service, content pointer, nginx configuration and MCP catalog as rollback material. No full-site or local production build.
