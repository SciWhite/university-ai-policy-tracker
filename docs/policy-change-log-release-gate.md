# Policy updates must publish their change logs

Every published policy update must update the corresponding `/changes/<slug>` page and its change-index, latest-university diff, recent-changes widget and RSS surfaces in the same scoped release. Validate the affected public URLs after cutover. A policy JSON update alone is incomplete.

For hash-pinned record corrections, add a public entry in `data/public-record-repairs/change-log.json`, bound to the exact revision, record hash, baseline fingerprint and tracker publication timestamp. The loader and `pnpm check` reject a published pin without its matching entry. The change renderer derives claim/evidence/source differences from immutable baseline and correction records, retaining historical global releases.

Describe audit corrections as tracker corrections. Never infer university publication/effective dates from tracker timestamps or source hashes. Student-summary approval remains separate. Follow the current small-release routing policy; do not rebuild the whole site for a few change pages.

Regenerate the frozen public index and university histories before validation:

```sh
UAPT_BUILD_CORRECTION_CHANGES=1 pnpm exec tsx --tsconfig apps/web/tsconfig.json scripts/build-record-correction-changes.ts
```

Commit the journal and `change-cache` projections together. Their manifest binds every projection to the exact journal hash; publication rejects stale projections. Do not use the regeneration flag on the production runtime.
