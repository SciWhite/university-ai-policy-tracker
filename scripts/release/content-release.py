#!/usr/bin/env python3
"""One content release on the production host. Replaces the per-batch host-release.py copies
(docs/content-release.md §5, docs/audit-20261121/REPORT.md §5).

Everything batch-specific lives in the operation's bundle.json (written locally by
`pnpm content:bundle`); this file has no batch constants. Host phases run as root from the
release helper shipped inside the ACTIVE program release, so the switch tooling always matches
the running program (scripts/program-build.mjs bundles it into release-helper/):

  sudo python3 <program-root>/release-helper/scripts/release/content-release.py check    --op <op-dir>
  sudo python3 ... activate --op <op-dir> --bundle-sha256 <sha>   # gates, install, switch, ISR expiry, refresh
  sudo python3 ... refresh  --op <op-dir>                         # warm changed pages + origin cache step
  sudo python3 ... complete --op <op-dir>                         # complete gate, register, classify, rescan
  sudo python3 ... status   --op <op-dir>

On the operator machine, `remote` runs one host phase in the background through
scripts/release/remote-bg.sh and waits on its exact PID (never `pgrep -f`):

  python3 scripts/release/content-release.py remote activate --op-id <id> --bundle-sha256 <sha> --helper <dir>

The refresh step is the plug-in point for the origin page cache (phase 2): after warming the
changed pages over loopback it runs `/usr/local/libexec/uapt-origin-refresh` when that hook is
installed, else today's whole-cache epoch purge (`uapt-program-release.py purge-html-cache`).
Never purges Cloudflare and never notifies search engines (those stay operator steps).
Python 3.10, standard library only.
"""
import argparse, fcntl, hashlib, json, os, re, runpy, shlex, stat, subprocess, sys, tempfile, time
from datetime import datetime, timedelta, timezone
from pathlib import Path
from urllib.request import Request, urlopen

BUNDLE_SCHEMA = 'uapt-content-release-bundle-v1'
CHANGED_URLS_SCHEMA = 'uapt-changed-urls-v1'
RECEIPT_SCHEMA = 'uapt-content-release-receipt-v1'
HELPER_SCHEMA = 'uapt-release-helper-v1'
CONTENT_ID = re.compile(r'^[a-z0-9][a-z0-9.-]{2,95}$')
OP_ID = re.compile(r'^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$')
HEX64 = re.compile(r'^[0-9a-f]{64}$')
SLOT_UNITS = {'uapt-mcp-v6-candidate.service': 3101, 'uapt-mcp-v6-r2.service': 3102}
HOLD_REVIEW_HOURS = 167


class Refused(Exception):
    """A gate refused; nothing after it ran. The message names the next action."""


def env_path(name, default):
    return Path(os.environ.get(name, default))


class Host:
    """Host paths and side effects; tests point these at a temporary tree."""
    def __init__(self):
        self.state = env_path('UAPT_RELEASE_STATE', '/srv/uapt/operations/release-lifecycle')
        self.controller_path = env_path('UAPT_RELEASE_CONTROLLER', '/usr/local/libexec/uapt-release-lifecycle.py')
        self.program_release = env_path('UAPT_PROGRAM_RELEASE', '/usr/local/libexec/uapt-program-release.py')
        self.origin_hook = env_path('UAPT_ORIGIN_REFRESH_HOOK', '/usr/local/libexec/uapt-origin-refresh')
        self.content_root = env_path('UAPT_CONTENT_ROOT_PATH', '/srv/uapt/content/runtime')
        self.ops_root = env_path('UAPT_OPERATIONS_ROOT', '/srv/uapt/operations')
        self.releases_root = env_path('UAPT_PROGRAM_RELEASES', '/srv/uapt/releases')
        self.mcp_url = os.environ.get('UAPT_MCP_URL', 'http://127.0.0.1:3161')
        self.node = os.environ.get('UAPT_NODE') or next((p for p in ['/opt/uapt/node-v22.23.4/bin/node'] if Path(p).exists()), 'node')
        self._controller = None

    @property
    def controller(self):
        if self._controller is None:
            self._controller = runpy.run_path(str(self.controller_path))
        return self._controller

    def run(self, argv, **kw):
        return subprocess.run(argv, **kw)

    def active_slot(self):
        """(unit, port, pid, working directory) of the one running web slot."""
        active = [u for u in SLOT_UNITS if self.run(['systemctl', 'is-active', '--quiet', u]).returncode == 0]
        if len(active) != 1:
            raise Refused('Expected exactly one active web slot, found ' + repr(active))
        unit = active[0]
        pid = int(self.run(['systemctl', 'show', '-p', 'MainPID', '--value', unit], capture_output=True, text=True, check=True).stdout.strip())
        cwd = os.readlink(f'/proc/{pid}/cwd')
        return unit, SLOT_UNITS[unit], pid, cwd

    def process_env(self, pid):
        raw = Path(f'/proc/{pid}/environ').read_bytes()
        return {k.decode(): v.decode() for k, v in (a.split(b'=', 1) for a in raw.split(b'\0') if b'=' in a)}

    def http_json(self, url, *, token=None, body=None, timeout=30):
        headers = {'Authorization': 'Bearer ' + token} if token else {}
        data = None
        if body is not None:
            data = json.dumps(body).encode(); headers['Content-Type'] = 'application/json'
        with urlopen(Request(url, data=data, headers=headers, method='POST' if body is not None else 'GET'), timeout=timeout) as f:
            return json.load(f)


# ---------------------------------------------------------------- small helpers

def now():
    return datetime.now(timezone.utc)


def sha256_bytes(raw):
    return hashlib.sha256(raw).hexdigest()


def sha256_file(path):
    h = hashlib.sha256()
    with open(path, 'rb') as f:
        for chunk in iter(lambda: f.read(1 << 20), b''):
            h.update(chunk)
    return h.hexdigest()


def read_json(path):
    return json.loads(Path(path).read_bytes())


def atomic_json(path, data, mode=0o640):
    path = Path(path)
    fd, name = tempfile.mkstemp(dir=path.parent, prefix='.' + path.name)
    with os.fdopen(fd, 'w') as f:
        json.dump(data, f, ensure_ascii=False, indent=2); f.write('\n'); f.flush(); os.fsync(f.fileno())
    os.chmod(name, mode)
    os.replace(name, path)


def log(message):
    print(message, file=sys.stderr, flush=True)


# ---------------------------------------------------------------- operation and bundle

class Operation:
    def __init__(self, host, op_dir):
        self.host = host
        self.dir = Path(op_dir).resolve()
        if self.dir.parent != host.ops_root.resolve():
            raise Refused(f'Operation directory must be directly under {host.ops_root}: {self.dir}')
        self.bundle_path = self.dir / 'bundle.json'
        if not self.bundle_path.is_file():
            raise Refused('No bundle.json in ' + str(self.dir) + '; build it with pnpm content:bundle and upload the operation directory')
        self.raw = self.bundle_path.read_bytes()
        self.sha256 = sha256_bytes(self.raw)
        self.bundle = validate_bundle(json.loads(self.raw), self.dir.name)
        self.receipts = self.dir / 'receipts'

    @property
    def cid(self): return self.bundle['contentId']

    @property
    def parent(self): return self.bundle['parentContentId']

    def path(self, key):
        return self.dir / self.bundle['files'][key]

    def write(self, name, data):
        self.receipts.mkdir(exist_ok=True)
        atomic_json(self.receipts / name, {'schemaVersion': RECEIPT_SCHEMA, 'opId': self.dir.name, 'contentId': self.cid,
                                           'bundleSha256': self.sha256, 'at': now().isoformat(), **data})
        print(json.dumps({'receipt': str(self.receipts / name), **{k: v for k, v in data.items() if not isinstance(v, (dict, list))}}, ensure_ascii=False))


def validate_bundle(bundle, op_name):
    if bundle.get('schemaVersion') != BUNDLE_SCHEMA:
        raise Refused('Unknown bundle schema')
    for key in ('contentId', 'parentContentId'):
        if not CONTENT_ID.match(bundle.get(key) or ''):
            raise Refused('Invalid ' + key)
    for key in ('manifestSha256', 'parentManifestSha256'):
        if not HEX64.match(bundle.get(key) or ''):
            raise Refused('Invalid ' + key)
    if bundle.get('opId') != op_name or not OP_ID.match(op_name):
        raise Refused(f'bundle.opId {bundle.get("opId")!r} does not name this operation directory {op_name!r}')
    if bundle.get('requiredSyncContract') != '2.1.0':
        raise Refused('Content releases require synchronization contract 2.1.0')
    files = bundle.get('files') or {}
    for key in ('syncCandidate', 'changedUrls'):
        rel = files.get(key)
        if not isinstance(rel, str) or rel.startswith('/') or '..' in rel.split('/'):
            raise Refused('Missing or unsafe bundle file reference: ' + key)
    if not isinstance(bundle.get('changedSchools'), list) or not all(isinstance(s, str) for s in bundle['changedSchools']):
        raise Refused('bundle.changedSchools must be a list of slugs')
    if not (isinstance(bundle.get('hold'), dict) and bundle['hold'].get('reason')):
        raise Refused('bundle.hold.reason is required (it is written into the retention register)')
    if not isinstance(bundle.get('authorization'), str) or not bundle['authorization'].strip():
        raise Refused('bundle.authorization must quote the release request')
    return bundle


# ---------------------------------------------------------------- helper pin

def helper_root():
    """This file is <helper>/scripts/release/content-release.py."""
    return Path(__file__).resolve().parents[2]


def check_helper(host, slot_cwd, legacy_reason=None):
    """The helper must be the release-helper/ of the program the active slot runs."""
    root = helper_root()
    info_path = root / 'HELPER.json'
    if legacy_reason:
        if not (root / 'scripts/content-release/switch.ts').is_file():
            raise Refused('--legacy-helper-reason needs a repository-checkout helper (scripts/content-release/switch.ts)')
        return {'mode': 'legacy-checkout', 'root': str(root), 'reason': legacy_reason}
    if not info_path.is_file():
        raise Refused('No HELPER.json: run this from <program-root>/release-helper of the active program (or pass --legacy-helper-reason during the transition)')
    info = read_json(info_path)
    if info.get('schemaVersion') != HELPER_SCHEMA or not re.fullmatch(r'[0-9a-f]{40}', info.get('codeSha', '')):
        raise Refused('Invalid HELPER.json')
    program_root = root.parent
    releases = host.releases_root.resolve()
    if program_root.parent != releases:
        raise Refused(f'Helper {root} is not inside a program release under {releases}')
    try:
        Path(slot_cwd).resolve().relative_to(program_root)
    except ValueError:
        raise Refused(f'Helper belongs to {program_root.name}, but the active web slot runs from {slot_cwd}; use the active program\'s release-helper')
    manifest = program_root / 'build-artifact-manifest.json'
    if manifest.is_file() and read_json(manifest).get('codeSha') != info['codeSha']:
        raise Refused('HELPER.json codeSha differs from the program artifact manifest')
    for rel, digest in (info.get('files') or {}).items():
        if sha256_file(root / rel) != digest:
            raise Refused('Release helper file changed after packaging: ' + rel)
    return {'mode': 'program-artifact', 'root': str(root), 'programRoot': program_root.name, 'codeSha': info['codeSha']}


def switch_command(host, helper, args):
    root = Path(helper['root'])
    if helper['mode'] == 'program-artifact':
        return [host.node, str(root / 'scripts/content-release/switch.mjs')] + args
    return [host.node, 'node_modules/tsx/dist/cli.mjs', '--tsconfig', 'apps/web/tsconfig.json', 'scripts/content-release/switch.ts'] + args


# ---------------------------------------------------------------- gates

def retention_gate(host, controller):
    """The controller's own retention validation (the same check activation refused on 2026-11-21)."""
    policy = read_json(host.state / 'policy.json')
    observed = controller['audit']()
    register_path = Path(policy['retentionRegister'])
    register = read_json(register_path)
    plan = {'basis': {'sha256': register['basisSha256']},
            'retentionReceipt': {'path': str(register_path), 'sha256': sha256_file(register_path)}}
    try:
        controller['validate_retention_receipt'](plan, observed, policy)
    except ValueError as error:
        raise Refused(f'Retention gate: {error}. Next: sudo {host.controller_path} rescan --reason "before content release" '
                      '(and archive any expired hold), then run this phase again.')
    tx = host.state / 'transaction.json'
    if tx.is_file() and read_json(tx).get('stage') not in ('complete', 'rolled_back'):
        raise Refused('A program release transaction is not complete; finish or recover it first')
    return policy, observed, register_path, register


def candidate_basis(op):
    sync = op.path('syncCandidate').parent
    basis_file = sync / 'basis.json'
    if sha256_file(basis_file) != op.bundle['manifestSha256']:
        raise Refused('sync/content-candidate/basis.json is not the bundle manifest')
    manifest = read_json(basis_file)
    if (manifest.get('contentId'), manifest.get('parentContentId'), manifest.get('requiredSyncContract')) != (op.cid, op.parent, '2.1.0'):
        raise Refused('Release manifest identity differs from the bundle')
    if read_json(op.path('syncCandidate')).get('basisSha256') != op.bundle['manifestSha256']:
        raise Refused('Candidate sync event is not bound to this manifest')
    return basis_file, manifest


def verify_objects(op, manifest):
    allowed = {h: n for _, h, n in manifest['files']}
    incoming = sorted(p for p in (op.dir / 'objects').glob('*/*') if p.is_file()) if (op.dir / 'objects').is_dir() else []
    for p in incoming:
        h = p.name
        if p.parent.name != h[:2] or h not in allowed or not stat.S_ISREG(p.lstat().st_mode):
            raise Refused('Unexpected object in the upload: ' + str(p.relative_to(op.dir)))
        if p.stat().st_size != allowed[h] or sha256_file(p) != h:
            raise Refused('Object bytes differ from their name: ' + h)
    return incoming, allowed


def sync_gate(host, helper, event, phase):
    result = host.run(['python3', 'scripts/policy-inventory.py', 'sync-gate', str(event), '--phase', phase],
                      cwd=helper['root'], capture_output=True, text=True)
    if result.returncode != 0:
        raise Refused(f'Synchronization gate ({phase}) rejected: ' + (result.stderr or result.stdout)[-2000:])


def materialize_proofs(op, host):
    """2.1.0 proofs arrive as proof-manifest.json (scripts/content-release/sync-proof.py)."""
    sync = op.path('syncCandidate').parent
    if not (sync / 'proof-manifest.json').is_file():
        return {'mode': 'full-copy-uploaded'}
    proof = runpy.run_path(str(helper_root() / 'scripts/content-release/sync-proof.py'))
    stores = [str(op.dir / 'objects'), str(host.content_root / 'objects')]
    try:
        return {'mode': 'hash-manifest', **proof['materialize'](sync, stores)}
    except proof['ProofError'] as error:
        raise Refused('Sync proof: ' + str(error))


# ---------------------------------------------------------------- phases

def live_runtime(host, port, token):
    return host.http_json(f'http://127.0.0.1:{port}/api/internal/content/refresh', token=token)


def mcp_health(host):
    return host.http_json(host.mcp_url.rstrip('/') + '/healthz', timeout=10)


def slot_context(host):
    unit, port, pid, cwd = host.active_slot()
    env = host.process_env(pid)
    if Path(env.get('UAPT_CONTENT_ROOT', '')) != host.content_root:
        raise Refused('Active slot reads a different content root: ' + env.get('UAPT_CONTENT_ROOT', '(unset)'))
    token = env.get('UAPT_CONTENT_REFRESH_TOKEN', '')
    if len(token) < 32:
        raise Refused('Active slot has no content refresh token')
    return {'unit': unit, 'port': port, 'pid': pid, 'cwd': cwd, 'token': token}


def cmd_check(host, op, args):
    controller = host.controller
    with open_lock(controller):
        retention_gate(host, controller)
    slot = slot_context(host)
    helper = check_helper(host, slot['cwd'], args.legacy_helper_reason)
    basis_file, manifest = candidate_basis(op)
    incoming, _ = verify_objects(op, manifest)
    pointer = read_json(host.content_root / 'current.json')
    problems = []
    if pointer.get('contentId') != op.parent or pointer.get('manifestSha256') != op.bundle['parentManifestSha256']:
        problems.append(f'live pointer is {pointer.get("contentId")}, bundle parent is {op.parent}')
    if (host.content_root / 'releases' / op.cid).exists():
        problems.append('release already installed: ' + op.cid)
    op.write('check.json', {'helper': helper, 'slot': {k: slot[k] for k in ('unit', 'port', 'cwd')}, 'incomingObjects': len(incoming),
                            'livePointer': pointer.get('contentId'), 'problems': problems, 'status': 'ok' if not problems else 'refused'})
    if problems:
        raise Refused('; '.join(problems))


class open_lock:
    def __init__(self, controller):
        self.path = controller['LOCK']

    def __enter__(self):
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self.handle = self.path.open('w')
        try:
            fcntl.flock(self.handle, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            raise Refused('The release lock is held by another release step; wait for it (exact PID) and run again')
        return self

    def __exit__(self, *exc):
        self.handle.close()


def cmd_activate(host, op, args):
    if args.bundle_sha256 != op.sha256:
        raise Refused(f'bundle.json is {op.sha256}, the approved bundle is {args.bundle_sha256}')
    controller = host.controller
    slot = slot_context(host)
    helper = check_helper(host, slot['cwd'], args.legacy_helper_reason)
    with open_lock(controller):
        policy, observed, register_path, register = retention_gate(host, controller)
        basis_file, manifest = candidate_basis(op)
        prior = read_json(host.content_root / 'current.json')
        if prior.get('contentId') != op.parent or prior.get('manifestSha256') != op.bundle['parentManifestSha256']:
            raise Refused(f'Live pointer is {prior.get("contentId")} ({prior.get("manifestSha256")}); the bundle was built on {op.parent}')
        if (host.content_root / 'releases' / op.cid).exists():
            raise Refused('Release already installed: ' + op.cid)
        incoming, allowed = verify_objects(op, manifest)
        total = sum(p.stat().st_size for p in incoming)
        peak = total * 2 + 100 * 1024 * 1024
        role = 'shared-web'
        disk_plan = {'basis': {'sha256': op.bundle['manifestSha256']}, 'diskBudget': {
            'schemaVersion': 'uapt-release-disk-budget-v1', 'basisSha256': op.bundle['manifestSha256'], 'role': role,
            'artifactMaxBytes': policy['diskCapacity']['artifactMaxBytesByRole'][role],
            'peakAdditionalBytesByStage': dict(download=0, unpack=0, dependencies=0, build=0, candidate=peak, archive=0, finalization=peak)}}
        try:
            controller['validate_disk_budget'](disk_plan, policy, observed)
        except ValueError as error:
            raise Refused('Disk budget: ' + str(error))
        if sum(allowed.values()) > disk_plan['diskBudget']['artifactMaxBytes']:
            raise Refused('Release exceeds the artifact budget for ' + role)
        proofs = materialize_proofs(op, host)
        sync_gate(host, helper, op.path('syncCandidate'), 'candidate')
        if live_runtime(host, slot['port'], slot['token']).get('contentId') != op.parent or mcp_health(host).get('contentId') != op.parent:
            raise Refused('Web or MCP does not serve the parent release')
        for p in incoming:
            target = host.content_root / 'objects' / p.parent.name / p.name
            target.parent.mkdir(exist_ok=True)
            if not target.exists():
                os.chmod(p, 0o444)
                os.link(p, target)
        installed = host.run(['python3', str(helper_root() / 'scripts/content-release/install-tree.py'), str(host.content_root), op.cid, str(basis_file)],
                             capture_output=True, text=True)
        if installed.returncode:
            raise Refused('Tree install failed: ' + installed.stderr[-1500:])
        stamp = now()
        hold = dict(path=str(host.content_root / 'releases' / op.cid), disposition='held', heldSince=stamp.isoformat(),
                    reviewBefore=(stamp + timedelta(hours=HOLD_REVIEW_HOURS)).isoformat(), reason=op.bundle['hold']['reason'],
                    nextAction='Complete the synchronized content release or preserve this installed package for exact-basis recovery.',
                    registeredBy=op.dir.name, registeredAt=stamp.isoformat())
        register.setdefault('contentReleaseHolds', []).append(hold)
        controller['write'](register_path, register)
        if 'checkpoint_hold_clocks' in controller:
            controller['checkpoint_hold_clocks'](register, policy)
        outcome = host.run(switch_command(host, helper, ['--content-root', str(host.content_root), '--content-id', op.cid,
                                                         '--sync-ledger', str(op.path('syncCandidate')),
                                                         '--refresh-url', f'http://127.0.0.1:{slot["port"]}',
                                                         '--mcp-url', host.mcp_url, '--mcp-wait-ms', '120000']),
                           cwd=helper['root'], env={**os.environ, 'UAPT_CONTENT_REFRESH_TOKEN': slot['token']}, capture_output=True, text=True)
        if outcome.returncode:
            (op.dir / 'switch-failed.json').write_text(outcome.stdout + '\n' + outcome.stderr[-4000:])
            raise Refused('Content switch failed (pointer unchanged unless the receipt says otherwise); see switch-failed.json')
        try:
            result = json.loads(outcome.stdout)
        except json.JSONDecodeError:
            (op.dir / 'switch-failed.json').write_text(outcome.stdout + '\n' + outcome.stderr[-4000:])
            raise Refused('Content switch printed no result (check the pointer and switch-failed.json before anything else)')
        if result['pointer']['manifestSha256'] != op.bundle['manifestSha256'] or result['mcp']['status'] != 'updated' or result['refresh']['contentId'] != op.cid:
            raise Refused('Switch result does not match the bundle: ' + json.dumps({k: result.get(k) for k in ('pointer', 'mcp')})[:800])
        atomic_json(op.dir / 'switch-receipt.json', result)
        unexpected = sorted(set(result.get('changedSchools', [])) - set(op.bundle['changedSchools']))
        if unexpected:
            raise Refused('The switch changed schools outside the bundle: ' + ', '.join(unexpected) + ' (release is live; roll back or complete deliberately)')
        expired = expire_pages(host, op, slot)
    op.write('activate.json', {'helper': helper, 'slot': {k: slot[k] for k in ('unit', 'port', 'cwd')}, 'incomingObjects': len(incoming),
                               'incomingBytes': total, 'proofs': proofs, 'hold': hold, 'switch': {k: result.get(k) for k in ('pointer', 'changedSchools')},
                               'isrExpiry': expired, 'authorization': op.bundle['authorization']})
    if not args.no_refresh:
        cmd_refresh(host, op, args)


def expire_pages(host, op, slot):
    """Page-only updates (V6 presentation, metadata) change pages without changing records; the
    switch's record digests miss them. The bundle lists their tags and every locale path."""
    rel = op.bundle['files'].get('isrExpiry')
    if not rel:
        return {'status': 'not_required', 'reason': 'bundle has no isrExpiry request'}
    body = read_json(op.dir / rel)
    if body.get('expectedContentId') != op.cid:
        raise Refused('isr-expiry request names another release')
    response = host.http_json(f'http://127.0.0.1:{slot["port"]}/api/internal/content/refresh', token=slot['token'], body=body, timeout=180)
    return {'status': 'expired', 'tags': len(body.get('tags', [])), 'paths': len(body.get('paths', [])), 'response': response}


def cmd_refresh(host, op, args):
    """Phase-2 plug-in point. Inputs: changed-urls.json ({schemaVersion, contentId, paths, readbackFirst}).
    1. warm every changed path over loopback (scripts/content-release/warm-changed-pages.py)
    2. origin cache: <UAPT_ORIGIN_REFRESH_HOOK> --changed-urls <file> --content-id <id> --receipt <file>
       when installed, else `uapt-program-release.py purge-html-cache` (epoch purge, today's practice).
    Cloudflare is purged by the operator afterwards (the token never reaches the host)."""
    pointer = read_json(host.content_root / 'current.json')
    if pointer.get('contentId') != op.cid:
        raise Refused(f'Live pointer is {pointer.get("contentId")}, not {op.cid}; refresh runs after activate')
    changed = read_json(op.path('changedUrls'))
    if changed.get('schemaVersion') != CHANGED_URLS_SCHEMA or changed.get('contentId') != op.cid or not isinstance(changed.get('paths'), list):
        raise Refused('Invalid changed-urls.json')
    op.receipts.mkdir(exist_ok=True)
    warm_receipt = op.receipts / 'warm.json'
    warm = host.run(['python3', str(helper_root() / 'scripts/content-release/warm-changed-pages.py'), '--plan', str(op.path('changedUrls')),
                     *sum((['--path', p] for p in changed.get('readbackFirst', [])), []), '--receipt', str(warm_receipt),
                     '--max-seconds', str(args.warm_max_seconds)], capture_output=True, text=True)
    if host.origin_hook.is_file() and os.access(host.origin_hook, os.X_OK):
        origin_receipt = op.receipts / 'origin-refresh.json'
        origin = host.run([str(host.origin_hook), '--changed-urls', str(op.path('changedUrls')), '--content-id', op.cid, '--receipt', str(origin_receipt)],
                          capture_output=True, text=True)
        origin_step = {'mode': 'hook', 'hook': str(host.origin_hook), 'exit': origin.returncode, 'receipt': str(origin_receipt), 'stderr': origin.stderr[-800:]}
    else:
        origin = host.run(['python3', str(host.program_release), 'purge-html-cache', '--reason', f'content switch {op.cid}'], capture_output=True, text=True)
        origin_step = {'mode': 'epoch-purge', 'exit': origin.returncode, 'stderr': origin.stderr[-800:]}
    status = 'ok' if warm.returncode == 0 and origin.returncode == 0 else 'incomplete'
    op.write('refresh.json', {'status': status, 'warm': {'exit': warm.returncode, 'receipt': str(warm_receipt), 'summary': warm.stdout[-1500:]},
                              'origin': origin_step, 'next': 'Purge Cloudflare (operator), then public readback with 1 worker, then complete.'})
    if origin.returncode:
        raise Refused('Origin cache step failed; nothing else changed. Run refresh again after fixing it.')
    if warm.returncode:
        log('Warm-up left some pages cold (see receipts/warm.json); readback retries 524s, or run refresh again.')


def cmd_complete(host, op, args):
    controller = host.controller
    slot = slot_context(host)
    helper = check_helper(host, slot['cwd'], args.legacy_helper_reason)
    complete_event = op.dir / 'sync/content-complete/event.json'
    activate = op.receipts / 'activate.json'
    if not activate.is_file() or read_json(activate).get('bundleSha256') != op.sha256:
        raise Refused('No activate receipt for this bundle')
    follow_ups = []
    with open_lock(controller):
        policy = read_json(host.state / 'policy.json')
        register_path = Path(policy['retentionRegister']); register = read_json(register_path)
        live = read_json(host.content_root / 'current.json')
        if live.get('contentId') != op.cid or live.get('manifestSha256') != op.bundle['manifestSha256']:
            raise Refused('The live pointer is not this release')
        if read_json(complete_event).get('basisSha256') != op.bundle['manifestSha256']:
            raise Refused('Completion event is not bound to this manifest')
        complete_sync = complete_event.parent
        if (complete_sync / 'proof-manifest.json').is_file():
            proof = runpy.run_path(str(helper_root() / 'scripts/content-release/sync-proof.py'))
            try: proof['materialize'](complete_sync, [str(op.dir / 'objects'), str(host.content_root / 'objects')])
            except proof['ProofError'] as error: raise Refused('Sync proof: ' + str(error))
        sync_gate(host, helper, complete_event, 'complete')
        if live_runtime(host, slot['port'], slot['token']).get('contentId') != op.cid or mcp_health(host).get('contentId') != op.cid:
            raise Refused('Web or MCP does not serve this release')
        release_path = str(host.content_root / 'releases' / op.cid)
        register['contentReleaseHolds'] = [h for h in register.get('contentReleaseHolds', []) if h.get('path') != release_path]
        register['contentActive'] = {'contentId': op.cid, 'manifestSha256': op.bundle['manifestSha256'], 'completedAt': now().isoformat(),
                                     'completionEventSha256': sha256_file(complete_event)}
        register['contentRollback'] = {'contentId': op.parent, 'manifestSha256': op.bundle['parentManifestSha256']}
        controller['write'](register_path, register)
        retention = after_complete(host, controller, policy, op, follow_ups)
    dehydrated = dehydrate_proofs(op)
    op.write('complete.json', {'contentActive': register['contentActive'], 'contentRollback': register['contentRollback'],
                               'retention': retention, 'proofs': dehydrated, 'followUps': follow_ups})
    if follow_ups:
        raise Refused('Release is complete; retention follow-ups need action: ' + '; '.join(follow_ups))


def after_complete(host, controller, policy, op, follow_ups):
    """Retention bookkeeping that used to be forgotten (2026-11-21): register the replaced release,
    refresh the receipt's checkedAt through the governed rescan, write the hold status."""
    out = {}
    guard = policy.get('retentionEnforcement') or {}
    if guard.get('contentReleaseRoot') and 'classify_content' in controller:
        try: out['classify'] = controller['classify_content'](policy, f'complete {op.cid}')
        except ValueError as error: follow_ups.append('classify-content-releases refused: ' + str(error))
    else:
        out['classify'] = {'skipped': 'policy has no retentionEnforcement.contentReleaseRoot (server-fixes step D not installed)'}
    if 'rescan' in controller:
        try:
            result = controller['rescan'](read_json(host.state / 'policy.json'), f'content complete {op.cid}')
            out['rescan'] = {k: result.get(k) for k in ('path', 'sha256', 'backup', 'check') if k in result}
        except ValueError as error:
            follow_ups.append('rescan refused (receipt not refreshed; it goes stale 24 h after the last refresh): ' + str(error))
    else:
        follow_ups.append('installed controller has no rescan action; the retention receipt was not refreshed')
    if 'write_hold_status' in controller:
        try:
            status, target = controller['write_hold_status'](read_json(host.state / 'policy.json'))
            out['holdStatus'] = {'status': status.get('status'), 'warning': status.get('warning'), 'overdue': status.get('overdue'), 'file': str(target)}
        except ValueError as error:
            follow_ups.append('hold-status failed: ' + str(error))
    return out


def dehydrate_proofs(op):
    proof = runpy.run_path(str(helper_root() / 'scripts/content-release/sync-proof.py'))
    out = {}
    for phase in ('content-candidate', 'content-complete'):
        sync = op.dir / 'sync' / phase
        if (sync / 'proof').is_dir():
            try: out[phase] = proof['dehydrate'](sync)
            except proof['ProofError'] as error: out[phase] = {'error': str(error)}
    return out


def cmd_status(host, op, args):
    slot = slot_context(host)
    op.write('status.json', {'pointer': read_json(host.content_root / 'current.json'), 'runtime': live_runtime(host, slot['port'], slot['token']),
                             'mcp': mcp_health(host), 'receipts': sorted(p.name for p in op.receipts.glob('*.json')) if op.receipts.is_dir() else []})


# ---------------------------------------------------------------- local: run a host phase with an exact-PID wait

def cmd_remote(args):
    """Operator machine: start one host phase in the background (remote-bg.sh keeps pid, exit code and
    log in ~/uapt-ops/<op>-<phase>/ of the SSH user) and wait on that exact PID."""
    if args.phase not in ('check', 'activate', 'refresh', 'complete', 'status'):
        raise Refused('Unknown phase ' + args.phase)
    if not OP_ID.match(args.op_id):
        raise Refused('Invalid op id')
    script = Path(args.helper) / 'scripts/release/content-release.py'
    command = ['sudo', '-n', 'python3', str(script), args.phase, '--op', f'{args.ops_root}/{args.op_id}']
    if args.phase == 'activate':
        if not HEX64.match(args.bundle_sha256 or ''):
            raise Refused('activate needs --bundle-sha256 (the approved bundle)')
        command += ['--bundle-sha256', args.bundle_sha256]
    if args.legacy_helper_reason:
        command += ['--legacy-helper-reason', args.legacy_helper_reason]
    bg = Path(__file__).resolve().parent / 'remote-bg.sh'
    job = f'{args.op_id}-{args.phase}' + (f'-{args.attempt}' if args.attempt else '')
    env = {**os.environ, **({'UAPT_HOST': args.host} if args.host else {})}
    started = subprocess.run([str(bg), 'start', job, '--'] + command, env=env, capture_output=True, text=True)
    if started.returncode:
        raise Refused('remote-bg start failed: ' + started.stderr.strip())
    pid = started.stdout.strip().splitlines()[-1]
    print(json.dumps({'job': job, 'pid': pid, 'command': shlex.join(command)}))
    waited = subprocess.run([str(bg), 'wait', job, str(args.timeout)], env=env)
    tail = subprocess.run([str(bg), 'tail', job, '40'], env=env, capture_output=True, text=True)
    print(tail.stdout)
    return waited.returncode


# ---------------------------------------------------------------- entry

def main(argv=None, host=None):
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    sub = parser.add_subparsers(dest='phase_cmd', required=True)
    for name in ('check', 'activate', 'refresh', 'complete', 'status'):
        p = sub.add_parser(name)
        p.add_argument('--op', required=True, help='operation directory under /srv/uapt/operations')
        p.add_argument('--legacy-helper-reason', help='transition only: run from a repository checkout helper; the reason is recorded')
        p.add_argument('--warm-max-seconds', type=float, default=2400.0)
        if name == 'activate':
            p.add_argument('--bundle-sha256', required=True, help='SHA256 of the approved bundle.json')
            p.add_argument('--no-refresh', action='store_true', help='skip the refresh step (run it separately)')
    r = sub.add_parser('remote', help='operator machine: run a host phase via remote-bg.sh and wait on its PID')
    r.add_argument('phase'); r.add_argument('--op-id', required=True); r.add_argument('--helper', required=True, help='release-helper directory on the host')
    r.add_argument('--bundle-sha256'); r.add_argument('--host'); r.add_argument('--ops-root', default='/srv/uapt/operations')
    r.add_argument('--timeout', type=int, default=7200); r.add_argument('--attempt', default='')
    r.add_argument('--legacy-helper-reason')
    args = parser.parse_args(argv)
    if args.phase_cmd == 'remote':
        return cmd_remote(args)
    host = host or Host()
    op = Operation(host, args.op)
    {'check': cmd_check, 'activate': cmd_activate, 'refresh': cmd_refresh, 'complete': cmd_complete, 'status': cmd_status}[args.phase_cmd](host, op, args)
    return 0


if __name__ == '__main__':
    try:
        sys.exit(main())
    except Refused as error:
        print('content-release refused: ' + str(error), file=sys.stderr)
        sys.exit(3)
