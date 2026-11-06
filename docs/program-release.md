# Program release: content-free build, artifact, install

Status: draft for R1-d (2026-11-04). It describes how the program (code only)
is built in GitHub Actions and installed on the host. Content ships separately
as runtime content releases (`docs/content-release.md`). This document does not
authorize a push, workflow run, download to the server, deployment, restart,
cutover, Cloudflare purge or search notification. Policy evidence rules
(`AGENTS.md`, `docs/policy-evidence-integration-runbook.md`), the lifecycle
controller (`docs/release-lifecycle.md`) and the disk rules
(`docs/release-storage-policy.md`) are unchanged.

## 1. What "content-free" means

- `next build` runs with `UAPT_PROGRAM_BUILD=1`. Any content read while Next
  prerenders aborts that render (`isContentFreeProgramBuild()` in
  `apps/web/lib/content-runtime.ts` throws `notFound()`), and the CI checkout
  has no `data/` or `staging/` at all. The build therefore cannot bake content
  in, and it succeeds without any.
- The root document reads the V6 reading cohort, so every page depends on
  content. No page is rendered at build time for real: the packager deletes
  every prerendered body (`.html`, `.rsc`, `.meta`, `.body`, `.segments`) except
  the framework `/_not-found` (checked to be the content-free global page) and
  `/_global-error`. The prerender manifest keeps each route registered, so the
  first request renders it from the active content release, caches it in the
  in-memory ISR cache (`isrFlushToDisk: false`), and tags refresh it after a
  switch, as in R1-b.
- Catalog-derived landing pages (`/analysis/[slug]`, `/regions/[slug]`,
  `/themes/[slug]`) no longer enumerate params from content at build; they
  render on first request and still 404 unknown slugs.
- `output: "standalone"` with no content tracing (`outputFileTracingIncludes`
  is empty in program builds; `data/`, `staging/`, `.local/`, docs and tests
  are excluded). Workspace-mode builds (`scripts/uapt-release.mjs build`) are
  unchanged.

Measured locally (2026-11-04, macOS arm64, Node 26), from a sparse checkout
without `data/` and `staging/` as in the workflow: build 13 s (warm Turbopack),
53 prerendered bodies pruned, 4,686 files, **147 MB unpacked, 96 MB tarball**
(plan target ≤ 1 GB). Installed with the installer below and started against a
content root: `/`, `/zh`, `/changes`, `/reports`, `/about`, a university page,
`/llms.txt` and the three feeds returned 200 (MISS, then HIT); a `reports`/`home`
tag refresh re-rendered exactly those pages.

## 2. Build in GitHub Actions

`.github/workflows/program-build.yml`, manual `workflow_dispatch` only:

| Input | Meaning |
|---|---|
| `sha` | Frozen 40-character commit SHA |
| `runner` | `ubuntu-24.04-arm` (default) or `ubuntu-24.04`; must match the host CPU (`sharp` ships native code) |
| `node-version` | Default `22` (production runs Node 22) |

Steps: sparse checkout of the SHA without `data/` and `staging/` → copy of the
five content pointer files (for the marker scan only) → `pnpm install
--frozen-lockfile` → Prisma Client generate → web typecheck → build-scope
validator → `node scripts/program-build.mjs build` → `package` → upload as the
Actions artifact `uapt-program-<sha>` (30 days). Permissions: `contents: read`;
no secrets; no deploy step.

Build-time `NEXT_PUBLIC_*` values come only from
`apps/web/program-build.public-env.json`; inherited `NEXT_PUBLIC_*` and
`UAPT_CONTENT_*` variables are dropped. They must equal the production
environment file (the installer can check this with `--production-env`).

Local diagnosis: `pnpm program:build --sha <HEAD> --local` and
`pnpm program:package --sha <HEAD> --out <dir> --local`. `--local` allows a
dirty checkout and `data/`; the artifact is marked `diagnostic` and the
installer refuses it.

## 3. Artifact

The upload holds three files:

- `uapt-program-<sha12>-<BUILD_ID>.tar.gz`: the standalone tree (release root):
  `apps/web/server.js`, `apps/web/.next/` (pruned, plus `static/`),
  `apps/web/public/`, `node_modules/` (pnpm layout, relative symlinks only),
  `build-artifact-manifest.json`, `source-manifest.json`;
- `<name>.tar.gz.sha256` (`sha256sum` format);
- `artifact.json`: the build manifest plus the tarball name, SHA256, size and
  the SHA256 of `build-artifact-manifest.json`.

`build-artifact-manifest.json` (`uapt-program-artifact-v1`): `codeSha`,
`BUILD_ID`, builder (Node, pnpm, Next, platform, arch, glibc), lockfile and
`next.config.ts` hashes, `publicBuildEnv`, `contentFree` (held-out checkout,
pruned count, marker count) and `files` (count, bytes, `listSha256`,
`sourceManifestSha256`). `source-manifest.json` (`uapt-program-file-list-v1`)
lists every file (path, SHA256, bytes, mode) and symlink; it is named for the
lifecycle controller's `basis.sourceManifestSha256` lookup.

The packager fails on: prerendered residue, private or content paths
(`data/`, `staging/`, `.local/`, `.runtime-data/`, `policy-inventory`,
`review-cache`, `screenshots`, `.env*`, keys, databases), symlinks leaving the
tree, setuid bits, more than 1 GiB unpacked, or any content pointer identity
(release ID, revision, hash) found in a text file.

## 4. Install on the host (not run yet)

`scripts/program-artifact-install.py` (Python standard library):

```bash
GH_TOKEN=<read-only actions token> sudo -E python3 scripts/program-artifact-install.py \
  --sha <40-hex> --run-id <workflow run id> --node-bin /opt/node-v22/bin/node \
  --production-env <production.env>
# or, with an artifact zip copied by the operator:
sudo python3 scripts/program-artifact-install.py --sha <40-hex> --zip <artifact.zip> ...
```

It takes the release lock (`/run/lock/uapt-release.lock`), checks the run
(head SHA, workflow path, `workflow_dispatch`, success) and the artifact, and
checks `diskCapacity` from the lifecycle policy before the download and again
before unpacking (reserve bytes and inodes, project ceiling, per-role cap; a
policy without `diskCapacity` is refused). It verifies the tarball SHA256,
platform/arch/Node major against the host, the manifest against
`artifact.json`, safe tar members, and every file against the file list, then
renames the tree into `/srv/uapt/releases/uapt-program-<sha12>-<BUILD_ID>`
(an existing directory is refused). It never starts, routes, switches content
or deletes a release. It removes only its own staging copy under
`<root>/builds/` after success; a failed run keeps it and prints the path,
which must be registered as a temporary artifact or reviewed.

Output: a receipt in `/srv/uapt/operations/program-artifacts/<name>.json` with
the `basis` fields the lifecycle plan binds (`release`, `codeSha`, `BUILD_ID`,
`sourceManifestSha256`, `buildArtifactSha256`) and the retention entry to add
(`disposition: candidate`; if it is not admitted it becomes a bounded `held`
entry). Run the candidate with `node server.js` from `apps/web` (env:
`PORT`, `HOSTNAME=127.0.0.1`, `UAPT_CONTENT_ROOT`, the production env; no
`node_modules` install).

## 5. R1 launch checklist (program side)

Not done by R1-d; each item is a launch step under the lifecycle controller.

1. **Architecture.** Confirm `uname -m` on the host and run the workflow on the
   matching runner (`ubuntu-24.04-arm` for aarch64).
2. **Lifecycle controller (done 2026-11-05).** A basis with `schemaVersion:
   "uapt-program-release-basis-v1"` (written by the installer) binds the
   runtime content pointer instead of in-tree data pointers. The plan adds
   `contentRelease: {root, contentId, manifestSha256}`. `validate_candidate_identity`
   then requires:
   - no `data/` or `staging/` in the release;
   - a content-free `uapt-program-artifact-v1` build manifest for the same `codeSha`;
   - a content manifest whose hash matches;
   - a `current.json` that selects that release with a sync receipt (local previews are refused).

   Legacy bases are unchanged.
3. **nginx deny for the refresh endpoint.** Add to the site config before the
   R1 upstream switch, and read it back (`curl -i https://eduaipolicy.org/api/internal/content/refresh` → 404):

   ```nginx
   location ^~ /api/internal/content/ { return 404; }
   ```

4. **Hand-added detail rule.** `/etc/nginx/snippets/uapt-eea1eb21-detail-routes.conf`
   (added by hand on 2026-11-04, outside the lifecycle controller; receipt in
   `/srv/uapt/operations/nginx-exception-20261104-changes-detail/`) sends
   `/changes/*` and `/rankings/*` detail routes in every locale to 3102. At R1
   launch the consolidated app serves these routes: take the rule into the
   controller's `routingFiles` (so it is switched and rolled back with the
   release) or remove it in the same cutover, before 3102 is retired. Do not
   leave it pointing at a retired upstream.
5. **Environment parity.** Install with `--production-env`; `NEXT_PUBLIC_*`
   are inlined at build time, so a mismatch needs a new build, not an env edit.
6. **Writable cache path.** The release tree is otherwise read-only at runtime
   (ISR stays in memory), but `/_next/image` writes `apps/web/.next/cache/`;
   give the service user that directory only.
7. **Cold start.** No page is prerendered, and the ISR cache is in memory, so
   every restart starts cold.
   - **How slow cold renders are.** On the loaded production host, first renders took up to 60–110 s (`/sitemaps/zh.xml`, `/reports`), which is longer than the 60 s proxy timeout.
   - **Enable warm-up.** Set `UAPT_WARMUP_ON_START=1` in the runtime env. After each start the server then requests the heavy pages, followed by every sitemap URL (up to 5,000), over loopback, one request at a time.
   - **Wait before routing.** Wait for the journal line `Runtime warm-up finished` before routing; sample cold pages if it is still running.
   - **Timing.** About 3,900 requests took 6 minutes locally and about 40 minutes on the host.
8. **Long-lived pages.** Pages with `revalidate = false` (`/about`, `/changes`,
   `/reports`) are cached for a year in the origin's ISR cache; Cloudflare
   keeps every public page for 2 hours (Cache Rule, see
   `docs/content-release.md` §5), so purge the whole zone after each cutover.
   A switch that changes the
   V6 reading cohort also changes the cohort every page embeds; untagged static
   pages are not in the switch plan. Expire `content` (or purge those paths)
   when the cohort changes.
9. **IndexNow.** The basis is the selected content release:
   `pnpm indexnow:latest --content-root /srv/uapt/content --sync-ledger <event.json>`
   submits the switch plan's changed paths that are in the published sitemap,
   after public readback.
10. **Retention.** Record the new release root, the previous accepted program
    release (rollback) and nothing else per role; old full-workspace release
    directories follow the archive rules.

## 6. Minimal nginx routing (prepared 2026-11-06, not installed)

**Old routing.** The live site config holds about 135k lines. It has:
- about 19,800 exact `location =` entries;
- 30 zone snippets left over from per-school releases.

Since R1, every one of those entries proxies to the same app.

**The generator.** `scripts/nginx-minimal-routing.py <nginx -T dump> <out> uapt_next_backend` rebuilds the site's locations. It keeps these verbatim:
- static aliases (1,221);
- pure `return` entries (107 redirects and retired-prefix 404s);
- proxies to non-app ports (MCP `/api/mcp` on 3161);
- the cached prefix blocks (`/api/public/v1/`, `/feeds/`, `/datasets`, `/sources`, `/search`, `/robots.txt`).

Everything else becomes one `location /` → `uapt_next_backend`. That location has a 180 s read timeout and no `private, no-store` header.

**What changes after the switch.** A program cutover then only rewrites `uapt-main-upstream.conf`.

**Cleanups it makes.**
- It drops the per-page RSC "Document navigation required" stubs of the old V5 zones.
- It drops another site's (`clb-pro`) CSP include that old static snippets had picked up.

**Equivalence test.**
- **Setup:** `scripts/nginx-minimal-routing-compare.py`, run on the host against a separate nginx instance on 127.0.0.1:18080, with production untouched.
- **Run of 2026-11-06:** 1,936 URLs, made up of every static or return path, 600 random app paths and 10 specials. 1,799 responses were identical. The rest differ for benign reasons:
  - JSON `generatedAt` timestamps;
  - first-request (cold) metadata streaming;
  - production's duplicated `Location` header on 5 redirects.
- **Evidence:** `/srv/uapt/operations/nginx-min-20261106/`.

**Install.** Install it as `routingFiles` of the next controller program release, in place of `uapt-proxy-locations.conf` and `uapt-eea1eb21-detail-routes.conf`. Then:
- run `nginx -t`;
- read back the public URL matrix;
- purge Cloudflare.

Keep the old files for rollback.
