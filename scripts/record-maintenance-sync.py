#!/usr/bin/env python3
"""Freeze a private maintenance receipt. Never promotes policy or calls a model."""
import argparse
import hashlib
import importlib.util
import json
import os
from pathlib import Path
from datetime import datetime, timezone

ROOT = Path(__file__).resolve().parents[1]
SURFACES = ['inventory', 'knowledge', 'review_cache', 'public_data', 'tools',
            'student_snapshot', 'mcp', 'search_coverage', 'pages', 'runtime_content',
            'changes', 'sitemap', 'notifications', 'public_readback']

def digest(data):
    return hashlib.sha256(data).hexdigest()

def record(run_dir, kind, repo=ROOT):
    run_dir, repo = Path(run_dir).resolve(), Path(repo).resolve()
    basis = run_dir / ('source-health.json' if kind == 'scan' else 'review-results.json')
    data = json.loads(basis.read_text())
    registry_bytes = (repo / 'docs/policy-audit-requirements-v1.json').read_bytes()
    registry = json.loads(registry_bytes)
    basis_bytes = basis.read_bytes()
    stamp = datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%S%fZ')
    dest = run_dir / 'sync-events' / (kind + '-' + stamp)
    dest.mkdir(parents=True, mode=0o700)
    os.chmod(dest, 0o700)
    def save(name, payload):
        raw = payload if isinstance(payload, bytes) else (json.dumps(payload, ensure_ascii=False, indent=2)+'\n').encode()
        p = dest / name
        with p.open('xb') as f:
            f.write(raw)
        p.chmod(0o600)
        return {'path': name, 'sha256': digest(raw), 'basisSha256': digest(basis_bytes)}
    save('basis.json', basis_bytes)
    requirements = save('requirements.json', registry_bytes)
    rules = save('maintenance-contract.md', (repo/'docs/openclaw-policy-maintenance-contract.md').read_bytes())
    receipts = []
    for row in data.get('rows', []):
        for proof in row.get('sourceEvidence', []):
            p = (run_dir / proof['path']).resolve()
            if run_dir not in p.parents or not p.is_file() or digest(p.read_bytes()) != proof['sha256']:
                raise ValueError('Missing or changed private source evidence')
            receipts.append(proof)
    index = save('inventory-receipt.json', {
        'runId': data.get('runId'), 'task': kind, 'sourceEvidence': receipts,
        'requirementsArtifact': requirements, 'rulesArtifact': rules,
        'inventoryPointerAvailable': (repo/'.local/policy-inventory/current.json').exists(),
        'inventoryGap': None if (repo/'.local/policy-inventory/current.json').exists() else 'inventory_not_available_on_host',
        'publicationApproved': False, 'productionLoaderConnected': False,
        'semanticAcceptance': False,
    })
    surfaces = {s: {'status': 'not_required_with_reason', 'reason':
        'Private maintenance '+kind+' only; this task does not change this public or derived surface. Policy publication requires a separate approved release event.'} for s in SURFACES}
    surfaces['inventory'] = {'status': 'updated', 'evidence': [index, requirements, rules]}
    if kind == 'review':
        surfaces['review_cache'] = {'status': 'updated', 'evidence': [
            {'path':'basis.json','sha256':digest(basis_bytes),'basisSha256':digest(basis_bytes)}]}
    event = {'eventId': 'maintenance-'+kind+'-'+stamp, 'eventType': 'source_health' if kind == 'scan' else 'audit',
        'generatedAt': datetime.now(timezone.utc).isoformat(), 'requirementsVersion': registry['version'],
        'basisSha256': digest(basis_bytes), 'basisArtifact': {'path':'basis.json','sha256':digest(basis_bytes)},
        'publicationApproved': False, 'surfaces': surfaces}
    # Health/review receipts deliberately do not claim the release-only 2.0.0 approval contract.
    spec = importlib.util.spec_from_file_location('inventory_sync', repo/'scripts/policy-inventory.py')
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    module.sync_gate(event, dest, 'candidate')
    module.sync_gate(event, dest, 'complete')
    save('event.json', event)
    return dest/'event.json'

if __name__ == '__main__':
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('run_dir');p.add_argument('--kind',choices=['scan','review'],required=True)
    args=p.parse_args()
    print(record(args.run_dir,args.kind))
