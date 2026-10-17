#!/usr/bin/env python3
"""Host-side release admission and crash-recoverable routing selection.
No build, install, deletion, or policy approval. See docs/release-lifecycle.md.
"""
import argparse, datetime, fcntl, hashlib, json, os, re, shutil, subprocess, sys
from pathlib import Path
STATE = Path('/srv/uapt/operations/release-lifecycle')
POLICY = Path('/srv/uapt/operations/release-lifecycle/policy.json')
LOCK = Path('/run/lock/uapt-release.lock')
def run(*args):
    return subprocess.check_output(args, text=True, stderr=subprocess.PIPE)
def digest(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()
def write(path, value):
    path = Path(path); path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(path.suffix + '.tmp')
    with tmp.open('w') as stream:
        json.dump(value, stream, indent=2); stream.write('\n'); stream.flush(); os.fsync(stream.fileno())
    os.replace(tmp, path)
    fd = os.open(path.parent, os.O_RDONLY); os.fsync(fd); os.close(fd)
def now():
    return datetime.datetime.now(datetime.timezone.utc).isoformat()
def state(unit):
    return dict(line.split('=', 1) for line in run('systemctl', 'show', unit, '-p', 'ActiveState,UnitFileState,MemoryCurrent,MemoryHigh,MemoryMax,WorkingDirectory').splitlines() if '=' in line)
def running():
    return [line.split()[0] for line in run('systemctl', 'list-units', '--type=service', '--state=running', 'uapt*', '--no-legend', '--no-pager', '--plain').splitlines() if line.split()]
def audit():
    units = {unit: state(unit) for unit in running()}
    memory = {line.split(':')[0]: int(line.split()[1]) * 1024 for line in Path('/proc/meminfo').read_text().splitlines() if line.startswith(('MemTotal:', 'MemAvailable:'))}
    return {'checkedAt': now(), 'memory': memory, 'units': units, 'uaptMemoryBytes': sum(int(s['MemoryCurrent']) for s in units.values())}
def validate_plan(plan, policy, observed):
    """Pure admission check; called again under the same lock immediately before routing."""
    if plan.get('schemaVersion') != 'uapt-release-lifecycle-plan-v1': raise ValueError('Wrong lifecycle plan schema')
    if plan.get('policySha256') != policy['_sha256']: raise ValueError('Policy changed; reprepare plan')
    if plan.get('expiresAt', '') <= now(): raise ValueError('Plan expired')
    expiry = datetime.datetime.fromisoformat(plan['expiresAt'])
    if expiry.tzinfo is None or expiry > datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(hours=4): raise ValueError('Plan lifetime exceeds four hours')
    candidates = plan.get('candidateUnits', [])
    if not candidates or len(candidates) > 2 or len(set(candidates)) != len(candidates): raise ValueError('Require one bounded candidate pair at most')
    if not set(candidates) <= set(policy['candidateSlots']): raise ValueError('Use fixed candidate slots; per-release/per-school units forbidden')
    allowed = set(policy['activeUnits']) | set(policy['legacyUnits']) | set(candidates)
    if set(observed['units']) - allowed: raise ValueError('Unregistered running service; retire or explicitly review it first')
    if set(observed['units']) - set(candidates) != set(policy['activeUnits']) | set(policy['legacyUnits']): raise ValueError('Expected active/legacy service set changed')
    budget = plan.get('candidatePeakBytes')
    if not isinstance(budget, int) or budget <= 0 or budget > policy['candidatePeakMaxBytes']: raise ValueError('Invalid measured candidate peak budget')
    # Before candidates start charge the full requested peak; when running charge remaining headroom.
    used = sum(int(observed['units'].get(u, {}).get('MemoryCurrent', 0)) for u in candidates)
    additional = max(0, budget - used)
    if observed['memory']['MemAvailable'] - additional < policy['hostReserveBytes']: raise ValueError('Insufficient host reserve for coexistence/build peak')
    if observed['uaptMemoryBytes'] + additional > policy['uaptPeakMaxBytes']: raise ValueError('UAPT aggregate peak budget exceeded')
    for unit, s in observed['units'].items():
        if s['MemoryHigh'] == 'infinity' or s['MemoryMax'] == 'infinity': raise ValueError('Missing resource limits: ' + unit)
    if not plan.get('retireUnits') or not set(plan['retireUnits']) <= set(policy['activeUnits']): raise ValueError('Explicit previous active units must retire at completion')
    if set(plan['retireUnits']) & set(candidates): raise ValueError('Candidate cannot retire itself')
    if set(plan['retireUnits']) != set(policy['activeUnits']) - set(plan.get('keepActiveUnits', [])): raise ValueError('Specify the exact replacement set')
    if set(plan.get('candidateEndpoints', {})) != set(candidates) or any(not v for v in plan['candidateEndpoints'].values()): raise ValueError('Exact candidate endpoints required for cleanup')
    if not plan.get('routingFiles') or not plan.get('candidateChecks') or not plan.get('retiredEndpoints'): raise ValueError('Missing routing/candidate/retirement endpoint scope')
    if not plan.get('staticArchiveReceipt') or not plan.get('publicChecks'): raise ValueError('Static archive and exact public readback checks required')
    return True

def validate_capacity(plan, capacity, prebuild=False):
    if prebuild:
        if capacity.get('schemaVersion') != 'uapt-prebuild-budget-v1' or capacity.get('measured') is not False:
            raise ValueError('Explicit provisional prebuild budget required; do not label estimates as measurements')
        budget = capacity.get('buildMemoryMaxBytes')
        if not isinstance(budget, int) or budget <= 0 or budget > plan['candidatePeakBytes'] or capacity.get('buildScope') != 'uapt-build.scope':
            raise ValueError('Build must use the fixed scope within the admitted candidate budget')
        return
    peaks = capacity.get('peakBytesByStage', {})
    if not {'build', 'startup', 'cold_history', 'steady'} <= set(peaks) or any(not isinstance(v, int) or v <= 0 for v in peaks.values()):
        raise ValueError('Measured build/startup/cold-history/steady peak receipt required')
    if max(peaks.values()) > plan['candidatePeakBytes']: raise ValueError('Candidate budget understates measured peak')

def load_plan(path, prebuild=False):
    path = Path(path).resolve(); plan = json.loads(path.read_text()); policy = json.loads(POLICY.read_text()); policy['_sha256'] = digest(POLICY)
    validate_plan(plan, policy, audit())
    for unit in plan['candidateUnits']:
        limits = state(unit)
        if limits.get('MemoryHigh') in [None, 'infinity'] or limits.get('MemoryMax') in [None, 'infinity']: raise ValueError('Candidate limits must be installed before admission')
    # Frozen artifact files are immutable; a checksum is not semantic acceptance.
    if digest(plan['releaseHelper']) != plan['releaseHelperSha256']: raise ValueError('Changed release helper')
    for key in ['basis', 'syncLedger', 'staticArchiveReceipt', 'capacityReceipt']:
        proof = plan[key]
        if digest(proof['path']) != proof['sha256']: raise ValueError('Changed ' + key)
    capacity = json.loads(Path(plan['capacityReceipt']['path']).read_text())
    validate_capacity(plan, capacity, prebuild)
    return plan, policy

def check_urls(checks):
    if not checks: raise ValueError('No checks')
    results = []
    for check in checks:
        url = check['url']
        if not url.startswith(('http://127.0.0.1:', 'https://eduaipolicy.org/')): raise ValueError('Outside allowed readback origin')
        body = subprocess.check_output(['curl', '-fLsS', '--max-time', '45', url])
        for text in check.get('contains', []):
            if text.encode() not in body: raise ValueError('Readback missing required text: ' + url)
        if not check.get('contains') and not check.get('sha256'): raise ValueError('HTTP 200 alone is not acceptance')
        if check.get('sha256') and hashlib.sha256(body).hexdigest() != check['sha256']: raise ValueError('Readback hash differs: ' + url)
        results.append({'url': url, 'sha256': hashlib.sha256(body).hexdigest()})
    return results

def recover(tx, reload_nginx=True):
    # Safe default for any unfinished transaction: start old units, restore exact old configs.
    for unit in tx['retireUnits']:
        run('systemctl', 'enable', '--now', unit)
    for item in tx['files']:
        target = Path(item['target']); backup = Path(item['backup'])
        if digest(backup) != item['beforeSha256']: raise ValueError('Corrupt recovery backup')
        temp = target.with_suffix('.recover-tmp'); shutil.copy2(backup, temp); os.replace(temp, target)
    run('nginx', '-t')
    if reload_nginx: run('systemctl', 'reload', 'nginx')
    write(POLICY, tx['beforePolicy'])
    # nginx -T parses restored config even before nginx starts during boot recovery.
    config = run('nginx', '-T')
    for unit in tx.get('plan', {}).get('candidateUnits', []):
        endpoints = tx['plan'].get('candidateEndpoints', {}).get(unit, [])
        if endpoints and not any(endpoint in config for endpoint in endpoints): run('systemctl', 'disable', '--now', unit)
    tx.update(stage='rolled_back', recoveredAt=now()); write(STATE / 'transaction.json', tx)

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('action', choices=['audit', 'prebuild', 'gate', 'cutover', 'complete', 'recover', 'expire'])
    parser.add_argument('plan', nargs='?'); parser.add_argument('--boot', action='store_true'); parser.add_argument('--completion-ledger'); args = parser.parse_args()
    LOCK.parent.mkdir(parents=True, exist_ok=True)
    with LOCK.open('w') as lock:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        if args.action == 'audit': print(json.dumps(audit(), indent=2)); return
        pending = STATE / 'transaction.json'
        if args.action == 'expire':
            if pending.exists():
                tx = json.loads(pending.read_text())
                if tx['stage'] not in ['complete', 'rolled_back'] and tx['plan']['expiresAt'] <= now():
                    recover(tx)
                    config = run('nginx', '-T')
                    for unit in tx['plan']['candidateUnits']:
                        # Only the exact candidate endpoints from its frozen plan may be retired.
                        endpoints = tx['plan'].get('candidateEndpoints', {}).get(unit, [])
                        if endpoints and not any(endpoint in config for endpoint in endpoints): run('systemctl', 'disable', '--now', unit)
            return
        if args.action == 'recover':
            if pending.exists():
                tx = json.loads(pending.read_text())
                if tx['stage'] not in ['complete', 'rolled_back']: recover(tx, not args.boot)
            return
        if args.action == 'complete':
            tx = json.loads(pending.read_text()); assert tx['stage'] == 'selected_pending_acceptance'
            plan = tx['plan']
            if not args.completion_ledger: raise ValueError('Fresh public synchronization completion required')
            proof = {'path': str(Path(args.completion_ledger).resolve()), 'sha256': digest(args.completion_ledger)}
            if digest(plan['basis']['path']) != plan['basis']['sha256'] or digest(plan['releaseHelper']) != plan['releaseHelperSha256']: raise ValueError('Frozen completion basis/helper changed')
            run('node', plan['releaseHelper'], 'verify-sync', proof['path'], plan['basis']['path'], 'complete')
            tx['completionLedger'] = proof
            tx['publicChecks'] = check_urls(plan['publicChecks'])
            config = run('nginx', '-T')
            for endpoint in plan['retiredEndpoints']:
                if endpoint in config: raise ValueError('Old endpoint remains in loaded nginx config: ' + endpoint)
            for unit in tx['retireUnits']: run('systemctl', 'disable', '--now', unit)
            for unit in tx['retireUnits']:
                s = state(unit)
                if s['ActiveState'] != 'inactive' or s['UnitFileState'] != 'disabled': raise ValueError('Retirement failed')
            policy = json.loads(POLICY.read_text()); policy['activeUnits'] = plan['keepActiveUnits'] + plan['candidateUnits']; policy['candidateSlots'] = list(set(policy['candidateSlots']) - set(plan['candidateUnits']) | set(tx['retireUnits']))
            write(POLICY, policy); tx.update(stage='complete', completedAt=now(), finalAudit=audit()); write(pending, tx); print('Complete; previous units cold'); return
        plan, policy = load_plan(args.plan, args.action == 'prebuild')
        if pending.exists() and json.loads(pending.read_text())['stage'] not in ['complete', 'rolled_back']: raise ValueError('Unfinished deployment: recover before another release')
        run('node', plan['releaseHelper'], 'verify-sync', plan['syncLedger']['path'], plan['basis']['path'], 'candidate')
        if args.action == 'prebuild': print('Prebuild admission passed; enforce uapt-build.scope budget and collect measurements before gate/cutover'); return
        if args.action == 'gate': print('Lifecycle + synchronization admission passed'); return
        if not re.fullmatch(r'[a-z0-9][a-z0-9-]{0,79}', plan.get('id', '')): raise ValueError('Invalid transaction identity')
        txdir = STATE / 'transactions' / plan['id']; txdir.mkdir(parents=True, exist_ok=False)
        files = []
        for i, item in enumerate(plan['routingFiles']):
            target, source = Path(item['target']), Path(item['source'])
            if target.resolve().parent != Path('/etc/nginx/snippets') or not target.name.startswith('uapt-') or target.is_symlink(): raise ValueError('Outside managed routing files')
            if digest(target) != item['beforeSha256'] or digest(source) != item['sha256']: raise ValueError('Routing drift')
            backup = txdir / str(i); shutil.copy2(target, backup); files.append({**item, 'backup': str(backup)})
        tx = {'stage': 'prepared', 'at': now(), 'files': files, 'retireUnits': plan['retireUnits'], 'plan': plan, 'beforePolicy': {k:v for k,v in policy.items() if k != '_sha256'}}; write(pending, tx)
        try:
            # Durable journal precedes even candidate enable/start, so reboot cannot orphan a candidate.
            for unit in plan['candidateUnits']: run('systemctl', 'enable', '--now', unit)
            check_urls(plan['candidateChecks'])
            validate_plan(plan, policy, audit())
            for item in files:
                target = Path(item['target']); tmp = target.with_suffix('.select-tmp'); shutil.copy2(item['source'], tmp); os.replace(tmp, target)
            run('nginx', '-t'); run('systemctl', 'reload', 'nginx')
            tx.update(stage='selected_pending_acceptance'); write(pending, tx)
            tx['publicChecks'] = check_urls(plan['publicChecks']); write(pending, tx)
        except BaseException:
            recover(tx); raise
        print('Selected; completion gate + retirement still required')
if __name__ == '__main__':
    try: main()
    except Exception as error: print(str(error), file=sys.stderr); sys.exit(1)
