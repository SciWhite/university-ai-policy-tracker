# OpenClaw policy maintenance contract

This contract applies to the existing HTTP-first scan and lightweight review
batch. Read `docs/policy-evidence-integration-runbook.md` and the current
versioned requirements registry. It does not authorize publication.

- Work source by source. Preserve exact university, audience, unit, assessment
  and tool scope. Complete a university audit only after reconciling its full
  public JSON Claim ID set, MCP remainingClaimIds, tools, supplementary objects
  and every student-summary version. A source-level maintenance review alone
  must remain PARTIAL for the university.
- Read the private inventory pointer when available. On a host without the
  Mac's inventory, record `inventory_not_available_on_host`; do not invent a
  current pointer, silently use an old cache, or transfer private materials
  into public data. Keep old snapshots and all holds.
- Retrieve official current evidence and necessary context; check replacement
  policies and conflicting sources. For PDFs inspect actual pages. Capture
  original response bytes in the run's private `source-evidence` directory,
  with source/final URL, fetch time, response status, content type, raw hash,
  representation and truncation state. Keep normalized text and its hash
  separate. HTTP-decoded entity bytes are not network-wire bytes; rendered
  markdown is not original HTML. Never store credentials, browser state or
  authenticated data. Respect robots, rate limits and access restrictions.
- If retrieval fails, record the gap and remaining IDs. Failure is not absence
  of a rule. Quote matching, changed hashes, structural validation and model
  confidence do not establish semantic accuracy, currentness or approval.
- Check modality and exceptions, academic integrity, detector evidence,
  hearings/appeals, privacy, research, procurement and institutional tools.
  Tool access/security approval never implies assessment permission. Keep
  policy dates separate from capture and inventory dates.
- Candidate claims stay agent_reviewed/needs_review and noncanonical. Use
  VERIFIED/OVERSTATED/UNDERSTATED/STALE/CONTRADICTED/BROKEN_SOURCE/UNVERIFIED
  with P0/P1/P2 and explicit uncertainty. English repairs require official
  support. Do not refresh lastCheckedAt for unchecked claims.
- Save `review-coverage/<source-item-id>.json` beside the run notes, including
  requirements version, source item/URL, publicClaimIds, checkedClaimIds,
  remainingClaimIds, supplementary objects, requirement gaps, evidence paths
  and hashes, status and held decisions. Save a note even for no change or
  blocked access. A note is a completed attempt, not a completed school audit.
- Every scan/review collection records a frozen synchronization event through
  `scripts/record-maintenance-sync.py`; all 14 surfaces need evidence or an
  explicit exclusion. No-change scans must not fabricate public changes.
- Propose an affected-surface plan for genuine policy changes: public JSON,
  tools, student snapshots, MCP, pages/runtime, search, sitemap and notification
  eligibility. The corresponding university changes/history/latest diff,
  changes index/recent changes/RSS must ship with the policy change. Preserve
  student-summary holds and require exact basis fingerprints.
- Do not invoke policy-manager/full orchestration, write production DB, commit,
  push main, deploy, select public pointers, promote candidates or notify search
  engines. Codex acceptance and separate publication authorization remain
  required. Publication uses fresh contract 2.0.0 candidate and completion
  receipts; maintenance events cannot substitute for release approval.

Staged candidate bundles and raw evidence belong outside the Git checkout.
The batch may read legacy artifacts at their old paths but must not rewrite or
move historical acceptance results. Requirements can grow with stable IDs and
new registry versions; old reviews do not inherit new requirements.
