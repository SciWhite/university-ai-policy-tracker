# OCI Crawl Data To Policy Update Runbook

Use this when a Codex thread needs to turn OCI maintenance crawl output into
reviewed university AI policy updates for the public tracker.

This is an operator runbook, not a crawler prompt. It assumes routine scans are
already running on the OCI/OpenClaw host and that Codex is doing local review,
validation, release promotion, and Git work.

## Boundaries

- Do not run the OpenClaw `policy-manager` full multi-agent workflow for routine
  maintenance updates.
- Do not ask OpenClaw to push `main`, deploy Vercel, write production DB data,
  or publish canonical claims.
- Do not treat `http_failed`, `blocked`, `robots_blocked`, timeout, or Firecrawl
  failure as proof of policy change.
- Do not publish raw HTML, full PDF text, screenshots, browser profiles, or full
  source text.
- Do not put Firecrawl keys, OpenClaw gateway tokens, SSH keys, or other secrets
  in Git, public JSON, logs, or PR text.
- Original-language evidence snippets are canonical. Translations can be display
  helpers only.

Related detailed docs:

- `docs/maintenance-oci-runbook.md`
- `docs/openclaw-data-prs.md`
- `docs/source-snapshot-storage-plan.md`
- `docs/data-contract.md`
- `docs/crawler-policy.md`

## Roles

OCI/OpenClaw host:

- Runs scheduled HTTP-first maintenance scans.
- Writes maintenance output under
  `/home/openclaw/workspace/staging/uapt-maintenance/<run-id>/`.
- May run one lightweight OpenClaw review per high-confidence changed source.
- Writes no-change notes under
  `/home/openclaw/workspace/staging/uapt-maintenance/<run-id>/notes/`.
- Writes real claim/evidence candidate bundles only under
  `staging/uapt-runs/<run-dir>/`.

Local Codex:

- Reads OCI maintenance output.
- Reviews candidate source changes against private source snapshots where
  available.
- Creates or repairs `openclaw-artifact-v1` staged bundles only for confirmed
  policy-content updates.
- Runs validators.
- Updates `data/public-releases/current.json` and history manifests.
- Pushes reviewed changes to Git when requested.

Public site:

- Consumes only promoted release manifests.
- Does not read live OpenClaw runtime output.
- Displays release-to-release claim/evidence/source diffs and history.

## Read OCI State

Start from the local OpenClaw handoff file:

```bash
source /Users/newvolume/Documents/OpenClaw/secrets/openclaw-local.env
```

Check timers and recent runs:

```bash
ssh -i "$OPENCLAW_SSH_KEY" "$OPENCLAW_USER@$OPENCLAW_HOST" 'bash -s' <<'REMOTE'
set -euo pipefail
systemctl list-timers --all 'uapt-maintenance-*' --no-pager
systemctl --no-pager --failed | grep -E 'uapt-maintenance|UNIT' || true
journalctl -u uapt-maintenance-qs200.service -n 80 --no-pager || true
journalctl -u uapt-maintenance-weekly-other.service -n 80 --no-pager || true
sudo -iu openclaw bash -lc 'ls -1dt /home/openclaw/workspace/staging/uapt-maintenance/maintenance-* | head -10'
REMOTE
```

Inspect a run:

```bash
RUN_ID=maintenance-YYYY-MM-DDTHH-MM-SS-000Z
ssh -i "$OPENCLAW_SSH_KEY" "$OPENCLAW_USER@$OPENCLAW_HOST" \
  "sudo -iu openclaw sed -n '1,180p' /home/openclaw/workspace/staging/uapt-maintenance/$RUN_ID/summary.md"
```

Copy `source-health.json` locally without exposing secrets:

```bash
mkdir -p /tmp/uapt-maintenance-review
ssh -i "$OPENCLAW_SSH_KEY" "$OPENCLAW_USER@$OPENCLAW_HOST" \
  "sudo -iu openclaw cat /home/openclaw/workspace/staging/uapt-maintenance/$RUN_ID/source-health.json" \
  > /tmp/uapt-maintenance-review/source-health.json
```

## Candidate Triage

Only review rows where:

- `diffClass` is `content_policy_delta`, and
- `status` or `openClawQueueStatus` indicates `needs_openclaw`, and
- the source has usable old and new text, or a clear official update date plus
  exact new policy evidence.

Do not promote candidates when:

- old private source text is missing;
- current text extraction failed or returned empty text;
- only source metadata, page chrome, navigation, alert banners, or footer text
  changed;
- the change is only a redirect, content-length change, Last-Modified change,
  or snapshot hash change without policy sentence changes;
- the source is blocked or failed with no independent content-change signal.

High-confidence policy delta signals include added or removed sentences that
contain both an AI/generative-AI term and a policy action term:

```text
must, must not, may not, prohibited, allowed, required, disclose, cite,
acknowledge, assessment, exam, coursework, academic integrity, privacy,
personal data, approved tool, licensed tool, Copilot, ChatGPT Edu
```

For multilingual sources, use source-language equivalents where possible, but
preserve original-language evidence snippets.

## Private Snapshot Comparison

If private snapshots are available on OCI, copy only manifests and normalized
text needed for review into `/tmp`, not into Git:

```bash
ssh -i "$OPENCLAW_SSH_KEY" "$OPENCLAW_USER@$OPENCLAW_HOST" \
  'sudo -iu openclaw tar -C /home/openclaw/workspace/university-ai-policy-tracker/.local/source-snapshots -czf - public-release-YYYYMMDD-NNN' \
  > /tmp/uapt-maintenance-review/source-snapshots.tgz
```

Use old normalized source text to determine whether changes are true policy
changes. If old text is unavailable, write a no-promote note or leave the row in
review. Do not publish it as a policy change.

## Creating Staged Artifacts

For confirmed policy-content updates, create a real `openclaw-artifact-v1`
bundle under:

```text
staging/uapt-runs/<run-dir>/artifacts.json
```

The bundle must include:

- `crawl_plan`
- `source_candidate`
- `source_discovery_trace`
- `fetch_attempt`
- `source_snapshot`
- `claim_candidate`
- `evidence_candidate`
- `review_decision`
- `report_draft`

Use `reviewState: "agent_reviewed"` for local Codex-reviewed maintenance
updates. Do not use `human_reviewed` unless the user explicitly performed human
review, and do not use `institution_verified` unless the institution confirmed
it.

Staged claims must remain candidates. Do not set `publishAsCanonical: true` or
`isCanonical: true`; the public release manifest is the promotion gate.

Validate the new bundle:

```bash
pnpm validate:openclaw-artifacts staging/uapt-runs/<run-dir>
```

## No-Change Or Inconclusive Results

If review finds no clear policy-content update, write a note under:

```text
staging/uapt-maintenance/<run-id>/notes/<entity-slug>.md
```

Do not write no-change notes under `staging/uapt-runs/`, and do not add them to
`data/public-releases/current.json`.

## Promote A Reviewed Update

1. Copy the current manifest into history:

```bash
OLD_ID=$(jq -r '.releaseId' data/public-releases/current.json)
cp data/public-releases/current.json "data/public-releases/history/$OLD_ID.json"
```

2. Update `data/public-releases/current.json`:

- new `releaseId`;
- new `publishedAt`;
- description that names the reviewed maintenance update;
- append the staged artifact directory to `includeStagedArtifactDirectories`;
- notes explaining held-back candidates and limitations.

3. Run validation:

```bash
pnpm validate:openclaw-artifacts staging/uapt-runs/<run-dir>
pnpm validate:dataset-release
pnpm validate:public-contract
pnpm audit:public-data
pnpm --filter @uapt/web typecheck
pnpm --filter @uapt/web build
git diff --check
```

Use `pnpm check` for a full gate when time allows.

## Expected Change Page Behavior

After promotion:

- `/changes` should show all historical university changes, grouped by
  university.
- `/changes/<university-slug>` should combine that university's changes across
  releases.
- `/changes/<releaseId>` should show one release's full diff.
- `/changes/<releaseId>/<university-slug>` should show that university's diff in
  that release.
- `/api/public/v1/changes/latest.json` should represent the latest release only.
- Historical releases must remain addressable.

Newly extracted tracker claims are not necessarily newly published by the
university. Source snapshot hash changes are not policy changes by themselves.

## Handoff Prompt For A New Codex Thread

Use this prompt when opening a fresh Codex thread:

```text
Work in /Users/newvolume/Documents/university-ai-policy-tracker.

Read docs/oci-policy-update-from-crawl-data.md first, then inspect the current
git state. Use /Users/newvolume/Documents/OpenClaw/AGENTS.md for OCI SSH rules.

Task:
1. Read the latest OCI maintenance run under
   /home/openclaw/workspace/staging/uapt-maintenance.
2. Copy only source-health metadata and needed private snapshot comparison data
   to /tmp.
3. Classify needs_openclaw/content_policy_delta candidates.
4. Promote only confirmed policy-content updates with official source URLs,
   source-language evidence snippets, source snapshot hashes, confidence, and
   reviewState=agent_reviewed.
5. Write no-change or inconclusive findings to maintenance notes, not
   staging/uapt-runs.
6. Validate staged artifacts and dataset release before commit/push.

Do not call OpenClaw policy-manager, do not run broad crawls locally, do not
publish raw source text, do not expose secrets, and do not treat HTTP failures
or blocked pages as policy changes.
```
