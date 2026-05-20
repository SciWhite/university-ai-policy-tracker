# OCI Maintenance Runbook

This runbook installs the HTTP-first maintenance scanner on the OpenClaw OCI
host without making OpenClaw responsible for routine scans.

## Boundaries

- Routine scans run through `pnpm maintenance:scan`, not the OpenClaw
  `policy-manager` multi-agent flow.
- Firecrawl is enabled only through `FIRECRAWL_API_KEY` in the host environment.
  Do not write the key to Git, logs, pull requests, or public JSON.
- OpenClaw is called later only for `suspected_policy_update` or
  `needs_openclaw` rows, using one lightweight agent per source/page.
- Maintenance output is metadata. It is not claim evidence and does not upgrade
  review state.

## Host Paths

Use these default paths on the OCI host:

```text
/home/openclaw/workspace/university-ai-policy-tracker
/home/openclaw/workspace/staging/uapt-maintenance
/home/openclaw/workspace/staging/uapt-maintenance/<run-id>/notes
/home/openclaw/.config/uapt-maintenance.env
```

The environment file should be owned by `openclaw` and mode `0600`.

Required environment variables:

```text
FIRECRAWL_API_KEY=...
```

## Install Timers

Run as an SSH user with sudo privileges:

```bash
cd /home/openclaw/workspace/university-ai-policy-tracker
git pull --ff-only
sudo cp infra/systemd/uapt-maintenance-qs200.service /etc/systemd/system/
sudo cp infra/systemd/uapt-maintenance-qs200.timer /etc/systemd/system/
sudo cp infra/systemd/uapt-maintenance-weekly-other.service /etc/systemd/system/
sudo cp infra/systemd/uapt-maintenance-weekly-other.timer /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now uapt-maintenance-qs200.timer
sudo systemctl enable --now uapt-maintenance-weekly-other.timer
```

## Manual Smoke Tests

Do not run a large scan first. Start with dry runs:

```bash
sudo -iu openclaw bash -lc 'cd ~/workspace/university-ai-policy-tracker && /home/linuxbrew/.linuxbrew/bin/pnpm maintenance:scan -- --dry-run --mode qs200 --limit 3'
sudo -iu openclaw bash -lc 'cd ~/workspace/university-ai-policy-tracker && /home/linuxbrew/.linuxbrew/bin/pnpm maintenance:scan -- --dry-run --mode weekly-other --shard-count 7 --shard-index 0 --limit 3'
```

Then run a tiny HTTP scan without Firecrawl:

```bash
sudo -iu openclaw bash -lc 'cd ~/workspace/university-ai-policy-tracker && /home/linuxbrew/.linuxbrew/bin/pnpm maintenance:scan -- --mode qs200 --limit 3 --output-dir ~/workspace/staging/uapt-maintenance'
```

## Status Checks

```bash
systemctl list-timers --all | grep uapt-maintenance
systemctl status uapt-maintenance-qs200.timer --no-pager
systemctl status uapt-maintenance-weekly-other.timer --no-pager
journalctl -u uapt-maintenance-qs200.service -n 100 --no-pager
journalctl -u uapt-maintenance-weekly-other.service -n 100 --no-pager
```

## Output Review

Each run writes:

```text
source-health.json
summary.md
```

Review the summary before generating any PR. No-change runs should not open PRs.
Rows marked `needs_openclaw` are the only candidates for lightweight OpenClaw
deep review.

## Lightweight OpenClaw Review Output

Use one lightweight OpenClaw agent per `needs_openclaw` source/page. Do not call
`policy-manager` for routine maintenance review.

Output paths are split by result:

```text
/home/openclaw/workspace/staging/uapt-maintenance/<run-id>/notes/
/home/openclaw/workspace/university-ai-policy-tracker/staging/uapt-runs/
```

If the agent concludes there is no policy-content change, write only a concise
maintenance note under `staging/uapt-maintenance/<run-id>/notes/`. Do not write
that note into `staging/uapt-runs/`, and do not run
`pnpm validate:openclaw-artifacts` against a note-only directory.

Only write to `staging/uapt-runs/` when the agent creates a real
`openclaw-artifact-v1` JSON bundle for review. The bundle must validate with:

```bash
sudo -iu openclaw bash -lc 'cd ~/workspace/university-ai-policy-tracker && pnpm validate:openclaw-artifacts staging/uapt-runs/<run-dir>'
```

The lightweight prompt should include this output rule explicitly:

```text
If there is no clear policy-content update, write a maintenance note to
/home/openclaw/workspace/staging/uapt-maintenance/<run-id>/notes/<entity-slug>.md
or .json and do not create a directory under staging/uapt-runs/.

If there is a clear policy-content update, write a valid openclaw-artifact-v1
bundle under the supplied staging/uapt-runs/<run-dir> and run the validator.
```
