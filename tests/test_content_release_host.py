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
        self.generation_file = base / 'nginx/uapt-html-content-generation.inc'  # absent: page store not installed
        self.page_store_origin = 'https://127.0.0.1'
        self.page_tree_current = base / 'page-tree/current'
        self.render_once = None  # the helper's own render-once.py
        self.render_once_exit = {'generation': 0, 'refresh': 0}
        self.purge_exit = 0
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
        if 'policy-inventory.py' in joined or 'warm-changed-pages.py' in joined:
            return ok
        if 'purge-html-cache' in joined:
            return subprocess.CompletedProcess(argv, self.purge_exit, stdout='{}', stderr='purge failed' if self.purge_exit else '')
        if 'render-once.py' in joined:
            action = argv[2]
            code = self.render_once_exit[action]
            if action == 'refresh':
                write_json(argv[argv.index('--receipt') + 1], {'schemaVersion': 'uapt-page-store-refresh-v1', 'problems': [{'path': '/x'}] if code else []})
            return subprocess.CompletedProcess(argv, code, stdout=json.dumps({'action': action}), stderr='nginx -t failed' if code else '')
        if 'switch.ts' in joined or 'switch.mjs' in joined:
            cid = argv[argv.index('--content-id') + 1]
            manifest = (self.content_root / 'releases' / cid / 'manifest.json').read_bytes()
            write_json(self.content_root / 'current.json', {'contentId': cid, 'manifestSha256': sha(manifest)})
            plan = write_json(self.content_root / 'releases' / cid / 'switch-2026-11-22T10-00-00-000Z.json',
                              {'schemaVersion': 'uapt-content-switch-v1', 'contentId': cid, 'paths': ['/universities/alpha-university', '/zh/universities/alpha-university']})
            out = {'pointer': {'manifestSha256': sha(manifest)}, 'planFile': str(plan), 'mcp': {'status': 'updated'}, 'refresh': {'contentId': cid}, 'changedSchools': ['alpha-university']}
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
        self.assertEqual(refresh['origin']['mode'], 'epoch-purge')  # no page store on this host
        self.assertIn('page store not installed', refresh['origin']['fallbackReason'])
        self.assertEqual(self.commands('render-once.py'), [])
        proofs = json.loads((self.op / 'receipts/activate.json').read_text())['proofs']
        self.assertEqual((proofs['mode'], proofs['linked']), ('hash-manifest', 1))
        # The proof was materialized as a hard link to the content store object.
        linked = self.op / 'sync/content-candidate/proof/public-change-history/objects/x.json'
        self.assertGreater(linked.stat().st_nlink, 1)

    # ---- refresh: page store first, epoch purge as the fallback (docs/render-once.md §6)

    def install_page_store(self):
        self.host.generation_file.parent.mkdir(parents=True, exist_ok=True)
        self.host.generation_file.write_text('map "" $uapt_html_content_generation { default "c-parent"; }\n')

    def commands(self, needle):
        return [c for c in self.host.commands if any(needle in str(a) for a in c)]

    def refresh_receipt(self):
        return json.loads((self.op / 'receipts/refresh.json').read_text())

    def test_page_store_generation_then_refresh_replaces_the_purge(self):
        self.install_page_store()
        code, _, _ = self.activate()
        self.assertEqual(code, 0)
        gen, ref = self.commands('render-once.py')
        self.assertEqual(gen[2], 'generation')
        self.assertEqual(gen[gen.index('--content-id') + 1], 'c-new')
        self.assertEqual(gen[gen.index('--file') + 1], str(self.host.generation_file))
        self.assertIn('content switch c-new', gen[gen.index('--reason') + 1])
        self.assertEqual(ref[2], 'refresh')
        plans = [ref[i + 1] for i, a in enumerate(ref) if a == '--plan']
        self.assertEqual(plans, [str(self.base / 'content/releases/c-new/switch-2026-11-22T10-00-00-000Z.json'), str(self.op.resolve() / 'changed-urls.json')])
        self.assertEqual([ref[i + 1] for i, a in enumerate(ref) if a == '--path'], ['/universities/alpha-university'])
        self.assertEqual(ref[ref.index('--receipt') + 1], str(self.op.resolve() / 'receipts/page-store-refresh.json'))
        self.assertEqual(ref[ref.index('--origin') + 1], 'https://127.0.0.1')
        self.assertEqual(self.commands('purge-html-cache'), [])
        self.assertEqual(self.commands('warm-changed-pages.py'), [])
        receipt = self.refresh_receipt()
        self.assertEqual((receipt['status'], receipt['origin']['mode']), ('ok', 'page-store'))
        self.assertEqual(receipt['origin']['toolSha256'], sha((REPO / 'scripts/release/render-once.py').read_bytes()))
        self.assertNotIn('fallbackReason', receipt['origin'])
        self.assertIn('<= 5 requests/s', receipt['next'])

    def test_failed_generation_falls_back_to_warm_and_purge(self):
        self.install_page_store(); self.host.render_once_exit['generation'] = 2
        code, _, err = self.activate()
        self.assertEqual(code, 0)
        self.assertEqual([c[2] for c in self.commands('render-once.py')], ['generation'])  # no refresh after a failed generation
        self.assertEqual(len(self.commands('purge-html-cache')), 1)
        self.assertEqual(len(self.commands('warm-changed-pages.py')), 1)
        receipt = self.refresh_receipt()
        self.assertEqual((receipt['status'], receipt['origin']['mode']), ('ok', 'epoch-purge-fallback'))
        self.assertIn('generation exited 2', receipt['origin']['fallbackReason'])
        self.assertEqual(receipt['origin']['pageStore']['generation']['exit'], 2)
        self.assertIn('falling back', err)

    def test_failed_page_store_refresh_falls_back_to_warm_and_purge(self):
        self.install_page_store(); self.host.render_once_exit['refresh'] = 1
        self.activate()
        self.assertEqual([c[2] for c in self.commands('render-once.py')], ['generation', 'refresh'])
        self.assertEqual(len(self.commands('purge-html-cache')), 1)
        receipt = self.refresh_receipt()
        self.assertEqual(receipt['origin']['mode'], 'epoch-purge-fallback')
        self.assertIn('refresh exited 1', receipt['origin']['fallbackReason'])
        self.assertEqual(receipt['origin']['pageStore']['refresh']['exit'], 1)
        self.assertTrue((self.op / 'receipts/page-store-refresh.json').is_file())

    def test_without_a_switch_plan_the_store_is_purged_not_half_refreshed(self):
        self.install_page_store()
        self.activate('--no-refresh')
        (self.op / 'switch-receipt.json').unlink()
        code, _, _ = self.main('refresh', '--op', str(self.op), '--legacy-helper-reason', 'test')
        self.assertEqual(code, 0)
        self.assertEqual(self.commands('render-once.py'), [])
        receipt = self.refresh_receipt()
        self.assertEqual(receipt['origin']['mode'], 'epoch-purge-fallback')
        self.assertIn('switch-receipt.json', receipt['origin']['fallbackReason'])

    def test_switch_plan_must_belong_to_this_release(self):
        self.install_page_store()
        self.activate('--no-refresh')
        foreign = write_json(self.base / 'content/releases/c-parent/switch-2026-11-21T00-00-00-000Z.json', {'contentId': 'c-parent', 'paths': []})
        write_json(self.op / 'switch-receipt.json', {'planFile': str(foreign)})
        self.main('refresh', '--op', str(self.op), '--legacy-helper-reason', 'test')
        self.assertEqual(self.commands('render-once.py'), [])
        self.assertIn('is not a switch-<time>.json of releases/c-new', self.refresh_receipt()['origin']['fallbackReason'])

    def test_failed_fallback_purge_is_refused_and_recorded(self):
        self.install_page_store(); self.host.render_once_exit['generation'] = 2; self.host.purge_exit = 1
        self.activate('--no-refresh')
        with self.assertRaisesRegex(self.module['Refused'], 'purge-html-cache'):
            self.main('refresh', '--op', str(self.op), '--legacy-helper-reason', 'test')
        receipt = self.refresh_receipt()
        self.assertEqual((receipt['status'], receipt['origin']['mode'], receipt['origin']['purge']['exit']), ('incomplete', 'epoch-purge-fallback', 1))

    def test_an_unexpected_error_in_the_page_store_step_still_purges(self):
        self.install_page_store()
        self.activate('--no-refresh')
        (self.op / 'switch-receipt.json').write_text('{not json')
        code, _, _ = self.main('refresh', '--op', str(self.op), '--legacy-helper-reason', 'test')
        self.assertEqual(code, 0)
        receipt = self.refresh_receipt()
        self.assertEqual(receipt['origin']['mode'], 'epoch-purge-fallback')
        self.assertIn('raised JSONDecodeError', receipt['origin']['fallbackReason'])
        self.assertEqual(len(self.commands('purge-html-cache')), 1)

    def test_active_page_tree_purges_the_rest_then_refuses(self):
        self.install_page_store()
        self.host.page_tree_current.parent.mkdir(parents=True); self.host.page_tree_current.symlink_to('trees/t1')
        self.activate('--no-refresh')
        with self.assertRaisesRegex(self.module['Refused'], 'switch is live.*pre-rendered page tree is active'):
            self.main('refresh', '--op', str(self.op), '--legacy-helper-reason', 'test')
        self.assertEqual(self.commands('render-once.py'), [])
        self.assertEqual(len(self.commands('purge-html-cache')), 1)  # generic pages and the store are not left on the old release
        self.assertIn('page tree is active', self.refresh_receipt()['origin']['fallbackReason'])
        self.assertEqual(self.refresh_receipt()['status'], 'refused')

    def test_standalone_refresh_checks_the_helper_pin(self):
        self.install_page_store()
        self.activate('--no-refresh')
        with self.assertRaisesRegex(self.module['Refused'], 'No HELPER.json'):
            self.main('refresh', '--op', str(self.op))  # no --legacy-helper-reason and no packaged helper
        self.assertEqual(self.commands('render-once.py'), [])

    def test_refresh_runs_only_after_the_switch(self):
        with self.assertRaisesRegex(self.module['Refused'], 'refresh runs after activate'):
            self.main('refresh', '--op', str(self.op), '--legacy-helper-reason', 'test')

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


class PublicReadbackTest(unittest.TestCase):
    """Operator-side public readback after the Cloudflare purge: <= 5 requests/s, waits out 429."""
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory(); self.dir = Path(self.tmp.name) / 'local-op'
        self.module = runpy.run_path(str(TOOL))
        slugs = ['alpha-university', 'beta-university']
        paths = ['/universities/alpha-university', '/zh/universities/alpha-university', '/fr/universities/alpha-university', '/zh-Hant/universities/alpha-university',
                 '/universities/beta-university', '/zh/universities/beta-university', '/changes', '/zh/changes', '/changes/alpha-university', '/sitemaps/changes.xml',
                 '/api/public/v1/universities/alpha-university.json', '/api/public/v1/universities/beta-university.json']
        write_json(self.dir / 'changed-urls.json', {'schemaVersion': 'uapt-changed-urls-v1', 'contentId': 'c-new', 'paths': paths,
                                                    'readbackFirst': ['/universities/alpha-university', '/zh/universities/alpha-university', '/universities/beta-university', '/zh/universities/beta-university']})
        write_json(self.dir / 'bundle.json', {'schemaVersion': 'uapt-content-release-bundle-v1', 'opId': 'content-new-op', 'contentId': 'c-new', 'parentContentId': 'c-parent',
                                              'manifestSha256': '1' * 64, 'parentManifestSha256': '2' * 64, 'requiredSyncContract': '2.1.0', 'changedSchools': slugs,
                                              'files': {'syncCandidate': 'sync/content-candidate/event.json', 'changedUrls': 'changed-urls.json'},
                                              'hold': {'reason': 'r'}, 'authorization': 'User: "publish it"'})
        self.t = 0.0; self.sleeps = []; self.starts = []

    def tearDown(self):
        self.tmp.cleanup()

    def clock(self): return self.t

    def sleep(self, seconds):
        self.sleeps.append(seconds); self.t += seconds

    def site(self, overrides=None):
        def get(url, headers, timeout):
            self.starts.append((self.t, url)); self.t += 0.01  # a fast edge: 10 ms per answer
            path = '/' + url.split('/', 3)[3]
            if overrides and path in overrides:
                answer = overrides[path]
                return answer.pop(0) if isinstance(answer, list) else answer
            if path.startswith(('/fr/', '/de/')):
                return 308, b'', {'location': '/universities/' + path.rsplit('/', 1)[1] + '#ui=' + path.split('/')[1]}, 0.01
            return 200, b'<html lang="en">ok</html>', {'cf-cache-status': 'MISS'}, 0.01
        return get

    def run_readback(self, get):
        args = self.module['main'].__globals__['argparse'].Namespace(op_dir=str(self.dir), origin='https://eduaipolicy.org')
        with redirect_stdout(io.StringIO()):
            code = self.module['cmd_readback'](args, get=get, sleep=self.sleep, clock=self.clock)
        return code, json.loads((self.dir / 'receipts/public-readback.json').read_text())

    def test_paced_at_five_per_second(self):
        code, receipt = self.run_readback(self.site())
        self.assertEqual(code, 0, receipt['problems'])
        starts = [t for t, _ in self.starts]
        self.assertGreaterEqual(len(starts), 12)
        self.assertTrue(all(b - a >= 0.2 - 1e-9 for a, b in zip(starts, starts[1:])), starts)
        for i in range(len(starts)):  # never more than 60 requests in any 10 s window (Cloudflare's limit)
            self.assertLessEqual(sum(1 for t in starts if starts[i] <= t < starts[i] + 10), 50)
        self.assertTrue(receipt['paced'])
        self.assertEqual(receipt['minIntervalSeconds'], 0.2)

    def test_reads_content_languages_and_samples_ui_locales(self):
        _, receipt = self.run_readback(self.site())
        paths = [r['path'] for r in receipt['rows']]
        self.assertEqual(paths[:4], ['/universities/alpha-university', '/zh/universities/alpha-university', '/universities/beta-university', '/zh/universities/beta-university'])
        self.assertIn('/api/public/v1/universities/beta-university.json', paths)
        self.assertNotIn('/zh-Hant/universities/alpha-university', paths)  # UI-only locales are not expanded
        self.assertEqual(paths[-2:], ['/fr/universities/alpha-university', '/de/universities/beta-university'])  # sample: native page or 308
        self.assertEqual(receipt['problems'], [])

    def test_waits_out_429_and_retries(self):
        limited = (429, b'', {'retry-after': '20'}, 0.01)
        code, receipt = self.run_readback(self.site({'/universities/alpha-university': [limited, limited, (200, b'ok', {}, 0.01)]}))
        self.assertEqual(code, 0)
        self.assertEqual(self.sleeps.count(20), 2)
        self.assertEqual(receipt['rateLimited'], 2)
        self.assertEqual(receipt['rows'][0]['status'], 200)
        short = (429, b'', {}, 0.01)
        self.sleeps.clear()
        self.run_readback(self.site({'/universities/alpha-university': [short, (200, b'ok', {}, 0.01)]}))
        self.assertIn(12, self.sleeps)  # at least 12 s when Retry-After is missing or shorter
        self.sleeps.clear()
        self.run_readback(self.site({'/universities/alpha-university': [(429, b'', {'retry-after': '3600'}, 0.01), (200, b'ok', {}, 0.01)]}))
        self.assertIn(60, self.sleeps)  # capped: a huge Retry-After does not stall the release

    def test_a_5xx_answered_on_retry_is_still_reported(self):
        code, receipt = self.run_readback(self.site({'/universities/alpha-university': [(524, b'', {}, 100.0), (200, b'ok', {}, 0.01)]}))
        self.assertEqual(code, 1)
        row = receipt['rows'][0]
        self.assertEqual((row['status'], row['retriedAfter']), (200, [524]))
        self.assertIn('retried', receipt['problems'][0]['problems'][0])

    def test_persistent_429_or_wrong_redirect_is_a_problem(self):
        limited = (429, b'', {}, 0.01)
        wrong = (308, b'', {'location': '/universities/other#ui=fr'}, 0.01)
        code, receipt = self.run_readback(self.site({'/universities/beta-university': limited, '/fr/universities/alpha-university': wrong,
                                                     '/changes': (200, b'<html>__next_error__</html>', {}, 0.01)}))
        self.assertEqual(code, 1)
        problems = {p['path']: p['problems'] for p in receipt['problems']}
        self.assertEqual(problems['/universities/beta-university'], ['status 429'])
        self.assertIn('English page', problems['/fr/universities/alpha-university'][0])
        self.assertEqual(problems['/changes'], ['application error in the page'])

    def test_redirect_on_a_content_language_url_is_a_problem(self):
        code, receipt = self.run_readback(self.site({'/zh/universities/alpha-university': (308, b'', {'location': '/universities/alpha-university'}, 0.01)}))
        self.assertEqual(code, 1)
        self.assertEqual(receipt['problems'][0]['path'], '/zh/universities/alpha-university')

    def test_retries_are_kept_per_path_without_the_query(self):
        # v6:readback adds ?uapt_readback=<batch> to page reads and looks rows up by the bare path.
        reader = self.module['PublicReader']('https://eduaipolicy.org', get=self.site({'/universities/alpha-university?uapt_readback=b4': [(524, b'', {}, 1.0), (200, b'ok', {}, 0.01)]}),
                                             sleep=self.sleep, clock=self.clock)
        self.assertEqual(reader('/universities/alpha-university?uapt_readback=b4')[0], 200)
        self.assertEqual(reader.retried, {'/universities/alpha-university': [524]})

    def test_loopback_reads_are_not_paced(self):
        reader = self.module['PublicReader']('http://127.0.0.1:3102', get=self.site(), sleep=self.sleep, clock=self.clock)
        for _ in range(10): reader('/universities/alpha-university')
        self.assertEqual(self.sleeps, [])
        self.assertFalse(reader.paced)

    def test_v6_readback_uses_the_paced_reader(self):
        text = (REPO / 'scripts/v6-pipeline/readback.py').read_text()
        self.assertIn('RELEASE["PublicReader"]', text)
        self.assertNotIn('urlopen', text)


TOKEN = 'tok-' + 'x' * 36
ZONE = 'ab' * 16


class CloudflarePurgeTest(unittest.TestCase):
    """Operator-side zone purge: the token never appears in output or receipts."""
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory(); self.dir = Path(self.tmp.name)
        self.module = runpy.run_path(str(TOOL))
        self.env = self.dir / '.env.agents.local'
        self.env.write_text(f'# local secrets\nexport CLOUDFLARE_ZONE_ID="{ZONE}"\nCLOUDFLARE_CACHE_PURGE_TOKEN={TOKEN}\nOTHER=1\n')
        self.saved = {k: os.environ.pop(k, None) for k in ('CLOUDFLARE_ZONE_ID', 'CLOUDFLARE_CACHE_PURGE_TOKEN')}
        self.calls, self.sleeps = [], []

    def tearDown(self):
        for k, v in self.saved.items():
            if v is not None: os.environ[k] = v
        self.tmp.cleanup()

    def poster(self, *answers):
        answers = list(answers)
        def post(url, body, token, timeout=60):
            self.calls.append((url, body, token))
            return answers.pop(0)
        return post

    def purge(self, post, receipt=None):
        out = io.StringIO()
        with redirect_stdout(out):
            self.module['purge_cloudflare']('test', receipt or self.dir / 'r/purge.json', env_file=self.env, post=post, sleep=self.sleeps.append)
        return out.getvalue()

    def test_sends_purge_everything_and_keeps_the_token_out(self):
        out = self.purge(self.poster((200, json.dumps({'success': True, 'result': {'id': ZONE}}).encode())))
        url, body, token = self.calls[0]
        self.assertEqual(url, f'https://api.cloudflare.com/client/v4/zones/{ZONE}/purge_cache')
        self.assertEqual(body, {'purge_everything': True}); self.assertEqual(token, TOKEN)
        text = (self.dir / 'r/purge.json').read_text()
        receipt = json.loads(text)
        self.assertTrue(receipt['ok']); self.assertEqual(receipt['schemaVersion'], 'uapt-cloudflare-purge-v1')
        for secret in (TOKEN, ZONE):
            self.assertNotIn(secret, text); self.assertNotIn(secret, out)

    def test_retries_5xx_then_succeeds(self):
        self.purge(self.poster((502, b'bad gateway'), (200, b'{"success": true}')))
        self.assertEqual(len(self.calls), 2); self.assertEqual(self.sleeps, [5])

    def test_auth_failure_is_final_refused_and_scrubbed(self):
        answer = json.dumps({'success': False, 'errors': [{'code': 10000, 'message': f'Authentication error for {TOKEN}'}]}).encode()
        with self.assertRaisesRegex(self.module['Refused'], 'Cloudflare purge failed'):
            self.purge(self.poster((403, answer)))
        self.assertEqual(len(self.calls), 1)
        text = (self.dir / 'r/purge.json').read_text()
        self.assertNotIn(TOKEN, text); self.assertIn('10000', text); self.assertFalse(json.loads(text)['ok'])

    def test_200_without_success_is_a_failure(self):
        with self.assertRaises(self.module['Refused']):
            self.purge(self.poster(*[(200, b'{"success": false}')] * 3))

    def test_missing_credentials_name_the_key_only(self):
        self.env.write_text(f'CLOUDFLARE_ZONE_ID={ZONE}\n')
        with self.assertRaisesRegex(self.module['Refused'], 'CLOUDFLARE_CACHE_PURGE_TOKEN'):
            self.purge(self.poster())
        self.assertEqual(self.calls, [])

    def test_cli_writes_the_op_receipt(self):
        with redirect_stdout(io.StringIO()):
            self.module['cmd_cloudflare_purge'](self.module['argparse'].Namespace(op_dir=str(self.dir / 'op'), receipt=None, reason='r', env_file=str(self.env)),
                                                post=self.poster((200, b'{"success": true}')), sleep=self.sleeps.append)
        self.assertTrue(json.loads((self.dir / 'op/receipts/cloudflare-purge.json').read_text())['ok'])


class FinishTest(unittest.TestCase):
    """`finish`: activate → refresh receipt → Cloudflare purge → readback → complete, stopping at the first failure."""
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory(); self.dir = Path(self.tmp.name) / 'local-op'
        self.module = runpy.run_path(str(TOOL))
        bundle = {'schemaVersion': 'uapt-content-release-bundle-v1', 'opId': 'content-new-op', 'contentId': 'c-new', 'parentContentId': 'c-parent',
                  'manifestSha256': '1' * 64, 'parentManifestSha256': '2' * 64, 'requiredSyncContract': '2.1.0', 'changedSchools': ['alpha-university'],
                  'files': {'syncCandidate': 'sync/content-candidate/event.json', 'changedUrls': 'changed-urls.json'},
                  'hold': {'reason': 'r'}, 'authorization': 'User: "publish it"'}
        write_json(self.dir / 'bundle.json', bundle)
        self.sha = sha((self.dir / 'bundle.json').read_bytes())
        self.env = Path(self.tmp.name) / '.env'; self.env.write_text(f'CLOUDFLARE_ZONE_ID={ZONE}\nCLOUDFLARE_CACHE_PURGE_TOKEN={TOKEN}\n')
        self.saved = {k: os.environ.pop(k, None) for k in ('CLOUDFLARE_ZONE_ID', 'CLOUDFLARE_CACHE_PURGE_TOKEN')}
        self.order = []

    def tearDown(self):
        for k, v in self.saved.items():
            if v is not None: os.environ[k] = v
        self.tmp.cleanup()

    def args(self, **kw):
        base = dict(op_id='content-new-op', op_dir=str(self.dir), helper='/srv/uapt/releases/p/release-helper', bundle_sha256=self.sha, host='local',
                    ops_root='/srv/uapt/operations', timeout=60, attempt='', legacy_helper_reason=None, env_file=str(self.env),
                    origin='https://eduaipolicy.org', settle_seconds=10.0)
        return self.module['argparse'].Namespace(**{**base, **kw})

    def run_finish(self, *, codes=None, refresh=None, purge_fails=False, readback_code=0, raises=None, states=None, rewait_codes=None, live='c-parent', **kw):
        codes = dict(codes or {}); raises = dict(raises or {}); states = list(states or []); rewait_codes = list(rewait_codes or [])
        def remote(a):
            self.order.append(a.phase)
            if a.phase in raises: raise raises[a.phase]
            return codes.get(a.phase, 0)
        def read_receipt(a, name): self.order.append('read:' + name); return refresh if refresh is not None else {'status': 'ok', 'origin': {'mode': 'page-store'}}
        def purge(reason, path, env_file):
            self.order.append('purge')
            if purge_fails: raise self.module['Refused']('Cloudflare purge failed')
        def readback(a): self.order.append('readback'); return readback_code
        def verify(env_file): self.order.append('verify')
        def job_state(a, phase): return states.pop(0) if states else 'finished exit=3'
        def rewait(a, phase): self.order.append('rewait'); return rewait_codes.pop(0)
        with redirect_stdout(io.StringIO()):
            code = self.module['cmd_finish'](self.args(**kw), remote=remote, read_receipt=read_receipt, purge=purge, readback=readback, verify=verify,
                                             job_state=job_state, rewait=rewait, live_content=lambda a: live, sleep=lambda s: self.order.append(f'sleep:{s:g}'))
        return code, json.loads((self.dir / 'receipts/finish.json').read_text())

    def test_runs_every_step_in_order(self):
        code, receipt = self.run_finish()
        self.assertEqual(code, 0)
        self.assertEqual(self.order, ['verify', 'activate', 'read:refresh.json', 'purge', 'sleep:10', 'readback', 'complete'])
        self.assertEqual(receipt['status'], 'complete')
        self.assertEqual([s['step'] for s in receipt['steps']], ['activate', 'refresh-receipt', 'cloudflare-purge', 'readback', 'complete'])

    def test_failed_activate_before_the_switch_stops_without_a_purge(self):
        code, receipt = self.run_finish(codes={'activate': 3})
        self.assertEqual(code, 1); self.assertEqual(self.order, ['verify', 'activate'])
        self.assertEqual(receipt['status'], 'stopped'); self.assertIn('nothing was switched', receipt['steps'][-1]['next'])

    def test_failed_activate_after_the_switch_still_purges_cloudflare(self):
        code, receipt = self.run_finish(codes={'activate': 3}, live='c-new')
        self.assertEqual(code, 1); self.assertEqual(self.order, ['verify', 'activate', 'purge'])
        last = receipt['steps'][-1]
        self.assertEqual(last['cloudflarePurge'], 'ok'); self.assertIn('IS live', last['next']); self.assertNotIn('readback', self.order)

    def test_lost_ssh_waits_again_and_continues(self):
        code, receipt = self.run_finish(codes={'activate': 255}, states=['running pid=1'], rewait_codes=[0])
        self.assertEqual(code, 0)
        self.assertEqual(self.order[:3], ['verify', 'activate', 'rewait']); self.assertIn('purge', self.order)
        self.assertEqual(receipt['steps'][0]['step'], 'activate-wait')

    def test_exceptions_become_recorded_stops(self):
        code, receipt = self.run_finish(raises={'complete': self.module['Refused']('op already started')})
        self.assertEqual(code, 1); self.assertEqual(receipt['status'], 'stopped')
        self.assertIn('op already started', receipt['steps'][-1]['error']); self.assertIn('--attempt', receipt['steps'][-1]['next'])

    def test_failed_token_preflight_runs_nothing(self):
        def verify(env_file): raise self.module['Refused']('did not verify')
        with redirect_stdout(io.StringIO()), self.assertRaisesRegex(self.module['Refused'], 'did not verify'):
            self.module['cmd_finish'](self.args(), remote=lambda a: self.order.append(a.phase), verify=verify)
        self.assertEqual(self.order, [])

    def test_refused_refresh_stops_before_the_purge(self):
        code, receipt = self.run_finish(refresh={'status': 'refused', 'origin': {'mode': 'page-store'}})
        self.assertEqual(code, 1); self.assertNotIn('purge', self.order)

    def test_fallback_refresh_still_purges(self):
        code, receipt = self.run_finish(refresh={'status': 'incomplete', 'origin': {'mode': 'epoch-purge-fallback', 'fallbackReason': '503'}})
        self.assertEqual(code, 0); self.assertEqual(receipt['steps'][1]['fallbackReason'], '503')

    def test_failed_purge_stops_before_readback(self):
        code, receipt = self.run_finish(purge_fails=True)
        self.assertEqual(code, 1); self.assertEqual(self.order[-1], 'purge')
        self.assertIn('cloudflare-purge', receipt['steps'][-1]['next']); self.assertIn('Cloudflare purge failed', receipt['steps'][-1]['error'])

    def test_readback_findings_stop_before_complete(self):
        code, receipt = self.run_finish(readback_code=1)
        self.assertEqual(code, 1); self.assertNotIn('complete', self.order)

    def test_refuses_other_bundle_bytes_before_any_step(self):
        with self.assertRaisesRegex(self.module['Refused'], 'not the approved bundle'):
            self.run_finish(bundle_sha256='f' * 64)
        self.assertEqual(self.order, [])

    def test_refuses_without_credentials_before_the_switch(self):
        self.env.write_text('')
        with redirect_stdout(io.StringIO()), self.assertRaisesRegex(self.module['Refused'], 'CLOUDFLARE_ZONE_ID'):
            self.module['cmd_finish'](self.args(), remote=lambda a: self.order.append(a.phase))
        self.assertEqual(self.order, [])

    def test_token_verify_needs_an_active_token(self):
        verify = self.module['verify_cloudflare_token']
        verify(str(self.env), get=lambda url, token: (200, b'{"success": true, "result": {"status": "active"}}'))
        with self.assertRaisesRegex(self.module['Refused'], 'did not verify'):
            verify(str(self.env), get=lambda url, token: (200, b'{"success": true, "result": {"status": "disabled"}}'))
        with self.assertRaisesRegex(self.module['Refused'], 'did not verify') as caught:
            verify(str(self.env), get=lambda url, token: (401, b'{"success": false}'))
        self.assertNotIn(TOKEN, str(caught.exception))


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
