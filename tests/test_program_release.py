import unittest, importlib.util, tempfile, json, hashlib, shutil, sys, datetime, os, stat
from pathlib import Path
from unittest.mock import patch

ROOT = Path(__file__).parents[1]


def load(name, rel):
    spec = importlib.util.spec_from_file_location(name, ROOT / rel)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


pr = load('program_release', 'scripts/release/program-release.py')
pi = load('policy_inventory', 'scripts/policy-inventory.py')
lc = load('lifecycle', 'scripts/uapt-release-lifecycle.py')


def sha(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def dump(path, value):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, indent=2) + '\n')
    return path


SLUGS = ['alpha-university', 'beta-university', 'gamma-university', 'delta-university']


def make_content_event(root, revision='rev-2'):
    """Small synthetic content sync event with the R1 layout (sync/content)."""
    root.mkdir(parents=True)
    basis = dump(root / 'basis.json', {'contentId': 'c-test', 'manifest': True})
    bsha = sha(basis)
    summaries = [{'entity': {'slug': s, 'aliases': [f'QS 2026 ={i * 120 + 1}']}, 'claims': [{'id': f'{s}:c{j}'} for j in range(i + 1)]}
                 for i, s in enumerate(SLUGS)]
    dump(root / 'public-data.json', summaries)
    dump(root / 'scope.json', {'schemaVersion': 'uapt-policy-sync-scope-v1',
                                       'universities': [{'slug': s['entity']['slug'], 'publicClaimIds': [c['id'] for c in s['claims']]} for s in summaries],
                                       'changedRevisionsBySlug': {s: ([revision] if i % 2 == 0 else []) for i, s in enumerate(SLUGS)}})
    index = []
    for i, slug in enumerate(SLUGS):
        index.append({'id': f'{slug}:{revision}', 'slug': slug, 'publishedAt': f'2026-10-2{i}T00:00:00Z'})
        index.append({'id': f'{slug}:rev-1', 'slug': slug, 'publishedAt': f'2026-09-1{i}T00:00:00Z'})
    index.sort(key=lambda r: r['publishedAt'], reverse=True)
    history_dir = root / 'proof/public-change-history'
    index_file = dump(history_dir / 'objects/index.json', index)
    manifest = dump(history_dir / 'manifest-x.json', {'schemaVersion': 'uapt-public-change-history-v2', 'revision': revision,
                                                      'eventIndex': {'file': 'objects/index.json', 'sha256': sha(index_file)}})
    dump(root / 'overviews.json', {'schemaVersion': 'uapt-v6-change-overviews-v1', 'schools': {}})
    surfaces = {}
    window = {'start': '2026-09-01T00:00:00Z', 'end': '2026-10-31T00:00:00Z', 'limit': 50}
    for name in pr.CHANGE_SURFACES:
        ids = [r['id'] for r in index]
        if name == 'latestDiff':
            ids = [next(r['id'] for r in index if r['slug'] == s) for s in SLUGS]
            ids.sort(key=lambda i: next(r['publishedAt'] for r in index if r['id'] == i), reverse=True)
        value = {'schemaVersion': 'uapt-change-event-surface-v1', 'surface': name, 'checkedSlugs': SLUGS, 'projectionSha256': sha(manifest),
                 'rulesVersion': 'rules-1', 'eventIds': ids}
        if name in ('recentChanges', 'rss'):
            value['window'] = window
        surfaces[name] = {'path': f'{name}-events.json', 'sha256': sha(dump(root / f'{name}-events.json', value)), 'basisSha256': bsha}
    proof = lambda p: {'path': p, 'sha256': sha(root / p), 'basisSha256': bsha}
    dump(root / 'changes-surface.json', {'schemaVersion': 'uapt-policy-surface-receipt-v1', 'surface': 'changes', 'basisSha256': bsha,
                                         'projectionArtifact': proof('proof/public-change-history/manifest-x.json'), 'overviewArtifact': proof('overviews.json'),
                                         'inputBasisSha256': 'f' * 64, 'projectionRevision': revision, 'rulesVersion': 'rules-1', 'eventSurfaces': surfaces})
    dump(root / 'public_data-surface.json', {'schemaVersion': 'uapt-policy-surface-receipt-v1', 'surface': 'public_data', 'basisSha256': bsha,
                                             'dataArtifact': proof('public-data.json')})
    event = dump(root / 'event.json', {'schemaVersion': 'uapt-policy-sync-event-v2', 'eventId': 'content-candidate', 'eventType': 'policy_release',
                                       'syncContractVersion': '2.1.0', 'basisSha256': bsha, 'basisArtifact': proof('basis.json'),
                                       'scopeArtifact': proof('scope.json'),
                                       'surfaces': {'public_data': {'status': 'updated', 'evidence': [proof('public_data-surface.json')]},
                                                    'changes': {'status': 'updated', 'evidence': [proof('changes-surface.json')]}}})
    pointer = {'schemaVersion': 'uapt-content-pointer-v1', 'contentId': 'c-test', 'manifestSha256': bsha,
               'sync': {'contractVersion': '2.1.0', 'eventId': 'content-candidate', 'eventSha256': sha(event)}}
    return pointer, summaries


class ParsingTests(unittest.TestCase):
    def test_env_file_quotes_export_and_last_assignment(self):
        env = pr.parse_env('# c\nA=1\nexport B="two words"\nC=\'x\'\nA=3\n\nbad line\n')
        self.assertEqual(env, {'A': '3', 'B': 'two words', 'C': 'x'})

    def test_systemctl_show_values(self):
        props = pr.parse_show('ExecStart={ path=/opt/node ; argv[]=/opt/node /r/apps/web/server.js ; ignore_errors=no }\n'
                              'EnvironmentFiles=/a.env (ignore_errors=no)\nEnvironmentFiles=/b.env (ignore_errors=yes)\nEnvironment=PORT=1 X="a b"\n')
        self.assertEqual(pr.exec_argv(pr.show_value(props, 'ExecStart')), ['/opt/node', '/r/apps/web/server.js'])
        self.assertEqual(pr.env_file_paths(props['EnvironmentFiles']), ['/a.env', '/b.env'])
        self.assertEqual(pr.unit_environment(props['Environment']), {'PORT': '1', 'X': 'a b'})

    def test_install_rerun_continues_the_unfinished_operation(self):
        with tempfile.TemporaryDirectory() as d:
            ops = Path(d)
            dump(ops / 'program-aaaaaaaaaaaa-20261106t0100z/release.json', {'codeSha': 'a' * 40, 'steps': {'install': {}, 'complete': {}}})
            self.assertIsNone(pr.unfinished_operation('a' * 40, ops))
            dump(ops / 'program-aaaaaaaaaaaa-20261107t0100z/release.json', {'codeSha': 'a' * 40, 'steps': {'install': {}}})
            self.assertEqual(pr.unfinished_operation('a' * 40, ops), ops / 'program-aaaaaaaaaaaa-20261107t0100z')
            self.assertIsNone(pr.unfinished_operation('b' * 40, ops))

    def test_release_root_and_plan_id(self):
        self.assertEqual(pr.release_root_name('/srv/uapt/releases/uapt-program-x/apps/web'), 'uapt-program-x')
        self.assertIsNone(pr.release_root_name('/srv/other'))
        self.assertEqual(pr.plan_id_for('/srv/uapt/operations/program-2b022f6816e4-20261107t0130z'), 'program-2b022f6816e4-20261107t0130z')


class SlotTests(unittest.TestCase):
    policy = {'activeUnits': ['uapt-shared-v6-r2.service', 'uapt-mcp-v6-candidate.service'],
              'candidateSlots': ['uapt-mcp-v6-r2.service', 'uapt-web.service']}

    def test_free_slot_is_the_other_fixed_slot(self):
        running = ['uapt-shared-v6-r2.service', 'uapt-mcp-v6-candidate.service']
        self.assertEqual(pr.pick_slots(self.policy, running, pr.WEB_SLOTS), ('uapt-mcp-v6-candidate.service', 'uapt-mcp-v6-r2.service'))
        flipped = {'activeUnits': ['uapt-shared-v6-r2.service', 'uapt-mcp-v6-r2.service'], 'candidateSlots': ['uapt-mcp-v6-candidate.service']}
        self.assertEqual(pr.pick_slots(flipped, ['uapt-mcp-v6-r2.service'], pr.WEB_SLOTS), ('uapt-mcp-v6-r2.service', 'uapt-mcp-v6-candidate.service'))

    def test_refuses_ambiguous_or_unregistered_slots(self):
        with self.assertRaisesRegex(pr.Refused, 'exactly one running active'):
            pr.pick_slots({**self.policy, 'activeUnits': list(pr.WEB_SLOTS)}, list(pr.WEB_SLOTS), pr.WEB_SLOTS)
        with self.assertRaisesRegex(pr.Refused, 'not a registered candidate slot'):
            pr.pick_slots({**self.policy, 'candidateSlots': []}, ['uapt-mcp-v6-candidate.service'], pr.WEB_SLOTS)
        with self.assertRaises(pr.Refused):
            pr.parse_slots(['a.service=1'])
        self.assertEqual(pr.parse_slots(['a.service=1', 'b.service=2']), {'a.service': 1, 'b.service': 2})


class DropinTests(unittest.TestCase):
    def test_name_sorts_after_every_existing_dropin_and_is_then_reused(self):
        existing = ['50-MemoryHigh.conf', 'release.conf', 'zz-a.conf', 'zzzzzz-rd-program.conf']
        name = pr.choose_dropin_name(existing)
        self.assertEqual(name, 'z' * 7 + pr.DROPIN_SUFFIX)
        self.assertEqual(sorted(existing + [name])[-1], name)
        self.assertEqual(pr.choose_dropin_name(existing + [name]), name)
        later = 'z' * 9 + '-someone-else.conf'
        self.assertEqual(pr.choose_dropin_name(existing + [name, later]), 'z' * 10 + pr.DROPIN_SUFFIX)

    def test_dropin_resets_inherited_settings_and_sets_slot_values(self):
        text = pr.render_dropin(release='/srv/uapt/releases/r', env_file='/op/runtime.env', port=3102, node_bin='/opt/node/bin/node')
        for line in ['WorkingDirectory=/srv/uapt/releases/r/apps/web', 'Environment=', 'EnvironmentFile=', 'EnvironmentFile=/op/runtime.env',
                     'Environment=PORT=3102 HOSTNAME=127.0.0.1 NODE_ENV=production', 'ExecStart=', 'ExecStart=/opt/node/bin/node /srv/uapt/releases/r/apps/web/server.js',
                     'SuccessExitStatus=143', 'MemoryHigh=5905580032', 'MemoryMax=6442450944', 'ReadWritePaths=',
                     'ReadWritePaths=/srv/uapt/mcp-telemetry /srv/uapt/releases/r/apps/web/.next/cache']:
            self.assertIn(line, text.splitlines())
        lines = text.splitlines()
        self.assertLess(lines.index('EnvironmentFile='), lines.index('EnvironmentFile=/op/runtime.env'))

    def test_runtime_env_rules(self):
        good = {'UAPT_CONTENT_ROOT': '/srv/uapt/content/runtime', 'UAPT_CONTENT_REFRESH_TOKEN': 't'}
        self.assertEqual(pr.check_runtime_env(good, '/srv/uapt/content/runtime'), [])
        problems = pr.check_runtime_env({**good, 'PORT': '3101', 'UAPT_CONTENT_ALLOW_UNSYNCHRONIZED': '1'}, '/srv/uapt/content/runtime')
        self.assertEqual(len(problems), 2)
        self.assertTrue(pr.check_runtime_env({}, '/srv/uapt/content/runtime'))

    def test_warmup_line_and_latency_fallback(self):
        line = 'Nov 06 node[1]: {"message":"Runtime warm-up finished","requests":3937,"failures":1,"seconds":4852}'
        self.assertEqual(pr.warmup_finished(['x', line])['requests'], 3937)
        self.assertIsNone(pr.warmup_finished(['Runtime warm-up started']))
        self.assertTrue(pr.latency_acceptable([{'status': 200, 'seconds': 1.0}], 5))
        self.assertFalse(pr.latency_acceptable([{'status': 200, 'seconds': 9.0}], 5))
        self.assertFalse(pr.latency_acceptable([{'status': 502, 'seconds': 0.1}], 5))
        self.assertFalse(pr.latency_acceptable([], 5))


class RoutingTests(unittest.TestCase):
    def setUp(self):
        self.tmp = Path(tempfile.mkdtemp())
        self.addCleanup(shutil.rmtree, self.tmp)
        self.nginx = self.tmp / 'nginx'
        (self.nginx / 'snippets').mkdir(parents=True)
        (self.nginx / 'sites-enabled').mkdir()
        (self.nginx / 'conf.d').mkdir()
        (self.nginx / 'nginx.conf').write_text(f'events {{}}\nhttp {{ include {self.nginx}/sites-enabled/*; }}\n')
        (self.nginx / 'sites-enabled/site').write_text(f'server {{ include {self.nginx}/snippets/uapt-proxy-locations.conf; }}\n')
        self.code = 'c' * 40
        (self.nginx / 'snippets/uapt-proxy-locations.conf').write_text(
            'location / { proxy_pass http://127.0.0.1:3101; add_header X-UAPT-Main-Code-Release "' + 'a' * 40 + '" always; }\n'
            'location /x { proxy_pass http://127.0.0.1:31010/; }\n')
        (self.nginx / 'snippets/uapt-main-upstream.conf').write_text('upstream u {\n    server 127.0.0.1:3101 max_fails=3;\n}\n')
        (self.nginx / 'snippets/uapt-unrelated.conf').write_text('location /m { proxy_pass http://127.0.0.1:3161; add_header X-UAPT-Main-Code-Release "' + 'a' * 40 + '"; }\n')

    def test_retargets_exact_port_and_release_header_only_in_switched_files(self):
        out = self.tmp / 'routing'
        result = pr.generate_routing(self.nginx, out, 3101, 3102, self.code)
        self.assertEqual(sorted(Path(f['target']).name for f in result['routingFiles']), ['uapt-main-upstream.conf', 'uapt-proxy-locations.conf'])
        self.assertEqual(result['replacements'], 2)
        staged = (out / 'uapt-proxy-locations.conf').read_text()
        self.assertIn('127.0.0.1:3102;', staged)
        self.assertIn('127.0.0.1:31010/', staged)
        self.assertIn(self.code, staged)
        self.assertIn('server 127.0.0.1:3102 max_fails', (out / 'uapt-main-upstream.conf').read_text())
        self.assertFalse((out / 'uapt-unrelated.conf').exists())
        for item in result['routingFiles']:
            self.assertEqual(item['beforeSha256'], sha(item['target']))
            self.assertEqual(item['sha256'], sha(item['source']))
        self.assertEqual(result['oldPortLeftInStaged'], [])

    def test_replacement_snippets_are_staged_and_upstream_only_switch_works(self):
        minimal = self.tmp / 'minimal-locations.conf'
        minimal.write_text('location ^~ /_next/static/ { alias /srv/uapt/static/x/; }\nlocation / { proxy_pass http://uapt_next_backend; }\n')
        empty = self.tmp / 'empty.conf'
        empty.write_text('# consolidated into uapt-proxy-locations.conf\n')
        (self.nginx / 'snippets/uapt-eea1eb21-detail-routes.conf').write_text('location /changes/x { proxy_pass http://127.0.0.1:3102; }\n')
        result = pr.generate_routing(self.nginx, self.tmp / 'r1', 3101, 3102, self.code,
                                     {'uapt-proxy-locations.conf': minimal, 'uapt-eea1eb21-detail-routes.conf': empty})
        staged = {Path(f['target']).name: f for f in result['routingFiles']}
        self.assertEqual(sorted(staged), ['uapt-eea1eb21-detail-routes.conf', 'uapt-main-upstream.conf', 'uapt-proxy-locations.conf'])
        self.assertEqual(Path(staged['uapt-proxy-locations.conf']['source']).read_text(), minimal.read_text())
        self.assertEqual(staged['uapt-proxy-locations.conf']['beforeSha256'], sha(self.nginx / 'snippets/uapt-proxy-locations.conf'))
        self.assertEqual(staged['uapt-eea1eb21-detail-routes.conf']['replacementSha256'], sha(empty))
        # Once installed, the next release only switches the upstream.
        (self.nginx / 'snippets/uapt-proxy-locations.conf').write_text(minimal.read_text())
        (self.nginx / 'snippets/uapt-eea1eb21-detail-routes.conf').write_text(empty.read_text())
        (self.nginx / 'snippets/uapt-main-upstream.conf').write_text('upstream uapt_next_backend {\n    server 127.0.0.1:3102 max_fails=3;\n}\n')
        result = pr.generate_routing(self.nginx, self.tmp / 'r2', 3102, 3101, self.code)
        self.assertEqual([Path(f['target']).name for f in result['routingFiles']], ['uapt-main-upstream.conf'])
        with self.assertRaisesRegex(pr.Refused, 'existing'):
            pr.generate_routing(self.nginx, self.tmp / 'r3', 3101, 3102, self.code, {'uapt-new.conf': empty})

    def test_unmanaged_reference_to_the_retiring_port_is_reported(self):
        self.assertEqual(pr.unmanaged_references(self.nginx, 3101), [])
        (self.nginx / 'sites-enabled/other').write_text('location /y { proxy_pass http://127.0.0.1:3101; }\n')
        (self.nginx / 'snippets/clb-common.conf').write_text('proxy_pass http://127.0.0.1:3101;\n')
        self.assertEqual(sorted(Path(p).name for p in pr.unmanaged_references(self.nginx, 3101)), ['clb-common.conf', 'other'])

    def test_isolated_nginx_test_uses_a_rewritten_copy_with_staged_files(self):
        out = self.tmp / 'routing'
        result = pr.generate_routing(self.nginx, out, 3101, 3102, self.code)
        fake = self.tmp / 'fake-nginx'
        fake.write_text('#!' + sys.executable + '\n'
                        'import sys, pathlib\n'
                        'conf = pathlib.Path(sys.argv[sys.argv.index("-c") + 1]); root = conf.parent\n'
                        'texts = "".join(p.read_text() for p in root.rglob("*") if p.is_file())\n'
                        f'ok = "{self.nginx}/" not in texts and "127.0.0.1:3102;" in (root / "snippets/uapt-proxy-locations.conf").read_text()\n'
                        'print(texts if ok else "bad copy"); sys.exit(0 if ok else 1)\n')
        fake.chmod(fake.stat().st_mode | stat.S_IEXEC)
        test = pr.isolated_nginx_test(self.nginx, result['routingFiles'], self.tmp, nginx_bin=str(fake), retired_port=3101)
        self.assertTrue(test['ok'], test['output'])
        self.assertFalse(test['retiredEndpointInConfig'])
        # A file the copy still loads with the old port fails like the controller's nginx -T check at complete.
        (self.nginx / 'conf.d').mkdir(exist_ok=True)
        (self.nginx / 'conf.d/extra.conf').write_text('# 127.0.0.1:3101 leftover\n')
        test = pr.isolated_nginx_test(self.nginx, result['routingFiles'], self.tmp, nginx_bin=str(fake), retired_port=3101)
        self.assertEqual((test['ok'], test['retiredEndpointInConfig']), (False, True))
        self.assertIn('127.0.0.1:3101;', (self.nginx / 'snippets/uapt-proxy-locations.conf').read_text())
        self.assertEqual([p.name for p in self.tmp.iterdir() if p.name.startswith('nginx-test-')], [])

    def test_static_alias_discovery(self):
        (self.nginx / 'snippets/uapt-proxy-locations.conf').write_text(
            'location ^~ /_next/static/ { alias /srv/uapt/static/unified/_next/static/; }\nlocation ^~ /x/_next/static/ { alias /srv/uapt/static/x/; }\n')
        self.assertEqual(pr.discover_static_dest(self.nginx), '/srv/uapt/static/unified/_next/static')


class SampleTests(unittest.TestCase):
    def summaries(self, count=60):
        rows = []
        for i in range(count):
            aliases = [f'QS 2026 ={i * 9 + 1}'] if i % 10 else []
            rows.append({'entity': {'slug': f's{i:03d}', 'aliases': aliases}, 'claims': [{'id': f's{i}:{j}'} for j in range(1 + i % 7)]})
        return rows

    def test_sample_is_deterministic_bounded_and_spans_tiers_and_extremes(self):
        rows = self.summaries()
        changed = {'s013': ['rev'], 's021': ['rev']}
        slugs, reasons = pr.select_sample(rows, changed, 20, ['s059'])
        self.assertEqual((slugs, reasons), pr.select_sample(rows, changed, 20, ['s059']))
        self.assertEqual(len(slugs), 20)
        self.assertIn('required', reasons['s059'])
        flat = {r for rs in reasons.values() for r in rs}
        self.assertTrue({'most claims', 'fewest claims', 'changed in the latest projection revision'} <= flat)
        self.assertTrue({'tier QS 1-50', 'tier QS 51-100', 'tier QS 101-200', 'tier QS 201-400', 'tier QS 401+', 'tier unranked'} <= flat)
        self.assertEqual(slugs, [r['entity']['slug'] for r in rows if r['entity']['slug'] in reasons])

    def test_small_scope_is_read_back_whole_and_unknown_slug_refuses(self):
        rows = self.summaries(5)
        slugs, _ = pr.select_sample(rows, {}, 20)
        self.assertEqual(len(slugs), 5)
        with self.assertRaisesRegex(pr.Refused, 'not in the synchronized scope'):
            pr.select_sample(rows, {}, 20, ['missing'])

    def test_qs_rank_parsing(self):
        self.assertEqual(pr.qs_rank({'entity': {'aliases': ['QS 2026 =114']}}), 114)
        self.assertEqual(pr.qs_rank({'entity': {'aliases': ['QS 2026 7']}}), 7)
        self.assertIsNone(pr.qs_rank({'entity': {'aliases': ['Other']}}))

    def test_mode_is_sample_only_when_the_content_basis_is_unchanged(self):
        with tempfile.TemporaryDirectory() as d:
            basis = dump(Path(d) / 'basis.json', {'contentRelease': {'root': '/c', 'contentId': 'c1', 'manifestSha256': 'm1'}})
            state = {'content': {'root': '/c', 'contentId': 'c1', 'manifestSha256': 'm1'}}
            self.assertEqual(pr.resolve_mode('auto', state, {'id': 'prev', 'basis': {'path': str(basis)}})[0], 'sample')
            state['content']['manifestSha256'] = 'm2'
            self.assertEqual(pr.resolve_mode('auto', state, {'id': 'prev', 'basis': {'path': str(basis)}})[0], 'full')
            self.assertEqual(pr.resolve_mode('auto', state, None)[0], 'full')
            self.assertEqual(pr.resolve_mode('sample', state, None)[0], 'sample')


class ReadbackTests(unittest.TestCase):
    def html(self, path, build='BID', lang=None):
        lang = lang or pr.expected_lang(path)
        return f'<html lang="{lang}"><link rel="canonical" href="https://eduaipolicy.org{path}"><script>"b":"{build}"</script></html>'.encode()

    def test_page_checks(self):
        ok = pr.page_row('/zh/universities/a', 200, self.html('/zh/universities/a'), 'BID', 0.5)
        self.assertEqual(pr.school_page_problems(ok), [])
        stale = pr.page_row('/universities/a', 200, self.html('/universities/a', build='OLD'), 'BID', 0.5)
        self.assertEqual(pr.school_page_problems(stale), ['BUILD_ID'])
        wrong = pr.page_row('/universities/a', 404, self.html('/universities/b', lang='zh'), 'BID', 0.5)
        self.assertEqual(pr.school_page_problems(wrong), ['status', 'canonical', 'lang'])

    def test_readback_with_injected_http_and_problem_report(self):
        manifest = b'self.__BUILD_MANIFEST={}'
        claims = {'a': ['a:1', 'a:2']}
        seen = []

        def get(url, headers, timeout):
            seen.append((url, headers.get('Host')))
            path = url.split('://', 1)[1].split('/', 1)[1]
            path = '/' + path.split('?')[0]
            if path.startswith('/api/public/v1/universities/'):
                return 200, json.dumps({'data': {'claims': [{'id': 'a:2'}, {'id': 'a:1'}]}}).encode(), {}, 0.1
            if path.endswith('_buildManifest.js'):
                return 200, manifest, {}, 0.1
            if path in pr.CORE_RESOURCES:
                return 200, b'ok', {}, 0.1
            return 200, self.html(path), {'cf-cache-status': 'DYNAMIC'}, 0.2

        result = pr.readback('http://127.0.0.1:3102', ['a'], 'BID', candidate=True, get=get, query='uapt_readback=x')
        self.assertEqual(pr.readback_problems(result, claims, hashlib.sha256(manifest).hexdigest()), [])
        self.assertTrue(all(host == pr.SITE_HOST for _, host in seen))
        self.assertTrue(any('?uapt_readback=x' in url for url, _ in seen))
        self.assertEqual(result['pages'][0]['cfCacheStatus'], 'DYNAMIC')
        problems = pr.readback_problems(result, {'a': ['a:1']}, '0' * 64)
        self.assertEqual({next(iter(p)) for p in problems}, {'api', 'path'})


class LedgerTests(unittest.TestCase):
    def setUp(self):
        self.tmp = Path(tempfile.mkdtemp())
        self.addCleanup(shutil.rmtree, self.tmp)
        self.content = self.tmp / 'sync/content'
        self.pointer, self.summaries = make_content_event(self.content)
        self.basis = dump(self.tmp / 'program-basis.json', {'schemaVersion': 'uapt-program-release-basis-v1', 'codeSha': 'a' * 40})

    def build(self, sample, api_override={}):
        event = pr.verify_content_event(self.content / 'event.json', self.pointer)
        ids = {s['entity']['slug']: sorted(c['id'] for c in s['claims']) for s in self.summaries}
        api = {s: ids.get(s, []) for s in sample}
        api.update(api_override)
        readback = {'buildId': 'BID', 'apiClaimIdsBySlug': api, 'pages': [], 'corePages': [], 'resources': []}
        return pr.build_program_event(content_dir=self.content, content_event=event, out_dir=self.tmp / 'sync/program', basis_file=self.basis,
                                      sample=sample, sample_reasons={s: ['test'] for s in sample}, mode='sample', mode_reason='unchanged content',
                                      candidate_readback=readback, mcp={'endpoint': '127.0.0.1:3161', 'health': {'releaseId': 'r'}, 'claimIdsBySlug': {s: ids.get(s, []) for s in sample}},
                                      runtime_state={'manifestSha256': self.pointer['manifestSha256']}, event_id='uapt-program-test-candidate',
                                      content_manifest_sha256=self.pointer['manifestSha256'])

    def gate(self, event_path, phase):
        # The 2.1.0 projection validator needs node + tsx; it is exercised against the real
        # R1 content event outside this unit test (docs/program-release.md section 7).
        with patch.object(pi, 'sync_gate_v21', lambda event, root: None):
            return pi.sync_gate(pi.load(event_path), Path(event_path).parent, phase)

    def test_sampled_event_restricts_frozen_artifacts_and_passes_the_v2_gate(self):
        sample = ['alpha-university', 'gamma-university']
        event_path = self.build(sample)
        out = event_path.parent
        event = json.loads(event_path.read_text())
        self.assertEqual((event['eventType'], event['syncContractVersion'], event['basisSha256']), ('audit', '2.1.0', sha(self.basis)))
        scope = json.loads((out / 'scope.json').read_text())
        self.assertEqual([u['slug'] for u in scope['universities']], sample)
        self.assertEqual(set(scope['changedRevisionsBySlug']), set(sample))
        self.assertEqual(scope['contentSync']['eventSha256'], self.pointer['sync']['eventSha256'])
        self.assertEqual([s['entity']['slug'] for s in json.loads((out / 'public-data.json').read_text())], sample)
        history = json.loads((out / 'history-events.json').read_text())
        self.assertEqual(history['eventIds'], [i for i in json.loads((self.content / 'history-events.json').read_text())['eventIds'] if i.split(':')[0] in sample])
        self.assertEqual(json.loads((out / 'rss-events.json').read_text())['window']['limit'], 50)
        self.assertEqual(event['surfaces']['public_readback']['status'], 'deferred_until_cutover')
        self.assertTrue(self.gate(event_path, 'candidate'))
        with self.assertRaisesRegex(ValueError, 'Unfinished synchronization: notifications'):
            self.gate(event_path, 'complete')
        with self.assertRaisesRegex(pr.Refused, 'exists'):
            self.build(sample)

    def test_completion_event_adds_public_readback_without_touching_candidate_evidence(self):
        sample = ['beta-university']
        event_path = self.build(sample)
        before = sha(event_path)
        complete = pr.build_completion_event(candidate_dir=event_path.parent, out_dir=self.tmp / 'sync/program-complete',
                                             public_readback={'buildId': 'BID', 'pages': [], 'apiClaimIdsBySlug': {}, 'corePages': [], 'resources': []})
        self.assertEqual(sha(event_path), before)
        event = json.loads(complete.read_text())
        self.assertEqual(event['eventId'], 'uapt-program-test-complete')
        self.assertEqual(event['phase'], 'complete_actual_public_readback')
        self.assertTrue(self.gate(complete, 'complete'))
        # Shared evidence is hard-linked, not copied (77 MB projection per release otherwise).
        self.assertEqual(os.stat(event_path.parent / 'public-data.json').st_ino, os.stat(complete.parent / 'public-data.json').st_ino)

    def test_sample_outside_scope_and_tampered_content_event_refuse(self):
        with self.assertRaisesRegex(pr.Refused, 'outside'):
            self.build(['omega-university'])
        with self.assertRaisesRegex(pr.Refused, 'Candidate API Claim IDs differ'):
            self.build(['alpha-university'], {'alpha-university': ['held-claim']})
        self.assertFalse((self.tmp / 'sync/program').exists())
        (self.content / 'public-data.json').write_text('[]\n')
        with self.assertRaisesRegex(pr.Refused, 'evidence changed'):
            pr.verify_content_event(self.content / 'event.json', self.pointer)
        with self.assertRaisesRegex(pr.Refused, 'not the event'):
            pr.verify_content_event(self.content / 'event.json', {**self.pointer, 'sync': {'eventSha256': '0' * 64}})

    def test_event_filter_keeps_order_and_refuses_unknown_ids(self):
        slug_of = {'a:1': 'a', 'b:1': 'b', 'a:0': 'a'}
        self.assertEqual(pr.filter_event_ids(['a:1', 'b:1', 'a:0'], slug_of, {'a'}), ['a:1', 'a:0'])
        with self.assertRaisesRegex(pr.Refused, 'missing'):
            pr.filter_event_ids(['c:1'], slug_of, {'a'})

    def test_find_content_event_by_pointer_hash(self):
        operations = self.tmp / 'ops'
        shutil.copytree(self.content, operations / 'r1/sync/content')
        self.assertEqual(pr.find_content_event(self.pointer, operations), operations / 'r1/sync/content/event.json')
        with self.assertRaisesRegex(pr.Refused, 'no synchronization'):
            pr.find_content_event({}, operations)


class StaticStepTests(unittest.TestCase):
    def test_union_copy_is_idempotent_keeps_old_files_and_refuses_collisions(self):
        with tempfile.TemporaryDirectory() as d:
            root = Path(d)
            static = root / 'release/apps/web/.next/static'
            (static / 'BID').mkdir(parents=True)
            (static / 'BID/_buildManifest.js').write_text('m')
            (static / 'chunks').mkdir()
            (static / 'chunks/shared.js').write_text('same')
            dest = root / 'static/_next/static'
            (dest / 'chunks').mkdir(parents=True)
            (dest / 'chunks/shared.js').write_text('same')
            (dest / 'chunks/old.js').write_text('previous release')
            op = root / 'op'
            dump(op / 'release.json', {'schemaVersion': pr.STATE_SCHEMA, 'codeSha': 'a' * 40, 'BUILD_ID': 'BID', 'release': str(root / 'release'), 'steps': {'install': {}}})
            args = type('A', (), {'op': str(op), 'static_dest': str(dest)})()
            pr.cmd_static(args)
            receipt = json.loads((op / 'static-union.json').read_text())
            self.assertEqual(([f['url'] for f in receipt['files']], receipt['identicalExisting']), (['/_next/static/BID/_buildManifest.js'], 1))
            self.assertTrue((dest / 'chunks/old.js').exists())
            before = sha(op / 'static-union.json')
            pr.cmd_static(args)
            self.assertEqual(sha(op / 'static-union.json'), before)
            (static / 'chunks/shared.js').write_text('different bytes')
            with self.assertRaisesRegex(pr.Refused, 'collisions'):
                pr.cmd_static(args)


class CapacityRetentionPlanTests(unittest.TestCase):
    def test_capacity_stages(self):
        samples = [(5, 'warmup', 100), (50, 'warmup', 300), (200, 'warmup', 900), (400, 'cold_history', 700), (500, 'steady', 650)]
        receipt = pr.capacity_receipt(samples=samples, request_rows=[('/a', 200), ('/b', 504)], code_sha='a' * 40, build_id='B', basis_sha='b' * 64,
                                      unit='u.service', pid='42', invocation='inv')
        self.assertEqual(receipt['peakBytesByStage'], {'build': 300, 'startup': 300, 'cold_history': 900, 'steady': 650})
        self.assertEqual(receipt['mainPids'], {'u.service': 42})
        self.assertEqual(receipt['coldNon200'], [('/b', 504)])
        plan = {'buildPeakBytes': 1000, 'candidatePeakBytes': 1000, 'candidateUnits': []}
        lc.validate_capacity(plan, receipt)

    def test_retention_receipt_adds_candidate_and_refuses_unclassified(self):
        register = {'schemaVersion': 'uapt-release-retention-v1', 'basisSha256': 'old', 'note': 'kept',
                    'entries': [{'name': 'old', 'disposition': 'active', 'reason': 'r'}, {'name': 'gone', 'disposition': 'held', 'reason': 'r'}],
                    'temporaryArtifacts': [{'path': '/srv/uapt/builds/x', 'disposition': 'held', 'reason': 'r'}]}
        receipt = pr.build_retention_receipt(register, ['old', 'new'], ['/srv/uapt/builds/x'], {'name': 'new', 'disposition': 'candidate', 'reason': 'c'}, 'basis')
        self.assertEqual([e['name'] for e in receipt['entries']], ['new', 'old'])
        self.assertEqual((receipt['basisSha256'], receipt['note']), ('basis', 'kept'))
        with self.assertRaisesRegex(pr.Refused, 'classify'):
            pr.build_retention_receipt(register, ['old', 'new', 'stray'], [], {'name': 'new', 'disposition': 'candidate', 'reason': 'c'}, 'b')
        with self.assertRaisesRegex(pr.Refused, 'Temporary'):
            pr.build_retention_receipt(register, ['old'], ['/srv/uapt/builds/y'], {'name': 'new', 'disposition': 'candidate', 'reason': 'c'}, 'b')

    def test_each_plan_attempt_gets_an_unused_transaction_id(self):
        with tempfile.TemporaryDirectory() as d:
            self.assertEqual(pr.next_plan_id('program-x', d), 'program-x')
            (Path(d) / 'program-x').mkdir()
            (Path(d) / 'program-x-p2').mkdir()
            self.assertEqual(pr.next_plan_id('program-x', d), 'program-x-p3')
            self.assertTrue(pr.PLAN_ID.match(pr.next_plan_id('a' * 80, d)))

    def test_plan_expiry_is_bounded_by_the_candidate_lifetime(self):
        at = datetime.datetime(2026, 11, 7, 10, 0, tzinfo=datetime.timezone.utc)
        self.assertEqual(pr.plan_expiry(at, 7, 8, at), at + datetime.timedelta(hours=7, minutes=-5))
        self.assertEqual(pr.plan_expiry(at, 7, 8, at - datetime.timedelta(hours=6)), at + datetime.timedelta(hours=2, minutes=-5))
        with self.assertRaisesRegex(pr.Refused, 'lifetime'):
            pr.plan_expiry(at, 7, 4, at - datetime.timedelta(hours=4))

    def test_peak_budgets_cover_measurements_within_policy(self):
        policy = {'candidatePeakMaxBytes': 4000, 'buildPeakMaxBytes': 8000}
        measured = {'build': 1800, 'startup': 1800, 'cold_history': 2200, 'steady': 2100}
        self.assertEqual(pr.peak_budgets(measured, {'candidatePeakBytes': 2000, 'buildPeakBytes': 1000}, policy), (2200, 1800))
        self.assertEqual(pr.peak_budgets(measured, {'candidatePeakBytes': 4000, 'buildPeakBytes': 4000}, policy), (4000, 4000))
        self.assertEqual(pr.peak_budgets(measured, {}, {'candidatePeakMaxBytes': 4000}), (2200, 1800))
        with self.assertRaisesRegex(pr.Refused, 'do not cover'):
            pr.peak_budgets(measured, {}, policy, candidate_override=1000)

    def test_candidate_and_capacity_refuse_after_cutover(self):
        with patch.object(pr, 'transaction', return_value={'plan': {'id': 'program-x-p2'}, 'stage': 'selected_pending_acceptance'}):
            with self.assertRaisesRegex(pr.Refused, 'cut over'):
                pr.refuse_after_cutover({'steps': {}, 'planIds': ['program-x', 'program-x-p2']}, 'candidate')
            pr.refuse_after_cutover({'steps': {}, 'planIds': ['program-y']}, 'candidate')
        with patch.object(pr, 'transaction', return_value={}):
            with self.assertRaisesRegex(pr.Refused, 'cut over'):
                pr.refuse_after_cutover({'steps': {'cutover': {}}}, 'capacity')

    def test_plan_is_admitted_by_the_controller_validator(self):
        policy = {'_sha256': 'p', 'activeUnits': ['uapt-shared-v6-r2.service', 'uapt-mcp-v6-candidate.service'], 'legacyUnits': [],
                  'candidateSlots': ['uapt-mcp-v6-r2.service'], 'candidatePeakMaxBytes': 4 << 30, 'buildPeakMaxBytes': 8 << 30,
                  'hostReserveBytes': 2 << 30, 'uaptPeakMaxBytes': 16 << 30, 'candidateTtlHours': 8}
        observed = {'units': {u: {'MemoryCurrent': str(1 << 30), 'MemoryHigh': '1', 'MemoryMax': '2'} for u in policy['activeUnits'] + ['uapt-mcp-v6-r2.service']},
                    'memory': {'MemAvailable': 12 << 30}, 'uaptMemoryBytes': 3 << 30}
        refs = {'path': '/x', 'sha256': 'a' * 64}
        plan = pr.build_plan(plan_id='program-test', expires_at=pr.iso(pr.now() + datetime.timedelta(hours=7)), policy_sha='p', basis={'path': '/b', 'sha256': 'b' * 64},
                             sync_ledger=refs, retention=refs, static_receipt=refs, capacity=refs, runtime_env=refs, helper=refs, routing_files=[{'target': 't'}],
                             build_id='BID', build_manifest_sha256='c' * 64, candidate_unit='uapt-mcp-v6-r2.service', candidate_port=3102,
                             active_unit='uapt-mcp-v6-candidate.service', active_port=3101, keep_active=['uapt-shared-v6-r2.service'],
                             disk_budget={'schemaVersion': 'uapt-release-disk-budget-v1', 'role': 'main'}, candidate_peak=4 << 30, build_peak=4 << 30, purpose='test')
        self.assertTrue(lc.validate_plan(plan, policy, observed))
        self.assertEqual(plan['retiredEndpoints'], ['127.0.0.1:3101'])
        self.assertEqual(plan['diskBudget']['basisSha256'], 'b' * 64)
        self.assertEqual([c['url'] for c in plan['publicChecks']], ['https://eduaipolicy.org/_next/static/BID/_buildManifest.js?uapt_release=program-test'])
        self.assertTrue(all('sha256' in c and 'contains' not in c for c in plan['publicChecks'] + plan['candidateChecks']))


if __name__ == '__main__':
    unittest.main()


class McpStepTests(unittest.TestCase):
    """The `mcp` step: MCP runs the release's bundled server on the content root."""

    def content_root(self, tmp, content_id='c-demo-1', mcp=True):
        catalog = b'{"payload":{"releaseId":"public-release-20260924-002"}}'
        tree = Path(tmp) / 'releases' / content_id / 'tree' / 'mcp'
        tree.mkdir(parents=True)
        (tree / 'catalog.json').write_bytes(catalog)
        manifest = {'schemaVersion': 'uapt-content-release-v1', 'contentId': content_id}
        if mcp:
            manifest['mcp'] = {'catalog': 'mcp/catalog.json', 'releaseId': 'public-release-20260924-002', 'sha256': hashlib.sha256(catalog).hexdigest()}
        manifest_path = dump(Path(tmp) / 'releases' / content_id / 'manifest.json', manifest)
        dump(Path(tmp) / 'current.json', {'schemaVersion': 'uapt-content-pointer-v1', 'contentId': content_id, 'manifestSha256': sha(manifest_path)})
        return manifest_path, hashlib.sha256(catalog).hexdigest()

    def test_selected_catalog_identity_comes_from_the_content_release(self):
        with tempfile.TemporaryDirectory() as tmp:
            manifest_path, catalog_sha = self.content_root(tmp)
            selected = pr.content_release_mcp(tmp)
            self.assertEqual(selected['contentId'], 'c-demo-1')
            self.assertEqual(selected['manifestSha256'], sha(manifest_path))
            self.assertEqual(selected['catalogSha256'], catalog_sha)
            self.assertEqual(selected['path'], (Path(tmp) / 'releases/c-demo-1/tree/mcp/catalog.json').resolve())
        with tempfile.TemporaryDirectory() as tmp:
            self.content_root(tmp, mcp=False)
            with self.assertRaisesRegex(pr.Refused, 'declares no MCP catalog'):
                pr.content_release_mcp(tmp)

    def test_identity_problems_name_every_mismatch(self):
        expected = {'contentId': 'c1', 'manifestSha256': 'a' * 64, 'releaseId': 'r1', 'catalogSha256': 'b' * 64}
        self.assertEqual(pr.mcp_identity_problems({'ok': True, **expected}, expected), [])
        # A pinned (pre-content-root) MCP reports no contentId: that is not the selected release.
        problems = pr.mcp_identity_problems({'ok': True, 'releaseId': 'r1', 'catalogSha256': 'b' * 64}, expected)
        self.assertEqual(len(problems), 2)
        self.assertTrue(any('contentId' in p for p in problems))

    def test_runtime_env_drops_the_catalog_pin_and_keeps_telemetry(self):
        current = {'UAPT_MCP_CATALOG': '/x/catalog.json', 'UAPT_MCP_EXPECTED_RELEASE_ID': 'public-release-1', 'UAPT_MCP_TELEMETRY_FILE': '/srv/uapt/mcp-telemetry/t.jsonl',
                   'NODE_OPTIONS': '--max-old-space-size=1408', 'PORT': '3100', 'UAPT_INTERNAL_SECRET': 'never-copied'}
        env = pr.parse_env(pr.mcp_runtime_env(current, content_root='/srv/uapt/content/runtime', port='3161', node_bin='/opt/node/bin/node'))
        self.assertEqual(env['UAPT_CONTENT_ROOT'], '/srv/uapt/content/runtime')
        self.assertEqual(env['UAPT_MCP_PORT'], '3161')
        self.assertEqual(env['NODE_ENV'], 'production')
        self.assertEqual(env['UAPT_MCP_TELEMETRY_FILE'], '/srv/uapt/mcp-telemetry/t.jsonl')
        self.assertEqual(env['NODE_OPTIONS'], '--max-old-space-size=1408')
        for key in ('UAPT_MCP_CATALOG', 'UAPT_MCP_EXPECTED_RELEASE_ID', 'PORT', 'UAPT_INTERNAL_SECRET'):
            self.assertNotIn(key, env)
        with self.assertRaisesRegex(pr.Refused, 'TELEMETRY'):
            pr.mcp_runtime_env({}, content_root='/c', port='3161', node_bin='/n')

    def test_dropin_resets_inherited_environment_and_runs_the_bundle(self):
        text = pr.render_mcp_dropin(release='/srv/uapt/releases/uapt-program-abc-B1', env_file='/srv/uapt/operations/op/mcp/mcp.env', node_bin='/opt/node/bin/node')
        lines = text.splitlines()
        for reset in ('Environment=', 'EnvironmentFile=', 'UnsetEnvironment=', 'ExecStart='):
            self.assertIn(reset, lines)
        self.assertLess(lines.index('EnvironmentFile='), lines.index('EnvironmentFile=/srv/uapt/operations/op/mcp/mcp.env'))
        self.assertIn('WorkingDirectory=/srv/uapt/releases/uapt-program-abc-B1/apps/mcp', lines)
        self.assertIn('ExecStart=/opt/node/bin/node /srv/uapt/releases/uapt-program-abc-B1/apps/mcp/server.mjs', lines)

    def test_check_waits_for_the_selected_catalog_then_lists_tools(self):
        expected = {'contentId': 'c2', 'manifestSha256': 'a' * 64, 'releaseId': 'r1', 'catalogSha256': 'b' * 64}
        answers = [(200, json.dumps({'ok': True, **expected, 'contentId': 'c1'}).encode()), (200, json.dumps({'ok': True, **expected}).encode())]
        get = lambda url, headers, timeout: (*answers.pop(0), {}, 0.01)
        post = lambda url, payload: (200, json.dumps({'result': {'tools': [{'name': n} for n in reversed(pr.MCP_TOOLS)]}}).encode())
        with patch.object(pr.time, 'sleep'):
            result = pr.mcp_check('127.0.0.1:3162', expected, timeout=30, get=get, post=post)
        self.assertEqual(result['tools'], pr.MCP_TOOLS)
        bad_tools = lambda url, payload: (200, b'{"result":{"tools":[]}}')
        with self.assertRaisesRegex(pr.Refused, 'lists tools'):
            pr.mcp_check('127.0.0.1:3162', expected, timeout=30, get=lambda u, h, t: (200, json.dumps({'ok': True, **expected}).encode(), {}, 0.01), post=bad_tools)
        with patch.object(pr.time, 'monotonic', side_effect=[0, 1, 100]), patch.object(pr.time, 'sleep'):
            with self.assertRaisesRegex(pr.Refused, 'does not serve the selected content release'):
                pr.mcp_check('127.0.0.1:3162', expected, timeout=30, get=lambda u, h, t: (0, b'', {}, 0.01), post=post)

    def test_plan_refuses_when_mcp_would_be_left_on_a_retiring_program_root(self):
        self.assertIsNone(pr.mcp_root_problem('uapt-program-a', 'uapt-program-a', 'uapt-program-b'))
        self.assertIsNone(pr.mcp_root_problem('uapt-program-b', 'uapt-program-a', 'uapt-program-b'))
        # Legacy full-workspace roots (before the first `mcp` step) do not block a release.
        self.assertIsNone(pr.mcp_root_problem('uapt-qs101-120-066043dd', 'uapt-program-a', 'uapt-program-b'))
        self.assertRegex(pr.mcp_root_problem('uapt-program-old', 'uapt-program-a', 'uapt-program-b'), 'run `mcp`')


class HtmlCachePurgeTests(unittest.TestCase):
    """nginx HTML cache purge: a new epoch in the key, nginx -t, reload, a log line."""

    class Result:
        def __init__(self, code=0, err=''):
            self.returncode, self.stderr, self.stdout = code, err, ''

    def test_purge_moves_to_a_new_epoch_reloads_and_logs(self):
        with tempfile.TemporaryDirectory() as tmp:
            epoch = Path(tmp) / 'uapt-html-cache-epoch.inc'
            epoch.write_text(pr.render_html_cache_epoch('initial'))
            calls = []
            record = pr.purge_html_cache('content switch c1', epoch_file=epoch, purge_log=Path(tmp) / 'log.jsonl',
                                         runner=lambda args, check=True: calls.append(args) or self.Result())
            self.assertEqual(calls, [['nginx', '-t'], ['systemctl', 'reload', 'nginx']])
            self.assertEqual(record['previous'], 'initial')
            self.assertIn(f'default "{record["epoch"]}"', epoch.read_text())
            self.assertEqual(json.loads((Path(tmp) / 'log.jsonl').read_text())['reason'], 'content switch c1')

    def test_failed_config_test_restores_the_previous_epoch(self):
        with tempfile.TemporaryDirectory() as tmp:
            epoch = Path(tmp) / 'e.inc'
            before = pr.render_html_cache_epoch('e1')
            epoch.write_text(before)
            with self.assertRaisesRegex(pr.Refused, 'nginx -t failed'):
                pr.purge_html_cache('x', epoch_file=epoch, purge_log=Path(tmp) / 'l', runner=lambda args, check=True: self.Result(1, 'bad'))
            self.assertEqual(epoch.read_text(), before)

    def test_missing_cache_is_a_no_op_and_epochs_are_validated(self):
        self.assertIsNone(pr.purge_html_cache('x', epoch_file='/nonexistent/e.inc', runner=lambda *a, **k: self.fail('no commands')))
        with self.assertRaises(pr.Refused):
            pr.render_html_cache_epoch('bad"; }')

    def test_epoch_template_matches_the_repository_bootstrap_file(self):
        shipped = (ROOT / 'infra/nginx/uapt-html-cache-epoch.inc').read_text()
        self.assertEqual(shipped, pr.render_html_cache_epoch('initial'))
