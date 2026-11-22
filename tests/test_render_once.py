"""Render-once tooling and page-store purge semantics (docs/render-once.md, audit 2026-11-21 phase 2)."""
import gzip, hashlib, importlib.util, io, json, os, re, subprocess, tempfile, unittest
from contextlib import redirect_stdout
from pathlib import Path

ROOT = Path(__file__).parents[1]
spec = importlib.util.spec_from_file_location('render_once', ROOT / 'scripts/release/render-once.py')
ro = importlib.util.module_from_spec(spec); spec.loader.exec_module(ro)
STORE_CONF = (ROOT / 'infra/nginx/uapt-page-store.conf').read_text()


# ------------------------------------------------------------ a tiny nginx `map` evaluator

def parse_maps(text):
    maps = {}
    for m in re.finditer(r'^map\s+("[^"]*"|\S+)\s+\$(\w+)\s*\{(.*?)\}[ \t]*$', text, re.M | re.S):
        source, name, body = m.group(1).strip('"'), m.group(2), m.group(3)
        rows = []
        for line in body.replace('; ', ';\n').splitlines():
            line = line.split('#', 1)[0].strip()
            if not line: continue
            km = re.match(r'("(?:[^"\\]|\\.)*"|\S+)\s+("(?:[^"\\]|\\.)*"|\S+);$', line)
            key, value = (x[1:-1] if x.startswith('"') else x for x in km.groups())
            rows.append((key, value))
        maps[name] = (source, rows)
    return maps


def expand(template, env):
    return re.sub(r'\$(\w+)', lambda m: env(m.group(1)), template)


def evaluate(maps, name, variables):
    """nginx semantics: exact keys, then regexes in order (~ case-sensitive, ~* not), then default."""
    def env(var):
        if var in maps: return evaluate(maps, var, variables)
        return variables.get(var, '')
    source, rows = maps[name]
    value = expand(source, env)
    default = next((v for k, v in rows if k == 'default'), '')
    for key, result in rows:
        if key != 'default' and not key.startswith('~') and key == value: return expand(result, env)
    for key, result in rows:
        if key.startswith('~*') and re.search(key[2:], value, re.I): return expand(result, env)
        if key.startswith('~') and not key.startswith('~*') and re.search(key[1:], value): return expand(result, env)
    return expand(default, env)


MAPS = parse_maps(STORE_CONF + (ROOT / 'infra/nginx/uapt-html-content-generation.inc').read_text() + (ROOT / 'infra/nginx/uapt-html-cache-epoch.inc').read_text())


def request(**overrides):
    base = {'realip_remote_addr': '203.0.113.7', 'request_method': 'GET', 'http_accept_encoding': 'gzip, br'}
    base.update(overrides); return base


def page_key(variables, uri, host='eduaipolicy.org'):
    """The page-store key exactly as generated (tests/test_nginx_minimal_routing.py checks the template)."""
    v = dict(variables, uri=uri, host=host)
    return '|'.join([evaluate(MAPS, 'uapt_html_cache_epoch', v), host, uri, evaluate(MAPS, 'uapt_page_store_variant', v),
                     'ae=' + evaluate(MAPS, 'uapt_page_store_encoding', v)])


class PurgeSemanticsTests(unittest.TestCase):
    def test_refresh_only_from_loopback_without_edge_headers(self):
        refresh = lambda **kw: evaluate(MAPS, 'uapt_page_store_refresh', request(**kw))
        self.assertEqual(refresh(realip_remote_addr='127.0.0.1', http_x_uapt_refresh='1'), '1')
        self.assertEqual(refresh(realip_remote_addr='::1', http_x_uapt_refresh='1'), '1')
        self.assertEqual(refresh(http_x_uapt_refresh='1'), '0')  # Cloudflare / any remote peer
        self.assertEqual(refresh(realip_remote_addr='127.0.0.1', http_x_uapt_refresh='1', http_cf_connecting_ip='1.2.3.4'), '0')  # a local tunnel relays CF headers
        self.assertEqual(refresh(realip_remote_addr='127.0.0.1', http_x_uapt_refresh='1', http_cf_ray='abc'), '0')
        self.assertEqual(refresh(realip_remote_addr='127.0.0.1', http_x_uapt_refresh='1', http_forwarded='for=1.2.3.4'), '0')
        self.assertEqual(refresh(realip_remote_addr='127.0.0.1', http_x_uapt_refresh='yes'), '0')
        self.assertEqual(refresh(realip_remote_addr='127.0.0.10', http_x_uapt_refresh='1'), '0')
        self.assertEqual(refresh(realip_remote_addr='127.0.0.1'), '0')

    def test_documents_share_one_entry_whatever_the_query(self):
        plain = page_key(request(args=''), '/universities/mit')
        legacy = page_key(request(args='returnTo=%2Funiversities%3Fq%3Dx', arg__rsc=''), '/universities/mit')
        self.assertEqual(plain, legacy)

    def test_content_release_keeps_documents_and_drops_rsc_and_generic_entries(self):
        # A content release only changes the generation; school/changes documents keep their key
        # (refreshed URL by URL), RSC variants and the generic location's entries change key.
        before = request(arg__rsc='abc', http_rsc='1', http_next_router_state_tree='%5B%22%22%5D')
        maps_after = dict(MAPS); maps_after['uapt_html_content_generation'] = ('', [('default', 'c-20261122-next')])
        def key_with(maps, variables):
            global MAPS
            saved = MAPS; MAPS = maps
            try: return page_key(variables, '/de/universities/mit')
            finally: MAPS = saved
        self.assertEqual(key_with(MAPS, request()), key_with(maps_after, request()))
        self.assertNotEqual(key_with(MAPS, before), key_with(maps_after, before))

    def test_program_release_changes_every_key(self):
        maps_after = dict(MAPS); maps_after['uapt_html_cache_epoch'] = ('', [('default', '20261122T000000Z')])
        self.assertNotEqual(evaluate(MAPS, 'uapt_html_cache_epoch', {}), evaluate(maps_after, 'uapt_html_cache_epoch', {}))
        self.assertTrue(page_key(request(), '/universities/mit').startswith(evaluate(MAPS, 'uapt_html_cache_epoch', {}) + '|'))

    def test_rsc_variants_never_collide_with_documents_or_each_other(self):
        doc = page_key(request(), '/universities/mit')
        nav = page_key(request(http_rsc='1', arg__rsc='a1', http_next_router_state_tree='T1'), '/universities/mit')
        other_tree = page_key(request(http_rsc='1', arg__rsc='a1', http_next_router_state_tree='T2'), '/universities/mit')
        prefetch = page_key(request(http_rsc='1', arg__rsc='a1', http_next_router_state_tree='T1', http_next_router_prefetch='1'), '/universities/mit')
        self.assertEqual(len({doc, nav, other_tree, prefetch}), 4)

    def test_encoding_is_normalized_to_two_stored_variants(self):
        enc = lambda value: evaluate(MAPS, 'uapt_page_store_encoding', {'http_accept_encoding': value})
        self.assertEqual({enc('gzip, deflate, br'), enc('br, gzip'), enc('GZIP')}, {'gzip'})
        self.assertEqual({enc(''), enc('br'), enc('identity')}, {'identity'})
        self.assertEqual(evaluate(MAPS, 'uapt_page_store_upstream_encoding', {'http_accept_encoding': 'br'}), '')
        self.assertEqual(evaluate(MAPS, 'uapt_page_store_upstream_encoding', {'http_accept_encoding': 'gzip'}), 'gzip')

    def test_tree_answers_only_plain_documents_and_full_navigations(self):
        kind = lambda **kw: evaluate(MAPS, 'uapt_page_tree_kind', request(**kw))
        self.assertEqual(kind(), 'html')
        self.assertEqual(kind(request_method='HEAD'), 'html')
        self.assertEqual(kind(http_rsc='1'), 'rsc')
        self.assertEqual(kind(http_rsc='1', http_next_router_prefetch='1'), 'none')
        self.assertEqual(kind(http_rsc='1', http_next_router_segment_prefetch='/_tree'), 'none')
        self.assertEqual(kind(request_method='POST'), 'none')
        self.assertEqual(kind(realip_remote_addr='127.0.0.1', http_x_uapt_refresh='1'), 'none')  # a refresh always reaches the app

    def test_cache_never_fills_the_disk(self):
        path = re.search(r'^proxy_cache_path .*;$', STORE_CONF, re.M).group(0)
        for item in ('max_size=6g', 'inactive=30d', 'keys_zone=uapt_html:64m'):
            self.assertIn(item, path)
        self.assertNotIn('min_free=', path)  # production nginx 1.18 rejects it (1.19.1+)
        # Same zone and size as the installed cache: a reload cannot resize a shared zone.
        old = re.search(r'^proxy_cache_path .*;$', (ROOT / 'infra/nginx/uapt-html-cache.conf').read_text(), re.M).group(0)
        self.assertIn('keys_zone=uapt_html:64m', old)
        self.assertEqual(path.split()[1], old.split()[1])

    def test_content_release_refreshes_content_language_urls_only(self):
        # Only en, zh and native pages exist (docs/render-once.md §10); other UI locales are 301/308,
        # so a changed path is not expanded to the 33 reading locales.
        plan = ['/universities/mit', '/zh/universities/mit', '/', '/zh', '/sitemap.xml', '/changes', '/zh/changes']
        urls = ro.expand_paths(['/universities/mit'], plan)
        self.assertEqual(urls, ['/universities/mit', '/zh/universities/mit', '/changes', '/zh/changes', '/', '/zh', '/sitemap.xml'])
        self.assertFalse([u for u in urls if strip(u) not in ('en', 'zh')])
        with self.assertRaises(ValueError): ro.expand_paths([], ['/universities/mit?returnTo=x'])

    def test_one_content_language_listed_refreshes_both(self):
        self.assertEqual(ro.expand_paths([], ['/zh/changes/mit']), ['/changes/mit', '/zh/changes/mit'])
        self.assertEqual(ro.expand_paths([], ['/universities/epfl']), ['/universities/epfl', '/zh/universities/epfl'])

    def test_ui_locale_school_pages_are_forced_only_for_reading_changes(self):
        # A reading-locale change can turn a native page into its 308 or back: every listed locale
        # is refreshed. Other UI-locale school URLs are probed instead (stored native page -> refresh).
        cohort = ['/universities/epfl'] + [f'/{l}/universities/epfl' for l in ro.READING_LOCALES if l != 'en']
        self.assertEqual(ro.expand_paths([], cohort, reading_changed=set()), ['/universities/epfl', '/zh/universities/epfl'])
        self.assertEqual(len(ro.expand_paths([], cohort, reading_changed={'epfl'})), len(ro.READING_LOCALES))
        urls = ro.expand_paths(['/universities/epfl', '/zh/universities/epfl'], cohort + ['/fr/changes', '/ja/changes/epfl'])  # no plan says: listed = forced
        self.assertEqual(urls[:2], ['/universities/epfl', '/zh/universities/epfl'])
        self.assertEqual(len(urls), len(ro.READING_LOCALES))  # exactly the listed school URLs
        self.assertIn('/fr/universities/epfl', urls); self.assertIn('/zh-Hant/universities/epfl', urls)
        self.assertNotIn('/fr/changes', urls); self.assertNotIn('/ja/changes/epfl', urls)  # constant 301s
        self.assertEqual(len(urls), len(set(urls)))

    def test_every_ui_locale_of_a_changed_school_is_probed_not_rendered(self):
        # A non-cohort school is listed in en/zh only, but may have a native page (base-tier
        # schoolTargetLocales): its UI-locale URLs are probed, so a stored native page is refreshed.
        plan = ['/universities/mit', '/zh/universities/mit', '/changes/mit']
        urls = ro.expand_paths([], plan, reading_changed=set())
        probe = ro.probe_paths(plan, urls)
        self.assertEqual(len(urls), 4)  # renders: school en/zh + changes en/zh
        self.assertEqual(len(probe), len(ro.UI_LOCALES)); self.assertIn('/ko/universities/mit', probe)
        self.assertFalse([p for p in probe if '/changes' in p])
        self.assertEqual(ro.probe_paths(['/universities/epfl', '/fr/universities/epfl'], ['/universities/epfl', '/fr/universities/epfl'])[0], '/pl/universities/epfl')

    def test_reading_changed_comes_from_switch_plans_only(self):
        with tempfile.TemporaryDirectory() as tmp:
            switch = Path(tmp) / 's.json'; switch.write_text(json.dumps({'paths': [], 'readingChangedSchools': ['epfl']}))
            changed = Path(tmp) / 'c.json'; changed.write_text(json.dumps({'paths': []}))
            self.assertEqual(ro.read_reading_changed([switch, changed]), {'epfl'})
            self.assertIsNone(ro.read_reading_changed([changed]))

    def test_urls_cli_prints_the_expanded_list(self):
        with tempfile.TemporaryDirectory() as tmp:
            plan = Path(tmp) / 'switch.json'
            plan.write_text(json.dumps({'schemaVersion': 'uapt-content-switch-v1', 'paths': ['/universities/mit', '/fr/changes'], 'tags': []}))
            changed = Path(tmp) / 'changed-urls.json'
            changed.write_text(json.dumps({'schemaVersion': 'uapt-changed-urls-v1', 'paths': ['/api/public/v1/universities/mit.json']}))
            out = io.StringIO()
            with redirect_stdout(out):
                self.assertEqual(ro.main(['urls', '--plan', str(plan), '--plan', str(changed), '--path', '/universities/mit']), 0)
            printed = json.loads(out.getvalue())
            self.assertEqual(printed['paths'], ['/universities/mit', '/zh/universities/mit', '/api/public/v1/universities/mit.json'])
            self.assertEqual(printed['probeCount'], len(ro.UI_LOCALES))


def strip(path):
    return ro.strip_locale(path)[0] or 'en'


class LocaleDriftTests(unittest.TestCase):
    def test_content_locales_match_the_app(self):
        text = (ROOT / 'apps/web/lib/content-locales.ts').read_text()
        self.assertEqual(tuple(re.findall(r'"([^"]+)"', re.search(r'export const CONTENT_LOCALES = \[(.*?)\]', text).group(1))), ro.CONTENT_LOCALES)

    def test_reading_locales_match_the_app(self):
        text = (ROOT / 'apps/web/lib/language-catalog.ts').read_text()
        block = re.search(r'export const READING_LOCALES = \[(.*?)\] as const', text, re.S).group(1)
        self.assertEqual(tuple(re.findall(r'"([^"]+)"', block)), ro.READING_LOCALES)

    def test_proxy_matcher_locales_match(self):
        text = (ROOT / 'apps/web/proxy.ts').read_text()
        self.assertEqual(set(re.search(r'/:locale\(([^)]*)\)', text).group(1).split('|')), set(ro.READING_LOCALES))


class FakeSite:
    """Loopback origin stand-in: status/headers/body per (path, header flavour)."""
    def __init__(self, pages=None, build='B1'):
        self.pages = pages or {}; self.calls = []; self.build = build; self.store = {}
    def __call__(self, origin, path, headers, timeout):
        self.calls.append((origin, path, dict(headers)))
        if headers.get('RSC') == '1' and path.endswith('?_rsc'): path = path[:-5]
        if path in self.pages and callable(self.pages[path]): return self.pages[path](headers)
        if headers.get('RSC') == '1':
            return 200, {'content-type': 'text/x-component', 'vary': 'RSC'}, f'0:{{"b":"{self.build}","p":"{path}"}}'.encode(), 0.1
        return 200, {'content-type': 'text/html; charset=utf-8', 'cache-control': ro.TREE_CACHE_CONTROL}, f'<html>"buildId":"{self.build}" {path}</html>'.encode(), 0.2


class RefreshTests(unittest.TestCase):
    def nginx(self, stored=True, bypass='BYPASS'):
        def get(origin, path, headers, timeout):
            if headers.get('X-UAPT-Refresh') == '1': return 200, {'x-uapt-origin-cache': bypass}, b'', 0.5
            return 200, {'x-uapt-origin-cache': 'HIT' if stored else 'MISS'}, b'', 0.01
        return get

    def test_refresh_sends_the_header_for_both_encodings_and_reads_back(self):
        calls = []
        def get(origin, path, headers, timeout):
            calls.append(headers); return self.nginx()(origin, path, headers, timeout)
        rows = ro.refresh('https://127.0.0.1', ['/universities/mit'], get=get)
        self.assertEqual([c.get('X-UAPT-Refresh') for c in calls], ['1', '1', None])
        self.assertEqual([c.get('Accept-Encoding') for c in calls], ['gzip', None, 'gzip'])
        self.assertEqual(ro.refresh_problems(rows), [])

    def test_unstored_or_unbypassed_or_failed_refresh_is_a_problem(self):
        self.assertTrue(ro.refresh_problems(ro.refresh('https://127.0.0.1', ['/universities/mit'], get=self.nginx(stored=False))))
        self.assertTrue(ro.refresh_problems(ro.refresh('https://127.0.0.1', ['/universities/mit'], get=self.nginx(bypass='HIT'))))
        attempts = []
        def failing(origin, path, headers, timeout):
            attempts.append(path); return 502, {}, b'', 1.0
        rows = ro.refresh('https://127.0.0.1', ['/universities/mit'], get=failing)
        self.assertEqual(rows[0]['gzip']['attempts'], 2)
        self.assertTrue(ro.refresh_problems(rows))

    def test_removed_page_is_answered_not_failed(self):
        get = lambda origin, path, headers, timeout: (404, {'x-uapt-origin-cache': 'BYPASS'}, b'', 0.1)
        self.assertEqual(ro.refresh_problems(ro.refresh('https://127.0.0.1', ['/universities/gone'], get=get)), [])

    def test_ui_locale_redirect_is_refreshed_and_answered(self):
        calls = []
        def get(origin, path, headers, timeout):
            calls.append(headers); return 308, {'x-uapt-origin-cache': 'BYPASS', 'location': '/universities/mit#ui=fr'}, b'', 0.05
        rows = ro.refresh('https://127.0.0.1', ['/fr/universities/mit'], get=get)
        self.assertEqual(len(calls), 2)  # both stored encodings, no readback of a redirect
        self.assertTrue(rows[0]['pageStore'])
        self.assertEqual(ro.refresh_problems(rows), [])

    def test_probe_refreshes_a_stored_native_page_and_keeps_a_stored_redirect(self):
        calls = []
        def nginx(stored):
            def get(origin, path, headers, timeout):
                calls.append((path, headers.get('X-UAPT-Refresh')))
                if headers.get('X-UAPT-Refresh') == '1': return 200, {'x-uapt-origin-cache': 'BYPASS'}, b'', 0.5
                return stored[path]
            return get
        stored = {'/ko/universities/mit': (200, {'x-uapt-origin-cache': 'HIT'}, b'', 0.01),
                  '/fr/universities/mit': (308, {'x-uapt-origin-cache': 'HIT'}, b'', 0.01),
                  '/de/universities/mit': (200, {'x-uapt-origin-cache': 'MISS'}, b'', 0.9)}
        rows = ro.refresh('https://127.0.0.1', [], probe=list(stored), get=nginx(stored))
        refreshed = sorted({p for p, h in calls if h == '1'})
        self.assertEqual(refreshed, ['/ko/universities/mit'])  # the redirect stays, the miss was just fetched fresh
        self.assertEqual(ro.refresh_problems(rows), [])
        failing = {'/ko/universities/mit': (502, {}, b'', 1.0)}
        self.assertTrue(ro.refresh_problems(ro.refresh('https://127.0.0.1', [], probe=['/ko/universities/mit'], get=nginx(failing))))

    def test_time_budget_skips_and_reports(self):
        ticks = iter([0, 0, 5000, 5000, 5000])
        rows = ro.refresh('https://127.0.0.1', ['/a', '/b'], get=self.nginx(), max_seconds=10, clock=lambda: next(ticks))
        self.assertEqual(rows[-1], {'path': '/b', 'skipped': 'time budget'})
        self.assertTrue(ro.refresh_problems(rows))

    def test_origin_must_be_loopback(self):
        for origin in ('https://eduaipolicy.org', 'http://10.0.0.5:3101', 'https://127.0.0.1/x'):
            with self.assertRaises(ValueError): ro.parse_origin(origin)
        self.assertEqual(ro.parse_origin('https://127.0.0.1'), ('https', '127.0.0.1', 443))
        self.assertEqual(ro.parse_origin('http://127.0.0.1:3101'), ('http', '127.0.0.1', 3101))


class GenerationTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory(); d = Path(self.tmp.name)
        self.file = d / 'gen.inc'; self.file.write_text((ROOT / 'infra/nginx/uapt-html-content-generation.inc').read_text())
        self.log = d / 'log.jsonl'
    def tearDown(self): self.tmp.cleanup()

    def test_writes_tests_reloads_and_logs(self):
        calls = []
        runner = lambda argv: (calls.append(argv), subprocess.CompletedProcess(argv, 0, '', ''))[1]
        record = ro.write_generation('c-20261122-x', file=self.file, log=self.log, reason='content switch', runner=runner)
        self.assertEqual(calls, [['nginx', '-t'], ['systemctl', 'reload', 'nginx']])
        self.assertIn('default "c-20261122-x";', self.file.read_text())
        self.assertEqual(record['previous'], 'initial')
        self.assertEqual(json.loads(self.log.read_text())['generation'], 'c-20261122-x')
        self.assertEqual(evaluate(parse_maps(self.file.read_text()), 'uapt_html_content_generation', {}), 'c-20261122-x')

    def test_failed_config_test_restores_and_does_not_reload(self):
        before = self.file.read_text(); calls = []
        runner = lambda argv: (calls.append(argv), subprocess.CompletedProcess(argv, 1, '', 'bad'))[1]
        with self.assertRaises(RuntimeError): ro.write_generation('c-x', file=self.file, log=self.log, runner=runner)
        self.assertEqual(self.file.read_text(), before); self.assertEqual(calls, [['nginx', '-t']]); self.assertFalse(self.log.exists())

    def test_dry_run_and_bad_ids(self):
        before = self.file.read_text()
        self.assertTrue(ro.write_generation('c-x', file=self.file, log=self.log, dry_run=True)['dryRun'])
        self.assertEqual(self.file.read_text(), before)
        for bad in ('a"b', 'x y', 'a;b', ''):
            with self.assertRaises(ValueError): ro.write_generation(bad, file=self.file, log=self.log, dry_run=True)


class TreeTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory(); self.root = Path(self.tmp.name)
    def tearDown(self): self.tmp.cleanup()

    def test_objects_are_content_addressed_and_deterministic(self):
        sha, new, _ = ro.store_object(self.root, b'<html>x</html>')
        self.assertEqual(sha, hashlib.sha256(b'<html>x</html>').hexdigest()); self.assertTrue(new)
        first = ro.object_path(self.root, sha).read_bytes()
        self.assertFalse(ro.store_object(self.root, b'<html>x</html>')[1])
        self.assertEqual(gzip.decompress(first), b'<html>x</html>')
        self.assertEqual(first, ro._gzip(b'<html>x</html>'))  # mtime=0: same bytes on every machine

    def test_capture_materialize_activate(self):
        site = FakeSite()
        paths = ['/universities/mit', '/zh/universities/mit', '/changes/mit', '/universities', '/']
        manifest = ro.capture(self.root, 't1', ['http://127.0.0.1:4001', 'http://127.0.0.1:4002'], paths, content_id='c-1', get=site)
        self.assertEqual(sorted(manifest['pages']), ['/changes/mit', '/universities/mit', '/zh/universities/mit'])  # page-store paths only
        self.assertEqual(manifest['buildId'], 'B1'); self.assertEqual(manifest['cacheControl'], [ro.TREE_CACHE_CONTROL])
        self.assertEqual({c[0] for c in site.calls}, {'http://127.0.0.1:4001', 'http://127.0.0.1:4002'})  # one worker per origin
        ro.materialize(self.root, 't1')
        html = self.root / 'trees/t1/html/zh/universities/mit'
        self.assertEqual(os.stat(html / 'index.html').st_ino, os.stat(html / 'index.html.gz').st_ino)
        self.assertEqual(os.stat(html / 'index.html').st_ino, ro.object_path(self.root, manifest['pages']['/zh/universities/mit']['html']).stat().st_ino)
        self.assertTrue((self.root / 'trees/t1/rsc/changes/mit/index.rsc.gz').is_file())
        self.assertFalse((self.root / 'trees/t1/none').exists())
        with self.assertRaises(ValueError): ro.activate(self.root, 't1', build_id='B2')
        ro.activate(self.root, 't1', build_id='B1')
        self.assertEqual(os.readlink(self.root / 'current'), 'trees/t1')
        with self.assertRaises(ValueError): ro.capture(self.root, 't1', ['http://127.0.0.1:4001'], paths, get=site)  # immutable ids

    def test_content_release_reuses_unchanged_objects(self):
        site = FakeSite()
        paths = ['/universities/a', '/universities/b', '/universities/c']
        base = ro.capture(self.root, 't1', ['http://127.0.0.1:4001'], paths, get=site)
        site.pages['/universities/b'] = lambda h: (200, {'content-type': 'text/x-component'}, b'0:new', 0.1) if h.get('RSC') else (200, {'content-type': 'text/html'}, b'<html>"buildId":"B1" new b</html>', 0.1)
        site.pages['/universities/c'] = lambda h: (404, {}, b'', 0.1)
        nxt = ro.capture(self.root, 't2', ['http://127.0.0.1:4001'], ['/universities/b', '/universities/c'], base=base, get=site)
        self.assertEqual(nxt['pages']['/universities/a'], base['pages']['/universities/a'])
        self.assertNotIn('/universities/c', nxt['pages']); self.assertEqual(nxt['gaps'], {'/universities/c': 'html status 404'})
        delta = ro.diff_trees(base, nxt)
        self.assertEqual((delta['same'], delta['changed'], delta['removed']), (1, ['/universities/b'], ['/universities/c']))
        site.build = 'B2'
        with self.assertRaises(ValueError): ro.capture(self.root, 't3', ['http://127.0.0.1:4001'], ['/universities/a'], base=nxt, get=site)

    def test_uncacheable_or_cookie_pages_stay_out(self):
        site = FakeSite({
            '/universities/a': lambda h: (200, {'content-type': 'text/html', 'cache-control': 'private, no-store'}, b'x', 0.1),
            '/universities/b': lambda h: (200, {'content-type': 'text/html', 'set-cookie': 'x=1'}, b'x', 0.1),
            '/universities/c': lambda h: (200, {'content-type': 'text/html'}, b'x', 0.1) if not h.get('RSC') else (200, {'content-type': 'text/html'}, b'x', 0.1),
        })
        manifest = ro.capture(self.root, 't1', ['http://127.0.0.1:4001'], ['/universities/a', '/universities/b', '/universities/c'], get=site)
        self.assertEqual(manifest['pages'], {}); self.assertEqual(len(manifest['gaps']), 3)

    def test_content_id_in_markup_is_reported(self):
        site = FakeSite({'/universities/a': lambda h: (200, {'content-type': 'text/x-component'} if h.get('RSC') else {'content-type': 'text/html'}, b'c-20261121-v6 "buildId":"B1"', 0.1)})
        manifest = ro.capture(self.root, 't1', ['http://127.0.0.1:4001'], ['/universities/a'], content_id='c-20261121-v6', get=site)
        self.assertEqual(manifest['notes']['/universities/a'], ['html embeds the contentId', 'rsc embeds the contentId'])

    def test_verify_finds_offline_and_host_differences(self):
        site = FakeSite()
        ro.capture(self.root, 't1', ['http://127.0.0.1:4001'], ['/universities/a', '/universities/b'], get=site)
        self.assertEqual(ro.verify(self.root, 't1', 'http://127.0.0.1:3102', get=site)['mismatches'], [])
        site.build = 'B9'
        self.assertEqual(len(ro.verify(self.root, 't1', 'http://127.0.0.1:3102', get=site)['mismatches']), 2)

    def test_render_order_noise_is_not_a_content_difference(self):
        # Measured 2026-11-21: ~1 page in 5 differs between two renders only in <head> tag order
        # and flight row ids (Next resolves metadata concurrently).
        flight = lambda rows: ''.join(f'<script>self.__next_f.push([1,"{r}"])</script>' for r in rows)
        a = ('<html><head><title>T</title><link rel="alternate" href="/feeds"/></head><body><p>x</p>' + flight(['2c:I[1,[],"IconMark"]', '2d:"$L2c"']) + '</body></html>').encode()
        b = ('<html><head><link rel="alternate" href="/feeds"/><title>T</title></head><body><p>x</p>' + flight(['2c:"$L2d"', '2d:I[1,[],"IconMark"]']) + '</body></html>').encode()
        self.assertNotEqual(a, b); self.assertTrue(ro.same_page('html', a, b))
        self.assertFalse(ro.same_page('html', a, a.replace(b'<p>x</p>', b'<p>y</p>')))
        self.assertTrue(ro.same_page('rsc', b'2c:I[1,[],"IconMark"]\n2d:"$L2c"\n', b'2c:"$L2d"\n2d:I[1,[],"IconMark"]\n'))
        self.assertFalse(ro.same_page('rsc', b'2c:"one"\n', b'2c:"two"\n'))
        site = FakeSite(); ro.capture(self.root, 't1', ['http://127.0.0.1:4001'], ['/universities/a'], get=site)
        original = site.pages.get('/universities/a')
        site.pages['/universities/a'] = lambda h: (200, {'content-type': 'text/x-component'}, b'0:{"b":"B1","p":"/universities/a"}', 0.1) if h.get('RSC') else (200, {'content-type': 'text/html'}, b'<html>"buildId":"B1" /universities/a</html>', 0.1)
        self.assertEqual(ro.verify(self.root, 't1', 'http://127.0.0.1:3102', get=site)['mismatches'], [])

    def test_deactivate_falls_back_to_the_store(self):
        site = FakeSite(); ro.capture(self.root, 't1', ['http://127.0.0.1:4001'], ['/universities/a'], get=site)
        ro.materialize(self.root, 't1'); ro.activate(self.root, 't1')
        self.assertEqual(ro.deactivate(self.root), {'previous': 'trees/t1'}); self.assertFalse((self.root / 'current').exists())


if __name__ == '__main__':
    unittest.main()
