# OCI build-once release

This full-site procedure is reserved for large/global version updates.
For small content/page updates, default to [the small-release workflow](oci-small-release.md).
[Release routing policy](release-routing-policy.md) decides the path. Do not
run the main full build merely because a few university pages or a report changed.

The original preparation notes described an untested workflow; OCI build-once
was subsequently exercised in the 2026-10-07 minimal UI release. Historical
results remain separate from the newer ten-school runtime-zone release.

For large releases keep GitHub exact SHA -> isolated OCI build -> actual
candidate acceptance -> same-artifact cutover -> bounded public smoke -> retained
artifact rollback. No mandatory Mac production build and no in-place active build.
Before cutover inventory existing nginx zone overrides: shared components/data
changes must coordinate those zones, not leave them serving incompatible versions.

## Local preflight

1. Inspect the dirty worktree and use an explicit file allowlist. Preserve
   unrelated changes. Validate policy scope, source fidelity, private-data
   exclusions and the intended public release manifest.
2. Run `pnpm release:local-check` (runs `git diff --check` and `pnpm check`,
   with no Next build). Run regression tests relevant to the changed surfaces,
   such as policy snapshots, index recovery, visual assets or IndexNow.
3. Use dev/browser checks to resolve wording, layout, evidence-language,
   expansion, anchors and accessibility issues before the expensive build.
   This is preliminary evidence, not acceptance of the Linux production build.
4. Review the staged allowlist, commit and push through the authorized Git/PR
   path. Freeze a full 40-character SHA on `origin/main`. A push does not
   authorize cutover by itself. Complete any source fixes before OCI build.

`pnpm check` performs generation/validators/type/lint checks, not `next build`.
Do not remove these checks to save the duplicate build. An optional Mac build
may diagnose a build-only bug, but is not a routine release requirement.

## Prepare the OCI candidate

Use the approved SSH access. Inspect active `WorkingDirectory`, full release
SHA, BUILD_ID, services/listeners, disk and running builds once. Save the full
systemd unit and drop-in configuration outside the source tree with restricted
permissions; do not print environment secrets. Record the old known-good
release as the rollback target. Do not alter any running release or build.

Confirm the actual `uapt-web.service` configuration before following examples:
Node/pnpm executable and versions, environment file, service user, working
directory, production mode and ExecStart. Use that same configuration for the
candidate; the historical `/opt/node-v22/bin` path must be rechecked.

In an OCI operator shell, set `release_sha` to the frozen full SHA. Create a new
unique directory; never reuse an existing candidate, even after failure:

```bash
set -euo pipefail
# Assign the reviewed full SHA before running this block.
[[ "$release_sha" =~ ^[0-9a-f]{40}$ ]]
release_root="/srv/uapt/releases/uapt-$release_sha"
test ! -e "$release_root"
sudo -H -u uapt git clone --no-checkout --single-branch --branch main \
  https://github.com/SciWhite/university-ai-policy-tracker.git "$release_root"
sudo -H -u uapt git -C "$release_root" checkout --detach "$release_sha"
test "$(sudo -H -u uapt git -C "$release_root" rev-parse HEAD)" = "$release_sha"
test "$(sudo -H -u uapt git -C "$release_root" rev-parse origin/main)" = "$release_sha"
```

Stop if main advanced; review and freeze the intended release again. Record the
candidate path separately from the active service directory. Give a retry a
new suffix/directory; preserve the failed candidate's evidence.

### Verify configuration before building

Run as `uapt`, with the inspected production toolchain. Source
`/srv/uapt/env/production.env` without echoing it; never use shell tracing or an
unfiltered environment dump. Check these values rather than silently correcting
them in the build command:

- `NODE_ENV=production` and production public site/API base URLs;
- expected `NEXT_PUBLIC_*` flags, including the multilingual exposure gate;
- production runtime data/Prisma paths and applicable private runtime settings;
- `CATALOG_API_BASE_URL` unset unless a separate catalog is intentionally used;
- lockfile/packageManager matches the installed pnpm, and Node matches runtime.

Record public build settings and toolchain versions in the evidence directory;
private values stay in the env file. Public settings are frozen by the build.
The reviewed configuration must be unchanged between build, acceptance and
cutover; a changed build input requires a new candidate.

After the checks pass, perform exactly one production build for this candidate:

```bash
sudo -H -u uapt env PATH=/opt/node-v22/bin:/usr/local/bin:/usr/bin:/bin \
  bash -s -- "$release_root" <<'BUILD'
set -euo pipefail
cd "$1"
set -a
source /srv/uapt/env/production.env
set +a
test "$NODE_ENV" = production
test "$NEXT_PUBLIC_SITE_URL" = https://eduaipolicy.org
test "$WEB_PUBLIC_BASE_URL" = https://eduaipolicy.org
test "$API_PUBLIC_BASE_URL" = https://eduaipolicy.org
pnpm install --frozen-lockfile
UAPT_DISABLE_INTERNAL_FETCH=1 pnpm --filter @uapt/web build
BUILD
```

`@uapt/web build` already generates Prisma, prepares `.runtime-data`, and runs
`next build`. Do not separately regenerate those after acceptance. A failed
build is not a tested artifact. Fix source/configuration, review a new candidate,
and build it; do not mutate an accepted directory to fix forward.

## Candidate runtime and acceptance

Reserve loopback 3101 without killing another process. Start the candidate in
the exact `apps/web` working directory with the production service's toolchain,
user and runtime environment. Prefer a temporary systemd unit mirroring the
inspected production service (including limits/restart behavior), with only
these necessary runtime overrides:

```text
PORT=3101
HOSTNAME=127.0.0.1
INTERNAL_NEXT_BASE_URL=http://127.0.0.1:3101
UAPT_DISABLE_INTERNAL_FETCH is unset
```

The self-fetch override prevents candidate dynamic requests from reading the
old production server on 3100. Public URLs stay `https://eduaipolicy.org`.
Do not assume `Environment=` overrides an identically named value from an
`EnvironmentFile=`. Use an explicit launcher that sources the same env file and
then applies the candidate overrides. For example, after checking the real
service command matches the existing pnpm start setup, the launcher body is:

```bash
set -euo pipefail
set -a
source /srv/uapt/env/production.env
set +a
unset UAPT_DISABLE_INTERNAL_FETCH
export PORT=3101 HOSTNAME=127.0.0.1
export INTERNAL_NEXT_BASE_URL=http://127.0.0.1:3101
cd "$release_root/apps/web"
exec pnpm start --hostname 127.0.0.1 --port 3101
```

Supply the verified release path to the launcher explicitly, and mirror the
production PATH. Do not source build-only settings into the runtime service.
Inspect the production unit next time before implementing its candidate unit;
this document does not assume the live unit's ExecStart or env precedence.

Open an SSH tunnel from Mac (use another free local port if 3101 is occupied):

```bash
ssh -N -L 127.0.0.1:3111:127.0.0.1:3101 hermes-agent-prod
```

Browser target: `http://127.0.0.1:3111`. Canonical assertions still expect the
public production domain. Do not change build URL settings for the tunnel.

Generate the release route matrix from reviewed changed university/page
allowlists, available locales and a few unchanged controls. Save expected
status, lang, canonical and semantic assertions per route. The 2026-10-07
release's 938 routes is an example, not a permanent count or a claim of testing
all 5,487 generated pages. Run the complete matrix on the candidate, recording
passed/failed/pending results and actual coverage.

Candidate gates:

- all expected routes and seven locales; intended hidden/404 surfaces;
- metadata/canonical/hreflang, sitemap and data manifest consistency;
- source expansion, evidence language, role switching, anchors and navigation;
- 1440/720/390 px, dark mode, print and keyboard behavior; image loading;
- API/data contract, RSC where relevant, unauthorized private-route response,
  and no private/pending-source material in HTML, JSON or static assets;
- data/source identity and unchanged control pages; production-like dynamic
  requests use the candidate itself. Document analytics side effects if checked.

Existing `smoke:i18n-http` accepts `UAPT_SMOKE_BASE_URL`; existing
`smoke:pilot-pages` accepts `--base-url`. Recheck their assertions against the
next release's content before using them. The change-scoped matrix and browser
ledger must be prepared for that release; no new 938-route script or successful
live acceptance is implied by this documentation update.

## Record and verify the accepted build

Use an evidence directory outside the release, such as
`/srv/uapt/release-evidence/<release-id>/`, owned by the operator with private
permissions. Run as `uapt` from the release root:

```bash
node scripts/uapt-release.mjs inspect "$release_sha" > /path/to/evidence/identity.json
```

The helper is read-only: verifies full SHA/clean tracked source, BUILD_ID and
repository/runtime manifest equality, and records lock/config/manifest hashes,
Node and packageManager. It never builds, deploys or reads the private env file.
Keep the non-secret configuration summary, build log, route results and browser
evidence beside it. Identity is provenance, not evidence that tests passed.

Inspect again before cutover and compare identity with the accepted record.
Do not change source, dependencies, build settings or output after acceptance.
Normal Next runtime cache writes are permitted. Config or source fixes require
a new candidate and relevant acceptance, not edits to the accepted release.

## Systemd cutover and public smoke

Only after candidate gates pass and deployment is authorized:

1. Confirm the old release remains complete, and save its path, identity and
   exact systemd configuration. Keep current env compatible with rollback;
   coordinate migrations separately if the change contains them.
2. Stop the temporary candidate runtime, leaving its build/data intact.
3. Update only the UAPT service configuration needed to use the tested
   `apps/web` directory. Check ExecStart for absolute references to the old
   checkout; a WorkingDirectory change alone may be insufficient. Preserve
   production 3100, user, PATH and env. A new `current` symlink is not required.
4. `systemctl daemon-reload` if unit/config changed, then restart
   `uapt-web.service`. This is a brief restart, not zero-downtime routing.
5. Read back effective WorkingDirectory, SHA, BUILD_ID, manifest hash,
   active service and loopback-only 3100 listener. Do not run install/generate
   or build during cutover.
6. Run bounded origin and public smoke: home/About/Methodology, seven-locale
   samples, representative V4/V5/supplement/AI Tools pages as applicable, API/data
   contract, canonical, nginx/Cloudflare cache behavior and private/pending
   content exclusions. Include RSC and authenticated private analytics where
   relevant. Check CELPIP/nginx health on the shared host.
7. Distinguish origin acceptance from public cache visibility. Use the inspected
   cache procedure for affected URLs if required; do not blindly purge all.
8. After public smoke passes, preview changed-URL IndexNow scope, then send
   only the authorized published URLs. Do not send the full candidate route
   matrix or whole-site notifications merely because the build was full.

The complete candidate matrix is not repeated through Cloudflare. Save the
smaller smoke list and observed results separately from candidate acceptance.
Do not delete the previous release as part of cutover; later cleanup must keep
active/rollback artifacts and account for current disk usage.

## Rollback

Restore the saved known-good release path and exact previous service unit/drop-in
configuration (including ExecStart), reload if needed, and restart. Check
loopback/public smoke and effective identity. Retain the failed release/evidence
for diagnosis. Do not `git reset`, install dependencies, regenerate Prisma/data
or execute `next build` in the rollback artifact. Do not return to Vercel.

Rollback also needs compatible runtime env and data schema; artifact retention
alone cannot undo incompatible migrations. If the retained build is missing or
corrupt, stop and report a recovery incident rather than rebuilding as if it
were normal rollback. A later Git revert repairs source history independently
of immediate service recovery.

## Historical first-adoption note

The following was the original documentation-only scope, not a current
prohibition on later user-authorized releases: only local documentation and helper
syntax/help checks were authorized in that pass.
Next time the user requests release, inspect the then-current service and env,
implement/verify its candidate unit and the change-scoped matrix, and exercise
this workflow. Record real build/candidate/public outcomes separately. No OCI
build, service change, push, indexing notification or live rollout is performed
by this document or by `release:local-check` / `release:inspect`.

## 政策同步附加门禁（2026-10-11）

涉及公开政策的数据或内容变更，遵守 [证据同步 runbook](policy-evidence-integration-runbook.md) 的合同 2.0.0：切换前对精确 basis 执行 `node scripts/uapt-release.mjs verify-sync <event.json> <basis-file> candidate`；实际公网回读后执行 complete 阶段。候选验收、changes/history/diff、MCP 全 ID、摘要暂缓及运行时一致性须有对应凭据。历史验收报告仍保留；此文档更新不代表部署授权或生产升级。
