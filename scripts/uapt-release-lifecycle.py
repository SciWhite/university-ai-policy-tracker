#!/usr/bin/env python3
"""Host-side release admission and crash-recoverable routing selection.
No build, install, deletion, or policy approval. See docs/release-lifecycle.md.
"""
import argparse, datetime, fcntl, hashlib, json, os, re, shutil, subprocess, sys, time
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
    return dict(line.split('=', 1) for line in run('systemctl', 'show', unit, '-p', 'ActiveState,UnitFileState,MemoryCurrent,MemoryHigh,MemoryMax,WorkingDirectory,MainPID,InvocationID').splitlines() if '=' in line)
def running():
    return [line.split()[0] for line in run('systemctl', 'list-units', '--type=service', '--state=running', 'uapt*', '--no-legend', '--no-pager', '--plain').splitlines() if line.split()]
def audit():
    units = {unit: state(unit) for unit in running()}
    memory = {line.split(':')[0]: int(line.split()[1]) * 1024 for line in Path('/proc/meminfo').read_text().splitlines() if line.startswith(('MemTotal:', 'MemAvailable:'))}
    result = {'checkedAt': now(), 'memory': memory, 'units': units, 'uaptMemoryBytes': sum(int(s['MemoryCurrent']) for s in units.values())}
    policy = json.loads(POLICY.read_text())
    if policy.get('diskCapacity'):
        root = Path(policy['diskCapacity']['root']).resolve()
        fs = os.statvfs(root)
        result['disk'] = {'root': str(root), 'freeBytes': fs.f_bavail * fs.f_frsize,
            'availableInodes': fs.f_favail, 'projectBytes': int(run('du', '-sx', '-B1', str(root)).split()[0]),
            'releaseRoots': sorted(p.name for p in (root / 'releases').iterdir() if p.is_dir() and not p.is_symlink())}
        if policy.get('retentionEnforcement'):
            result['disk']['temporaryPaths'] = temporary_paths(root, policy['retentionEnforcement'])
    return result

def validate_disk_budget(plan, policy, observed):
    """Live filesystem headroom, total project ceiling and a basis-bound artifact budget.
    Policies predating disk admission remain readable for historical recovery tests.
    Production policy installs diskCapacity; removing it is not a release operation.
    """
    guard = policy.get('diskCapacity')
    if not guard: return
    disk, budget = observed.get('disk', {}), plan.get('diskBudget', {})
    if budget.get('schemaVersion') != 'uapt-release-disk-budget-v1' or budget.get('basisSha256') != plan.get('basis', {}).get('sha256'):
        raise ValueError('Missing or unbound disk budget')
    if disk.get('root') != str(Path(guard['root']).resolve()): raise ValueError('Disk filesystem/root mismatch')
    peaks = budget.get('peakAdditionalBytesByStage', {})
    stages = {'download', 'unpack', 'dependencies', 'build', 'candidate', 'archive', 'finalization'}
    if set(peaks) != stages or any(type(v) is not int or v < 0 for v in peaks.values()):
        raise ValueError('Complete cumulative disk peak estimates required')
    additional = max(peaks.values())
    if disk.get('freeBytes', 0) - additional < guard['reserveBytes']: raise ValueError('Insufficient disk reserve for release peak')
    if disk.get('availableInodes', 0) < guard['reserveInodes']: raise ValueError('Insufficient free disk inodes')
    if disk.get('projectBytes', 0) + additional > guard['projectMaxBytes']: raise ValueError('UAPT disk budget exceeded; archive before releasing')
    cap = budget.get('artifactMaxBytes'); role = budget.get('role')
    if type(cap) is not int or cap <= 0 or role not in guard['artifactMaxBytesByRole'] or cap > guard['artifactMaxBytesByRole'][role]:
        raise ValueError('Invalid per-role artifact size budget')

def retention_timestamp(value, label):
    try:
        parsed = datetime.datetime.fromisoformat(value.replace('Z', '+00:00'))
        if parsed.tzinfo is None: raise ValueError('timezone required')
        return parsed
    except (ValueError, TypeError, AttributeError):
        raise ValueError('Invalid retention ' + label + '; timezone required')

def temporary_paths(root, guard):
    root = Path(root).resolve()
    paths = set()
    for pattern in guard.get('temporaryGlobs', []):
        if Path(pattern).is_absolute() or '..' in Path(pattern).parts: raise ValueError('Unsafe temporary artifact discovery pattern')
        for path in root.glob(pattern):
            if not path.is_symlink() and (path.is_file() or path.is_dir()): paths.add(str(path))
    return sorted(paths)

def validate_retention_deadlines(receipt, observed, policy, registered):
    guard = policy.get('retentionEnforcement')
    if not guard: return
    current = datetime.datetime.now(datetime.timezone.utc)
    checked = retention_timestamp(receipt['checkedAt'], 'checkedAt')
    limit = datetime.timedelta(hours=guard['maxHoldHours'])
    runtime_roots = set()
    for details in observed.get('units', {}).values():
        try:
            parts = Path(details.get('WorkingDirectory', '')).relative_to(Path(observed['disk']['root']) / 'releases').parts
            if parts: runtime_roots.add(parts[0])
        except ValueError: pass
    expected_temporary = set(observed['disk'].get('temporaryPaths', []))
    temps = receipt.get('temporaryArtifacts', [])
    paths = [entry.get('path') for entry in temps]
    if len(paths) != len(set(paths)) or set(paths) != expected_temporary:
        raise ValueError('Unclassified or changed temporary artifacts')
    prior_releases = {e['name']: e for e in registered.get('entries', [])}
    prior_temps = {e['path']: e for e in registered.get('temporaryArtifacts', [])}
    for entries, previous, key in [(receipt['entries'], prior_releases, 'name'), (temps, prior_temps, 'path')]:
        for entry in entries:
            identity = entry[key]; prior = previous.get(identity)
            if key == 'path' and (entry.get('disposition') != 'held' or not entry.get('reason')):
                raise ValueError('Temporary artifacts require an explicit bounded hold: ' + identity)
            if prior and prior.get('disposition') == 'held':
                old_deadline = retention_timestamp(prior.get('reviewBefore'), 'registered reviewBefore')
                if old_deadline <= current: raise ValueError('Expired registered hold; archive or resolve dependency before release: ' + identity)
                if entry.get('disposition') != 'held':
                    # A fresh name/classification cannot hide old archive debt.
                    if key == 'path' or entry.get('disposition') != 'active' or identity not in runtime_roots:
                        raise ValueError('Held artifact reclassified without an actual active runtime: ' + identity)
            if entry.get('disposition') != 'held': continue
            since = retention_timestamp(entry.get('heldSince'), 'heldSince')
            deadline = retention_timestamp(entry.get('reviewBefore'), 'reviewBefore')
            if not entry.get('nextAction') or since > checked + datetime.timedelta(minutes=5) or deadline <= since or deadline - since > limit:
                raise ValueError('Missing or unbounded hold action/deadline: ' + identity)
            if deadline <= current: raise ValueError('Expired hold; archive or resolve dependency before release: ' + identity)
            if prior and prior.get('disposition') == 'held':
                if since != retention_timestamp(prior.get('heldSince'), 'registered heldSince') or deadline > old_deadline:
                    raise ValueError('Hold deadline cannot be renewed by refreshing the receipt: ' + identity)

def retention_with_clocks(registered, policy):
    path = policy.get('retentionEnforcement', {}).get('clockRegister')
    if not path: return registered
    if not Path(path).is_file(): raise ValueError('Immutable hold-clock register missing')
    clocks = json.loads(Path(path).read_text())
    if clocks.get('schemaVersion') != 'uapt-retention-clocks-v1': raise ValueError('Invalid hold-clock register')
    merged = dict(registered)
    for field, key in [('entries', 'name'), ('temporaryArtifacts', 'path')]:
        entries = {e[key]: e for e in registered.get(field, [])}
        entries.update({e[key]: e for e in clocks.get(field, [])})
        merged[field] = list(entries.values())
    return merged

def checkpoint_hold_clocks(receipt, policy):
    path = policy.get('retentionEnforcement', {}).get('clockRegister')
    if not path: return
    path = Path(path)
    clocks = json.loads(path.read_text())
    for field, key in [('entries', 'name'), ('temporaryArtifacts', 'path')]:
        existing = {e[key]: e for e in clocks.get(field, [])}
        for entry in receipt.get(field, []):
            if entry.get('disposition') != 'held': continue
            prior = existing.get(entry[key])
            if prior and (retention_timestamp(entry['heldSince'], 'heldSince') != retention_timestamp(prior['heldSince'], 'registered heldSince') or retention_timestamp(entry['reviewBefore'], 'reviewBefore') > retention_timestamp(prior['reviewBefore'], 'registered reviewBefore')):
                raise ValueError('Hold clock cannot be overwritten by a refreshed register: ' + entry[key])
            if not prior: existing[entry[key]] = {k: entry[k] for k in [key, 'disposition', 'heldSince', 'reviewBefore', 'nextAction', 'reason']}
        clocks[field] = list(existing.values())
    clocks['checkedAt'] = now(); write(path, clocks)

def validate_retention_receipt(plan, observed, policy=None):
    proof = plan.get('retentionReceipt', {})
    if not proof.get('path') or digest(proof['path']) != proof.get('sha256'): raise ValueError('Missing or changed retention receipt')
    receipt = json.loads(Path(proof['path']).read_text())
    if receipt.get('schemaVersion') != 'uapt-release-retention-v1' or receipt.get('basisSha256') != plan['basis']['sha256']:
        raise ValueError('Retention receipt basis mismatch')
    checked = datetime.datetime.fromisoformat(receipt.get('checkedAt', '').replace('Z', '+00:00'))
    age = (datetime.datetime.now(datetime.timezone.utc) - checked).total_seconds()
    if not -300 <= age <= 86400: raise ValueError('Retention receipt is stale; rescan current dependencies')
    entries = receipt.get('entries', [])
    names = [entry.get('name') for entry in entries]
    if len(names) != len(set(names)) or set(names) != set(observed['disk']['releaseRoots']):
        raise ValueError('Unclassified or changed release roots')
    for entry in entries:
        if entry.get('disposition') not in ['active', 'candidate', 'rollback', 'held'] or not entry.get('reason'):
            raise ValueError('Unresolved release retention/archive debt')
    policy = policy or {}
    if policy.get('retentionEnforcement'):
        register = Path(policy['retentionRegister'])
        if not register.is_file(): raise ValueError('Authoritative retention register missing')
        validate_retention_deadlines(receipt, observed, policy, retention_with_clocks(json.loads(register.read_text()), policy))
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
    validate_disk_budget(plan, policy, observed)
    if policy.get('diskCapacity'): validate_retention_receipt(plan, observed, policy)
    return True

def validate_candidate_identity(plan, basis, prebuild=False):
    release_path = Path(basis.get('release', ''))
    if not release_path.is_dir():
        raise ValueError('Candidate release directory does not exist: ' + str(release_path))

    # 1. Verify data pointers (pages, records, history)
    pointers = [
        ('pagePointer', 'data/public-v6-pages'),
        ('recordPointer', 'data/public-v6-records'),
        ('historyPointer', 'data/public-v6-history'),
    ]
    for key, rel_subdir in pointers:
        expected = basis.get(key)
        if not expected or not expected.get('path') or not expected.get('sha256'):
            raise ValueError(f'Missing or malformed {key} in basis')
        current_file = release_path / rel_subdir / 'current.json'
        if not current_file.is_file():
            raise ValueError(f'Missing {current_file}')
        current_data = json.loads(current_file.read_text())
        if current_data.get('path') != expected['path'] or current_data.get('sha256') != expected['sha256']:
            raise ValueError(f'Pointer {key} in current.json differs from basis: {current_data.get("sha256")} != {expected["sha256"]}')
        target_revision = release_path / rel_subdir / expected['path']
        if target_revision.is_file():
            if digest(target_revision) != expected['sha256']:
                raise ValueError(f'Revision file hash mismatch for {key}: {digest(target_revision)} != {expected["sha256"]}')
        else:
            idx_file = release_path / rel_subdir / 'sharded/index.json'
            if not idx_file.is_file():
                raise ValueError(f'Revision file missing and no sharded index for {key}: {target_revision}')
            idx_data = json.loads(idx_file.read_text())
            rev_id = current_data.get('releaseId') or current_data.get('revision') or current_data.get('basisRevision')
            rev_entry = idx_data.get('revisions', {}).get(rev_id)
            if not rev_entry or rev_entry.get('sourceSha256') != expected['sha256']:
                raise ValueError(f'Sharded index missing or sourceSha256 mismatch for {key}: {rev_id}')
            sharded_file = release_path / rel_subdir / rev_entry['path']
            if not sharded_file.is_file() or digest(sharded_file) != rev_entry['sha256']:
                raise ValueError(f'Sharded revision file missing or hash mismatch for {key}: {sharded_file}')

    # 2. Verify source manifest & codeSha
    if basis.get('sourceManifestSha256'):
        source_manifest_path = None
        candidates = [
            release_path / 'source-manifest.json',
            Path(plan['basis']['path']).parent / 'source-manifest.json',
            Path(plan['basis']['path']).parent / 'raw/source-manifest.json',
            Path(plan['basis']['path']).parents[1] / 'source-manifest.json',
        ]
        for p in candidates:
            if p.is_file():
                source_manifest_path = p
                break
        if not source_manifest_path or digest(source_manifest_path) != basis['sourceManifestSha256']:
            raise ValueError('Source manifest missing or hash does not match basis.sourceManifestSha256')
        manifest_data = json.loads(source_manifest_path.read_text())
        if manifest_data.get('codeSha') != basis.get('codeSha'):
            raise ValueError(f'Source manifest codeSha ({manifest_data.get("codeSha")}) != basis codeSha ({basis.get("codeSha")})')
        for entry in manifest_data.get('files', [])[:50]:
            f_path = release_path / entry['path']
            if not (f_path.is_file() or f_path.is_symlink()):
                raise ValueError(f'Tracked file missing from release: {entry["path"]}')
            if entry.get('sha256') and f_path.is_file() and digest(f_path) != entry['sha256']:
                raise ValueError(f'Tracked file content hash mismatch in release: {entry["path"]}')

    if prebuild:
        return True

    # 3. Verify BUILD_ID in candidate directory
    build_id = basis.get('BUILD_ID')
    if not build_id:
        raise ValueError('Missing BUILD_ID in basis')
    build_id_candidates = [
        release_path / 'apps/tulsa-zone/.next/BUILD_ID',
        release_path / 'apps/web/.next/BUILD_ID',
        release_path / '.next/BUILD_ID',
    ]
    found_build_id = None
    for bp in build_id_candidates:
        if bp.is_file():
            found_build_id = bp.read_text().strip()
            break
    if not found_build_id or found_build_id != build_id:
        raise ValueError(f'Candidate BUILD_ID ({found_build_id}) does not match basis ({build_id})')

    # 4. Verify build artifact manifest if present
    if basis.get('buildArtifactSha256'):
        build_manifest_path = None
        for p in [
            release_path / 'build-artifact-manifest.json',
            Path(plan['basis']['path']).parent / 'build-artifact-manifest.json',
            Path(plan['basis']['path']).parent / 'raw/server/build-artifact-manifest.json',
            Path(plan['basis']['path']).parents[1] / 'build-artifact-manifest.json',
        ]:
            if p.is_file():
                build_manifest_path = p
                break
        if not build_manifest_path or digest(build_manifest_path) != basis['buildArtifactSha256']:
            raise ValueError('Build artifact manifest missing or hash does not match basis.buildArtifactSha256')
        bm = json.loads(build_manifest_path.read_text())
        if bm.get('BUILD_ID') != build_id:
            raise ValueError(f'Build artifact manifest BUILD_ID ({bm.get("BUILD_ID")}) does not match basis ({build_id})')

    # 5. Verify MCP catalog if present
    if basis.get('mcpCatalogSha256'):
        mcp_catalog_path = None
        for p in [
            release_path / 'mcp-catalog.json',
            Path(plan['basis']['path']).parent / 'mcp-catalog.json',
            Path(plan['basis']['path']).parent / 'raw/mcp-catalog.json',
            Path(plan['basis']['path']).parents[1] / 'mcp-catalog.json',
        ]:
            if p.is_file():
                mcp_catalog_path = p
                break
        if not mcp_catalog_path or digest(mcp_catalog_path) != basis['mcpCatalogSha256']:
            raise ValueError('MCP catalog missing or hash does not match basis.mcpCatalogSha256')

    # 6. Verify candidate services, working directories, active state, and PIDs
    candidate_units = plan.get('candidateUnits', [])
    for unit in candidate_units:
        s = state(unit)
        if s.get('ActiveState') != 'active':
            raise ValueError(f'Candidate unit {unit} is not active ({s.get("ActiveState")})')
        main_pid = s.get('MainPID')
        if not main_pid or not main_pid.isdigit() or int(main_pid) <= 0:
            raise ValueError(f'Candidate unit {unit} has invalid MainPID: {main_pid}')
        if not s.get('InvocationID'):
            raise ValueError(f'Candidate unit {unit} missing InvocationID')
        wd = s.get('WorkingDirectory')
        if not wd or (Path(wd).resolve() != release_path.resolve() and release_path.resolve() not in Path(wd).resolve().parents):
            raise ValueError(f'Candidate unit {unit} WorkingDirectory ({wd}) is not within release ({release_path})')

    return True

def validate_capacity(plan, capacity, prebuild=False, basis=None):
    if isinstance(prebuild, dict) and basis is None:
        basis = prebuild
        prebuild = False
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
    if basis and capacity.get('BUILD_ID') and capacity['BUILD_ID'] != basis.get('BUILD_ID'):
        raise ValueError(f'Capacity receipt BUILD_ID ({capacity["BUILD_ID"]}) does not match basis ({basis.get("BUILD_ID")})')
    if capacity.get('invocationIds'):
        for u in plan.get('candidateUnits', []):
            if u in capacity['invocationIds']:
                s = state(u)
                if s.get('InvocationID') != capacity['invocationIds'][u]:
                    raise ValueError(f'Candidate unit {u} InvocationID changed since sampling: {s.get("InvocationID")} != {capacity["invocationIds"][u]}')
    if capacity.get('mainPids'):
        for u in plan.get('candidateUnits', []):
            if u in capacity['mainPids']:
                s = state(u)
                if s.get('MainPID') != str(capacity['mainPids'][u]):
                    raise ValueError(f'Candidate unit {u} MainPID changed since sampling: {s.get("MainPID")} != {capacity["mainPids"][u]}')

def load_plan(path, prebuild=False):
    path = Path(path).resolve(); plan = json.loads(path.read_text()); policy = json.loads(POLICY.read_text()); policy['_sha256'] = digest(POLICY)
    validate_plan(plan, policy, audit())
    if policy.get('retentionEnforcement'):
        checkpoint_hold_clocks(json.loads(Path(plan['retentionReceipt']['path']).read_text()), policy)
    for unit in plan['candidateUnits']:
        limits = state(unit)
        if limits.get('MemoryHigh') in [None, 'infinity'] or limits.get('MemoryMax') in [None, 'infinity']: raise ValueError('Candidate limits must be installed before admission')
    # Frozen artifact files are immutable; a checksum is not semantic acceptance.
    if digest(plan['releaseHelper']) != plan['releaseHelperSha256']: raise ValueError('Changed release helper')
    for key in ['basis', 'syncLedger', 'staticArchiveReceipt', 'capacityReceipt']:
        proof = plan[key]
        if digest(proof['path']) != proof['sha256']: raise ValueError('Changed ' + key)
    basis = json.loads(Path(plan['basis']['path']).read_text())
    validate_candidate_identity(plan, basis, prebuild=prebuild)
    capacity = json.loads(Path(plan['capacityReceipt']['path']).read_text())
    validate_capacity(plan, capacity, prebuild=prebuild, basis=basis)
    if policy.get('diskCapacity'):
        current = audit()
        validate_disk_budget(plan, policy, current)
        validate_retention_receipt(plan, current, policy)
        actual_bytes = int(run('du', '-sx', '-B1', str(Path(basis['release']).resolve())).split()[0])
        if actual_bytes > plan['diskBudget']['artifactMaxBytes']: raise ValueError('Actual release artifact exceeds the declared per-role budget')
    return plan, policy

def check_urls(checks):
    if not checks: raise ValueError('No checks')
    results = []
    for check in checks:
        url = check['url']
        if not url.startswith(('http://127.0.0.1:', 'https://eduaipolicy.org/')): raise ValueError('Outside allowed readback origin')
        if not check.get('contains') and not check.get('sha256'): raise ValueError('HTTP 200 alone is not acceptance')
        attempts = []
        # nginx reload is graceful: established edge connections can briefly reach
        # the previous worker. Retry the identical semantic check, never weaken it.
        for attempt in range(4):
            try:
                body = subprocess.check_output(['curl', '-fLsS', '--max-time', '45', url])
                observed = hashlib.sha256(body).hexdigest()
                if any(text.encode() not in body for text in check.get('contains', [])):
                    raise ValueError('Readback missing required text: ' + url + ' body=' + observed)
                if check.get('sha256') and observed != check['sha256']: raise ValueError('Readback hash differs: ' + url)
                results.append({'url': url, 'sha256': observed, 'previousAttempts': attempts})
                break
            except (subprocess.CalledProcessError, ValueError) as error:
                attempts.append({'attempt': attempt + 1, 'error': str(error), 'at': now()})
                if attempt == 3: raise
                time.sleep(attempt + 1)
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
    parser.add_argument('action', choices=['audit', 'retention', 'record-retention', 'prebuild', 'gate', 'cutover', 'complete', 'recover', 'expire'])
    parser.add_argument('plan', nargs='?'); parser.add_argument('--boot', action='store_true'); parser.add_argument('--completion-ledger'); args = parser.parse_args()
    LOCK.parent.mkdir(parents=True, exist_ok=True)
    with LOCK.open('w') as lock:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        if args.action == 'audit': print(json.dumps(audit(), indent=2)); return
        if args.action in ['retention', 'record-retention']:
            policy = json.loads(POLICY.read_text()); register = Path(policy['retentionRegister'])
            receipt = json.loads(register.read_text())
            plan = {'basis': {'sha256': receipt['basisSha256']}, 'retentionReceipt': {'path': str(register), 'sha256': digest(register)}}
            validate_retention_receipt(plan, audit(), policy)
            if args.action == 'record-retention': checkpoint_hold_clocks(receipt, policy)
            print('Retention passed; no expired holds or unclassified temporary artifacts'); return
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
            basis = json.loads(Path(plan['basis']['path']).read_text())
            validate_candidate_identity(plan, basis, prebuild=False)
            event = json.loads(Path(args.completion_ledger).read_text())
            if event.get('basisSha256') != plan['basis']['sha256']:
                raise ValueError('Completion ledger basisSha256 does not match plan.basis.sha256')
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
            basis = json.loads(Path(plan['basis']['path']).read_text())
            validate_candidate_identity(plan, basis, prebuild=False)
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
