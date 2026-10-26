# Bounded indexing and measurement repair

The accepted source/data baseline is `6dbaadf4` with 100 V6 schools and 881
published historical events. All existing policy/source/snapshot/held objects
remain byte-identical. This release does not approve policy semantics.

Build only the existing shared web zone. Main and MCP remain on their accepted
artifacts. Replace the shared web role through the installed lifecycle controller;
retain all its existing route ownership and resource fallbacks. Additional ownership
is an exact allowlist of 1,613 English empty diffs, their 9,678 language controls,
the analytics event collector. Five changed sitemap sections remain static. The unchanged
core sitemap can remain on main. No generic school/API/locale prefix is taken over.

The sitemap builder reads byte-frozen accepted public XML in
`data/index-sitemap-source/` and removes only frozen members from
`data/index-sitemap-removal-scope.json`. Preserve
all retained XML entries and dates. Expect 1,673 membership removals: 1,613 empty
English diffs, 52 aliases, eight duplicate members. Verify actual before/after
sets and bytes, never infer acceptance from counts alone.

The collector accepts explicit QA/internal/monitor labels for every routed client;
updated shared pages also carry the new browser collector. Older main/legacy
clients remain recognizable as older collector versions. Unmarked traffic is not
verified human traffic. Preserve raw historical events; expose incomplete windows
and missing source coverage. A separate role/collector T0 is required.

Freeze the code SHA and source manifest. Reuse unchanged immutable public data and
assets by verified hard links, and accepted dependencies read-only; record those
recovery dependencies. Do not hard-link mutable source, build output or pointers.
Budget seven cumulative disk stages and fixed build memory before transfer/build.
Use contract 2.1.0, candidate/browser/actual public checks, old-web retirement,
retention receipts and exact notification scope. New assets use a distinct prefix
`/index-measurement-20261026`; preserve previous resources independently.

The March/September-style legacy public diff bodies must be compared to main:
metadata/noindex changes cannot silently replace policy/history meaning. If
candidate body/data or protected routes drift, stop before cutover and narrow the
adapter. Policy APIs, MCP, school history and all 881 event identities are controls.

The first isolated built candidate timed out on the newly owned legacy diff path.
A CPU profile identified repeated whole-cohort summary inflation during a
single-school lookup. The candidate was stopped without routing public traffic.
The next candidate uses the existing verified keyed shard reader and selects the
requested release entity before resolving its record. Unknown schools/revisions
remain unavailable; no policy/source/snapshot approval is introduced. Validate
all 100 school records and all 1,613 legacy empty records against the unchanged
complete loaders before freezing, then repeat cold HTTP and memory acceptance.
