# V6 discovery shared-zone release

This release integrates the locally accepted V6 homepage, university directory, search, Changes index and ranking directory/editions into the existing shared zone. Production baseline is `e7ca36b442780bc47544fd99c183c08f3c4d1629`; its 31 reviewed university revisions and immutable page/record/history pointers remain selected.

The 13 audited duplicate identities are merged into their canonical universities, retaining Claim IDs, sources, search aliases, permanent redirects and historical release diffs. Current discovery counts derive from 815 university identities. Historical dataset reports keep their original count semantics.

Single-university history reads use hash-verified frozen per-school artifacts; release diffs use frozen artifacts with bounded caches. Export the cache again whenever its public input basis changes. No private policy inventory is a production loader.

Selected compact marks are exported as hash-named WebP assets under `/assets/university-marks/20261020-compact`, with role, size, backing and native-pixel restrictions retained. The separate export authorization records the user's 2026-10-20 request to publish the prepared pages; source-library `publicationApproved:false` flags are retained. Private originals and provenance are not served. Development-only routes remain unavailable in production.

Only `@uapt/tulsa-zone` is built on OCI. Exact affected routes join the existing shared zone; existing routes and cold rollback artifacts are retained. Build admission, candidate/public acceptance, synchronization contract 2.0.0 and previous-slot retirement use `scripts/uapt-release-lifecycle.py`. Actual deployment receipts are stored separately; this document alone is not proof of cutover.
