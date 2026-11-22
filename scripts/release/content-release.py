#!/usr/bin/env python3
"""One content release on the production host. Replaces the per-batch host-release.py copies
(docs/content-release.md §5, docs/audit-20261121/REPORT.md §5).

Everything batch-specific lives in the operation's bundle.json (written locally by
`pnpm content:bundle`); this file has no batch constants. Host phases run as root from the
release helper shipped inside the ACTIVE program release, so the switch tooling always matches
the running program (scripts/program-build.mjs bundles it into release-helper/):

  sudo python3 <program-root>/release-helper/scripts/release/content-release.py check    --op <op-dir>
  sudo python3 ... activate --op <op-dir> --bundle-sha256 <sha>   # gates, install, switch, ISR expiry, refresh
  sudo python3 ... refresh  --op <op-dir>                         # page store generation + refresh (fallback: warm + epoch purge)
  sudo python3 ... complete --op <op-dir>                         # complete gate, register, classify, rescan
  sudo python3 ... status   --op <op-dir>

On the operator machine, after the Cloudflare purge (paced <= 5 requests/s, waits out 429):

  python3 scripts/release/content-release.py readback --op-dir <local op dir>

On the operator machine, `remote` runs one host phase in the background through
scripts/release/remote-bg.sh and waits on its exact PID (never `pgrep -f`):

  python3 scripts/release/content-release.py remote activate --op-id <id> --bundle-sha256 <sha> --helper <dir>

The refresh step keeps the nginx page store warm (docs/render-once.md §6): a new content
generation (`render-once.py generation`: nginx -t, reload, restore on failure), then
`render-once.py refresh` of the switch plan's changed URLs in their content languages through
nginx with the loopback `X-UAPT-Refresh` header. If the page store is not installed, or either
step fails, it falls back to warming the changed pages and the whole-cache epoch purge
(`uapt-program-release.py purge-html-cache`); receipts/refresh.json records which path ran.
Never purges Cloudflare and never notifies search engines (those stay operator steps).
Python 3.10, standard library only.
"""
import argparse, fcntl, hashlib, json, os, re, runpy, shlex, stat, subprocess, sys, tempfile, threading, time
import urllib.error, urllib.parse, urllib.request
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
        # Page store (docs/render-once.md): the generation file exists once the store is installed.
        self.generation_file = env_path('UAPT_HTML_CONTENT_GENERATION_FILE', '/etc/nginx/conf.d/uapt-html-content-generation.inc')
        self.page_store_origin = os.environ.get('UAPT_PAGE_STORE_ORIGIN', 'https://127.0.0.1')
        # A pre-rendered tree (R3) answers before the store; content releases cannot update it yet.
        self.page_tree_current = env_path('UAPT_PAGE_TREE_ROOT', '/srv/uapt/page-tree') / 'current'
        # Default: the helper's own render-once.py, pinned by HELPER.json like every helper file,
        # so its URL rules match the running program (UAPT_RENDER_ONCE overrides it).
        self.render_once = Path(os.environ['UAPT_RENDER_ONCE']) if os.environ.get('UAPT_RENDER_ONCE') else None
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
        args.helper_checked = True
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


def switch_plan(host, op):
    """The switch-<time>.json the activate step's switch wrote (named in switch-receipt.json)."""
    receipt = op.dir / 'switch-receipt.json'
    if not receipt.is_file():
        return None, 'no switch-receipt.json in the operation directory'
    plan = Path(read_json(receipt).get('planFile') or '')
    release = (host.content_root / 'releases' / op.cid).resolve()
    if not re.fullmatch(r'switch-[0-9TZ-]+\.json', plan.name) or plan.resolve().parent != release or not plan.is_file():
        return None, f'switch plan {plan} is not a switch-<time>.json of releases/{op.cid}'
    if read_json(plan).get('contentId') != op.cid:
        return None, f'switch plan {plan} names another release'
    return plan, None


def render_once_tool(host):
    return host.render_once or helper_root() / 'scripts/release/render-once.py'


def tail(text, n=800):
    return (text or '')[-n:]


def page_store_refresh(host, op, args, changed):
    """generation, then refresh. Returns (step, None) on success, (step, reason) when the caller
    must fall back to the epoch purge. Nothing here deletes cache files."""
    step = {'mode': 'page-store'}
    if not host.generation_file.is_file():
        return step, f'page store not installed ({host.generation_file} is missing)'
    if os.path.lexists(host.page_tree_current):
        # nginx try_files serves the tree before the store; neither a refresh nor the epoch purge
        # changes it. Capture + activate for content releases is R3 (docs/render-once.md §8).
        # cmd_refresh purges the rest first, then refuses.
        step['pageTree'] = str(host.page_tree_current)
        return step, f'a pre-rendered page tree is active ({host.page_tree_current})'
    plan, problem = switch_plan(host, op)
    if problem:
        return step, problem
    tool = render_once_tool(host)
    if not tool.is_file():
        return step, f'{tool} is missing'
    step.update(tool=str(tool), toolSha256=sha256_file(tool), plan=str(plan))
    generation = host.run(['python3', str(tool), 'generation', '--content-id', op.cid, '--file', str(host.generation_file),
                           '--log', str(host.state / 'html-content-generations.jsonl'), '--reason', f'content switch {op.cid} ({op.dir.name})'],
                          capture_output=True, text=True)
    step['generation'] = {'exit': generation.returncode, 'stdout': tail(generation.stdout, 1500), 'stderr': tail(generation.stderr)}
    if generation.returncode:
        return step, f'render-once generation exited {generation.returncode} (nginx keeps or restored the previous generation)'
    refresh_receipt = op.receipts / 'page-store-refresh.json'
    refresh = host.run(['python3', str(tool), 'refresh', '--plan', str(plan), '--plan', str(op.path('changedUrls')),
                        *sum((['--path', p] for p in changed.get('readbackFirst', [])), []),
                        '--origin', host.page_store_origin, '--max-seconds', str(args.warm_max_seconds), '--receipt', str(refresh_receipt)],
                       capture_output=True, text=True)
    step['refresh'] = {'exit': refresh.returncode, 'receipt': str(refresh_receipt), 'summary': tail(refresh.stdout, 1500), 'stderr': tail(refresh.stderr)}
    if refresh.returncode:
        return step, f'render-once refresh exited {refresh.returncode} (problems in {refresh_receipt.name})'
    return step, None


def warm_and_purge(host, op, args, changed):
    """Without the page store (or after it failed): warm the changed pages in Next over loopback,
    then the whole-cache epoch purge. Correct in every case, but the whole store goes cold."""
    warm_receipt = op.receipts / 'warm.json'
    warm = host.run(['python3', str(helper_root() / 'scripts/content-release/warm-changed-pages.py'), '--plan', str(op.path('changedUrls')),
                     *sum((['--path', p] for p in changed.get('readbackFirst', [])), []), '--receipt', str(warm_receipt),
                     '--max-seconds', str(args.warm_max_seconds)], capture_output=True, text=True)
    purge = host.run(['python3', str(host.program_release), 'purge-html-cache', '--reason', f'content switch {op.cid}'], capture_output=True, text=True)
    return ({'exit': warm.returncode, 'receipt': str(warm_receipt), 'summary': tail(warm.stdout, 1500)},
            {'exit': purge.returncode, 'stderr': tail(purge.stderr)})


def cmd_refresh(host, op, args):
    """Origin cache after the switch. Inputs: the switch plan (switch-receipt.json → planFile) and
    changed-urls.json ({schemaVersion, contentId, paths, readbackFirst}).
    1. page store (docs/render-once.md §6): `render-once.py generation` (new generation for generic
       pages and RSC variants; nginx -t + reload, restored on failure), then `render-once.py refresh`
       of the plan's and changed-urls' paths in their content languages, readback paths first.
       Receipt receipts/page-store-refresh.json.
    2. fallback when the store is not installed or step 1 fails: warm-changed-pages.py, then
       `uapt-program-release.py purge-html-cache` (the epoch purge before 2026-11-22).
    receipts/refresh.json: origin.mode = page-store | epoch-purge-fallback | epoch-purge.
    Cloudflare is purged by the operator afterwards (the token never reaches the host)."""
    pointer = read_json(host.content_root / 'current.json')
    if pointer.get('contentId') != op.cid:
        raise Refused(f'Live pointer is {pointer.get("contentId")}, not {op.cid}; refresh runs after activate')
    changed = read_json(op.path('changedUrls'))
    if changed.get('schemaVersion') != CHANGED_URLS_SCHEMA or changed.get('contentId') != op.cid or not isinstance(changed.get('paths'), list):
        raise Refused('Invalid changed-urls.json')
    if not getattr(args, 'helper_checked', False):  # standalone refresh: same pin as every other phase
        check_helper(host, slot_context(host)['cwd'], args.legacy_helper_reason)
    op.receipts.mkdir(exist_ok=True)
    try:
        store, reason = page_store_refresh(host, op, args, changed)
    except Refused:
        raise
    except Exception as error:  # malformed receipt or plan, OSError: never skip the fallback
        store, reason = {'mode': 'page-store', 'error': repr(error)[:800]}, f'page-store step raised {type(error).__name__}: {str(error)[:300]}'
    warm = None
    if reason is None:
        origin = {**store, 'status': 'ok'}
        failed = None
    else:
        installed = host.generation_file.is_file()
        log(('Page store refresh failed: ' if installed else 'Page store not used: ') + reason + '; falling back to warm + purge-html-cache.')
        warm, purge = warm_and_purge(host, op, args, changed)
        origin = {'mode': 'epoch-purge-fallback' if installed else 'epoch-purge', 'fallbackReason': reason,
                  **({'pageStore': store} if installed else {}), 'purge': purge}
        failed = 'Origin cache step failed (purge-html-cache)' if purge['exit'] else None
    status = 'incomplete' if failed or (warm and warm['exit']) else 'ok'
    op.write('refresh.json', {'status': status, 'origin': origin, **({'warm': warm} if warm else {}),
                              'next': 'Cloudflare purge_everything (operator), then the paced public readback (<= 5 requests/s, waits out 429), then complete.'})
    if failed:
        raise Refused(failed + '; nothing else changed. Run refresh again after fixing it.')
    if store.get('pageTree'):
        raise Refused(f'The switch is live and the origin cache was purged, but a pre-rendered page tree is active ({store["pageTree"]}; '
                      'UAPT_PAGE_TREE_ROOT if nginx --page-tree points elsewhere): its school/changes pages still show the previous release. '
                      'Deactivate it (render-once.py deactivate) or capture and activate a tree for this release (R3), then purge Cloudflare.')
    if warm and warm['exit']:
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


# ---------------------------------------------------------------- local: paced public readback

# Public reads go through Cloudflare, whose rate limit (docs/stop-bleed-set2-20261121.md 0.4b)
# allows 60 requests / 10 s per IP on */universities/* and */changes/* and then blocks for 10 s
# (the 2026-11-22 program completion was refused on 429s; program-release.py fetch(), PR #53).
# Public reads are paced at <= 5 requests/s and a 429 waits out the block.
PUBLIC_MIN_INTERVAL_SECONDS = 0.2
RATE_LIMIT_WAIT_SECONDS = 12
RATE_LIMIT_RETRIES = 3
RATE_LIMIT_MAX_WAIT_SECONDS = 60
PUBLIC_ORIGIN = 'https://eduaipolicy.org'
PUBLIC_READBACK_SCHEMA = 'uapt-content-public-readback-v1'
UI_SAMPLE_LOCALES = ('fr', 'de', 'ja', 'es', 'ko', 'ar', 'pl', 'nl')


class _NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def http_get(url, headers=None, timeout=120):
    """GET without following redirects: (status, body, lower-case headers, seconds); status 0 on a network error."""
    request = urllib.request.Request(url, headers={'User-Agent': 'uapt-content-release/1.0', **(headers or {})})
    started = time.monotonic()
    try:
        with urllib.request.build_opener(_NoRedirect).open(request, timeout=timeout) as response:
            return response.status, response.read(), {k.lower(): v for k, v in response.headers.items()}, time.monotonic() - started
    except urllib.error.HTTPError as error:
        body = error.read() if error.fp else b''
        return error.code, body, {k.lower(): v for k, v in (error.headers or {}).items()}, time.monotonic() - started
    except (urllib.error.URLError, OSError) as error:
        return 0, b'', {'error': str(error)[:300]}, time.monotonic() - started


def is_loopback(base):
    return urllib.parse.urlsplit(base).hostname in ('127.0.0.1', '::1', 'localhost')


class PublicReader:
    """Thread-safe paced GET. Public origins: request starts at least 0.2 s apart (<= 5/s, also
    across threads), a 429 sleeps Retry-After (at least 12 s) and retries up to 3 times; 5xx and
    network errors retry up to `attempts` times. Loopback origins are not paced. Never follows
    redirects (a 301/308 is an answer). scripts/v6-pipeline/readback.py uses it too."""
    def __init__(self, base, *, get=http_get, sleep=time.sleep, clock=time.monotonic, attempts=3, timeout=300, paced=None):
        self.base = base.rstrip('/')
        self.get, self.sleep, self.clock, self.attempts, self.timeout = get, sleep, clock, attempts, timeout
        self.paced = (not is_loopback(base)) if paced is None else paced
        self.lock = threading.Lock(); self.next_at = 0.0
        self.requests = 0; self.rate_limited = 0
        self.retried = {}  # path (without query) -> statuses answered before the final one (5xx, 0, 429)

    def _pace(self):
        with self.lock:
            self.requests += 1
            if not self.paced: return
            now = self.clock()
            wait = self.next_at - now
            self.next_at = max(now, self.next_at) + PUBLIC_MIN_INTERVAL_SECONDS
        if wait > 0: self.sleep(wait)

    def __call__(self, path, headers=None):
        limited, attempt = RATE_LIMIT_RETRIES, 0
        while True:
            self._pace()
            status, body, response_headers, seconds = self.get(self.base + path, headers, self.timeout)
            if status == 429 and limited > 0:
                limited -= 1
                with self.lock: self.rate_limited += 1; self.retried.setdefault(path.split('?', 1)[0], []).append(status)
                self.sleep(retry_after(response_headers)); continue
            attempt += 1
            if (status and status < 500) or attempt >= self.attempts:
                return status, body, response_headers, seconds
            # A 5xx/524 is retried but kept: after a refresh it is a finding (docs/content-release.md §5).
            with self.lock: self.retried.setdefault(path.split('?', 1)[0], []).append(status)
            self.sleep(3)


def retry_after(headers):
    try: return min(RATE_LIMIT_MAX_WAIT_SECONDS, max(RATE_LIMIT_WAIT_SECONDS, int(headers.get('retry-after', '0'))))
    except (TypeError, ValueError): return RATE_LIMIT_WAIT_SECONDS


def readback_paths(changed, schools):
    """Content-language paths of changed-urls.json (readback set first, then the rest and the API
    records) plus a small UI-locale sample: one /<uiLocale>/universities/<slug> per changed school
    (up to 8), which must be a native page (200) or a 308 to the English page."""
    content, seen = [], set()
    for path in changed.get('readbackFirst', []) + changed['paths']:
        locale = (re.match(r'^/([A-Za-z]{2}(?:-[A-Za-z]{2,4})?)(?=/|$)', path) or [None, None])[1]
        if path in seen or (locale and locale != 'zh' and not path.startswith('/api/')): continue
        seen.add(path); content.append(path)
    sample = [f'/{UI_SAMPLE_LOCALES[i % len(UI_SAMPLE_LOCALES)]}/universities/{slug}' for i, slug in enumerate(sorted(schools)[:8])]
    return content, sample


def readback_row(path, status, body, headers, seconds, *, ui_locale=False):
    row = {'path': path, 'status': status, 'seconds': round(seconds or 0, 3), 'sha256': sha256_bytes(body or b'')}
    for key in ('cf-cache-status', 'x-uapt-origin-cache', 'location'):
        if headers.get(key): row[key] = headers[key]
    problems = []
    if ui_locale and status in (301, 308):
        target = urllib.parse.urlsplit(headers.get('location', ''))
        if target.path != '/' + path.split('/', 2)[2]:
            problems.append('UI-locale redirect does not point at the English page: ' + headers.get('location', '(none)'))
    elif status != 200:
        problems.append(f'status {status}' + (f' ({headers["error"]})' if headers.get('error') else ''))
    elif b'__next_error__' in (body or b'') or b'Application error' in (body or b''):
        problems.append('application error in the page')
    if problems: row['problems'] = problems
    return row


def cmd_readback(args, *, get=http_get, sleep=time.sleep, clock=time.monotonic):
    """Operator machine, after the Cloudflare purge: public readback of the release's changed URLs
    in their content languages, paced (<= 5 requests/s, waits out 429). Writes
    <op-dir>/receipts/public-readback.json; exit 1 when any row has problems."""
    op_dir = Path(args.op_dir)
    raw = read_json(op_dir / 'bundle.json')
    bundle = validate_bundle(raw, str(raw.get('opId')))  # the local directory may have another name
    changed = read_json(op_dir / bundle['files']['changedUrls'])
    if changed.get('schemaVersion') != CHANGED_URLS_SCHEMA or changed.get('contentId') != bundle['contentId'] or not isinstance(changed.get('paths'), list):
        raise Refused('Invalid changed-urls.json')
    content, sample = readback_paths(changed, bundle['changedSchools'])
    reader = PublicReader(args.origin, get=get, sleep=sleep, clock=clock)
    started = now().isoformat()
    rows = [readback_row(p, *reader(p)) for p in content] + [readback_row(p, *reader(p), ui_locale=True) for p in sample]
    for row in rows:
        earlier = [s for s in reader.retried.get(row['path'], []) if s != 429]
        if earlier:  # answered on a retry: still a finding (a 524 means a cold render reached the edge)
            row['retriedAfter'] = earlier
            row.setdefault('problems', []).append(f'answered only after {earlier} (retried)')
    problems = [r for r in rows if r.get('problems')]
    receipt = {'schemaVersion': PUBLIC_READBACK_SCHEMA, 'opId': bundle['opId'], 'contentId': bundle['contentId'], 'origin': reader.base,
               'startedAt': started, 'checkedAt': now().isoformat(), 'paced': reader.paced, 'minIntervalSeconds': PUBLIC_MIN_INTERVAL_SECONDS,
               'requests': reader.requests, 'rateLimited': reader.rate_limited, 'rows': rows, 'problems': [{'path': r['path'], 'problems': r['problems']} for r in problems]}
    (op_dir / 'receipts').mkdir(exist_ok=True)
    atomic_json(op_dir / 'receipts/public-readback.json', receipt, mode=0o644)
    print(json.dumps({k: receipt[k] for k in ('origin', 'requests', 'rateLimited')} | {'rows': len(rows), 'problems': receipt['problems'][:10]}, ensure_ascii=False))
    return 1 if problems else 0


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
    b = sub.add_parser('readback', help='operator machine, after the Cloudflare purge: paced public readback of changed-urls.json')
    b.add_argument('--op-dir', required=True, help='the local operation directory (bundle.json, changed-urls.json)')
    b.add_argument('--origin', default=PUBLIC_ORIGIN)
    args = parser.parse_args(argv)
    if args.phase_cmd == 'remote':
        return cmd_remote(args)
    if args.phase_cmd == 'readback':
        return cmd_readback(args)
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
