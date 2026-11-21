"""scripts/release/content-release.py and scripts/content-release/sync-proof.py on a fake host tree.

Nothing here touches a server: the controller is a small fake module, systemd/HTTP are stubbed,
and the real install-tree.py and sync-proof.py run against temporary directories.
"""
import hashlib, io, json, os, runpy, shutil, subprocess, sys, tempfile, unittest
from contextlib import redirect_stdout, redirect_stderr
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
TOOL = REPO / 'scripts/release/content-release.py'
PROOF = REPO / 'scripts/content-release/sync-proof.py'
sha = lambda b: hashlib.sha256(b).hexdigest()

FAKE_CONTROLLER = '''
import json
from pathlib import Path
LOCK = Path(__file__).with_name('release.lock')
CALLS = Path(__file__).with_name('calls.jsonl')
def _log(name, **kw):
    with CALLS.open('a') as f: f.write(json.dumps({'call': name, **kw}) + '\\n')
def audit(): return {'disk': {}}
def validate_retention_receipt(plan, observed, policy):
    if Path(__file__).with_name('STALE').exists(): raise ValueError('Retention receipt is stale; rescan current dependencies')
def validate_disk_budget(plan, policy, observed): _log('disk', peak=plan['diskBudget']['peakAdditionalBytesByStage']['candidate'])
def write(path, value): Path(path).write_text(json.dumps(value, indent=1))
def checkpoint_hold_clocks(receipt, policy): _log('clocks', holds=len(receipt.get('contentReleaseHolds', [])))
def classify_content(policy, reason, dry_run=False): _log('classify', reason=reason); return {'written': False, 'added': []}
def rescan(policy, reason, dry_run=False): _log('rescan', reason=reason); return {'path': 'register', 'sha256': '0' * 64, 'backup': 'b', 'check': 'passed'}
def write_hold_status(policy, at=None): _log('hold-status'); return {'status': 'ok', 'warning': [], 'overdue': []}, Path('hold-status.json')
'''


def write_json(path, value):
    path = Path(path); path.parent.mkdir(parents=True, exist_ok=True); path.write_text(json.dumps(value, indent=1) + '\n')
    return path


def make_release(root, cid, parent, files):
    """Objects + manifest bytes for a release (not installed)."""
    rows = []
    for rel, data in files.items():
        digest = sha(data)
        obj = root / 'objects' / digest[:2] / digest
        obj.parent.mkdir(parents=True, exist_ok=True)
        if not obj.exists(): obj.write_bytes(data)
        rows.append([rel, digest, len(data)])
    manifest = {'schemaVersion': 'uapt-content-release-v1', 'contentId': cid, 'parentContentId': parent, 'requiredSyncContract': '2.1.0', 'files': rows}
    return json.dumps(manifest).encode()


class FakeHost:
    def __init__(self, base, module):
        self.base = base
        self.state = base / 'state'
        self.controller_path = base / 'controller.py'
        self.program_release = base / 'program-release.py'
        self.origin_hook = base / 'no-hook'
        self.content_root = base / 'content'
        self.ops_root = base / 'operations'
        self.releases_root = base / 'releases'
        self.mcp_url = 'http://127.0.0.1:3161'
        self.node = 'node'
        self.module = module
        self.slot_cwd = str(base / 'releases/uapt-program-aaaaaaaaaaaa-x/apps/web')
        self.posts = []
        self.commands = []
        self._controller = None

    @property
    def controller(self):
        if self._controller is None: self._controller = runpy.run_path(str(self.controller_path))
        return self._controller

    def active_slot(self):
        return 'uapt-mcp-v6-candidate.service', 3101, 4242, self.slot_cwd

    def process_env(self, pid):
        return {'UAPT_CONTENT_ROOT': str(self.content_root), 'UAPT_CONTENT_REFRESH_TOKEN': 't' * 40}

    def http_json(self, url, *, token=None, body=None, timeout=30):
        live = json.loads((self.content_root / 'current.json').read_text())['contentId']
        if body is not None:
            self.posts.append((url, body)); return {'expired': len(body.get('paths', []))}
        return {'contentId': live}

    def run(self, argv, **kw):
        self.commands.append(argv)
        joined = ' '.join(map(str, argv))
        ok = subprocess.CompletedProcess(argv, 0, stdout='{}', stderr='')
        if 'policy-inventory.py' in joined or 'warm-changed-pages.py' in joined or 'purge-html-cache' in joined:
            return ok
        if 'switch.ts' in joined or 'switch.mjs' in joined:
            cid = argv[argv.index('--content-id') + 1]
            manifest = (self.content_root / 'releases' / cid / 'manifest.json').read_bytes()
            write_json(self.content_root / 'current.json', {'contentId': cid, 'manifestSha256': sha(manifest)})
            out = {'pointer': {'manifestSha256': sha(manifest)}, 'mcp': {'status': 'updated'}, 'refresh': {'contentId': cid}, 'changedSchools': ['alpha-university']}
            return subprocess.CompletedProcess(argv, 0, stdout=json.dumps(out), stderr='')
        if 'install-tree.py' in joined:
            return subprocess.run(argv, **kw)
        raise AssertionError('unexpected command ' + joined)


class ContentReleaseHostTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory(); base = Path(self.tmp.name); self.base = base
        self.module = runpy.run_path(str(TOOL))
        (base / 'controller.py').write_text(FAKE_CONTROLLER)
        self.host = FakeHost(base, self.module)
        content = base / 'content'
        parent_files = {'data/a.json': b'{"a":1}\n', 'data/public-change-history/objects/x.json': b'{"x":1}\n'}
        parent_raw = make_release(content, 'c-parent', 'c-grand', parent_files)
        write_json(content / 'current.json', {'contentId': 'c-parent', 'manifestSha256': sha(parent_raw)})
        (content / 'releases/c-parent').mkdir(parents=True)
        (content / 'releases/c-parent/manifest.json').write_bytes(parent_raw)
        # New release: one changed object, uploaded in the op dir.
        new_files = {**parent_files, 'data/a.json': b'{"a":2}\n'}
        stage = base / 'stage'
        new_raw = make_release(stage, 'c-new', 'c-parent', new_files)
        op = base / 'operations/content-new-op'
        changed = sha(b'{"a":2}\n')
        (op / 'objects' / changed[:2]).mkdir(parents=True)
        shutil.copy(stage / 'objects' / changed[:2] / changed, op / 'objects' / changed[:2] / changed)
        sync = op / 'sync/content-candidate'
        sync.mkdir(parents=True)
        (sync / 'basis.json').write_bytes(new_raw)
        write_json(sync / 'event.json', {'basisSha256': sha(new_raw), 'syncContractVersion': '2.1.0', 'phase': 'candidate'})
        proof = sync / 'proof/public-change-history/objects/x.json'; proof.parent.mkdir(parents=True); proof.write_bytes(b'{"x":1}\n')
        runpy.run_path(str(PROOF))['dehydrate'](sync)
        write_json(op / 'isr-expiry-request.json', {'expectedContentId': 'c-new', 'tags': ['school:alpha-university'], 'paths': ['/universities/alpha-university']})
        write_json(op / 'changed-urls.json', {'schemaVersion': 'uapt-changed-urls-v1', 'contentId': 'c-new', 'readbackFirst': ['/universities/alpha-university'], 'paths': ['/universities/alpha-university']})
        bundle = {'schemaVersion': 'uapt-content-release-bundle-v1', 'opId': 'content-new-op', 'contentId': 'c-new', 'parentContentId': 'c-parent',
                  'manifestSha256': sha(new_raw), 'parentManifestSha256': sha(parent_raw), 'requiredSyncContract': '2.1.0',
                  'changedSchools': ['alpha-university'], 'files': {'syncCandidate': 'sync/content-candidate/event.json', 'isrExpiry': 'isr-expiry-request.json', 'changedUrls': 'changed-urls.json'},
                  'hold': {'reason': 'test release'}, 'authorization': 'User: "publish it"'}
        self.bundle_raw = (json.dumps(bundle, indent=2) + '\n').encode()
        (op / 'bundle.json').write_bytes(self.bundle_raw)
        self.op = op
        state = base / 'state'
        write_json(state / 'policy.json', {'retentionRegister': str(state / 'register.json'), 'diskCapacity': {'artifactMaxBytesByRole': {'shared-web': 10 ** 9}}, 'retentionEnforcement': {}})
        write_json(state / 'register.json', {'basisSha256': '0' * 64, 'contentReleaseHolds': []})
        write_json(state / 'transaction.json', {'stage': 'complete'})

    def tearDown(self):
        self.tmp.cleanup()

    def main(self, *argv):
        out, err = io.StringIO(), io.StringIO()
        with redirect_stdout(out), redirect_stderr(err):
            code = self.module['main'](list(argv), host=self.host)
        return code, out.getvalue(), err.getvalue()

    def calls(self):
        path = self.base / 'calls.jsonl'
        return [json.loads(l)['call'] for l in path.read_text().splitlines()] if path.exists() else []

    def activate(self, *extra):
        return self.main('activate', '--op', str(self.op), '--bundle-sha256', sha(self.bundle_raw), '--legacy-helper-reason', 'test checkout', *extra)

    def test_activate_installs_switches_expires_and_refreshes(self):
        code, out, _ = self.activate()
        self.assertEqual(code, 0)
        live = json.loads((self.base / 'content/current.json').read_text())
        self.assertEqual(live['contentId'], 'c-new')
        tree = self.base / 'content/releases/c-new/tree/data/a.json'
        self.assertEqual(tree.read_bytes(), b'{"a":2}\n')
        register = json.loads((self.base / 'state/register.json').read_text())
        self.assertEqual([h['reason'] for h in register['contentReleaseHolds']], ['test release'])
        self.assertIn('clocks', self.calls())
        self.assertEqual(self.host.posts[0][1]['expectedContentId'], 'c-new')
        receipts = sorted(p.name for p in (self.op / 'receipts').iterdir())
        self.assertEqual(receipts, ['activate.json', 'refresh.json'])
        refresh = json.loads((self.op / 'receipts/refresh.json').read_text())
        self.assertEqual(refresh['origin']['mode'], 'epoch-purge')
        proofs = json.loads((self.op / 'receipts/activate.json').read_text())['proofs']
        self.assertEqual((proofs['mode'], proofs['linked']), ('hash-manifest', 1))
        # The proof was materialized as a hard link to the content store object.
        linked = self.op / 'sync/content-candidate/proof/public-change-history/objects/x.json'
        self.assertGreater(linked.stat().st_nlink, 1)

    def test_activate_refuses_other_bundle_bytes(self):
        with self.assertRaisesRegex(self.module['Refused'], 'approved bundle'):
            self.main('activate', '--op', str(self.op), '--bundle-sha256', '1' * 64, '--legacy-helper-reason', 'test')

    def test_stale_retention_names_the_next_action(self):
        (self.base / 'STALE').write_text('')
        with self.assertRaisesRegex(self.module['Refused'], 'rescan --reason'):
            self.activate()
        self.assertEqual(json.loads((self.base / 'content/current.json').read_text())['contentId'], 'c-parent')

    def test_refuses_when_live_pointer_is_not_the_parent(self):
        write_json(self.base / 'content/current.json', {'contentId': 'c-other', 'manifestSha256': '2' * 64})
        with self.assertRaisesRegex(self.module['Refused'], 'built on c-parent'):
            self.activate()

    def test_refuses_foreign_uploaded_object(self):
        junk = b'not in the manifest'
        digest = sha(junk); (self.op / 'objects' / digest[:2]).mkdir(exist_ok=True); (self.op / 'objects' / digest[:2] / digest).write_bytes(junk)
        with self.assertRaisesRegex(self.module['Refused'], 'Unexpected object'):
            self.activate()

    def test_bundle_must_name_its_operation(self):
        other = self.base / 'operations/renamed'; shutil.copytree(self.op, other)
        with self.assertRaisesRegex(self.module['Refused'], 'does not name this operation'):
            self.main('check', '--op', str(other), '--legacy-helper-reason', 'test')

    def test_complete_registers_rescans_and_dehydrates(self):
        self.activate()
        manifest_sha = json.loads(self.bundle_raw)['manifestSha256']
        complete = self.op / 'sync/content-complete'; complete.mkdir(parents=True)
        write_json(complete / 'event.json', {'basisSha256': manifest_sha, 'syncContractVersion': '2.1.0', 'phase': 'complete'})
        code, _, _ = self.main('complete', '--op', str(self.op), '--legacy-helper-reason', 'test')
        self.assertEqual(code, 0)
        register = json.loads((self.base / 'state/register.json').read_text())
        self.assertEqual(register['contentActive']['contentId'], 'c-new')
        self.assertEqual(register['contentRollback']['contentId'], 'c-parent')
        self.assertEqual(register['contentReleaseHolds'], [])
        calls = self.calls()
        self.assertIn('rescan', calls); self.assertIn('hold-status', calls)
        self.assertNotIn('classify', calls)  # policy has no contentReleaseRoot yet
        self.assertFalse((self.op / 'sync/content-candidate/proof').exists())
        self.assertTrue((self.op / 'sync/content-candidate/proof-manifest.json').exists())

    def test_complete_classifies_once_policy_names_the_content_root(self):
        self.activate()
        policy = json.loads((self.base / 'state/policy.json').read_text()); policy['retentionEnforcement']['contentReleaseRoot'] = str(self.base / 'content')
        write_json(self.base / 'state/policy.json', policy)
        complete = self.op / 'sync/content-complete'; complete.mkdir(parents=True)
        write_json(complete / 'event.json', {'basisSha256': json.loads(self.bundle_raw)['manifestSha256']})
        self.main('complete', '--op', str(self.op), '--legacy-helper-reason', 'test')
        self.assertIn('classify', self.calls())

    def test_program_helper_must_belong_to_the_active_program(self):
        program = self.base / 'releases/uapt-program-aaaaaaaaaaaa-x'
        helper = program / 'release-helper'
        for rel in ['scripts/release/content-release.py', 'scripts/content-release/sync-proof.py', 'scripts/content-release/install-tree.py']:
            (helper / rel).parent.mkdir(parents=True, exist_ok=True); shutil.copy(REPO / rel, helper / rel)
        code_sha = 'a' * 40
        files = {rel: sha((helper / rel).read_bytes()) for rel in ['scripts/release/content-release.py']}
        write_json(helper / 'HELPER.json', {'schemaVersion': 'uapt-release-helper-v1', 'codeSha': code_sha, 'files': files})
        write_json(program / 'build-artifact-manifest.json', {'codeSha': code_sha})
        pinned = runpy.run_path(str(helper / 'scripts/release/content-release.py'))
        info = pinned['check_helper'](self.host, self.host.slot_cwd)
        self.assertEqual((info['mode'], info['codeSha']), ('program-artifact', code_sha))
        with self.assertRaisesRegex(pinned['Refused'], 'active web slot runs from'):
            pinned['check_helper'](self.host, str(self.base / 'releases/uapt-program-bbbbbbbbbbbb-y/apps/web'))
        (helper / 'scripts/release/content-release.py').write_text('# changed\n')
        with self.assertRaisesRegex(pinned['Refused'], 'changed after packaging'):
            pinned['check_helper'](self.host, self.host.slot_cwd)

    def test_remote_waits_on_the_exact_pid(self):
        calls = []
        def fake_run(argv, **kw):
            calls.append(argv)
            return subprocess.CompletedProcess(argv, 0, stdout='12345\n' if argv[1] == 'start' else 'log', stderr='')
        self.module['cmd_remote'].__globals__['subprocess'] = type('S', (), {'run': staticmethod(fake_run), 'CompletedProcess': subprocess.CompletedProcess})
        try:
            with redirect_stdout(io.StringIO()):
                code = self.module['main'](['remote', 'activate', '--op-id', 'content-new-op', '--helper', '/srv/uapt/releases/p/release-helper', '--bundle-sha256', 'a' * 64])
        finally:
            self.module['cmd_remote'].__globals__['subprocess'] = subprocess
        self.assertEqual(code, 0)
        self.assertEqual([c[1] for c in calls], ['start', 'wait', 'tail'])
        self.assertIn('--bundle-sha256', calls[0])
        self.assertEqual(calls[1][2], 'content-new-op-activate')
        self.assertFalse(any('pgrep' in ' '.join(c) for c in calls))


class SyncProofTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory(); self.base = Path(self.tmp.name)
        self.proof = runpy.run_path(str(PROOF))
        self.sync = self.base / 'sync'; self.store = self.base / 'objects'
        for name, data in [('proof/a/manifest-1.json', b'{"m":1}\n'), ('proof/a/objects/o.json', b'{"o":1}\n')]:
            p = self.sync / name; p.parent.mkdir(parents=True, exist_ok=True); p.write_bytes(data)
            digest = sha(data); (self.store / digest[:2]).mkdir(parents=True, exist_ok=True); (self.store / digest[:2] / digest).write_bytes(data)
        (self.sync / 'event.json').write_text('{}')

    def tearDown(self):
        self.tmp.cleanup()

    def test_round_trip_keeps_paths_and_hashes(self):
        before = {p.relative_to(self.sync).as_posix(): p.read_bytes() for p in self.sync.rglob('*') if p.is_file()}
        result = self.proof['dehydrate'](self.sync)
        self.assertEqual(result['files'], 2)
        self.assertFalse((self.sync / 'proof').exists())
        self.proof['materialize'](self.sync, [str(self.store)])
        after = {p.relative_to(self.sync).as_posix(): p.read_bytes() for p in self.sync.rglob('*') if p.is_file() and p.name != 'proof-manifest.json'}
        self.assertEqual(before, after)
        self.assertTrue(self.proof['verify'](self.sync)['verified'])

    def test_missing_object_is_refused(self):
        self.proof['dehydrate'](self.sync)
        shutil.rmtree(self.store)
        with self.assertRaisesRegex(self.proof['ProofError'], 'in no object store'):
            self.proof['materialize'](self.sync, [str(self.store)])

    def test_tampered_manifest_is_refused(self):
        self.proof['dehydrate'](self.sync)
        manifest = json.loads((self.sync / 'proof-manifest.json').read_text())
        manifest['files'][0][0] = 'proof/../event.json'
        (self.sync / 'proof-manifest.json').write_text(json.dumps(manifest))
        with self.assertRaisesRegex(self.proof['ProofError'], 'Unsafe proof path'):
            self.proof['materialize'](self.sync, [str(self.store)])

    def test_changed_object_store_bytes_are_refused(self):
        self.proof['dehydrate'](self.sync)
        digest = json.loads((self.sync / 'proof-manifest.json').read_text())['files'][0][1]
        obj = self.store / digest[:2] / digest; obj.write_bytes(b'{"m":2}\n')
        with self.assertRaisesRegex(self.proof['ProofError'], 'does not match its name'):
            self.proof['materialize'](self.sync, [str(self.store)])


class ProjectionValidatorTest(unittest.TestCase):
    def test_bundled_validator_when_no_tsx(self):
        inventory = runpy.run_path(str(REPO / 'scripts/policy-inventory.py'))
        with tempfile.TemporaryDirectory() as tmp:
            repo = Path(tmp)
            with self.assertRaisesRegex(ValueError, 'No change projection validator'):
                inventory['projection_validator'](repo)
            bundled = repo / 'scripts/validate-change-event-projection.mjs'; bundled.parent.mkdir(parents=True); bundled.write_text('')
            self.assertEqual(inventory['projection_validator'](repo)[-1], str(bundled))
            tsx = repo / 'node_modules/tsx/dist/cli.mjs'; tsx.parent.mkdir(parents=True); tsx.write_text('')
            self.assertIn(str(tsx), inventory['projection_validator'](repo))


if __name__ == '__main__':
    unittest.main()
