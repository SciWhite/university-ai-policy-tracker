# Content release: format, validate, switch, refresh, rollback

Status: R1-b (2026-11-04); corrections, locale-index policy, record deltas and
MCP readback added 2026-11-06 (§12). It describes the runtime content path in
`apps/web` and `apps/mcp` and the tools in `scripts/content-release/`. This
document does not authorize a push, build, deployment, restart, cutover,
Cloudflare purge or search notification. Policy evidence rules
(`AGENTS.md`, `docs/policy-evidence-integration-runbook.md`) are unchanged.

## 1. Program and content

The program build no longer contains content pointers. Every loader resolves
its files through the **active content release**:

| Was compiled in | Now read at request time |
|---|---|
| `data/public-v6-{pages,records,history}/current.json`, `revisions.json`, `sharded/index.json` | same paths in the release tree |
| `data/public-change-history/current.json`, `revisions.json` | same |
| `data/*.json` (diff scope, sitemap overlay, student actions, projections, source-hash provenance, claim reference map, legacy completeness), analysis and record repairs | same |
| `apps/web/lib/policy-supplements-approved.json`, `university-tools-published-supplements.json` | moved to `data/` |
| Monthly report specs in `lib/monthly-report-registry.ts`, latest report in `lib/reports.ts` | `data/monthly-reports/registry.json` (`current` field) |
| `public/llms.txt` with the latest report path | `/llms.txt` route rendering the registry's `current` |
| V6 reading cohort for client links (`localizeHref`, language switcher) | server: active release; browser: passed by the root document |
| Reading translation pointer and sampled-publication pins (env) | `translations` in the release manifest (env remains the fallback) |
| Locale-index policy pinned by `UAPT_UNIVERSITY_LOCALE_INDEX_POLICY(_SHA256)` | `localeIndexPolicy` in the release manifest (env remains the fallback) |
| MCP catalog file pinned by `UAPT_MCP_EXPECTED_RELEASE_ID` | `mcp` in the release manifest, hot-reloaded |

Program assets stay in the build: UI copy (`messages/`), marks, artwork,
`policy-v6-review.json` (frozen approval of six fixed pages) and
`university-slug-aliases.json` (client-safe alias copy). A new school that
needs a new alias or a mark still needs a program release; see §9.

Two modes, chosen by environment:

- **Release mode** (`UAPT_CONTENT_ROOT` set): production and the local demo.
- **Workspace mode** (unset): the checkout's `data/`, read at runtime with the
  pre-R1-b precedence (`apps/web/.runtime-data` when present). Local
  development, tests, and builds made the old way.

## 2. Layout and format

```
$UAPT_CONTENT_ROOT/
  current.json                       pointer (atomic rename)
  pointer-history.jsonl              every switch, with its sync receipt
  objects/<aa>/<sha256>              immutable bytes (0444), shared by releases
  releases/<contentId>/
    manifest.json                    release manifest (0444)
    tree/<repository path>           hard links to objects/
    switch-<time>.json               changed tags/URLs and the Cloudflare body
```

A release tree has the repository layout (`data/...`, `staging/uapt-runs/...`,
`mcp/catalog.json`, `translations/...`), so loaders are unchanged apart from
their root. Unchanged files cost no bytes: building release B after A with the
same shards added 0 objects locally; a report-only release added 1.

**Pointer** (`uapt-content-pointer-v1`):

```json
{ "schemaVersion": "uapt-content-pointer-v1", "contentId": "c-20261110-001",
  "manifestSha256": "<sha256 of manifest.json>", "switchedAt": "...", "previousContentId": "...",
  "sync": { "contractVersion": "2.1.0", "eventId": "...", "eventSha256": "<sha256 of the event file>" } }
```

A pointer without `sync` is accepted only with
`UAPT_CONTENT_ALLOW_UNSYNCHRONIZED=1` and `unsynchronizedLocalPreview: true`
(local demos). A `2.0.0` receipt is refused for content that needs `2.1.0`.

**Manifest** (`uapt-content-release-v1`), main fields:

- `contentId`, `parentContentId`, `createdAt`;
- `appCompatibility`: `contentApi` (program reads `CONTENT_API_VERSION = 1`)
  and `schemas` (every family schema present; the program refuses unknown ones,
  see `SUPPORTED_CONTENT_SCHEMAS` in `apps/web/lib/content-runtime.ts`);
- `requiredSyncContract`: `2.1.0` when the release carries change-history v2
  or V6 overview packages, else `2.0.0`;
- `families`: identity (schema, revision, hash) of each family pointer;
- `reports` (`registry`, `current`), optional `translations` (`pointer`,
  `sampledPublication`, `recordDeltaAcceptanceSha256s`), optional
  `localeIndexPolicy` (`path`, `sha256`), optional `mcp` (`catalog`,
  `releaseId`, `sha256`);
- `decisions`: explicit `removedClaimIds`, `releasedHeldClaimIds`,
  `correctedClaimIds` per school (see §4);
- `claimSets`: school, claim and held counts plus the digest of the full Claim
  ID sets;
- `files`: sorted `[path, sha256, bytes]` for every file in the tree.

**What a release carries** (`scripts/content-release/file-set.ts`): the former
`.runtime-data` set, the staged directories named by published release
manifests, top-level `data/*.json`, the V6 families with every shard reachable
from an indexed revision, the current and registered change-history
projections with only the files they reference, overviews, reports and
repairs. It never carries legacy whole-revision files (`public-v6-*/revisions/`,
about 460 MB), candidate manifests, unreferenced history objects, `.local`,
private inventories or review caches. Today: 11,531 files, 851 MB.

## 3. Build

```bash
pnpm content:build --content-root "$UAPT_CONTENT_ROOT" --content-id c-20261110-001 \
  [--source <dir> | --source-release <id>] [--parent <id>] [--overlay <dir>] \
  [--mcp-catalog apps/mcp/.runtime-data/catalog.json] [--translations-pointer <reading package current.json>] \
  [--locale-index-policy <file>] [--no-inherit] [--decisions decisions.json]
```

- The source is the checkout, `--source <dir>`, or `--source-release <id>`
  (that release's tree, which then also defaults the parent). A correction
  builds from the live release, not from a checkout that may be older.
  `--overlay` adds or replaces repository paths under `data/` or `staging/`
  (for example a new report spec) without editing the checkout.
- Inheritance: without `--mcp-catalog`, `--translations-pointer` or
  `--locale-index-policy`, the parent's catalog, translation package and
  locale-index policy are carried over (`--no-inherit` drops them). The
  validator then refuses a carried-over catalog or policy that no longer
  matches a changed record (§4, checks 8–9).
- `--translations-pointer`: the sampled-publication pins come from
  `UAPT_READING_SAMPLED_PUBLICATION_*` when set, else from the parent when the
  new selection keeps the parent's accepted corpus (only record deltas
  changed). Every record-delta review in the selection is pinned in
  `translations.recordDeltaAcceptanceSha256s`.
- Objects are copied (cloned on APFS), never hard-linked to the checkout, so a
  publisher rewriting a checkout file cannot alter a stored release.
- The parent defaults to the current pointer. Releases are immutable: an
  existing `contentId` is refused.
- The build ends by running the validator; a release that fails stays on disk
  for inspection and cannot be switched to.

## 4. Validate

```bash
pnpm content:validate --content-root "$UAPT_CONTENT_ROOT" --content-id <id> [--report out.json]
```

Hard failures:

1. Manifest schema, content id, `appCompatibility`, known sync contract.
2. File list sorted and safe; every file present, regular, right size and
   hash; nothing unlisted in the tree. (Files not hard-linked to their object
   are noted.)
3. Private paths (`.local`, `private`, `candidates`, `review-cache`,
   `policy-inventory`) and private fields: the key/path rule of
   `scripts/pack-v6-release.ts`, applied to every JSON file not already in the
   parent release. Seven already-published files with relative source-text
   pointers are listed in `scripts/content-release/private-field-baseline.json`,
   bound to their exact bytes; any edit or new occurrence fails.
4. Loader identity with the production code: V6 pages, records and every
   school's frozen history; change-history basis; monthly registry (every
   report's release manifest must be in the package); family identities and
   schemas equal the manifest; `2.1.0` when required.
5. Full Claim ID sets (V6 records plus held claims for V6 schools, the staged
   public catalog for the rest): no claim without an ID or evidence, no
   duplicate IDs, every quote non-empty, http(s) source, 64-hex snapshot hash;
   `claimSets` must equal the computed sets.
6. MCP catalog, when present: declared hash and release, and only published,
   never held, Claim IDs.
7. Against the parent: a Claim ID may not disappear, a held claim may not be
   published or dropped, and a quote or locator (URL, snapshot hash, snippet,
   location, language) of a surviving Claim ID may not change, unless the
   decision is recorded (manifest `decisions`, or the records package's
   `changesBySlug.addedClaimIds` / `updatedClaimIds`). New schools are noted.

8. Records changed in the selected V6 revision: `publishedAt` not after the
   release's `createdAt`, every `previousRevisionId` readable as a V6
   revision, and the production `/changes/<revision>` diff builds.
9. Carried-over surfaces: the MCP catalog serves each V6 school's current
   `recordSha256` (a stale catalog is refused); the locale-index policy is a
   listed file, names the translation package's corpus, and moves every
   school whose record changed against the parent; each record-delta review
   in the translation package is pinned by the manifest and vice versa. An
   environment-pinned policy is reported as a note listing the changed
   schools that lose their reading locales.

Retrieval failure is not absence: the validator only compares published
packages and never infers a removal.

## 5. Switch

```bash
UAPT_CONTENT_REFRESH_TOKEN=... pnpm content:switch --content-root "$UAPT_CONTENT_ROOT" \
  --content-id <id> --sync-ledger <event.json> --refresh-url http://127.0.0.1:3100
```

1. Re-validates the release.
2. Synchronization: `requirePolicySync` binds the event (`policy_release`,
   contract 2.0.0/2.1.0, at least `requiredSyncContract`) to the exact
   `manifest.json` and runs `policy-inventory.py sync-gate --phase candidate`.
   Without `--sync-ledger` the switch is refused.
3. Computes the changed surface against the release being replaced: changed
   schools (record digests), cohort locales, catalog, change history, reports,
   sitemap, and schools whose reading locales can change (locale-index entry,
   translation refs or record deltas): their pages in every locale and the
   sitemaps. Writes `switch-<time>.json` with tags, exact paths and the
   Cloudflare request body.
4. Atomically renames `current.json` and appends `pointer-history.jsonl`.
5. Calls the loopback refresh endpoint in batches of 1,000 paths.
6. With `--mcp-url http://127.0.0.1:<mcp port>`: waits (`--mcp-wait-ms`,
   default 60 s) until MCP's `/healthz` reports the new `contentId` and the
   manifest's catalog hash. MCP follows the pointer itself; nothing is
   restarted. A timeout exits 3 and is reported, not rolled back.

**Refresh endpoint** `POST /api/internal/content/refresh`
(`apps/web/app/api/internal/content/refresh/route.ts`):

- exists only when `UAPT_CONTENT_REFRESH_TOKEN` (32+ characters) is set;
- loopback only: Host, `X-Forwarded-Host`, `X-Forwarded-For` and `X-Real-IP`
  must all be loopback; `Forwarded` and Cloudflare headers are refused;
- body `{ expectedContentId, tags[], paths[] }`; it re-reads the pointer and
  answers 409 unless this process now serves `expectedContentId`, then calls
  `revalidateTag(tag, { expire: 0 })` and `revalidatePath(path)`;
- `GET` returns the selected release, sync state and cache sizes;
- nginx must also deny it: `location ^~ /api/internal/content/ { return 404; }`.

**Tags.** Routes register tags through `tagContent()`
(`lib/content-cache-tags.ts`); Next copies them onto the ISR entry, so one tag
covers every locale of a page. `content` (all tagged routes), `home`,
`catalog`, `universities`, `school:<slug>`, `changes`, `changes:<revision>`,
`reports`, `report:<month>`, `sitemap`. The catalog self-fetch carries
`catalog`. In-process caches (dataset, release diffs, change records, reports,
history basis, JSON files) are keyed by `contentId`, so they never need a
restart.

**Cloudflare hook.** The tools never call Cloudflare. `switch-<time>.json` →
`cloudflarePurge.body` is the exact `{"files": [...]}` body for the zone's
`purge_cache` API; send it in the separate, authorized step (in batches the
plan allows) after the refresh, with the purge-only token in
`.env.agents.local`.

**Completion.** Public readback of the changed URLs (L1/L2 in full, L3
sampled, per `docs/release-acceptance-tiers.md`) happens after the refresh and
the purge. Then `python3 scripts/policy-inventory.py sync-gate <event.json>
--phase complete`. IndexNow stays a separate step (`pnpm indexnow:latest
--content-root "$UAPT_CONTENT_ROOT" --sync-ledger <event.json>`), only after
public readback. Its basis is the selected release's `manifest.json` (the same
file the switch event binds) and its URLs are this switch plan's `paths`
intersected with the published sitemap; a first selection has no changed-URL
list.

## 6. Rollback

```bash
pnpm content:switch --content-root "$UAPT_CONTENT_ROOT" --content-id <earlier id> --rollback --refresh-url http://127.0.0.1:3100
```

The target must appear in `pointer-history.jsonl`; its original sync receipt
is reused. The changed surface is computed against the release being replaced,
so the refresh covers both sides (for example the removed report month). No
build or restart. Then purge and read back as in §5.

## 7. Runtime configuration

| Variable | Where | Meaning |
|---|---|---|
| `UAPT_CONTENT_ROOT` | web, MCP | content root; unset = workspace mode |
| `UAPT_CONTENT_POINTER_CHECK_MS` | web | pointer re-check interval (default 1000 ms); one selection per request |
| `UAPT_CONTENT_REFRESH_TOKEN` | web, switch tool | enables the refresh endpoint |
| `UAPT_CONTENT_ALLOW_UNSYNCHRONIZED` | local only | accept preview pointers |
| `UAPT_MCP_CONTENT_POLL_MS` | MCP | pointer poll (default 15 s); SIGHUP reloads now |
| `UAPT_UNIVERSITY_LOCALE_INDEX_POLICY(_SHA256)` | web | fallback only, for releases without `localeIndexPolicy` |
| `UAPT_READING_RECORD_DELTA_ACCEPTANCE_SHA256S` | web | fallback only: comma-separated record-delta review pins for an env-pinned reading package |

A pointer the program rejects (hash, compatibility, sync) keeps the last
verified release in service and is reported by `GET` on the refresh endpoint;
at startup it fails closed. SIGHUP re-reads the pointer in the web process.

**MCP** reads the same pointer, verifies the manifest hash, compatibility, the
catalog bytes and `releaseId`, and swaps its catalog between requests; a
failed reload keeps the previous catalog. Reloads (poll and SIGHUP) run one
at a time, so an older read never replaces a newer selection. `/healthz`
reports `contentId`, `manifestSha256` and `catalogSha256` for readback.
Without `UAPT_CONTENT_ROOT`, the legacy `UAPT_MCP_CATALOG` +
`UAPT_MCP_EXPECTED_RELEASE_ID` pin still applies.

## 8. Publishing a monthly report

1. Add the spec to `data/monthly-reports/registry.json` (or an overlay copy)
   and set `current`. `releaseManifestPath` must name a published release
   manifest in the package.
2. Build, validate and switch. Report, coverage, chart-data, feeds, `/reports`,
   `/api-reference`, `/datasets`, sitemap and `/llms.txt` follow. The old
   `scripts/activate-september-report.py` is retired.

## 9. History basis

`publicHistoryBasisV2` no longer hashes source files. It binds the frozen
renderer identity of the change rules version
(`CHANGE_RENDERER_IDENTITIES` in `lib/public-history-basis.ts`), which
reproduces the published basis `86f34606…` exactly, so a program build that
keeps `CHANGE_RULES_VERSION` keeps every published history valid. Changing
event semantics needs a new rules version, a new identity entry and a
regenerated history package under contract 2.1.0.

## 10. Disk and retention

- Objects are content-addressed and shared; trees are hard links. Measure with
  object bytes, not `du` on trees.
- Retention follows `docs/release-storage-policy.md`: keep the current release,
  the previous accepted one, and any release still referenced by a hold or a
  historical page; record each in the retention ledger. Removing a release
  directory removes only links; an object may be deleted only when no
  retained manifest lists it, by exact whitelist, after off-host archive and
  hash check. No age-based deletion.

## 11. Known limits (R1-b)

- The local demo added schools to the V6 cohort (110 → 132, real published
  data from commit `70dd8a1f` vs today). No unpublished catalog school exists
  in the repository, and none was invented, so a brand-new catalog school was
  not demonstrated; it uses the same path (published release manifest +
  staged directory + regenerated change history in one release).
- Resolved in R1-d (`docs/program-release.md`): the program build is
  content-free and every route renders on demand from the active release.
- Aliases and marks for brand-new schools remain program files (§1).
- The translation package path is supported in the manifest but was not part
  of the local demo (no reading package is configured on this machine).

## 12. Policy-claim corrections (`content:correct`)

A reviewed correction of published claims is a content release: no
per-correction script, no program build, no web or MCP restart. It replaces
the hand-written generators of the first post-R1 correction (9 schools,
2026-11-06) and `scripts/prepare-v6-audit-correction.py` /
`scripts/finalize-v6-audit-correction.ts`, which remain for history only.

### 12.1 Decisions file (`uapt-content-correction-v1`)

```json
{
  "schemaVersion": "uapt-content-correction-v1",
  "revision": "v6-corrections-20261110",
  "author": "<who prepared the decisions>",
  "changeSummary": { "en": "...", "zh": "..." },
  "approval": { "publication": "<who approved publication, where, when>" },
  "captures": {
    "uq-rules": { "sourceUrl": "https://...", "snapshotHash": "<64 hex>", "retrievedAt": "2026-11-09T08:00:00Z",
                  "citationTitle": "...", "publisher": "...", "sourceType": "official_guidance",
                  "packageId": "<raw capture receipt>", "textSha256": "<optional>" }
  },
  "schools": {
    "university-of-queensland": {
      "claims": [
        { "action": "correct", "id": "<existing Claim ID>", "claimType": "...", "confidence": 0.9,
          "claimText": "...", "claimValue": "...", "keepEvidenceIds": [],
          "evidence": [{ "sourceUrl": "https://...", "snapshotHash": "<64 hex>", "quote": "<original text>", "location": "..." }] },
        { "action": "add", "id": "<new Claim ID>", "topics": ["exams"], "...": "..." }
      ],
      "tools": [{ "match": "<rawToolName>", "set": {}, "appendDescription": "...", "evidence": [] }],
      "presentation": {
        "entitySummary": { "en": "...", "zh": "..." },
        "topicSummaries": { "exams": { "en": "...", "zh": "..." } },
        "topicScopes": { "exams": { "en": "...", "zh": "..." } },
        "claimScopes": { "<Claim ID>": "..." },
        "dispositions": { "<added Claim ID>": { "mode": "scoped_reference", "scope": "...", "reason": "..." } }
      }
    }
  },
  "lintAcknowledgements": [{ "code": "zh-missing-facts", "slug": "...", "target": "topicSummaries/exams", "reason": "..." }]
}
```

- `action`: `correct` (new text/value/evidence, optional kept evidence IDs),
  `amend` (`appendText`), `add` (new Claim ID; `topics` places it). Claim IDs
  never disappear and held claims stay held.
- Evidence cites a declared capture by key or by exact URL + snapshot hash;
  quotes stay original. Checked dates are the capture times, never the
  publication or review date.
- `publishedAt` is optional: it defaults to build time and a future date (or
  one before the parent revision) is refused.
- `previousRevisionId` is chosen, not declared: the school's last revision if
  it is a readable V6 revision holding the exact parent record, else the
  parent revision. Neither readable is an error (CMU and Edinburgh pinned a
  dataset release id, which made `/changes/<revision>` fail).
- `presentation` also accepts `statusOverrides`, `addTopicClaims`,
  `replacePresentationEvidence`, `presentationTitles`, `gaps`, `addGaps`,
  `dispositionReasons`, `convertToView: "compactProjection"` and
  `heroTitleZh` (see `scripts/content-release/correction-apply.ts`).

### 12.2 Steps

```bash
# 1. Candidate, lints, production gates, review packet (no reviewer recorded).
pnpm content:correct prepare --decisions decisions.json --out /tmp/c1/prepare --content-root "$UAPT_CONTENT_ROOT"

# 2. An independent reviewer reads prepare/review-packet.md and fills
#    prepare/review-template.json: decision "accepted", reviewer, reviewedAt.

# 3. Receipts, overlay, Changes v2, MCP catalog, locale-index policy.
pnpm content:correct finalize --candidate /tmp/c1/prepare --review review.json --out /tmp/c1/final

# 4. Reading translations: only the changed strings (12.4).
pnpm content:correct translations plan --candidate /tmp/c1/final --out plan.json
pnpm content:correct translations template --plan plan.json --translations tr/ --translator <id> --out delta-review.json
pnpm content:correct translations build --plan plan.json --translations tr/ --review delta-review.json --out /tmp/c1/reading

# 5. Build exactly as final/content-build.sh.txt says (plus --translations-pointer /tmp/c1/reading/current.json).
# 6. Sync event (2.1.0), content:switch with --refresh-url and --mcp-url, purge, readback (§5).
```

`prepare` exits non-zero when a lint or gate blocks; its report and packet are
still written. `finalize` refuses a candidate that did not pass, a review that
does not bind the exact candidate hashes, a review by the decisions' author,
and a selected parent that changed since `prepare`.

**Production gates** (prepare on scratch receipts, finalize on the real ones),
run with the production loaders on a scratch tree = source release + overlay:
every locale of every changed school passes `getV6PageInput` (the runtime
completeness gate that blocked Stanford, Harvard and Caltech), the previous
revision reads back the parent record, the `/changes/<revision>` diff builds,
the frozen histories and the change-history manifest load, and the MCP
catalog serves exactly the record's Claim IDs at the new revision.

### 12.3 Review lints

| Code | Kind | What it catches |
|---|---|---|
| `generic-entity-summary` | review | entity/record summary becomes a "N claims and M sources" template where the parent was specific |
| `zh-missing-facts` | review | zh copy drops numbers or Latin names stated in en, or is far shorter |
| `checked-at-before-evidence` | hard | a corrected claim, the record or a page whose checked date is older than the evidence it cites |
| `summary-sentence-unsupported` | review | a topic summary sentence whose numbers, names or terms are not in that topic's claims and evidence |
| `claim-without-topic` | hard | an added claim shown in no topic, student-action row or disposition, or a claim the correction removes from its topic |
| `placeholder-scope` | hard | empty, TODO-like, too short, title-repeating or untranslated scope text |

Review findings block unless `lintAcknowledgements` records a reason (code +
slug + target); hard findings always block.

### 12.4 Reading translations: per-string binding and record deltas

A reading bundle is bound to the record it was translated for, but each
translation unit is keyed by the exact source-text hash. A corrected school
keeps its accepted bundles byte for byte; a **record delta**
(`supplemental.recordDeltas` in the selection) adds the strings the new
record needs and moves the school's basis from `parent` to `record`:

- `translation-delta` bundle per school and locale: new or changed strings,
  and new display-field uses of unchanged strings;
- review receipt (`uapt-reading-delta-review-v1`): translator and reviewer
  differ, `coverage: "every_delta_pair"` (not a sample), no native-speaker or
  publication claim, and one accepted pair (source hash, target hash, exact
  fields, origin) for every delta item.

The loader (`apps/web/lib/reading-translations.ts`) composes bundle + delta
chain only when the release pins every receipt
(`translations.recordDeltaAcceptanceSha256s`) and
`checkReadingTranslationDelta` accepts each delta: a tampered target, an extra
unreviewed string or field, a self-review, a sampled review, a delta for
another school or a changed number is refused (`unapproved` or
`invalid_package`). The corpus sampled-publication approval keeps covering
only the unchanged strings; it is never re-signed. Deltas chain across
corrections; a rollback selects the earlier release and its selection.

`translations plan` lists, per locale, the strings to translate, accepted
pairs reusable from other bundles and new field uses. `build` hard-links the
old package, writes the deltas, the receipt (hashes only) and a new selection,
and checks every planned school/locale with the production loader before it
reports success.

### 12.5 What a correction no longer needs, and what still needs a program release

No longer needed: hand-written generators, rebinding or retranslating
unchanged strings, env changes or a web restart for the locale-index policy,
an MCP restart for the catalog, or a rebuild for a future `publishedAt` or an
unreadable previous revision (both refused at `prepare`).

Still a program release:

- The first deployment of this program (web and MCP). Until then, production
  runs a web program without manifest locale-index or record-delta support.
- **MCP on 3161** (`uapt-shared-v6-r2.service`) runs the pre-R1-b program from
  release `uapt-qs101-120-066043dd`, pinned with `UAPT_MCP_CATALOG`, and has no
  `UAPT_CONTENT_ROOT`. Hot reload needs a one-time program release of
  `apps/mcp` with `UAPT_CONTENT_ROOT=/srv/uapt/content/runtime` (and no
  catalog pin).
- The live locale-index policy must be carried into a release once:
  `--locale-index-policy <the env-pinned file>` on the next build (or
  `content:correct finalize --locale-index-policy`). Releases then inherit it.
- New aliases, marks, UI copy, new presentation schemas or completeness
  rules, a new change-rules version, and new translation contract kinds
  (§1, §9).
