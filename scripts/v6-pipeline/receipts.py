#!/usr/bin/env python3
"""S4 receipts: write <review-dir>/independent-review.json from the frozen packets and the final agent findings.

Refuses unless every school's latest findings file says accept with no blocker or fix left, and every packet
hash still matches review/manifest.json. Receipts copy each packet's requiredAcceptance exactly (presentation
evidence acceptance), plus reviewer and time. Agent review only; no human review step (AGENTS.md)."""
import json, hashlib, pathlib, datetime, sys, os

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
import v6batch as Bt  # noqa: E402
import gates  # noqa: E402

P, args = Bt.workspace_from_argv()
BATCH = Bt.load(P)
gates.require(P, BATCH, 'locale')  # no review receipts for a page whose /zh/ rows are not all Chinese
R = P / (args[0] if args else BATCH.get('reviewDir', 'review'))
man = json.loads((R / 'manifest.json').read_text())
now = datetime.datetime.now(datetime.timezone.utc).isoformat().replace('+00:00', 'Z')
reviewer = BATCH.get('review', {}).get('reviewer', 'Claude Opus 5.5 independent agent presentation review')
receipts, problems, rounds = {}, [], {}
for slug, sha in man['schoolPacketSha256'].items():
    raw = (R / f'{slug}.json').read_bytes()
    if hashlib.sha256(raw).hexdigest() != sha:
        problems.append(f'{slug}: packet changed after freezing')
        continue
    f = R / 'findings' / f'{slug}.json'
    if not f.exists():
        problems.append(f'{slug}: no final findings'); continue
    fd = json.loads(f.read_text())
    open_items = [x for x in fd.get('findings', []) if x.get('severity') in ('blocker', 'fix')]
    if fd.get('decision') != 'accept' or open_items:
        problems.append(f"{slug}: decision {fd.get('decision')} with {len(open_items)} open blocker/fix")
        continue
    req = json.loads(raw)['requiredAcceptance']
    receipts[slug] = {**req, 'reviewer': reviewer, 'reviewedAt': now}
    rounds[slug] = {'findingsSha256': hashlib.sha256(f.read_bytes()).hexdigest(), 'minorOpen': sum(1 for x in fd.get('findings', []) if x.get('severity') == 'minor')}
if problems:
    sys.exit('Not issuing receipts:\n' + '\n'.join(problems))
out = {'reviewer': reviewer, 'reviewedAt': now, 'decision': 'accepted', 'packetSha256': man['schoolPacketSha256'],
       'details': {'revision': man['revision'], 'method': os.environ.get('RECEIPT_METHOD') or BATCH.get('review', {}).get('method') or 'Independent agent review per school against the cited captured sources until no blocker or fix remained (scripts/v6-pipeline/prompts/REVIEW-SPEC.md).',
                   'findings': rounds, 'reviewPolicy': 'agent review only; no human review step (AGENTS.md Review Policy)'},
       'receipts': receipts}
(R / 'independent-review.json').write_text(json.dumps(out, ensure_ascii=False, indent=1) + '\n')
print(json.dumps({'accepted': len(receipts), 'reviewedAt': now}))
