# Student plugin combined release

Implementation is based on production `e71d4f37b86b4fdf910ee74ee98e5bbf5ed0cea3`.
The original dirty checkout is preserved. Already released V4 work is retained;
older uncommitted V3 changes, duplicate files and private enforcement candidates
are not automatically overlaid or promoted.

## Current acceptance

- Catalog: `public-release-20260924-002`; all 828 published schools resolve.
  5,491 reviewed claims are available, excluding four `needs_review` claims.
  Sultan Qaboos University resolves but has no eligible reviewed claims, so
  policy retrieval returns insufficient evidence. This is not a top-100 gate.
- 17 strong snapshots pass release, review and fingerprint validation. Other
  schools return reviewed claim text without inventing student recommendations.
- Official SDK initialize, tool discovery and all three calls pass over real
  unauthenticated Streamable HTTP. This is SDK acceptance, not ChatGPT acceptance.
- Eight MCP tests, six existing snapshot tests, two preference tests pass.
Workspace typechecking/lint, public-contract validation, i18n and
  entity-search smoke are recorded separately from a production build.
- 35/35 local browser routes have the correct localized H1. This checks routing
  and rendered content, not full translation or visual regression review.
  A subsequent small style update reuses the published Home V4 title/scale,
  colors and Policy Reference V4 reading rail; it replaces legacy hero/boxed
  content on all five page families. `check-trust-pages-http.ts` checks all 35
  V4 responses. The browser automatically rejected reopening the local URL,
  so the updated style has no new browser visual acceptance yet.
- Browser network: enabled analytics sent one request; after opting out and
  reloading, zero analytics requests, with the preference retained.
- Priority QA data and automated cohort checks are in `.local/plugin-qa/`.
  September Bing data is collected without the dashboard's top-row truncation.
  AI citation CSV covers 2026-06-13 through 2026-09-25; it is not September-only
  or ChatGPT plugin invocation data. Missing metrics remain null; observed zeros
  score zero and the positive-value percentiles are weighted .4/.3/.3 over
  available metrics. 100-school automated QA covers 800 topic retrievals;
  manual and actual ChatGPT checks are still pending.
- The Supabase retention RPC migration is installed. Transactional test data
  older than 13 months is removed inside a rolled-back verification transaction;
  existing production events were not removed. The daily timer is not enabled
  until the combined deployment.

## Additional V4 university pages

The combined release includes Aalto, Cornell and Melbourne, taking the V4
cohort from 33 to 36. All 17 effective strong snapshots now have a V4 guide;
no pending snapshot or private enforcement candidate is promoted. Nine new
optimized images reuse the existing character/style and evidence-linked layout.
The authored guide requires unchanged reviewed fingerprints and a strong
snapshot. Melbourne visibly separates the moved current student source from
older unverified citation/privacy/tool evidence. See
`docs/policy-hero-candidates/v4-ready-three-20261003/brief.md` for provenance,
source-check limitations and local acceptance (105 tests, 21 seven-language
HTTP/browser routes, 18 viewport/theme combinations). Include these routes
in the same production build and post-deploy acceptance as the plugin pages
and September report.

## Pre-release dependencies

The user provisions a real commercial `support@eduaipolicy.org` mailbox with
direct inbound and outbound email, not forwarding. Confirm the actual provider
and retention settings. Run `node scripts/verify-support-email.mjs
--dkim-selector=<provider-selector>`, then test inbound delivery, outbound reply
from support@ and SPF/DKIM/DMARC authentication in received headers. Only mark
the verification report's three delivery/authentication test fields `passed`
after observing the actual messages. Credentials remain outside Git.

Set `UAPT_SUPPORT_EMAIL_PROVIDER` and `UAPT_SUPPORT_EMAIL_RETENTION` in the web
runtime environment; these facts appear through `/api/plugin/status` without
another website build. Use a concise English retention description for the
canonical policy. Email-provider details are rendered on Privacy. Current
read-only DNS checks show Zoho MX, one SPF and one DMARC record; DKIM selector,
and authentication-header acceptance remain open. On 2026-10-03, the user
confirmed Zoho direct inbound/outbound delivery tested successfully with an
external Gmail account. This is user-observed delivery evidence, distinct from
agent DNS and authentication-header checks. Mailbox retention is not yet known.

Immediately before the combined release, activate the report locally with the
actual publication timestamp:

```bash
python3 scripts/activate-september-report.py --published-at <actual-ISO-timestamp>
```

This updates registry, latest pointers, llms.txt and editorial status. Preserve
the fixed September manifest and commit activation into the release SHA.
No September page, feed or latest link is advertised while the registry is
inactive. Do not use the dataset's September timestamp as report publication.

## Single OCI build and deployment

Use a clean OCI release checkout of the accepted GitHub SHA under
`/srv/uapt/releases/`; leave the active checkout and build running. Load the
protected production environment without printing it and invoke
`scripts/build-student-release.sh`, with `NEXT_PUBLIC_SITE_URL` set to the
verified public HTTPS domain. This exports the frozen MCP catalog and
performs exactly one Next production build for the approved batch. The script
fails before building if mailbox acceptance or September activation is missing.

The post-build `scripts/check-student-build.mjs` checks the web runtime manifest
against committed data, MCP release/digest and the generated September route,
then writes `.local/student-release/build-receipt.json` with SHA and build ID.
Record the report timestamp as well. Start the candidate web server on a free
loopback port and run the existing site HTTP checks plus the 35 new routes,
September report/charts/feeds and all SDK MCP cases before switching services.

Install the checked `infra/oci/uapt-mcp.service` with its WorkingDirectory set
to the accepted release directory. Create mode-0600 `/srv/uapt/env/mcp.env`:

```text
UAPT_MCP_PORT=3110
UAPT_MCP_PUBLIC_ORIGIN=https://eduaipolicy.org
UAPT_MCP_CATALOG=/srv/uapt/releases/<release>/apps/mcp/.runtime-data/catalog.json
UAPT_MCP_EXPECTED_RELEASE_ID=<the-web-release-id>
UAPT_MCP_TELEMETRY_FILE=/srv/uapt/mcp-telemetry/daily.json
```

Create `/srv/uapt/mcp-telemetry` owned by uapt, mode 0700. The service binds only
loopback and has no database, crawling or private research access. Set the web
service's WorkingDirectory to this same release's `apps/web`. Keep the prior
service configurations and build pointers as rollback artifacts.

Back up the existing UAPT Nginx configuration; include
`infra/oci/uapt-mcp-location.conf` inside both existing UAPT server blocks.
Do not change CELPIP configurations. `/api/mcp` and `/api/plugin/status` must
remain uncached by Cloudflare and Nginx; disable body/prompt logging. Run
`nginx -t` before reload. Install the analytics retention service and timer
using the same release's WorkingDirectory; confirm the RPC dry-run and enable
the timer. Daily aggregate cleanup also runs at MCP startup and every day.

Switch the web and MCP services to the accepted release together, then verify
public HTTPS endpoint calls, web/report versions, new pages and retention timer.
If any verification fails, restore the prior service and Nginx configurations
and restart the prior web build. Disable newly activated services/timer as
needed. Do not replace or discard the previous release until readback passes.

## Directory submission

`plugins/university-ai-policy-tracker` contains the portable Agent Plugins
manifest, one MCP server, existing brand icon, student Skill and exactly five
positive/three negative review scenarios. `python3 scripts/package-student-plugin.py`
creates a deterministic draft ZIP. `--submission` requires an HTTPS URL for a
real recorded supported-client demonstration; it cannot silently fabricate one.

The test scenarios are reviewer expectations, not proof they have been executed
in ChatGPT. Record these cases after production connection. All tools have
`readOnlyHint=true`, `destructiveHint=false`, `openWorldHint=false`: they read a
fixed first-party catalog and do not fetch arbitrary websites. The only write
is ancillary daily aggregate telemetry. Keep these behavior explanations for
portal findings; official pages currently disagree on whether justifications
are mandatory. No pricing promotion appears in the listing.

Use Samsong as the preferred publisher. The portal derives its display name
from the selected verified identity. If verification requires ID or prevents
this name, return to the user rather than changing the name or submitting ID.
The current browser session has not established a verified developer identity.

After website/mailbox production acceptance, the user signs into the submission
portal. Complete the exact `/.well-known/openai-apps-challenge` token using the
uncached file route; run current tool/Skill scans and resolve issues. The user
handles identity documents and any platform agreement when actually required.
Upload the ZIP, supply the real demo URL, submit, then publish after approval.

After public publication, set `UAPT_PLUGIN_DIRECTORY_STATUS=published` and
`UAPT_PLUGIN_DIRECTORY_URL=<verified-official-listing-URL>` and restart the web
runtime. No Next rebuild is needed for the link. Final acceptance requires an
eligible non-developer ChatGPT account to search the exact name, install and
retrieve a cited answer with Developer Mode disabled. Manual MCP connection is
not completion of directory discovery.

## Demonstration recording sequence

Show the eligible client and installation/connection status. Ask about NUS
coursework, Toronto institutional-tool scope, Bristol disclosure and Guelph
detectors, then request original evidence for a cited claim. Open one tracker
and one official source link. Show an insufficient-evidence question and a
refused mutation/private-data request. Avoid exposing account identity, raw
private prompts or mailbox credentials. Capture actual tool calls and results;
an SDK terminal run does not substitute for this client demonstration.
