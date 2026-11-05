#!/usr/bin/env python3
"""Host-side release admission and crash-recoverable routing selection.
No build, install, deletion, or policy approval. See docs/release-lifecycle.md.
"""
import argparse, concurrent.futures, datetime, email.utils, fcntl, hashlib, http.client, json, os, re, shutil, socket, ssl, subprocess, sys, time, urllib.error, urllib.request
from pathlib import Path
STATE = Path('/srv/uapt/operations/release-lifecycle')
POLICY = Path('/srv/uapt/operations/release-lifecycle/policy.json')
LOCK = Path('/run/lock/uapt-release.lock')
STATIC_CONFIGS = {
    '/etc/nginx/snippets/uapt-two-0a468b3-static.conf',
    '/etc/nginx/snippets/uapt-changes-77182af-static.conf',
    '/etc/nginx/snippets/uapt-imperial-c7275d4-static.conf',
    '/etc/nginx/snippets/uapt-imperial-b466afa-static.conf',
    '/etc/nginx/snippets/uapt-mit-803e4e3-static-fallbacks.conf',
    '/etc/nginx/snippets/uapt-v5-static-legacy-fallbacks-1af9e1f.conf',
    '/etc/nginx/snippets/uapt-v6-cef6184-live.conf',
}
STATIC_ROOTS = {
    'uapt-identity-d1add86', 'uapt-policy-0a468b3', 'uapt-policy-77182af',
    'uapt-policy-b466afa', 'uapt-policy-c7275d4', 'uapt-v5-zone-b-1af9e1f',
    'uapt-v5-zone-b-46ac2ce', 'uapt-v6-cef6184',
}
STATIC_DEST_ROOT = Path('/srv/uapt/static/controlled/uapt-held-static-20261102')
STATIC_EXPECTED_ALIASES = 1175
STATIC_RECEIPT_MAX_BYTES_PER_ASSET = 4096
STATIC_RECEIPT_PHASES = 4
STATIC_ORIGIN_CONTEXT_MAX_BYTES = 16384
STATIC_ORIGIN_VHOST = '/etc/nginx/sites-enabled/uapt-eduaipolicy.org.conf'
STATIC_ORIGIN_PARENT = '/etc/nginx/snippets/uapt-proxy-locations.conf'
STATIC_ORIGIN_CERT = '/etc/ssl/certs/eduaipolicy.org-selfsigned.pem'
STATIC_PREVIEW_DIRECTIVES = (
    'charset utf-8;', 'gzip on;', 'gzip_vary on;', 'gzip_proxied any;', 'gzip_comp_level 5;', 'gzip_min_length 256;',
    'gzip_types text/plain text/css text/javascript application/javascript application/json application/xml image/svg+xml font/woff2;',
)
STATIC_SECURITY_HEADERS = ('content-security-policy', 'x-frame-options', 'strict-transport-security', 'referrer-policy')
STATIC_HEADERS = ('content-type', 'cache-control', 'etag', 'last-modified', 'content-encoding', 'vary', 'x-content-type-options') + STATIC_SECURITY_HEADERS
DISCOVERY_SCOPE = 'discovery-prefix-v1'
DISCOVERY_ROOT = 'uapt-discovery-ba543052'
DISCOVERY_CONFIG = '/etc/nginx/snippets/uapt-shared-v6-0b969275-live.conf'
DISCOVERY_URL_PREFIX = '/assets/university-marks/20261020-compact/'
DISCOVERY_SOURCE_BASE = Path('/srv/uapt/releases')/DISCOVERY_ROOT/'apps/tulsa-zone/public/assets/university-marks/20261020-compact'
DISCOVERY_DEST_BASE = STATIC_DEST_ROOT/DISCOVERY_ROOT/'university-marks/20261020-compact'
class _NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl): return None
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

def retention_blocking_deadline(entry, guard):
    """Keep the original review clock; allow a separately bounded handling window."""
    hours = guard.get('blockAfterHours', 0)
    if type(hours) is not int or not 0 <= hours <= guard['maxHoldHours']:
        raise ValueError('Invalid retention blocking window')
    review = retention_timestamp(entry.get('reviewBefore'), 'reviewBefore')
    since = retention_timestamp(entry.get('heldSince'), 'heldSince')
    return max(review, since + datetime.timedelta(hours=hours))

def authorized_retention_deferral(receipt, policy, entry, current):
    """Explicit, exact-basis operations exception; original hold clocks never change."""
    exception = policy.get('retentionEnforcement', {}).get('releaseDeferral')
    if not exception: return False
    approved = retention_timestamp(exception.get('approvedAt'), 'deferral approvedAt')
    expires = retention_timestamp(exception.get('expiresAt'), 'deferral expiresAt')
    if exception.get('schemaVersion') != 'uapt-retention-release-deferral-v1' or not exception.get('authorization') or not exception.get('nextAction') or expires <= current or approved > current + datetime.timedelta(minutes=5) or expires <= approved or expires - approved > datetime.timedelta(hours=24):
        raise ValueError('Invalid or expired explicit retention deferral')
    if receipt.get('basisSha256') != exception.get('basisSha256'): return False
    key = 'path' if 'path' in entry else 'name'
    row = next((item for item in exception.get('holds', []) if item.get(key) == entry.get(key)), None)
    return bool(row and row.get('heldSince') == entry.get('heldSince') and row.get('reviewBefore') == entry.get('reviewBefore'))

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
                if retention_blocking_deadline(prior, guard) <= current and not authorized_retention_deferral(receipt, policy, prior, current): raise ValueError('Expired registered hold; archive or resolve dependency before release: ' + identity)
                if entry.get('disposition') != 'held':
                    # A fresh name/classification cannot hide old archive debt.
                    if key == 'path' or entry.get('disposition') != 'active' or identity not in runtime_roots:
                        raise ValueError('Held artifact reclassified without an actual active runtime: ' + identity)
            if entry.get('disposition') != 'held': continue
            since = retention_timestamp(entry.get('heldSince'), 'heldSince')
            deadline = retention_timestamp(entry.get('reviewBefore'), 'reviewBefore')
            if not entry.get('nextAction') or since > checked + datetime.timedelta(minutes=5) or deadline <= since or deadline - since > limit:
                raise ValueError('Missing or unbounded hold action/deadline: ' + identity)
            if retention_blocking_deadline(entry, guard) <= current and not authorized_retention_deferral(receipt, policy, entry, current): raise ValueError('Expired hold; archive or resolve dependency before release: ' + identity)
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
def validate_r4_reuse_authorization(plan, policy):
    """One operator-authorized exception retaining the existing 3163 dependency."""
    ref = plan.get('operatorAuthorization') or {}
    try:
        if not re.fullmatch(r'[0-9a-f]{64}', ref.get('sha256', '')) or digest(ref['path']) != ref['sha256']:
            raise ValueError('authorization hash mismatch')
        auth = json.loads(Path(ref['path']).read_text())
        basis_ref = plan['basis']
        if digest(basis_ref['path']) != basis_ref['sha256']: raise ValueError('basis hash mismatch')
        basis = json.loads(Path(basis_ref['path']).read_text())
        current = datetime.datetime.now(datetime.timezone.utc)
        issued = datetime.datetime.fromisoformat(auth['issuedAt'].replace('Z', '+00:00'))
        expires = datetime.datetime.fromisoformat(auth['expiresAt'].replace('Z', '+00:00'))
        plan_expiry = datetime.datetime.fromisoformat(plan['expiresAt'].replace('Z', '+00:00'))
        if any(t.tzinfo is None for t in (issued, expires, plan_expiry)) or not issued <= current < expires or expires - issued > datetime.timedelta(hours=24) or plan_expiry > expires:
            raise ValueError('authorization expired or exceeds its bounded window')
        code = 'f4e7c1277ba460aaf9919a6a088d9612870ce926'
        build = '4bCh6d8DfW5AO0c96DBsW'
        active = {'uapt-web.service', 'uapt-shared-v6-candidate.service', 'uapt-shared-v6-r2.service'}
        if (auth.get('schemaVersion') != 'uapt-r4-reuse-authorization-v1' or
            plan.get('id') not in ['reuse-r4-20261102','reuse-r4-20261102-r2'] or auth.get('planId') != plan['id'] or
            auth.get('basisSha256') != basis_ref['sha256'] or
            auth.get('codeSha') != code or basis.get('codeSha') != code or
            auth.get('BUILD_ID') != build or basis.get('BUILD_ID') != build or
            auth.get('retainedCompatibilityUnit') != {'unit': 'uapt-shared-v6-candidate.service', 'endpoint': '127.0.0.1:3163'} or
            not isinstance(auth.get('boundedAcceptance'), str) or not auth['boundedAcceptance'].strip() or
            not isinstance(auth.get('acceptedKnownIssues'), list) or not auth['acceptedKnownIssues'] or
            any(not isinstance(x, str) or not x.strip() for x in auth['acceptedKnownIssues']) or
            len(policy['activeUnits']) != 3 or set(policy['activeUnits']) != active or
            len(plan.get('keepActiveUnits', [])) != 3 or set(plan['keepActiveUnits']) != active or
            plan.get('candidateUnits') != ['uapt-mcp-v6-candidate.service'] or
            plan.get('candidateEndpoints') != {'uapt-mcp-v6-candidate.service': ['127.0.0.1:3101']} or
            plan.get('retireUnits') != [] or plan.get('retiredEndpoints') != []):
            raise ValueError('authorization scope mismatch')
    except (OSError, KeyError, TypeError, ValueError) as error:
        raise ValueError('Invalid R4 reuse operator authorization: ' + str(error)) from error
    return True

def validate_plan(plan, policy, observed, prebuild=False):
    """Pure admission check; called again under the same lock immediately before routing."""
    if plan.get('schemaVersion') != 'uapt-release-lifecycle-plan-v1': raise ValueError('Wrong lifecycle plan schema')
    if plan.get('policySha256') != policy['_sha256']: raise ValueError('Policy changed; reprepare plan')
    if plan.get('expiresAt', '') <= now(): raise ValueError('Plan expired')
    expiry = datetime.datetime.fromisoformat(plan['expiresAt'])
    # Build deadlines remain four hours. Only future runtime candidate plans use
    # the explicitly installed bounded window; static plans have their own guard.
    candidate_hours = policy.get('candidateTtlHours', 4)
    if type(candidate_hours) is not int or candidate_hours not in (4, 8):
        raise ValueError('Candidate lifetime must be the configured four or eight hours')
    configured_seconds = policy.get('fixedReleaseProfile', {}).get('candidate', {}).get('maximumLifetimeSeconds')
    if configured_seconds is not None and (type(configured_seconds) is not int or configured_seconds != candidate_hours * 3600):
        raise ValueError('Candidate lifetime policy/profile mismatch')
    plan_hours = 4 if prebuild else candidate_hours
    if expiry.tzinfo is None or expiry > datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(hours=plan_hours):
        raise ValueError('Plan lifetime exceeds configured ' + str(plan_hours) + ' hours')
    candidates = plan.get('candidateUnits', [])
    if not candidates or len(candidates) > 2 or len(set(candidates)) != len(candidates): raise ValueError('Require one bounded candidate pair at most')
    if not set(candidates) <= set(policy['candidateSlots']): raise ValueError('Use fixed candidate slots; per-release/per-school units forbidden')
    allowed = set(policy['activeUnits']) | set(policy['legacyUnits']) | set(candidates)
    if set(observed['units']) - allowed: raise ValueError('Unregistered running service; retire or explicitly review it first')
    if set(observed['units']) - set(candidates) != set(policy['activeUnits']) | set(policy['legacyUnits']): raise ValueError('Expected active/legacy service set changed')
    budget = plan.get('candidatePeakBytes')
    if type(budget) is not int or budget <= 0 or budget > policy['candidatePeakMaxBytes']: raise ValueError('Invalid measured candidate peak budget')
    # The command supplies prebuild; plan JSON cannot select its own admission phase.
    if 'buildPeakMaxBytes' in policy:
        build_budget = plan.get('buildPeakBytes')
        if type(build_budget) is not int or build_budget <= 0 or build_budget > policy['buildPeakMaxBytes']:
            raise ValueError('Invalid separate build peak budget')
        if prebuild:
            if any(unit in observed['units'] for unit in candidates): raise ValueError('Build admission requires cold candidate slots')
            budget = build_budget
    elif 'buildPeakBytes' in plan:
        raise ValueError('Separate build budget requires policy buildPeakMaxBytes')
    # Build reserves its full independent peak. Runtime reserves only unoccupied
    # candidate headroom; neither phase credits memory from future retirement.
    used = 0 if prebuild and 'buildPeakMaxBytes' in policy else sum(int(observed['units'].get(u, {}).get('MemoryCurrent', 0)) for u in candidates)
    additional = max(0, budget - used)
    if observed['memory']['MemAvailable'] - additional < policy['hostReserveBytes']: raise ValueError('Insufficient host reserve for ' + ('build peak' if prebuild else 'runtime coexistence'))
    if observed['uaptMemoryBytes'] + additional > policy['uaptPeakMaxBytes']: raise ValueError('UAPT aggregate peak budget exceeded')
    for unit, s in observed['units'].items():
        if s['MemoryHigh'] == 'infinity' or s['MemoryMax'] == 'infinity': raise ValueError('Missing resource limits: ' + unit)
    reuse = plan.get('retireUnits') == [] and plan.get('retiredEndpoints') == []
    if reuse: validate_r4_reuse_authorization(plan, policy)
    elif not plan.get('retireUnits') or not set(plan['retireUnits']) <= set(policy['activeUnits']): raise ValueError('Explicit previous active units must retire at completion')
    if set(plan['retireUnits']) & set(candidates): raise ValueError('Candidate cannot retire itself')
    if set(plan['retireUnits']) != set(policy['activeUnits']) - set(plan.get('keepActiveUnits', [])): raise ValueError('Specify the exact replacement set')
    if set(plan.get('candidateEndpoints', {})) != set(candidates) or any(not v for v in plan['candidateEndpoints'].values()): raise ValueError('Exact candidate endpoints required for cleanup')
    if not plan.get('routingFiles') or not plan.get('candidateChecks') or (not reuse and not plan.get('retiredEndpoints')): raise ValueError('Missing routing/candidate/retirement endpoint scope')
    if not plan.get('staticArchiveReceipt') or not plan.get('publicChecks'): raise ValueError('Static archive and exact public readback checks required')
    validate_disk_budget(plan, policy, observed)
    if policy.get('diskCapacity'): validate_retention_receipt(plan, observed, policy)
    return True

PROGRAM_BASIS_SCHEMA = 'uapt-program-release-basis-v1'
PROGRAM_ARTIFACT_SCHEMA = 'uapt-program-artifact-v1'
CONTENT_POINTER_SCHEMA = 'uapt-content-pointer-v1'

def validate_program_content_basis(release_path, basis):
    """A program artifact carries no content; its content basis is the runtime
    content pointer that the candidate will read (docs/content-release.md)."""
    for key in ['sourceManifestSha256', 'buildArtifactSha256']:
        if not basis.get(key): raise ValueError('Program artifact basis requires ' + key)
    for rel in ['data', 'staging']:
        if (release_path / rel).exists(): raise ValueError('Program artifact must not contain ' + rel + '/')
    manifest_path = release_path / 'build-artifact-manifest.json'
    if not manifest_path.is_file() or digest(manifest_path) != basis['buildArtifactSha256']:
        raise ValueError('Program build manifest missing or hash does not match basis.buildArtifactSha256')
    built = json.loads(manifest_path.read_text())
    if built.get('schemaVersion') != PROGRAM_ARTIFACT_SCHEMA or built.get('codeSha') != basis.get('codeSha'):
        raise ValueError('Program build manifest schema or codeSha does not match basis')
    if (built.get('contentFree') or {}).get('checkoutContentHeldOut') is not True:
        raise ValueError('Program artifact was not built from a content-free checkout')
    content = basis.get('contentRelease') or {}
    root, content_id, manifest_sha = Path(content.get('root', '')), content.get('contentId', ''), content.get('manifestSha256', '')
    if not root.is_absolute() or not root.is_dir(): raise ValueError('Content root missing: ' + str(root))
    if not re.fullmatch(r'[A-Za-z0-9][A-Za-z0-9._-]{0,127}', content_id): raise ValueError('Invalid contentId in basis')
    if not re.fullmatch(r'[0-9a-f]{64}', manifest_sha): raise ValueError('Invalid content manifestSha256 in basis')
    content_manifest = root / 'releases' / content_id / 'manifest.json'
    if not content_manifest.is_file() or digest(content_manifest) != manifest_sha:
        raise ValueError('Content release manifest missing or hash does not match basis')
    if json.loads(content_manifest.read_text()).get('contentId') != content_id:
        raise ValueError('Content release manifest names a different contentId')
    pointer = json.loads((root / 'current.json').read_text())
    if pointer.get('schemaVersion') != CONTENT_POINTER_SCHEMA or pointer.get('contentId') != content_id or pointer.get('manifestSha256') != manifest_sha:
        raise ValueError('Content pointer does not select the basis content release')
    # Local previews are never production content; a switch needs a sync receipt.
    if pointer.get('unsynchronizedLocalPreview') or not (pointer.get('sync') or {}).get('eventSha256'):
        raise ValueError('Content pointer has no synchronization receipt')

def validate_candidate_identity(plan, basis, prebuild=False):
    release_path = Path(basis.get('release', ''))
    if not release_path.is_dir():
        raise ValueError('Candidate release directory does not exist: ' + str(release_path))

    # 1. Verify the content basis: the runtime content pointer for a program
    # artifact, otherwise the data pointers (pages, records, history) in the tree.
    if basis.get('schemaVersion') == PROGRAM_BASIS_SCHEMA:
        validate_program_content_basis(release_path, basis)
    pointers = [] if basis.get('schemaVersion') == PROGRAM_BASIS_SCHEMA else [
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
        if not isinstance(budget, int) or budget <= 0 or budget > plan.get('buildPeakBytes', plan['candidatePeakBytes']) or capacity.get('buildScope') != 'uapt-build.scope':
            raise ValueError('Build must use the fixed scope within the admitted build budget')
        return
    peaks = capacity.get('peakBytesByStage', {})
    if not {'build', 'startup', 'cold_history', 'steady'} <= set(peaks) or any(not isinstance(v, int) or v <= 0 for v in peaks.values()):
        raise ValueError('Measured build/startup/cold-history/steady peak receipt required')
    if peaks['build'] > plan.get('buildPeakBytes', plan['candidatePeakBytes']): raise ValueError('Build budget understates measured build peak')
    if max(value for stage, value in peaks.items() if stage != 'build') > plan['candidatePeakBytes']: raise ValueError('Candidate budget understates measured runtime peak')
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
    validate_plan(plan, policy, audit(), prebuild=prebuild)
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

def _under(path, root):
    try: Path(path).resolve(strict=True).relative_to(Path(root).resolve(strict=True)); return True
    except (ValueError, FileNotFoundError): return False

def _reject_symlink_components(path, allow_missing=False):
    path = Path(path)
    current = Path(path.anchor)
    for part in path.parts[1:]:
        current = current / part
        if current.is_symlink(): raise ValueError('Symlink path component is forbidden: ' + str(current))
        if not current.exists() and not allow_missing: raise ValueError('Required path is missing: ' + str(current))

def _alias_lines(text):
    return re.findall(r'\balias\s+([^;]+);', text)

def _location_aliases(text):
    pattern=r'(?m)^\s*location\s+(?:(?P<modifier>=|~\*?|\^~)\s+)?(?P<url>[^\s{]+)\s*\{'
    rows=[]
    for match in re.finditer(pattern,text):
        end=text.find('}',match.end())
        if end<0: raise ValueError('Unclosed Nginx location block')
        aliases=re.findall(r'\balias\s+([^;]+);',text[match.end():end])
        if aliases: rows.append((match.group('modifier') or 'prefix-unspecified',match.group('url'),aliases[0]))
    return rows

def _without_alias_targets(text):
    return re.sub(r'(?m)(\balias\s+)[^;]+;', r'\1<ALIAS>;', text)

def _validate_static_snippet(original_text, staged_text, entries, target):
    before_locations=_location_aliases(original_text); after_locations=_location_aliases(staged_text)
    before_map={(modifier,url):alias for modifier,url,alias in before_locations}
    after_map={(modifier,url):alias for modifier,url,alias in after_locations}
    if len(before_map)!=len(before_locations) or len(after_map)!=len(after_locations) or set(before_map)!=set(after_map):
        raise ValueError('Location mapping changed or duplicated: '+target)
    if _alias_lines(original_text)!=[row[2] for row in before_locations] or _alias_lines(staged_text)!=[row[2] for row in after_locations]:
        raise ValueError('Alias parser did not account for every directive: '+target)
    expected={(a['locationModifier'],a['urlPath']):(a['sourcePath'],a['plannedDestination']) for a in entries}
    if len(expected)!=len(entries): raise ValueError('Duplicate manifest location: '+target)
    for key,(old,new) in expected.items():
        if before_map.get(key)!=old or after_map.get(key)!=new:
            raise ValueError('Exact URL/location alias mapping differs from manifest: '+str(key))
    for key in before_map:
        if key not in expected and before_map[key]!=after_map[key]:
            raise ValueError('Unlisted alias target changed: '+str(key))
    if _without_alias_targets(original_text) != _without_alias_targets(staged_text):
        raise ValueError('Non-alias config text changed: '+target)
    for asset in entries:
        if original_text.count('alias '+asset['sourcePath']+';') != 1 or staged_text.count('alias '+asset['plannedDestination']+';') != 1:
            raise ValueError('Alias replacement is not exact: '+asset['urlPath'])

def _nginx_config_blocks(output):
    blocks={}; current=None; lines=[]
    for line in output.splitlines():
        if line.startswith('# configuration file '):
            if current is not None: blocks[current]='\n'.join(lines)
            current=line[len('# configuration file '):].rstrip(':'); lines=[]
        elif current is not None: lines.append(line)
    if current is not None: blocks[current]='\n'.join(lines)
    return blocks

def _nginx_context_items(text):
    """Read direct statements/blocks only, without treating quoted braces as syntax."""
    statements=[]; blocks=[]; buffer=[]; depth=0; quote=None; escaped=False; comment=False; start=None; header=None
    for index,char in enumerate(text):
        if comment:
            if char=='\n': comment=False
            else: continue
        if escaped:
            escaped=False
            if depth==0: buffer.append(char)
            continue
        if char=='\\':
            escaped=True
            if depth==0: buffer.append(char)
            continue
        if quote:
            if char==quote: quote=None
            if depth==0: buffer.append(char)
            continue
        if char in ('"',"'"):
            quote=char
            if depth==0: buffer.append(char)
            continue
        if char=='#': comment=True; continue
        if char=='{':
            if depth==0: header=' '.join(''.join(buffer).split()); buffer=[]; start=index+1
            depth+=1
        elif char=='}':
            depth-=1
            if depth<0: raise ValueError('Unbalanced Nginx context')
            if depth==0: blocks.append((header,text[start:index])); buffer=[]
        elif depth==0:
            if char==';': statements.append(' '.join(''.join(buffer).split())+';'); buffer=[]
            else: buffer.append(char)
    if depth or quote or ''.join(buffer).strip(): raise ValueError('Incomplete Nginx context')
    return statements,blocks

def _static_origin_context(manifest):
    loaded=_nginx_config_blocks(run('nginx','-T'))
    required=[STATIC_ORIGIN_VHOST,STATIC_ORIGIN_PARENT,'/etc/nginx/nginx.conf','/etc/nginx/mime.types','/etc/nginx/snippets/clb-pro-security-headers.conf']
    if any(p not in loaded for p in required): raise ValueError('UAPT origin context is not fully loaded')
    _,vhost_blocks=_nginx_context_items(loaded[STATIC_ORIGIN_VHOST])
    servers=[body for head,body in vhost_blocks if head=='server']; tls=[]
    for body in servers:
        directives,_=_nginx_context_items(body)
        if [x for x in directives if x.startswith('server_name ')]!=['server_name eduaipolicy.org www.eduaipolicy.org;']:
            raise ValueError('Third-party or changed origin server_name')
        listens=[x for x in directives if x.startswith('listen ')]
        if any(' ssl' in x for x in listens): tls.append(directives)
    if len(servers)!=2 or len(tls)!=1: raise ValueError('Require one exact UAPT HTTPS server')
    if set(x for x in tls[0] if x.startswith('listen '))!={'listen 443 ssl http2;','listen [::]:443 ssl http2;'}:
        raise ValueError('Unexpected UAPT origin TLS listener')
    if [x for x in tls[0] if x.startswith('ssl_certificate ')]!=['ssl_certificate '+STATIC_ORIGIN_CERT+';'] or 'include '+STATIC_ORIGIN_PARENT+';' not in tls[0]:
        raise ValueError('UAPT origin certificate/parent include changed')
    def transport(statement):
        word=statement.split(' ',1)[0]
        return word.startswith(('gzip','charset','brotli')) or word in ['default_type','etag','expires']
    parent_statements,parent_blocks=_nginx_context_items(loaded[STATIC_ORIGIN_PARENT])
    if [x for x in parent_statements if transport(x)]!=list(STATIC_PREVIEW_DIRECTIVES): raise ValueError('Unknown or changed UAPT charset/gzip context')
    if any(transport(x) for x in tls[0]) or any(head.split(' ',1)[0] in ['types','charset_map'] for head,_ in parent_blocks):
        raise ValueError('Unmodeled UAPT transport context')
    _,global_blocks=_nginx_context_items(loaded['/etc/nginx/nginx.conf'])
    http=[body for head,body in global_blocks if head=='http']
    if len(http)!=1: raise ValueError('Expected one global HTTP context')
    global_statements,global_children=_nginx_context_items(http[0])
    if set(x for x in global_statements if transport(x))!={'default_type application/octet-stream;','gzip on;'} or 'include /etc/nginx/mime.types;' not in global_statements:
        raise ValueError('Unknown global MIME/gzip/charset context')
    if any(head.split(' ',1)[0] in ['types','charset_map'] for head,_ in global_children): raise ValueError('Unmodeled global MIME override')
    targets={x['path'] for x in manifest.get('configFiles',[])}
    expected={DISCOVERY_CONFIG} if manifest.get('scope')==DISCOVERY_SCOPE else STATIC_CONFIGS
    if targets!=expected: raise ValueError('Unexpected source snippet set for origin binding')
    visited=set(); pending=[STATIC_ORIGIN_PARENT]
    while pending:
        path=pending.pop()
        if path in visited: continue
        if path not in loaded: raise ValueError('Missing loaded UAPT include: '+path)
        visited.add(path); directives,_=_nginx_context_items(loaded[path])
        for item in directives:
            if not item.startswith('include '): continue
            child=item[len('include '):-1]
            if not child.startswith('/etc/nginx/snippets/uapt-') and child!='/etc/nginx/snippets/clb-pro-security-headers.conf':
                raise ValueError('Unknown or third-party UAPT context include')
            pending.append(child)
    if not targets<=visited: raise ValueError('Origin TLS server does not select every source snippet')
    files=[]
    for path in sorted(set(required)|visited):
        files.append({'path':path,'sha256':digest(path),'nginxTBlockSha256':hashlib.sha256(loaded[path].encode()).hexdigest()})
    pem=Path(STATIC_ORIGIN_CERT).read_text(); certificate=re.search(r'-----BEGIN CERTIFICATE-----.*?-----END CERTIFICATE-----',pem,re.S)
    if not certificate: raise ValueError('Origin leaf certificate missing')
    context={'schemaVersion':'uapt-static-origin-context-v1','connectHost':'127.0.0.1','port':443,'hostAndSni':'eduaipolicy.org',
            'certificateFile':STATIC_ORIGIN_CERT,'certificateFileSha256':digest(STATIC_ORIGIN_CERT),
            'certificateDerSha256':hashlib.sha256(ssl.PEM_cert_to_DER_cert(certificate.group(0))).hexdigest(),
            'contextFiles':files,'previewServerDirectives':list(STATIC_PREVIEW_DIRECTIVES),
            'previewContextSha256':hashlib.sha256('\n'.join(STATIC_PREVIEW_DIRECTIVES).encode()).hexdigest()}
    if len(json.dumps(context,indent=2).encode())>STATIC_ORIGIN_CONTEXT_MAX_BYTES: raise ValueError('Origin context exceeds bounded receipt/journal reserve')
    return context

def _expires_ttl(headers):
    date_value, expires_value = headers.get('date'), headers.get('expires')
    if not date_value or not expires_value: return None
    date = email.utils.parsedate_to_datetime(date_value)
    expires = email.utils.parsedate_to_datetime(expires_value)
    return (expires - date).total_seconds()

def _require_static_unexpired(plan):
    expiry=datetime.datetime.fromisoformat(plan['expiresAt'].replace('Z','+00:00'))
    if expiry.tzinfo is None or expiry <= datetime.datetime.now(datetime.timezone.utc):
        raise ValueError('Static plan expired during migration')

def _static_response_fact(url,status,headers,body):
    values = {key: headers.get(key) for key in ('content-type','cache-control','expires','date','etag','last-modified','content-encoding','vary','x-content-type-options','content-length')}
    for key in STATIC_SECURITY_HEADERS:
        all_values=headers.get_all(key,[])
        values[key]=', '.join(all_values) if all_values else None
    cache_tokens = {token.strip().lower() for token in (values.get('cache-control') or '').split(',')}
    return {'url':url,'status':status,'bodyBytes':len(body),'bodySha256':hashlib.sha256(body).hexdigest(),
            'headers':values,'noTransform':'no-transform' in cache_tokens,'expiresTtlSeconds':_expires_ttl(values)}

def _fetch_static(url):
    opener = urllib.request.build_opener(urllib.request.ProxyHandler({}),_NoRedirect())
    request = urllib.request.Request(url, headers={'Accept-Encoding': 'identity', 'User-Agent': 'uapt-static-migration/1'})
    try:
        with opener.open(request, timeout=30) as response:
            return _static_response_fact(url,response.status,response.headers,response.read())
    except urllib.error.HTTPError as error:
        return _static_response_fact(url,error.code,error.headers,error.read())

def _fetch_origin_static(path,context):
    if (context.get('schemaVersion')!='uapt-static-origin-context-v1' or context.get('connectHost')!='127.0.0.1' or context.get('port')!=443
            or context.get('hostAndSni')!='eduaipolicy.org' or context.get('certificateFile')!=STATIC_ORIGIN_CERT
            or not re.fullmatch('[0-9a-f]{64}',context.get('certificateDerSha256','')) or not path.startswith('/') or '?' in path or '#' in path):
        raise ValueError('Outside fixed authenticated loopback origin contract')
    tls=ssl.SSLContext(ssl.PROTOCOL_TLS_CLIENT); tls.check_hostname=False; tls.verify_mode=ssl.CERT_NONE
    class PinnedOrigin(http.client.HTTPConnection):
        def connect(self):
            raw=socket.create_connection(('127.0.0.1',443),timeout=30)
            self.sock=tls.wrap_socket(raw,server_hostname='eduaipolicy.org')
            if hashlib.sha256(self.sock.getpeercert(binary_form=True)).hexdigest()!=context['certificateDerSha256']:
                self.sock.close(); raise ValueError('Pinned UAPT origin leaf certificate mismatch')
    connection=PinnedOrigin('eduaipolicy.org',443,timeout=30)
    try:
        connection.request('GET',path,headers={'Host':'eduaipolicy.org','Accept-Encoding':'identity','User-Agent':'uapt-static-migration/1'})
        response=connection.getresponse()
        return _static_response_fact('https://eduaipolicy.org'+path,response.status,response.headers,response.read())
    finally: connection.close()

def _static_readback(assets, phase, baseline=None, origin='https://eduaipolicy.org'):
    if phase not in ('public-before','origin-before','preview','public-after'): raise ValueError('Invalid static readback phase')
    concurrency = 2
    def inspect(asset):
        row = _fetch_origin_static(asset['urlPath'],origin) if phase=='origin-before' else _fetch_static(origin+asset['urlPath'])
        row['urlPath'] = asset['urlPath']
        return row
    rows=[]; failures=[]
    with concurrent.futures.ThreadPoolExecutor(max_workers=concurrency) as pool:
        futures = {pool.submit(inspect, asset):asset for asset in assets}
        for future in concurrent.futures.as_completed(futures):
            asset = futures[future]
            try: row=future.result()
            except Exception as error:
                rows.append({'urlPath':asset['urlPath'],'error':str(error)}); failures.append({'urlPath':asset['urlPath'],'kind':'request_error'}); continue
            rows.append(row)
            if row['status'] != 200: failures.append({'urlPath':asset['urlPath'],'kind':'status','actual':row['status']})
            if row['bodyBytes'] != asset['sourceBytes'] or row['bodySha256'] != asset['sourceSha256']:
                failures.append({'urlPath':asset['urlPath'],'kind':'source_body_mismatch'})
            if row.get('headers',{}).get('content-security-policy') not in (None,''):
                failures.append({'urlPath':asset['urlPath'],'kind':'unexpected_uapt_content_security_policy'})
            if baseline is not None:
                old=baseline.get(asset['urlPath'])
                if not old: failures.append({'urlPath':asset['urlPath'],'kind':'missing_before'})
                else:
                    for key in ('status','bodyBytes','bodySha256','noTransform'):
                        if old.get(key) != row.get(key): failures.append({'urlPath':asset['urlPath'],'kind':'before_after_mismatch','field':key})
                    for key in STATIC_HEADERS:
                        if old.get('headers',{}).get(key) != row.get('headers',{}).get(key):
                            failures.append({'urlPath':asset['urlPath'],'kind':'before_after_mismatch','field':key})
                    old_ttl, new_ttl = old.get('expiresTtlSeconds'), row.get('expiresTtlSeconds')
                    if (old_ttl is None) != (new_ttl is None) or (old_ttl is not None and abs(old_ttl-new_ttl)>1):
                        failures.append({'urlPath':asset['urlPath'],'kind':'before_after_mismatch','field':'expiresTtlSeconds'})
    rows.sort(key=lambda item:item['urlPath'])
    return {'schemaVersion':'uapt-static-readback-v1','phase':phase,'checkedAt':now(),'concurrency':concurrency,
            'origin':origin,'redirectsFollowed':False,'assetCount':len(rows),'status':'PASS' if not failures and len(rows)==len(assets) else 'BLOCKED',
            'failures':failures,'responses':rows}

def _save_static_receipt(txdir, label, receipt):
    count=receipt.get('assetCount',0)
    if type(count) is not int or count<0 or len(json.dumps(receipt,indent=2).encode())>count*STATIC_RECEIPT_MAX_BYTES_PER_ASSET+STATIC_ORIGIN_CONTEXT_MAX_BYTES:
        raise ValueError('Static receipt exceeds declared per-asset/header/context budget')
    path=Path(txdir)/(label+'.json'); write(path,receipt)
    return {'path':str(path),'sha256':digest(path)}

def _discovery_location_block(text, expected_alias):
    pattern=r'(?m)^[ \t]*location\s+\^~\s+'+re.escape(DISCOVERY_URL_PREFIX)+r'\s*\{([^{}]*)\}'
    matches=list(re.finditer(pattern,text))
    if len(matches)!=1: raise ValueError('Require one exact discovery prefix location')
    body_pattern=(r'\s*alias\s+'+re.escape(expected_alias)+r'\s*;\s*'
                  r'add_header\s+Cache-Control\s+"public, max-age=31536000, immutable"\s+always\s*;\s*')
    if not re.fullmatch(body_pattern,matches[0].group(1)):
        raise ValueError('Discovery prefix alias or header body changed')
    return matches[0].group(0)

def _discovery_source_assets():
    _reject_symlink_components(DISCOVERY_SOURCE_BASE)
    if not DISCOVERY_SOURCE_BASE.is_dir(): raise ValueError('Discovery source must be the exact directory')
    assets=[]
    for directory, dirs, files in os.walk(DISCOVERY_SOURCE_BASE,followlinks=False):
        for name in sorted(dirs):
            child=Path(directory)/name
            if child.is_symlink() or not child.is_dir(): raise ValueError('Discovery source directory symlink or special file')
        for name in sorted(files):
            source=Path(directory)/name
            _reject_symlink_components(source)
            before=source.stat()
            import stat
            if not stat.S_ISREG(before.st_mode): raise ValueError('Discovery source must contain only regular files')
            if before.st_mode&0o7000: raise ValueError('Discovery source has special permission bits')
            relative=source.relative_to(DISCOVERY_SOURCE_BASE).as_posix()
            if not re.fullmatch(r'[A-Za-z0-9._/-]+',relative) or '..' in Path(relative).parts:
                raise ValueError('Unsupported discovery asset relative path')
            sha=digest(source); after=source.stat()
            if (before.st_dev,before.st_ino,before.st_size,before.st_mtime_ns,before.st_mode)!=(after.st_dev,after.st_ino,after.st_size,after.st_mtime_ns,after.st_mode):
                raise ValueError('Discovery source changed while hashing')
            url=DISCOVERY_URL_PREFIX+relative
            assets.append({'root':DISCOVERY_ROOT,'configFile':DISCOVERY_CONFIG,
                           'sourceKind':'discovery_mark','sourceBase':str(DISCOVERY_SOURCE_BASE),
                           'sourceRelativePath':relative,'sourcePath':str(source),
                           'sourceBytes':before.st_size,'sourceSha256':sha,
                           'sourceMode':format(before.st_mode&0o7777,'04o'),'sourceMtimeNs':before.st_mtime_ns,
                           'sourceIsSymlink':False,'destinationExistsAtFreeze':False,
                           'plannedDestination':str(DISCOVERY_DEST_BASE/relative),
                           'urlPath':url,'absoluteUrl':'https://eduaipolicy.org'+url})
    if not assets: raise ValueError('Discovery prefix may not be an empty directory')
    return sorted(assets,key=lambda a:a['urlPath'])

def _build_discovery_inventory():
    _reject_symlink_components(Path(DISCOVERY_CONFIG))
    original=Path(DISCOVERY_CONFIG).read_text()
    _discovery_location_block(original,str(DISCOVERY_SOURCE_BASE)+'/')
    original_sha=hashlib.sha256(original.encode()).hexdigest()
    loaded=_nginx_config_blocks(run('nginx','-T'))
    if DISCOVERY_CONFIG not in loaded: raise ValueError('Discovery snippet is not loaded by Nginx')
    # Exact or longer prefix locations would defeat a directory-prefix preview.
    for text in loaded.values():
        for match in re.finditer(r'(?m)^\s*location\s+(?:(=|~\*?|\^~)\s+)?([^\s{]+)\s*\{',text):
            if match.group(2).startswith(DISCOVERY_URL_PREFIX) and match.group(2)!=DISCOVERY_URL_PREFIX:
                raise ValueError('Discovery prefix has an overriding child location')
    _reject_symlink_components(DISCOVERY_DEST_BASE,allow_missing=True)
    if os.path.lexists(DISCOVERY_DEST_BASE): raise ValueError('Discovery destination already exists')
    assets=_discovery_source_assets()
    for asset in assets:
        _reject_symlink_components(Path(asset['plannedDestination']),allow_missing=True)
    if digest(DISCOVERY_CONFIG)!=original_sha: raise ValueError('Discovery config changed while freezing')
    return {'schemaVersion':'uapt-static-alias-inventory-v1','scope':DISCOVERY_SCOPE,
            'status':'READY_FOR_REVIEW','readOnly':True,'productionWritesPerformed':False,
            'controlledDestinationRoot':str(STATIC_DEST_ROOT),
            'configFiles':[{'path':DISCOVERY_CONFIG,'sha256':digest(DISCOVERY_CONFIG),
                            'nginxTBlockSha256':hashlib.sha256(loaded[DISCOVERY_CONFIG].encode()).hexdigest(),'loadedByNginxT':True}],
            'directoryAlias':{'sourcePath':str(DISCOVERY_SOURCE_BASE)+'/',
                              'plannedDestination':str(DISCOVERY_DEST_BASE)+'/',
                              'urlPath':DISCOVERY_URL_PREFIX,'locationModifier':'^~'},
            'assets':assets}

def _validate_discovery_static_plan(plan,manifest):
    # Re-enumeration rejects omissions, added files, source/config drift and links.
    if manifest!=_build_discovery_inventory(): raise ValueError('Discovery frozen inventory changed or incomplete')
    staged=plan.get('stagedConfigs',[])
    if len(staged)!=1 or staged[0].get('target')!=DISCOVERY_CONFIG:
        raise ValueError('Discovery may stage only its exact one snippet')
    item=staged[0]; target=Path(DISCOVERY_CONFIG); path=Path(item.get('path',''))
    if not path.is_absolute() or '..' in path.parts: raise ValueError('Invalid discovery staged snippet path')
    _reject_symlink_components(path)
    if not _under(path,STATE/'static-migration-plans'): raise ValueError('Discovery staged snippet outside lifecycle plans')
    meta=manifest['configFiles'][0]
    if item.get('beforeSha256')!=meta['sha256'] or digest(target)!=meta['sha256'] or digest(path)!=item.get('sha256'):
        raise ValueError('Discovery staged or live config hash changed')
    original=target.read_text(); rendered=path.read_text()
    _validate_static_snippet(original,rendered,[manifest['directoryAlias']],DISCOVERY_CONFIG)
    _discovery_location_block(rendered,str(DISCOVERY_DEST_BASE)+'/')
    expected=sum(a['sourceBytes'] for a in manifest['assets'])+target.stat().st_size+len(manifest['assets'])*STATIC_RECEIPT_MAX_BYTES_PER_ASSET*STATIC_RECEIPT_PHASES+65536
    if type(plan.get('incrementalBudgetBytes')) is not int or plan['incrementalBudgetBytes']!=expected:
        raise ValueError('Discovery incremental budget mismatch')
    return manifest

def _validate_static_plan(plan, policy):
    if plan.get('kind') != 'static' or plan.get('schemaVersion') != 'uapt-static-migration-plan-v1':
        raise ValueError('Static action requires kind=static and uapt-static-migration-plan-v1')
    if plan.get('policySha256') != policy['_sha256']: raise ValueError('Policy changed; reprepare static plan')
    if not re.fullmatch(r'static-[a-z0-9][a-z0-9-]{0,72}',plan.get('id','')): raise ValueError('Invalid static transaction identity')
    expiry=datetime.datetime.fromisoformat(plan['expiresAt'].replace('Z','+00:00'))
    current=datetime.datetime.now(datetime.timezone.utc)
    if expiry.tzinfo is None or expiry <= current or expiry > current+datetime.timedelta(hours=4): raise ValueError('Static plan must be unexpired and no longer than four hours')
    proof=plan.get('manifest',{})
    manifest_path=Path(proof.get('path',''))
    plans_root=STATE/'static-migration-plans'
    if not manifest_path.is_absolute() or '..' in manifest_path.parts: raise ValueError('Static manifest path must be absolute and traversal-free')
    _reject_symlink_components(manifest_path)
    if not _under(manifest_path,plans_root) or digest(manifest_path) != proof.get('sha256'): raise ValueError('Static manifest path/hash invalid')
    manifest=json.loads(manifest_path.read_text())
    if manifest.get('schemaVersion') != 'uapt-static-alias-inventory-v1' or manifest.get('status') != 'READY_FOR_REVIEW' or manifest.get('readOnly') is not True or manifest.get('productionWritesPerformed') is not False:
        raise ValueError('Static inventory is not a frozen read-only complete manifest')
    if plan.get('originContext')!=_static_origin_context(manifest): raise ValueError('Frozen UAPT origin/preview context changed or missing')
    if manifest.get('scope')==DISCOVERY_SCOPE:
        return _validate_discovery_static_plan(plan,manifest)
    if manifest.get('scope') is not None: raise ValueError('Unknown static migration scope')
    if manifest.get('controlledDestinationRoot') != str(STATIC_DEST_ROOT): raise ValueError('Unexpected static destination root')
    assets=manifest.get('assets',[])
    if len(assets) != STATIC_EXPECTED_ALIASES: raise ValueError('Expected exactly 1,175 manifest assets')
    urls=[item.get('urlPath') for item in assets]; dests=[item.get('plannedDestination') for item in assets]
    if None in urls or len(set(urls)) != len(urls): raise ValueError('Duplicate or missing static URL')
    if None in dests or len(set(dests)) != len(dests): raise ValueError('Duplicate or missing static destination')
    if len(manifest.get('configFiles',[])) != len(STATIC_CONFIGS): raise ValueError('Static config inventory incomplete')
    config_meta={entry['path']:entry for entry in manifest['configFiles']}
    if set(config_meta) != STATIC_CONFIGS or any(not entry.get('loadedByNginxT') for entry in config_meta.values()): raise ValueError('Static config whitelist or nginx -T evidence mismatch')
    if manifest.get('parentInclude',{}).get('path') != '/etc/nginx/snippets/uapt-proxy-locations.conf' or not manifest['parentInclude'].get('loaded') or not manifest['parentInclude'].get('includesCefLiveSnippet'):
        raise ValueError('Loaded proxy parent include evidence missing')
    loaded=_nginx_config_blocks(run('nginx','-T'))
    for config in manifest['configFiles']+[manifest['parentInclude']]:
        path=config['path']; block=loaded.get(path)
        if block is None or hashlib.sha256(block.encode()).hexdigest()!=config.get('nginxTBlockSha256'):
            raise ValueError('Loaded Nginx config block changed or missing: '+path)
        if digest(path)!=config.get('sha256'): raise ValueError('Nginx config file hash changed: '+path)
    by_config={path:[] for path in STATIC_CONFIGS}
    source_total=0
    for asset in assets:
        root=asset.get('root'); config=asset.get('configFile'); source=Path(asset.get('sourcePath','')); dest=Path(asset.get('plannedDestination',''))
        if root not in STATIC_ROOTS or config not in STATIC_CONFIGS: raise ValueError('Static manifest path outside exact allowlist')
        expected_source_root=Path('/srv/uapt/releases')/root
        expected_dest=STATIC_DEST_ROOT/root/asset.get('sourceRelativePath','')
        relative=Path(asset.get('sourceRelativePath',''))
        source_base=Path(asset.get('sourceBase',''))
        expected_base=(expected_source_root/'apps/tulsa-zone/.next/static' if asset.get('sourceKind')=='next_static'
                       else expected_source_root/'apps/tulsa-zone/public/assets' if asset.get('sourceKind')=='public_asset' else None)
        if expected_base is None or source_base!=expected_base or relative.is_absolute() or not relative.parts or '..' in relative.parts or source!=source_base/relative:
            raise ValueError('Static source base/relative path mismatch')
        if not re.fullmatch(r'0[0-7]{3}',asset.get('sourceMode','')) or type(asset.get('sourceMtimeNs')) is not int:
            raise ValueError('Static source mode/mtime metadata missing')
        if not source.is_absolute() or '..' in source.parts or not _under(source,expected_source_root): raise ValueError('Static source outside named release root')
        if not dest.is_absolute() or '..' in dest.parts or dest != expected_dest: raise ValueError('Static destination path does not match controlled layout')
        _reject_symlink_components(source)
        if source.is_symlink() or not source.is_file() or asset.get('sourceIsSymlink') is not False: raise ValueError('Static source must be a regular non-symlink file')
        if digest(source) != asset.get('sourceSha256') or source.stat().st_size != asset.get('sourceBytes'): raise ValueError('Static source hash/size drift')
        if asset.get('destinationExistsAtFreeze') is not False: raise ValueError('Static destination was not absent at manifest freeze')
        _reject_symlink_components(dest,allow_missing=True)
        if os.path.lexists(dest): raise ValueError('Static destination collision: '+str(dest))
        if (not asset.get('urlPath','').startswith('/') or '..' in Path(asset['urlPath']).parts or '?' in asset['urlPath'] or '#' in asset['urlPath']
                or asset.get('absoluteUrl') != 'https://eduaipolicy.org'+asset['urlPath']):
            raise ValueError('Static public URL outside exact host/path contract')
        by_config[config].append(asset); source_total += asset['sourceBytes']
    staged=plan.get('stagedConfigs',[])
    if len(staged) != len(STATIC_CONFIGS) or {item.get('target') for item in staged} != STATIC_CONFIGS: raise ValueError('Must stage exactly seven allowlisted snippets')
    for item in staged:
        target=item['target']; original=Path(target); staged_path=Path(item.get('path','')); meta=config_meta[target]
        _reject_symlink_components(original); _reject_symlink_components(staged_path)
        if not staged_path.is_absolute() or '..' in staged_path.parts: raise ValueError('Staged config path must be absolute and traversal-free')
        if digest(original) != meta['sha256'] or item.get('beforeSha256') != meta['sha256']: raise ValueError('Live static snippet drift: '+target)
        if digest(staged_path) != item.get('sha256'): raise ValueError('Staged static snippet hash mismatch: '+target)
        if not _under(staged_path,plans_root): raise ValueError('Staged config must be inside static-migration-plans')
        original_text=original.read_text(); staged_text=staged_path.read_text()
        _validate_static_snippet(original_text,staged_text,by_config[target],target)
    expected_increment=source_total+sum(Path(p).stat().st_size for p in STATIC_CONFIGS)+len(assets)*STATIC_RECEIPT_MAX_BYTES_PER_ASSET*STATIC_RECEIPT_PHASES+65536
    if type(plan.get('incrementalBudgetBytes')) is not int or plan['incrementalBudgetBytes'] != expected_increment:
        raise ValueError('Static incremental budget must equal manifest payload + config backups + bounded receipts')
    return manifest

def _validate_static_capacity(plan, policy, observed, manifest):
    guard=policy.get('diskCapacity'); disk=observed.get('disk',{})
    if not guard: raise ValueError('Static migration requires current diskCapacity policy')
    root=str(Path(guard['root']).resolve())
    if disk.get('root') != root: raise ValueError('Static migration filesystem/root mismatch')
    incremental=plan['incrementalBudgetBytes']; new_dirs=set()
    for asset in manifest['assets']:
        parent=Path(asset['plannedDestination']).parent
        while parent != STATIC_DEST_ROOT.parent and parent != parent.parent:
            if parent.exists(): break
            new_dirs.add(str(parent)); parent=parent.parent
    file_count=len(manifest['assets'])+len(manifest['configFiles'])+3+10+len(new_dirs)
    if disk.get('freeBytes',0)-incremental < guard['reserveBytes']: raise ValueError('Insufficient free disk reserve for static migration')
    if disk.get('availableInodes',0)-file_count < guard['reserveInodes']: raise ValueError('Insufficient free inode reserve for static migration')
    if disk.get('projectBytes',0)+incremental > guard['projectMaxBytes']: raise ValueError('Static migration exceeds UAPT project disk budget')

def _copy_static_asset(asset):
    source=Path(asset['sourcePath']); dest=Path(asset['plannedDestination'])
    _reject_symlink_components(source); _reject_symlink_components(dest,allow_missing=True)
    if os.path.lexists(dest): raise ValueError('Static destination appeared during migration: '+str(dest))
    _ensure_static_directories(dest.parent)
    _reject_symlink_components(dest.parent)
    temp=dest.with_name(dest.name+'.static-copy-tmp')
    if os.path.lexists(temp): raise ValueError('Static copy temporary path collision: '+str(temp))
    flags=os.O_WRONLY|os.O_CREAT|os.O_EXCL|getattr(os,'O_NOFOLLOW',0)
    fd=os.open(temp,flags,int(asset['sourceMode'],8)); h=hashlib.sha256(); size=0
    try:
        with source.open('rb') as src, os.fdopen(fd,'wb') as out:
            fd=None
            for chunk in iter(lambda:src.read(1024*1024),b''):
                out.write(chunk); h.update(chunk); size+=len(chunk)
            if h.hexdigest()!=asset['sourceSha256'] or size!=asset['sourceBytes']:
                raise ValueError('Static copy hash/size mismatch: '+str(dest))
            out.flush(); os.fchmod(out.fileno(),int(asset['sourceMode'],8))
            os.utime(temp,ns=(asset['sourceMtimeNs'],asset['sourceMtimeNs'])); os.fsync(out.fileno())
    except BaseException:
        if fd is not None:
            try: os.close(fd)
            except OSError: pass
        temp.unlink(missing_ok=True)
        raise
    if os.path.lexists(dest):
        temp.unlink(missing_ok=True); raise ValueError('Static destination appeared during copy: '+str(dest))
    os.replace(temp,dest)
    directory_fd=os.open(dest.parent,os.O_RDONLY); os.fsync(directory_fd); os.close(directory_fd)
    return {'path':str(dest),'sha256':h.hexdigest(),'bytes':size}

def _ensure_static_directories(path):
    path=Path(path); missing=[]; current=path
    while not current.exists():
        if current.is_symlink(): raise ValueError('Static directory path is a symlink: '+str(current))
        missing.append(current); current=current.parent
    if current.is_symlink() or not current.is_dir(): raise ValueError('Static directory parent is not a real directory: '+str(current))
    for directory in reversed(missing):
        try: directory.mkdir(mode=0o755)
        except FileExistsError:
            if directory.is_symlink() or not directory.is_dir(): raise ValueError('Static directory collision: '+str(directory))
        else:
            os.chmod(directory,0o755)
            fd=os.open(directory.parent,os.O_RDONLY); os.fsync(fd); os.close(fd)

def _copy_file_durable(source, destination, expected_sha256, replace_stale=False):
    source=Path(source); destination=Path(destination)
    if os.path.lexists(destination):
        if not replace_stale or destination.is_symlink() or not destination.is_file():
            raise ValueError('Static transaction file collision: '+str(destination))
        if digest(destination)==expected_sha256:
            shutil.copystat(source,destination,follow_symlinks=False)
            with destination.open('rb') as stream: os.fsync(stream.fileno())
            directory_fd=os.open(destination.parent,os.O_RDONLY); os.fsync(directory_fd); os.close(directory_fd)
            return expected_sha256
        destination.unlink()
    fd=os.open(destination,os.O_WRONLY|os.O_CREAT|os.O_EXCL|getattr(os,'O_NOFOLLOW',0),source.stat().st_mode&0o777)
    h=hashlib.sha256()
    try:
        with source.open('rb') as src, os.fdopen(fd,'wb') as out:
            fd=None
            for chunk in iter(lambda:src.read(1024*1024),b''):
                out.write(chunk); h.update(chunk)
            if h.hexdigest()!=expected_sha256: raise ValueError('Static transaction copy hash mismatch: '+str(source))
            out.flush(); os.fsync(out.fileno())
        shutil.copystat(source,destination,follow_symlinks=False)
        directory_fd=os.open(destination.parent,os.O_RDONLY); os.fsync(directory_fd); os.close(directory_fd)
    except BaseException:
        if fd is not None:
            try: os.close(fd)
            except OSError: pass
        destination.unlink(missing_ok=True)
        raise
    return h.hexdigest()

def _static_preview_impl(staged, assets, baseline, txdir, directory_alias=None, origin_context=None):
    import socket
    preview=Path(txdir)/'preview'; preview.mkdir()
    with socket.socket() as sock:
        sock.bind(('127.0.0.1',0)); port=sock.getsockname()[1]
    conf=preview/'nginx.conf'; pid=preview/'nginx.pid'
    if directory_alias is None:
        includes='\n'.join('    include '+json.dumps(item['path'])+';' for item in staged)
    else:
        # The discovery snippet also contains dynamic/API routes. Preview only
        # its exact unchanged static location; no dynamic route is instantiated.
        if len(staged)!=1 or staged[0]['target']!=DISCOVERY_CONFIG:
            raise ValueError('Unexpected discovery preview snippet')
        includes=_discovery_location_block(Path(staged[0]['path']).read_text(),str(DISCOVERY_DEST_BASE)+'/')
    ttls={row.get('expiresTtlSeconds') for row in baseline.values()}
    if len(ttls)>1: raise ValueError('Per-URL Expires TTL differs; cannot safely model the live server context in preview')
    expires=next(iter(ttls)) if ttls else None
    expires_directive=('    expires '+str(int(round(expires)))+'s;\n') if expires is not None else ''
    if (not isinstance(origin_context,dict) or origin_context.get('previewServerDirectives')!=list(STATIC_PREVIEW_DIRECTIVES)
            or origin_context.get('previewContextSha256')!=hashlib.sha256('\n'.join(STATIC_PREVIEW_DIRECTIVES).encode()).hexdigest()):
        raise ValueError('Exact frozen UAPT preview transport context required')
    transport='\n'.join('    '+line for line in origin_context['previewServerDirectives'])+'\n'
    # Match inherited site-wide MIME/security/Expires behavior; each staged location
    # retains its own Cache-Control and legacy per-location security includes.
    # Production registers this shared-header variable in a different host's
    # server block. UAPT's value is empty; register that same empty value only
    # in this isolated preview, without importing the other host's CSP policy.
    text='pid '+json.dumps(str(pid))+';\nerror_log /dev/null;\nevents { worker_connections 1024; }\nhttp {\n  access_log off;\n  include /etc/nginx/mime.types;\n  default_type application/octet-stream;\n  server {\n    listen 127.0.0.1:'+str(port)+';\n    server_name localhost;\n    set $clb_pro_csp "";\n    include /etc/nginx/snippets/clb-pro-security-headers.conf;\n'+transport+expires_directive+includes+'\n  }\n}\n'
    conf.write_text(text)
    prefix=str(preview)+'/'
    proc=None
    receipt={'schemaVersion':'uapt-static-readback-v1','phase':'preview','checkedAt':now(),'concurrency':2,
             'origin':'http://127.0.0.1:'+str(port),'redirectsFollowed':False,'assetCount':0,'status':'BLOCKED','failures':[],'responses':[]}
    try:
        run('nginx','-t','-p',prefix,'-c',str(conf))
        proc=subprocess.Popen(['nginx','-g','daemon off;','-p',prefix,'-c',str(conf)],stdout=subprocess.DEVNULL,stderr=subprocess.PIPE,text=True)
        deadline=time.time()+10
        while time.time()<deadline:
            if proc.poll() is not None: raise ValueError('Nginx static preview failed to start: '+(proc.stderr.read() if proc.stderr else ''))
            try:
                with urllib.request.urlopen('http://127.0.0.1:'+str(port)+assets[0]['urlPath'],timeout=1): break
            except Exception: time.sleep(.1)
        else: raise ValueError('Nginx static preview did not become ready')
        receipt=_static_readback(assets,'preview',baseline,origin='http://127.0.0.1:'+str(port))
    except Exception as error:
        receipt.update(status='BLOCKED',failures=receipt.get('failures',[])+[{'kind':'preview_error','error':str(error)}])
    finally:
        if proc is not None:
            try: subprocess.run(['nginx','-s','quit','-p',prefix,'-c',str(conf)],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL,timeout=10)
            except (subprocess.TimeoutExpired,OSError):
                if proc.poll() is None: proc.terminate()
            try: proc.wait(timeout=10)
            except subprocess.TimeoutExpired:
                proc.kill(); proc.wait(timeout=5)
    return receipt

def _static_preview(staged, assets, baseline, txdir, directory_alias=None, origin_context=None):
    try: return _static_preview_impl(staged,assets,baseline,txdir,directory_alias,origin_context)
    except Exception as error:
        return {'schemaVersion':'uapt-static-readback-v1','phase':'preview','checkedAt':now(),'concurrency':2,
                'origin':'http://127.0.0.1','redirectsFollowed':False,'assetCount':0,'status':'BLOCKED',
                'failures':[{'kind':'preview_error','error':str(error)}],'responses':[]}

def static_migrate(plan_path, pending):
    plan_path=Path(plan_path)
    if not plan_path.is_absolute() or '..' in plan_path.parts: raise ValueError('Static plan path must be absolute and traversal-free')
    _reject_symlink_components(plan_path)
    plan_path=plan_path.resolve(strict=True)
    if '..' in plan_path.parts: raise ValueError('Static plan path traversal is forbidden')
    plans_root=STATE/'static-migration-plans'
    if not _under(plan_path,plans_root): raise ValueError('Static plan must be under lifecycle static-migration-plans')
    policy=json.loads(POLICY.read_text()); policy['_sha256']=digest(POLICY)
    plan=json.loads(plan_path.read_text())
    manifest=_validate_static_plan(plan,policy)
    if pending.exists() and json.loads(pending.read_text()).get('stage') not in ('complete','rolled_back'):
        raise ValueError('Unfinished lifecycle transaction: recover before static migration')
    observed=audit()
    # This bounded maintenance action repairs existing static references only. It has no app candidate,
    # does not rewrite retention clocks, and cannot authorize or satisfy an application release gate.
    _validate_static_capacity(plan,policy,observed,manifest)
    _require_static_unexpired(plan)
    txdir=STATE/'transactions'/plan['id']; txdir.mkdir(parents=True,exist_ok=False)
    files=[]
    for i,item in enumerate(plan['stagedConfigs']):
        target=Path(item['target']); backup=txdir/('config-'+str(i)+'.conf')
        if target.is_symlink() or digest(target)!=item['beforeSha256']: raise ValueError('Static config drift before backup: '+str(target))
        _copy_file_durable(target,backup,item['beforeSha256'])
        files.append({'target':str(target),'backup':str(backup),'beforeSha256':item['beforeSha256'],'stagedPath':item['path'],'stagedSha256':item['sha256']})
    before_policy=json.loads(POLICY.read_text())
    tx={'kind':'static','stage':'prepared','at':now(),'files':files,'retireUnits':[],'plan':plan,
        'beforePolicy':before_policy,'beforePolicySha256':digest(POLICY),'candidateUnits':[],
        'staticReceipts':{},'copiedAssets':[]}
    write(pending,tx)
    try:
        baseline_receipt=_static_readback(manifest['assets'],'public-before')
        tx['staticReceipts']['publicBefore']=_save_static_receipt(txdir,'public-before',baseline_receipt); write(pending,tx)
        if baseline_receipt['status']!='PASS': raise ValueError('Static public-before failed')
        baselines={row['urlPath']:row for row in baseline_receipt['responses']}
        origin_context=plan.get('originContext')
        origin_receipt=_static_readback(manifest['assets'],'origin-before',origin=origin_context)
        tx['staticReceipts']['originBefore']=_save_static_receipt(txdir,'origin-before',origin_receipt); write(pending,tx)
        if origin_receipt['status']!='PASS': raise ValueError('Static pinned origin-before failed')
        origin_baselines={row['urlPath']:row for row in origin_receipt['responses']}
        _require_static_unexpired(plan)
        for asset in manifest['assets']:
            copied=_copy_static_asset(asset); tx['copiedAssets'].append(copied)
        write(pending,tx)
        if manifest.get('scope')==DISCOVERY_SCOPE:
            staged_receipt=_static_preview(plan['stagedConfigs'],manifest['assets'],origin_baselines,txdir,manifest['directoryAlias'],origin_context)
        else:
            staged_receipt=_static_preview(plan['stagedConfigs'],manifest['assets'],origin_baselines,txdir,None,origin_context)
        tx['staticReceipts']['preview']=_save_static_receipt(txdir,'preview',staged_receipt); tx['stage']='preview_passed'; write(pending,tx)
        if staged_receipt['status']!='PASS': raise ValueError('Static local Nginx preview failed semantic checks')
        _require_static_unexpired(plan)
        if digest(POLICY)!=tx['beforePolicySha256']: raise ValueError('Lifecycle policy changed during static transaction')
        if origin_context!=_static_origin_context(manifest):
            raise ValueError('Origin/preview context changed after preview')
        if manifest.get('scope')==DISCOVERY_SCOPE and manifest['assets']!=_discovery_source_assets():
            raise ValueError('Discovery source tree changed after preview')
        for item in files:
            target=Path(item['target']); staged=Path(item['stagedPath'])
            if digest(target)!=item['beforeSha256'] or digest(staged)!=item['stagedSha256']: raise ValueError('Static config changed after preview')
            temp=target.with_name(target.name+'.static-migrate-tmp')
            _copy_file_durable(staged,temp,item['stagedSha256'])
            os.replace(temp,target)
            directory_fd=os.open(target.parent,os.O_RDONLY); os.fsync(directory_fd); os.close(directory_fd)
        tx['stage']='config_written'; write(pending,tx)
        run('nginx','-t'); run('systemctl','reload','nginx')
        tx['stage']='reloaded'; write(pending,tx)
        after=_static_readback(manifest['assets'],'public-after',baselines)
        tx['staticReceipts']['publicAfter']=_save_static_receipt(txdir,'public-after',after); write(pending,tx)
        if after['status']!='PASS': raise ValueError('Static public-after failed semantic checks')
        if digest(POLICY)!=tx['beforePolicySha256']: raise ValueError('Lifecycle policy changed during static transaction')
        _require_static_unexpired(plan)
        tx.update(stage='complete',completedAt=now(),staticAssetCount=len(manifest['assets']),staticBytes=sum(a['sourceBytes'] for a in manifest['assets']))
        write(pending,tx)
        print(json.dumps({'status':'complete','kind':'static','id':plan['id'],'assets':len(manifest['assets']),'bytes':tx['staticBytes'],'transaction':str(pending)},indent=2))
    except BaseException as error:
        tx['staticFailure']={'at':now(),'error':str(error)}
        try: write(pending,tx)
        except OSError: pass
        try: recover(tx)
        except BaseException as recovery_error:
            tx['staticRecoveryFailure']={'at':now(),'error':str(recovery_error)}; write(pending,tx)
            raise RuntimeError('Static migration failed and recovery also failed: '+str(recovery_error)) from error
        raise

def recover(tx, reload_nginx=True):
    if tx.get('kind') == 'static':
        recovery={'startedAt':now(),'restoredConfigs':[]}
        tx['staticRecovery']=recovery
        try: write(STATE/'transaction.json',tx)
        except OSError: pass  # Existing prepared journal remains sufficient to retry boot recovery.
        try:
            for item in tx['files']:
                target=Path(item['target']); backup=Path(item['backup'])
                if digest(backup)!=item['beforeSha256']: raise ValueError('Corrupt static config recovery backup: '+str(backup))
                stale=target.with_name(target.name+'.static-migrate-tmp')
                if os.path.lexists(stale):
                    if stale.is_symlink() or not stale.is_file(): raise ValueError('Unsafe static migration temp during recovery: '+str(stale))
                    stale.unlink()
                temp=target.with_name(target.name+'.static-recover-tmp'); _copy_file_durable(backup,temp,item['beforeSha256'],replace_stale=True)
                os.replace(temp,target)
                directory_fd=os.open(target.parent,os.O_RDONLY); os.fsync(directory_fd); os.close(directory_fd)
                recovery['restoredConfigs'].append({'target':str(target),'sha256':item['beforeSha256']})
            run('nginx','-t')
            if reload_nginx: run('systemctl','reload','nginx')
            tx.update(stage='rolled_back',recoveredAt=now(),staticRecovery=recovery); write(STATE/'transaction.json',tx)
        except BaseException as error:
            recovery.update(failedAt=now(),error=str(error)); tx['staticRecovery']=recovery
            try: write(STATE/'transaction.json',tx)
            except OSError: pass
            raise
        return
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
    parser.add_argument('action', choices=['audit', 'retention', 'record-retention', 'prebuild', 'gate', 'cutover', 'complete', 'recover', 'expire', 'static-migrate'])
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
            current = datetime.datetime.now(datetime.timezone.utc)
            for entry in receipt.get('entries', []) + receipt.get('temporaryArtifacts', []):
                if entry.get('disposition') == 'held' and retention_timestamp(entry['reviewBefore'], 'reviewBefore') <= current:
                    print('Review overdue (release handling window applies): ' + entry.get('name', entry.get('path', '')) + '; blocking deadline=' + retention_blocking_deadline(entry, policy['retentionEnforcement']).isoformat())
            print('Retention passed; no blocking expired holds or unclassified temporary artifacts'); return
        pending = STATE / 'transaction.json'
        if args.action == 'expire':
            if pending.exists():
                tx = json.loads(pending.read_text())
                expired=(retention_timestamp(tx['plan']['expiresAt'],'static expiresAt') <= datetime.datetime.now(datetime.timezone.utc)) if tx.get('kind')=='static' else tx['plan']['expiresAt'] <= now()
                if tx['stage'] not in ['complete', 'rolled_back'] and expired:
                    recover(tx)
                    if tx.get('kind') == 'static': return
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
        if args.action == 'static-migrate':
            if not args.plan: raise ValueError('Static migration plan path required')
            static_migrate(args.plan,pending)
            return
        if args.action == 'complete':
            tx = json.loads(pending.read_text()); assert tx['stage'] == 'selected_pending_acceptance'
            plan = tx['plan']
            if plan.get('retireUnits') == [] and plan.get('retiredEndpoints') == []:
                validate_r4_reuse_authorization(plan, json.loads(POLICY.read_text()))
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
            write(POLICY, policy); tx.update(stage='complete', completedAt=now(), finalAudit=audit()); write(pending, tx); print('Complete; compatibility units retained' if not tx['retireUnits'] else 'Complete; previous units cold'); return
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
