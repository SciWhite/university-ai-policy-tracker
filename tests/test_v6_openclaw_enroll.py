"""scripts/v6-pipeline/openclaw_enroll.py + openclaw_install.py (S8b OpenClaw enrollment).

Synthetic workspace and monitor state; a fake monitor API and a fake SSH runner. No network, no OpenClaw host.
"""
import base64, io, json, shutil, sys, tarfile, tempfile, unittest
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REPO / 'scripts/v6-pipeline'))
import openclaw_enroll as E  # noqa: E402
import openclaw_install as I  # noqa: E402

CID, REV = 'c-20261201-v6-batch9', 'v6-batch9-20261201'


def write(path, value):
    path = Path(path); path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(value if isinstance(value, str) else json.dumps(value, ensure_ascii=False, indent=2))
    return path


def record(slug, claims, official, revision=REV):
    return {'recordRevision': {'universityRevisionId': revision, 'recordSha256': 'r-' + slug},
            'data': {'entitySlug': slug, 'officialSources': [{'id': f'o{i}', 'sourceUrl': u, 'citationTitle': 'Official'}
                                                            for i, u in enumerate(official)],
                     'claims': [{'id': cid, 'claimType': 'policy', 'evidence': [{'sourceUrl': u}]} for cid, u in claims]}}


def bundle(sources, claims):
    return {'sources': [{'sourceId': sid, 'url': url, 'title': 'Bundle ' + sid, 'rawSha256': 'h' + sid,
                         'retrievedAt': '2026-12-01T00:00:00Z'} for sid, url in sources],
            'evidenceBindings': [{'evidenceId': 'e-' + sid, 'sourceUrl': url} for sid, url in sources],
            'publicClaims': [{'claimId': cid, 'evidenceIds': ['e-' + sid]} for cid, sid in claims]}


class FakeMonitor:
    """The parts of the host's monitor_control the installer uses, over an in-memory changedetection API."""
    def __init__(self, base):
        self.base = Path(base)
        self.watches = {}
        for uid, source in json.loads((self.base / 'watch-bindings.json').read_text()).items():
            self.watches[uid] = {'url': source['url'], 'paused': bool(source.get('monitoringPaused')), 'tags': [],
                                 'time_between_check': {'days': source['intervalDays']}, 'notification_muted': False}
            self._persist(uid)
        self.tags, self.calls = {}, []

    def _persist(self, uid):
        write(self.base / 'data' / uid / 'watch.json', self.watches[uid])

    load = staticmethod(lambda path: json.loads(Path(path).read_text()))

    def save(self, path, value):
        write(path, json.dumps(value, ensure_ascii=False, indent=2))

    is_self_site = staticmethod(E.self_site)

    def api(self, path, method='GET', value=None):
        self.calls.append((method, path))
        if (path, method) == ('watch', 'GET'):
            return {uid: dict(w) for uid, w in self.watches.items()}
        if (path, method) == ('tags', 'GET'):
            return {uid: {'title': t} for uid, t in self.tags.items()}
        if (path, method) == ('tag', 'POST'):
            uid = f'tag-{len(self.tags)}'; self.tags[uid] = value['title']; return {'uuid': uid}
        if (path, method) == ('watch', 'POST'):
            uid = f'new-{len(self.watches):04d}'; self.watches[uid] = dict(value); self._persist(uid); return {'uuid': uid}
        if path.startswith('watch/') and method == 'PUT':
            uid = path.split('/', 1)[1]; self.watches[uid].update(value); self._persist(uid); return {}
        raise AssertionError('unexpected API call ' + method + ' ' + path)


class Fixture(unittest.TestCase):
    """Workspace with two schools: alpha (new group) and beta (enrolled 2026-11 as a local candidate)."""
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory(); root = Path(self.tmp.name)
        self.ws, self.host = root / 'ws', root / 'host'
        schools = [{'slug': 'alpha-university', 'abbr': 'alpha', 'rank': '1', 'language': 'en'},
                   {'slug': 'beta-university', 'abbr': 'beta', 'rank': '2', 'language': 'de'}]
        self.batch_value = {'schemaVersion': 'uapt-v6-batch-v1', 'batchId': 'batch9', 'mode': 'add', 'revision': REV,
                            'contentId': CID, 'parentRelease': 'parent', 'schools': schools}
        write(self.ws / 'batch.json', self.batch_value)
        a = 'https://www.alpha.edu/'
        self.alpha = record('alpha-university', [('a-1', a + 'ai'), ('a-2', a + 'exam')], [a + 'ai', a + 'gone'])
        self.beta = record('beta-university', [('b-1', 'https://beta.de/ki')], ['https://beta.de/ki'])
        write(self.ws / 'alpha-university/bundle/outputs/bundle.json', bundle(
            [('s1', a + 'ai'), ('s2', a + 'handbook'), ('s3', 'https://eduaipolicy.org/universities/alpha-university'),
             ('s4', 'https://alpha.edu/retired'), ('s5', a + 'rendered')], [('a-2', 's2')]))
        write(self.ws / 'beta-university/bundle/outputs/bundle.json', bundle([('t1', 'https://beta.de/ki'), ('t2', 'https://beta.de/pruefung')], []))
        for abbr, key, url, status, extra in [
                ('alpha', 'o1', a + 'ai', '200', {}), ('alpha', 'o2', a + 'exam', '200', {}), ('alpha', 'o3', a + 'gone', '404', {}),
                ('alpha', 'c1', a + 'handbook', '200', {}), ('alpha', 'c2', 'https://alpha.edu/retired', '200', {}),
                ('alpha', 'c3', a + 'rendered', '200', {'hashKind': 'rendered_dom', 'plainHttpStatus': '403'}),
                ('beta', 'o1', 'https://beta.de/ki', '200', {}), ('beta', 'c1', 'https://beta.de/pruefung', '200', {})]:
            write(self.ws / 'captures' / abbr / f'{key}.json', {'key': key, 'url': url, 'status': status,
                                                                'rawSha256': 'raw-' + key, 'retrievedAt': '2026-12-01T00:00:00Z', **extra})
        (self.ws / 'captures/alpha/o1.body').write_bytes(b'not json')  # body files sit next to receipts
        # Monitor host state: gamma (published), beta (candidate), one relocated and one retired URL, one ten-day control.
        beta_baseline = json.dumps(self.beta).encode()
        sources = [
            {'id': 'src-g1', 'url': 'https://gamma.edu/ai', 'intervalDays': 3, 'official': True,
             'bindings': [{'slug': 'gamma-university', 'sourceId': 'g1', 'claimIds': ['g-1'], 'claimTypes': ['policy']}]},
            {'id': 'src-g2', 'url': 'https://gamma.edu/slow', 'intervalDays': 10, 'official': True, 'singleAttempt': True,
             'bindings': [{'slug': 'gamma-university', 'sourceId': 'g2', 'claimIds': [], 'claimTypes': []}]},
            {'id': 'src-b1', 'url': 'https://beta.de/ki', 'intervalDays': 3, 'official': True,
             'bindings': [{'slug': 'beta-university', 'sourceId': 'cand-1', 'claimIds': [], 'claimTypes': [], 'candidateOnly': True}]},
            {'id': 'src-p1', 'url': 'https://gamma.edu/paused', 'intervalDays': 3, 'official': True, 'monitoringPaused': True,
             'pauseReason': 'self_site_watch', 'bindings': []},
        ]
        manifest = {'schemaVersion': 'uapt-monitor-source-manifest-v1', 'recordRevision': 'v6-x', 'schoolCount': 2,
                    'schools': [{'slug': 'gamma-university', 'claimIds': ['g-1'], 'baselineApiSha256': 'g', 'reviewState': 'agent_reviewed'},
                                {'slug': 'beta-university', 'claimIds': ['b-1'], 'baselineApiSha256': E.sha_bytes(beta_baseline),
                                 'reviewState': 'agent_reviewed', 'sourcePublishedV6': False, 'candidateOnly': True,
                                 'publicationApproved': False, 'localViewRevision': 'v6-candidate'}],
                    'sources': sources}
        write(self.host / 'sources.json', E.dump(manifest))
        write(self.host / 'watch-bindings.json', E.dump({f'uid-{s["id"]}': s for s in sources}))
        write(self.host / 'source-resolutions.json', {'https://alpha.edu/retired': {'oldUrl': 'https://alpha.edu/retired', 'status': 'retired_invalid_probe'}})
        write(self.host / 'fetch-policy.json', {'singleAttemptWatchIds': ['uid-src-g2'], 'singleAttemptUrls': ['https://gamma.edu/slow']})
        write(self.host / 'monitor_control.py', '# host module stand-in\n')
        write(self.host / 'monitor_noise.py', '# host module stand-in\n')
        (self.host / 'baseline').mkdir()
        (self.host / 'baseline/beta-university.json').write_bytes(beta_baseline)
        self.monitor = FakeMonitor(self.host)
        self.batch = E.B.load(self.ws)
        self.edir = E.enrollment_dir(self.ws, self.batch)
        self.live({'alpha-university': self.alpha, 'beta-university': self.beta})
        self.copy_parent()

    def tearDown(self):
        self.tmp.cleanup()

    def live(self, records):
        for slug, value in records.items():
            write(self.edir / 'live-api' / f'{slug}.json', json.dumps(value))
        write(self.edir / 'live-api/receipt.json', {'fetchedAt': '2026-12-02T08:00:00Z', 'schools': {s: {'status': 200} for s in records}})

    def copy_parent(self):
        parent = self.edir / 'parent'
        if parent.exists():
            shutil.rmtree(parent)
        (parent / 'baseline').mkdir(parents=True)
        for name in E.PARENT_FILES:
            shutil.copyfile(self.host / name, parent / name)
        for path in (self.host / 'baseline').glob('*.json'):
            if path.stem in ('alpha-university', 'beta-university'):
                shutil.copyfile(path, parent / 'baseline' / path.name)
        write(parent / 'receipt.json', {'fetchedAt': '2026-12-02T08:01:00Z', 'files': {}})

    def rewrite(self, relative, update):
        path = self.edir / relative
        value = json.loads(path.read_text()); update(value); path.write_text(json.dumps(value))
        manifest = json.loads((self.edir / 'payload-manifest.json').read_text())
        manifest['files'][relative] = I.sha(path)
        (self.edir / 'payload-manifest.json').write_text(json.dumps(manifest))

    def validate(self):
        return I.validate_payload(self.edir, self.host, self.monitor)


class BuildTest(Fixture):
    def test_additive_payload_and_skips(self):
        result = E.build(self.ws, self.batch, self.edir)
        self.assertEqual(result['status'], 'payload_ready')
        plan = json.loads((self.edir / 'payload/sources.json').read_text())
        cov = json.loads((self.edir / 'payload/coverage.json').read_text())
        meta = json.loads((self.edir / 'payload/enrollment.json').read_text())
        self.assertEqual(meta['newSchools'], ['alpha-university'])
        self.assertEqual(meta['statusUpdatedSchools'], ['beta-university'])
        self.assertEqual(cov['addedUrls'], ['https://beta.de/pruefung', 'https://www.alpha.edu/ai',
                                            'https://www.alpha.edu/exam', 'https://www.alpha.edu/handbook'])
        reasons = {x['url']: x['reason'] for x in cov['skippedUrls']}
        self.assertEqual(reasons, {'https://www.alpha.edu/gone': 'capture_status_404',
                                   'https://eduaipolicy.org/universities/alpha-university': 'self_site',
                                   'https://alpha.edu/retired': 'source_resolution_retired_invalid_probe',
                                   'https://www.alpha.edu/rendered': 'rendered_only_plain_http_403'})
        beta_src = next(s for s in plan['sources'] if s['id'] == 'src-b1')
        self.assertEqual(len(beta_src['bindings']), 2, 'public binding appended to the candidate watch')
        self.assertEqual(beta_src['bindings'][1]['claimIds'], ['b-1'])
        beta = next(s for s in plan['schools'] if s['slug'] == 'beta-university')
        self.assertEqual((beta['publishedContentId'], beta['localViewRevision'], beta['candidateOnly']), (CID, REV, False))
        self.assertEqual(beta['localViewRevisionHistory'], ['v6-candidate'])
        alpha_handbook = next(s for s in plan['sources'] if s['url'].endswith('/handbook'))
        self.assertEqual(alpha_handbook['bindings'][0]['claimIds'], ['a-2'])
        self.assertEqual(alpha_handbook['intervalDays'], 3)
        self.assertEqual(plan['schoolCount'], 3)
        self.assertIn(E.note_key(CID), plan)

    def test_payload_is_deterministic(self):
        first = E.build(self.ws, self.batch, self.edir)['payloadManifestSha256']
        self.assertEqual(E.build(self.ws, self.batch, self.edir)['payloadManifestSha256'], first)

    def test_unbound_public_claim_refused_unless_held(self):
        self.alpha['data']['claims'].append({'id': 'a-3', 'claimType': 'policy', 'evidence': [{'sourceUrl': 'https://www.alpha.edu/gone'}]})
        self.live({'alpha-university': self.alpha, 'beta-university': self.beta})
        with self.assertRaisesRegex(E.Refused, 'a-3 has no watchable source'):
            E.build(self.ws, self.batch, self.edir)
        self.batch['openclaw'] = {'unboundClaims': {'a-3': 'only source is 404; relocation task'}}
        E.build(self.ws, self.batch, self.edir)
        cov = json.loads((self.edir / 'payload/coverage.json').read_text())
        self.assertEqual(cov['unboundClaims'], [{'slug': 'alpha-university', 'claimId': 'a-3', 'reason': 'only source is 404; relocation task'}])
        self.validate()

    def test_enrolled_school_with_changed_public_data_refused(self):
        self.beta['data']['claims'][0]['claimType'] = 'changed'
        self.live({'alpha-university': self.alpha, 'beta-university': self.beta})
        with self.assertRaisesRegex(E.Refused, 'baseline refresh is separate'):
            E.build(self.ws, self.batch, self.edir)

    def test_bundle_claim_outside_public_record_refused(self):
        path = self.ws / 'beta-university/bundle/outputs/bundle.json'
        value = json.loads(path.read_text()); value['publicClaims'] = [{'claimId': 'draft-only', 'evidenceIds': ['e-t1']}]
        path.write_text(json.dumps(value))
        with self.assertRaisesRegex(E.Refused, 'not a live public Claim ID'):
            E.build(self.ws, self.batch, self.edir)


class InstallerValidationTest(Fixture):
    def setUp(self):
        super().setUp()
        E.build(self.ws, self.batch, self.edir)

    def test_accepts_exact_additive_scope(self):
        _, meta, plan, cov, old = self.validate()
        self.assertEqual(len(plan['sources']) - len(old), 4)
        self.assertEqual(meta['appendedBindings'], 1)

    def test_rejects_changed_payload_and_parent(self):
        with (self.edir / 'payload/coverage.json').open('a') as f:
            f.write(' ')
        with self.assertRaisesRegex(I.Refused, 'Payload changed'):
            self.validate()
        E.build(self.ws, self.batch, self.edir)
        with (self.host / 'watch-bindings.json').open('a') as f:
            f.write(' ')
        with self.assertRaisesRegex(I.Refused, 'Concurrent state change'):
            self.validate()

    def test_rejects_non_public_claim(self):
        self.rewrite('payload/sources.json', lambda p: p['sources'][-1]['bindings'][0]['claimIds'].append('UNAPPROVED-DRAFT'))
        with self.assertRaisesRegex(I.Refused, 'Non-public'):
            self.validate()

    def test_rejects_existing_url_metadata_binding_or_control_change(self):
        edits = [(lambda p: p['sources'][0].update(url='https://gamma.edu/other'), 'Unexpected URL'),
                 (lambda p: p['sources'][1].update(intervalDays=1), 'metadata changed'),
                 (lambda p: p['sources'][3].update(monitoringPaused=False), 'metadata changed'),
                 (lambda p: p['sources'][0]['bindings'][0].update(claimIds=[]), 'Existing binding changed'),
                 (lambda p: p['schools'][0].update(reviewState='human_reviewed'), 'Unplanned school change'),
                 (lambda p: p['schools'][-1].update(publicationApproved=True), 'New school scope'),
                 (lambda p: p['sources'][-1].update(url='https://gamma.edu/ai/'), 'duplicates an existing URL'),
                 (lambda p: p['sources'][-1].update(url='https://alpha.edu/retired'), 'revives a resolved source')]
        for edit, message in edits:
            E.build(self.ws, self.batch, self.edir)
            self.rewrite('payload/sources.json', edit)
            with self.assertRaisesRegex(I.Refused, message):
                self.validate()

    def test_rejects_baseline_overwrite(self):
        write(self.host / 'baseline/alpha-university.json', '{}')
        with self.assertRaisesRegex(I.Refused, 'must not be overwritten'):
            self.validate()


class InstallTest(Fixture):
    def setUp(self):
        super().setUp()
        self.sha = E.build(self.ws, self.batch, self.edir)['payloadManifestSha256']

    def test_install_readback_and_rerun(self):
        controls = I.watch_controls(self.host, list(self.monitor.watches))
        dry = I.cmd_dry_run(self.edir, self.host, self.monitor)
        self.assertEqual((dry['plannedNewWatches'], dry['tagsToCreate']), (4, ['alpha-university', 'beta-university']))
        self.assertTrue(all(method == 'GET' for method, _ in self.monitor.calls), 'dry-run only GETs')
        result = I.cmd_install(self.edir, self.host, self.monitor, self.sha, 'owner: "enroll batch 9"')
        self.assertEqual((result['newWatches'], result['watchCount']), (4, 8))
        self.assertEqual(I.sha(self.host / 'sources.json'), I.sha(self.edir / 'payload/sources.json'))
        self.assertEqual(I.watch_controls(self.host, list(controls)), controls)
        new = [self.monitor.watches[u] for u in result['createdWatchIds']]
        self.assertTrue(all(not w['paused'] and w['notification_muted'] and w['fetch_backend'] == 'html_requests' for w in new))
        self.assertTrue((self.host / 'baseline/alpha-university.json').is_file())
        posts = [p for m, p in self.monitor.calls if m == 'PUT']
        self.assertEqual(len(posts), 4 + 1, 'unpause 4 new watches + one tag addition on the beta watch')
        back = I.cmd_readback(self.edir, self.host, self.monitor)
        self.assertTrue(back['sourcesMatchPayload'] and back['baselinesMatchPayload'])
        self.assertEqual(back['previousControlsIdentical'], back['previousWatchCount'])
        again = I.cmd_install(self.edir, self.host, self.monitor, self.sha, 'owner: "enroll batch 9"')
        self.assertTrue(again['alreadyInstalled'])
        # Idempotent pipeline: a rebuild on the new host state has nothing left to enroll.
        self.copy_parent()
        self.assertEqual(E.build(self.ws, self.batch, self.edir)['status'], 'nothing_to_enroll')

    def test_install_refusals(self):
        with self.assertRaisesRegex(I.Refused, 'approved SHA256'):
            I.cmd_install(self.edir, self.host, self.monitor, '0' * 64, 'owner')
        write(self.edir / 'creation-journal.json', {'createdWatchIds': ['x'], 'activated': False})
        with self.assertRaisesRegex(I.Refused, 'part-way'):
            I.cmd_install(self.edir, self.host, self.monitor, self.sha, 'owner')

    def test_live_watch_set_must_match_bindings(self):
        self.monitor.watches['stray'] = {'url': 'https://stray.example/'}
        with self.assertRaisesRegex(I.Refused, 'Unclassified existing watches'):
            I.cmd_dry_run(self.edir, self.host, self.monitor)

    def test_stage_is_new_or_identical(self):
        target = self.host / ('enrollment-' + CID)
        self.assertTrue(I.cmd_stage(self.edir, target)['created'])
        self.assertFalse(I.cmd_stage(self.edir, target)['created'])
        write(target / 'payload-manifest.json', '{}')
        with self.assertRaisesRegex(I.Refused, 'Another payload'):
            I.cmd_stage(self.edir, target)


class FakeRemote:
    """Runs the host side in-process: recognises the driver's commands and calls the installer."""
    base = '/monitor'

    def __init__(self, fixture):
        self.f, self.commands = fixture, []

    def __call__(self, command, stdin=None, timeout=None):
        self.commands.append(command)
        f = self.f
        if command.startswith('cd '):
            buf = io.BytesIO()
            with tarfile.open(fileobj=buf, mode='w') as tar:
                for name in E.PARENT_FILES + ('baseline/alpha-university.json', 'baseline/beta-university.json'):
                    if (f.host / name).is_file():
                        tar.add(f.host / name, arcname=name)
            return 0, buf.getvalue(), ''
        if 'dry-run' in command or ' install ' in command:
            tmp = Path(tempfile.mkdtemp(dir=self.f.tmp.name))
            with tarfile.open(fileobj=io.BytesIO(stdin)) as tar:
                tar.extractall(tmp)
            if 'dry-run' in command:
                value = I.cmd_dry_run(tmp, f.host, f.monitor)
            else:
                target = f.host / ('enrollment-' + CID); I.cmd_stage(tmp, target)
                approved = command.split('--approved-sha256 ')[1].split()[0]
                auth = base64.b64decode(command.split('--authorization-b64 ')[1].split()[0]).decode()
                value = I.cmd_install(target, f.host, f.monitor, approved, auth)
            return 0, json.dumps(dict(value, ok=True)).encode(), ''
        target = f.host / ('enrollment-' + CID)
        if 'receipts' in command:
            return 0, json.dumps(dict(I.cmd_receipts(target), ok=True)).encode(), ''
        if 'readback' in command:
            return 0, json.dumps(dict(I.cmd_readback(target, f.host, f.monitor), ok=True)).encode(), ''
        raise AssertionError(command)


class DriverTest(Fixture):
    def run_main(self, *args, remote=None, reader=None):
        out = io.StringIO(); old = sys.stdout; sys.stdout = out
        try:
            code = E.main(['--workspace', str(self.ws), *args], remote_factory=lambda: remote, reader=reader)
        finally:
            sys.stdout = old
        return code, json.loads(out.getvalue())

    def test_plan_dry_run_install_readback(self):
        shutil.rmtree(self.edir / 'parent')
        remote = FakeRemote(self)
        code, plan = self.run_main('plan', remote=remote)
        self.assertEqual((code, plan['status']), (0, 'payload_ready'))
        self.assertTrue(all('tar -c' in c for c in remote.commands), 'plan only reads files on the host')
        with self.assertRaisesRegex(E.Refused, 'dry-run'):
            self.run_main('install', '--approve', plan['payloadManifestSha256'], '--authorization', 'x', remote=remote)
        self.assertEqual(self.run_main('dry-run', remote=remote)[1]['status'], 'dry_run_passed')
        with self.assertRaisesRegex(E.Refused, 'approved payload-manifest'):
            self.run_main('install', '--approve', 'f' * 64, '--authorization', 'x', remote=remote)
        with self.assertRaisesRegex(E.Refused, 'owner go-ahead'):
            self.run_main('install', '--approve', plan['payloadManifestSha256'], remote=remote)
        code, done = self.run_main('install', '--approve', plan['payloadManifestSha256'], '--authorization', 'owner: "yes, enroll"', remote=remote)
        self.assertEqual((code, done['status'], done['newWatches']), (0, 'installed', 4))
        self.assertTrue((self.edir / 'host/installed.json').is_file())
        code, back = self.run_main('readback', remote=remote)
        self.assertEqual((code, back['status'], back['problems']), (0, 'complete', []))
        steps = [s['step'] for s in json.loads((self.edir / 'receipt.json').read_text())['steps']]
        self.assertEqual(steps, ['plan', 'dry-run', 'install', 'readback'])
        code, again = self.run_main('plan', '--refresh-parent', remote=remote)
        self.assertEqual(again['status'], 'nothing_to_enroll')
        self.assertEqual(self.run_main('readback', remote=remote)[1]['status'], 'complete', 'installed payload kept')

    def test_live_revision_must_be_the_batch(self):
        shutil.rmtree(self.edir / 'live-api')
        old = record('alpha-university', [], [], revision='v6-older')
        answers = {'/api/public/v1/universities/alpha-university.json': old, '/api/public/v1/universities/beta-university.json': self.beta}
        reader = lambda path: (200, json.dumps(answers[path]).encode(), {}, 0.1)  # noqa: E731
        with self.assertRaisesRegex(E.Refused, 'not live as released'):
            E.fetch_live(self.ws, self.batch, self.edir, reader=reader)

    def test_parent_archive_must_hold_only_monitor_files(self):
        shutil.rmtree(self.edir / 'parent')
        buf = io.BytesIO()
        with tarfile.open(fileobj=buf, mode='w') as tar:
            tar.add(self.host / 'sources.json', arcname='../escape.json')
        remote = lambda command, stdin=None, timeout=None: (0, buf.getvalue(), '')  # noqa: E731
        remote.base = '/monitor'
        with self.assertRaisesRegex(E.Refused, 'Unexpected entry'):
            E.fetch_parent(self.ws, self.batch, self.edir, remote)

    def test_host_config_reads_three_keys_only(self):
        env = write(Path(self.tmp.name) / 'env', 'OPENCLAW_HOST=h.example\nOPENCLAW_USER=ubuntu\nOPENCLAW_SSH_KEY=~/k\nOPENCLAW_GATEWAY_TOKEN=secret\n')
        saved = {k: E.os.environ.pop(k, None) for k in ('OPENCLAW_HOST', 'OPENCLAW_USER', 'OPENCLAW_SSH_KEY')}
        try:
            config = E.host_config(str(env))
            self.assertEqual(set(config), {'OPENCLAW_HOST', 'OPENCLAW_USER', 'OPENCLAW_SSH_KEY'})
            with self.assertRaisesRegex(E.Refused, 'OPENCLAW_HOST'):
                E.host_config(str(write(Path(self.tmp.name) / 'empty', '')))
        finally:
            E.os.environ.update({k: v for k, v in saved.items() if v})

    def test_payload_tar_has_no_macos_metadata(self):
        E.build(self.ws, self.batch, self.edir)
        with tarfile.open(fileobj=io.BytesIO(E.payload_tar(self.edir))) as tar:
            names = tar.getnames()
        self.assertIn('install.py', names)
        self.assertFalse([n for n in names if '._' in n or n.startswith('/') or '..' in n])


FAKE_MONITOR_CONTROL = r"""
import json, os, pathlib
BASE = pathlib.Path(__file__).resolve().parent
STORE = BASE / 'fake-api.json'
def load(path, default=None):
    path = pathlib.Path(path)
    return json.loads(path.read_text()) if path.exists() else default
def save(path, value):
    path = pathlib.Path(path); path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix('.tmp'); tmp.write_text(json.dumps(value, ensure_ascii=False, indent=2)); os.replace(tmp, path)
def is_self_site(url):
    return 'eduaipolicy.org' in (url or '')
def api(path, method='GET', value=None):
    store = load(STORE); watches, tags = store['watches'], store['tags']
    if (path, method) == ('watch', 'GET'): return watches
    if (path, method) == ('tags', 'GET'): return tags
    if method == 'GET': raise AssertionError(path)
    if (path, method) == ('tag', 'POST'):
        uid = 'tag-%d' % len(tags); tags[uid] = {'title': value['title']}; out = {'uuid': uid}
    elif (path, method) == ('watch', 'POST'):
        uid = 'new-%04d' % len(watches); watches[uid] = value; out = {'uuid': uid}
        save(BASE / 'data' / uid / 'watch.json', value)
    else:
        uid = path.split('/', 1)[1]; watches[uid].update(value); out = {}
        save(BASE / 'data' / uid / 'watch.json', watches[uid])
    save(STORE, store)
    return out
"""


class LocalShell:
    """The driver's real shell commands, run with bash on this machine instead of ssh + sudo."""
    def __init__(self, base):
        self.base = str(base)

    def __call__(self, command, stdin=None, timeout=None):
        import os, subprocess
        done = subprocess.run(['bash', '-c', 'set -euo pipefail; ' + command], input=stdin, capture_output=True,
                              timeout=60, env={**os.environ, 'COPYFILE_DISABLE': '1'})
        return done.returncode, done.stdout, done.stderr.decode()


class ShellGlueTest(Fixture):
    run_main = DriverTest.run_main

    def test_real_commands_end_to_end(self):
        write(self.host / 'monitor_control.py', FAKE_MONITOR_CONTROL)
        watches = {uid: dict(w) for uid, w in self.monitor.watches.items()}
        write(self.host / 'fake-api.json', {'watches': watches, 'tags': {}})
        shutil.rmtree(self.edir / 'parent')
        shell = LocalShell(self.host)
        code, plan = self.run_main('plan', remote=shell)
        self.assertEqual(plan['status'], 'payload_ready')
        self.assertEqual(self.run_main('dry-run', remote=shell)[1]['status'], 'dry_run_passed')
        self.assertFalse(list(self.host.glob('enrollment-*')), 'dry-run leaves nothing on the host')
        code, done = self.run_main('install', '--approve', plan['payloadManifestSha256'], '--authorization', "owner: 'go'", remote=shell)
        self.assertEqual((done['status'], done['newWatches']), ('installed', 4))
        self.assertEqual(json.loads((self.edir / 'host/installed.json').read_text())['authorization'], "owner: 'go'")
        self.assertEqual(self.run_main('readback', remote=shell)[1]['problems'], [])
        code, again = self.run_main('install', '--approve', plan['payloadManifestSha256'], '--authorization', 'again', remote=shell)
        self.assertEqual(again['status'], 'already_installed')


if __name__ == '__main__':
    unittest.main()
