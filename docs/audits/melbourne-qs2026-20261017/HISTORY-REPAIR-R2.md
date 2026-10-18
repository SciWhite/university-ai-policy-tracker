# Melbourne R2 local history repair acceptance

Date: 2026-10-18. Revision: `melbourne-v6-r2-20261018`. State: local candidate accepted for this history repair; not committed, pushed, deployed or publicly verified by this task. The original independent evidence audit remains PARTIAL; this repair does not grant a complete university policy audit or approve held snapshots.

## Problem and resulting behavior

The R1 candidate froze Melbourne canonical history as an empty array. That made the history route fast but suppressed two existing releases. R2 freezes the complete original ChangeRecord objects from canonical history, including all fields and diff rows:

| Release | Diff rows |
| --- | ---: |
| public-release-20260715-005 | 8 |
| public-release-20260614-001 | 4 |

The selected loader now returns the R2 tracker correction followed by these two original releases. Full deep comparison against freshly recomputed canonical records passed. No new policy enactment or new historical policy change is inferred.

R2 uses a new paired page/record revision and aligned history basisRevision. R1 files were retained; no immutable revision was rewritten. All 422 pre-existing shard objects/manifests retain their original bytes. The other 18 school history blobs retain their original identities. All 19 school summaries, tool sets, snapshots and held collections match the preceding R1 candidate. Melbourne remains 30 Claims, 15 Sources and 4 Tools; exams remains insufficient_public_evidence. Parent release metadata continues to describe the previously published Berkeley baseline; the unpromoted R1 candidate is not presented as an actual public deployment.

## Frozen identities

| Artifact | SHA-256 |
| --- | --- |
| paired input | b3362d92d453f33b7ee25c4c548ce62b738ab89557d634d7ad30620b85798550 |
| pages | 40bda17d04a1700fb5da1c77f31f672baeb0e3f4ee4697277156a9c96e645eaa |
| records | a61103cf0fdc53de9dd434ab0e9a6412b5d6975408e4fe25f3a7c08a081647bf |
| history aggregate | 09aaa6c2e07b392bc17e71e718d4c2a8b7c1d32e07679150bfc2ed7ec12b322f |
| packaging acceptance | 4ddc5dbd6820f6852165f6ac12e2c826b9d4a339c328d4e706f960bdfadb4b2f |
| local packaging audit ledger | 96b7efd44128642c374d32904dede6ecc38e6f812500a00268d61dce2c5d8921 |
| source hash provenance | 6fef24a32c0134ee5d4f8b778ed9c9a21932d05618bfa0fc0f2d0796c1f3df8a |

The packaging ledger is a local audit event. It must not be reused as candidate/public policy_release acceptance. Actual release ledgers must bind the final source SHA, BUILD_ID, three artifact families, effective data basis and fresh readbacks.

## Validation and limits

- pnpm check passed, including paired V6 validation (19 schools / 629 Claims / 218 Tools / 7 held), shard validation (57 revisions / 39 legacy files), workspace typecheck and lint.
- Explicit @uapt/tulsa-zone tsc --noEmit passed. Targeted assessment/QS regressions passed 8/8. git diff --check passed.
- Direct history loader cold read 2.89 ms; warm entity history call 4.44 ms. Exact original history objects match.
- Local dev HTTP full response: Changes first request 2.896 s; warm request 0.186 s; both HTTP 200 with R2 and both old release IDs. Latest changes API, analysis API and Chinese SSR returned HTTP 200; exam evidence-insufficient state preserved.
- These timings are local development samples, not OCI production memory/capacity or sustained-performance acceptance. No full browser matrix or new official-source audit is claimed.

Local evidence and reproducible capture/verification scripts are retained in the private repair bundle. They are not production loaders or public data. Production promotion, capacity sampling, MCP readback, search/sitemap/notification eligibility and retirement remain the deployment agent's work under the current runbooks.
