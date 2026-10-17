# V6 immutable shards and bounded historical caches

Stage: local implementation, not a production migration. This follows
`bda783e29a07b04a4a2f5071e408bf2d7b50426e`. No production build, push, service
change, content cutover, snapshot re-pin or notification is authorized by this
work. Existing public pointers, frozen packages and approval fingerprints remain
unchanged. This is a storage/loader change, not a university policy correction.

## Storage and reads

Each of the three public families now has `sharded/index.json`, immutable
hash-named revision manifests, and `sharded/objects/<sha256>.json`. Page leaves
are split by locale/school/representation; record leaves separate summaries,
tools, snapshots, held claims, historical baselines and analysis overrides.
Frozen histories split by school. Identical JSON bytes share a blob across
revisions and locales. Sharing bytes never merges source URLs, versions, Claim
IDs, hash kinds, scope or approvals inside those objects.

The manifest keeps original field/array order and the original package's raw
SHA-256. Its descriptors reconstruct the original public JSON, including fields
outside the old TypeScript interfaces. A full compatibility view uses enumerable
getters without memoizing the whole reconstructed package. Single-school page,
record and history reads select the exact leaf; the comparison name dictionary
is small manifest metadata. Explicit full-package JSON endpoints still enumerate
all leaves and can allocate a full response. They retain no assembled package.

The legacy readers remain available with `UAPT_V6_LEGACY_DATA=1` for controlled
comparison/rollback. Registered shards with bad hashes, sizes, paths or identity
throw; they do not silently fall back to old data. Source bytes and per-school
record fingerprints are distinct. The shard layout never re-hashes a review pin
to make a stale or held snapshot appear approved.

Current derived representation, counting reachable manifests/objects and index:

| Family | Frozen revisions | Old aggregate bytes | Sharded bytes |
| --- | ---: | ---: | ---: |
| Pages | 15 | 370,592,835 | 16,144,368 |
| Effective records | 13 | 47,003,858 | 5,180,557 |
| Histories | 11 | 67,422,566 | 18,705,421 |

All 39 old aggregate files are retained byte-for-byte. These figures compare
representations, not Git pack sizes or disk space reclaimed: no old data was
deleted. Future revisions add changed blobs plus a manifest/index entry, rather
than another full aggregate. Manifests still scale with the indexed collection.

## Cache and concurrency budgets

`ByteLru` bounds retained serialized payload and entry count. The shared artifact
cache has 256 entries / 24 MiB across pages, records and histories. Large objects
are read but not cached; individual shard files above 16 MiB and manifests above
2 MiB are rejected before parsing. This requires explicit redesign if a future
school exceeds those limits.

Historical computed results also have byte/item budgets:

| Cache | Items / serialized payload | Active builds / queued unique keys |
| --- | --- | --- |
| Release diffs | 8 / 24 MiB | 2 / 32 |
| Historical datasets | 2 / 24 MiB | 1 / 32 |
| Source text diffs | 8 / 4 MiB | 2 / 32 |
| Aggregate change rows | 1 / 8 MiB | 1 / 32 |
| All-release change rows | 1 / 8 MiB | 1 / 32 |
| Change index | 1 / 4 MiB | 1 / 32 |

Concurrent identical keys share one promise. Failed promises are removed so a
retry can work. Oversized results are returned to active callers but not retained.
Full queues reject; the zone public API returns 503 with Retry-After for that
capacity error. Revision expansion is sequential rather than an unbounded
Promise.all over historical releases.

These are serialized-payload accounting limits, not a hard heap/RSS ceiling.
Decoded objects, clones, keys, active responses, framework/build caches, the
existing current 828-school dataset and concurrent cache families use additional
memory. Production capacity gates, cgroup limits and cold-start peak receipts
remain required; the local measurements below do not replace them.

## Authoring and validation

`pnpm validate:v6-shards`, included in `pnpm check`, verifies all frozen aggregate
hashes, shard reconstruction and current pointers. Its frozen legacy baseline
rejects newly copied aggregate revision files. It does not approve policies.

For conversion of existing public artifacts:

```sh
pnpm v6:shards --all-public
```

Historical single-family conversion (new page/record packages now use the paired
`pnpm v6:pack` input described in `v6-input-hash-seo-contract.md`):

```sh
pnpm v6:shards --family public-v6-pages --revision <new-id> \
  --input <frozen-public-package> --sha256 <exact-input-byte-hash>
```

The single-family CLI only accepts frozen legacy page/record revisions, or public history.
New page/record revisions require the paired packer. Keep the
exact input in the acceptance/recovery bundle; publish only public fields.
Export validates identity and applicable record schemas, writes immutable blobs
and a local registry, and never updates current pointers. It does not establish
semantic approval, independent review, or promotion authorization. Existing
one-off preparation/publishing scripts must not be rerun to bypass the adapter,
new aggregate guard or synchronization ledger. Keep paired page/record scopes
and selected package hashes consistent. A new revision need not have a tracked
aggregate file; readers can resolve its registered shards.

The registry is presently imported with code. This work does not implement a
live content-pointer reloader or make new school additions Mode A. Build tracing
explicitly includes shards, but no production build was run. A future authorized
release must carry every referenced manifest/blob, test from the deployed
artifact, and retain legacy packages for rollback. Do not start per-school or
per-version services. Use the lifecycle controller and actual affected scope.

## Verification and remaining release gates

- All 39 page/record/history revisions reconstruct identically, including field
  and array order; all historical single-school summaries/histories reconcile.
- Cold UCL page/record/history lookup reads six files, 388,146 bytes total, largest
  file 173,692 bytes. It does not load the large legacy aggregates.
- Separate Node processes compared the original release checkout at `65ff0fce`
  with this implementation, visiting the same schools/revisions twice. Matching
  result checksum: 698. After explicit GC, original heap was 64.2 MiB after cold
  school access and 426.7 MiB after historical visits; the new heap was 26.2 and
  34.9 MiB. Baselines were 25.3/25.5 MiB. Final new artifact-cache retention was
  6,882,420 serialized bytes. These are one-machine diagnostics, not load tests or
  guaranteed production percentages. Raw samples include RSS and timings.
- Tests cover immutable reconstruction, direct lookup, source mismatch,
  corrupted blobs/manifests, path/symlink escape, mutation isolation, byte/item
  eviction, oversize skips, single-flight, rejected-promise retry, active/wait
  limits, repeated-revision cache pressure, export reuse and the aggregate guard.
- The local seven-language school/directory matrix (128 paths) and stable
  history/change API/page matrix (86 paths) passed. Representative main SSR text
  remains identical to the earlier payload fix. Early HTTP attempts encountered
  a development config restart; another cold MIT legacy-diff request exceeded
  60 seconds during compilation/load. Those failures are retained separately;
  stable readback passing does not prove production cold-start performance.
- A separate fresh-process route-handler probe then exercised cold and warm
  paths without the development compiler: MIT latest diff returned 200 in
  2,435/9 ms, UCL historical JSON in 8/5 ms, Cornell historical JSON in 9/5 ms,
  and the change index in 100/42 ms. This tests actual handler code, not a full
  production Next server, TLS, browser or OCI startup.
- Explicit zone typecheck, repository checks and relevant regressions are
  recorded in the private task receipts. Gemini has not reviewed this new change.

Before release: validate an OCI candidate from the exact artifact, installed
shard hashes, cold/warm history paths, peak memory under bounded concurrent
requests, public readback and active retirement. Do not claim this local task
completes those gates. Keep the prior directory fix's fourteen exact routes in
the same release plan; its production directory mismatch is still unresolved
until authorized selection.

## Review edge notes repaired

The comparison tray now uses selected slugs plus the name dictionary even when
loading fails. Async-loaded V6 table links keep `?layout=v6`. The V6 changes
endpoint links each school to its own record revision (presentation-only
releases retain their presentation revision); per-release delta arrays remain
unchanged. Next's generated zone `next-env.d.ts` is ignored and preserved.

Private evidence, original benchmark harness, error logs and sync event are in
`.local/v6-shards-20261016/`. The previous task's frozen receipts remain intact.
