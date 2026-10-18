# Bounded search runtime repair

This repair covers three reproduced faults: the API root's nginx/Next slash
redirect cycle, streamed localized monthly share-image failures, and duplicate
ETH Zurich sitemap entries. Policy records, approvals, titles, source quotations,
snapshots and historical release contents are unchanged.

- Select exact `/api/public/v1` and `/api/public/v1/` redirects to the existing
  `/api/public/v1/index.json`, preserving query parameters. The template is
  `infra/nginx/uapt-api-root-redirects.conf`.
- Reuse the localized image renderer through the existing shared zone. Give
  the footer an explicit flex layout and a single interpolated text child.
  Consume the PNG stream in regression checks, since construction alone does
  not expose rendering failures. Only existing, tested locale/month URLs are
  selected; report pages remain on their current upstreams.
- Deduplicate sitemap generation by full URL, retaining the latest existing
  lastmod. The currently served immutable XML artifacts also need an explicit
  new package: preserve every distinct URL, lastmod and historical artifact,
  remove only duplicate blocks, and atomically select exact aliases.

Follow `release-routing-policy.md`, `oci-small-release.md` and
`release-lifecycle.md`: frozen pushed SHA, OCI shared-zone-only build, fixed
candidate slot, capacity sampling, synchronization 2.0.0 receipts, semantic
candidate acceptance, lifecycle cutover, public readback, and prior active
retirement. Preserve the exact previous nginx and static assets for rollback.
No new policy change or artificial policy freshness date is created.
