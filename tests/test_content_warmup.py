import importlib.util, io, json, tempfile, unittest, urllib.error
from pathlib import Path

spec = importlib.util.spec_from_file_location('warm', Path(__file__).parents[1] / 'scripts/content-release/warm-changed-pages.py')
warm = importlib.util.module_from_spec(spec); spec.loader.exec_module(warm)
UPSTREAM = 'upstream uapt_next_backend {\n    server 127.0.0.1:3102 max_fails=3;\n}\n'


class Response(io.BytesIO):
    def __init__(self, status): super().__init__(b'<html>'); self.status = status
    def __enter__(self): return self
    def __exit__(self, *a): return False


class WarmTests(unittest.TestCase):
    def test_paths_keep_readback_first_and_drop_duplicates(self):
        with tempfile.TemporaryDirectory() as d:
            plan = Path(d) / 'switch.json'; plan.write_text(json.dumps({'paths': ['/a', '/zh/a', '/b']}))
            extra = Path(d) / 'list.json'; extra.write_text(json.dumps(['/c', '/a']))
            self.assertEqual(warm.collect_paths(['/b'], [plan, extra]), ['/b', '/a', '/zh/a', '/c'])
            for bad in ['a', '//evil.example/x', 3]:
                with self.assertRaises(ValueError): warm.collect_paths([bad], [])

    def test_routed_origin_is_the_single_upstream(self):
        self.assertEqual(warm.routed_origin(UPSTREAM), 'http://127.0.0.1:3102')
        with self.assertRaises(ValueError): warm.routed_origin('upstream other { server 127.0.0.1:1; }')

    def test_cold_page_gets_a_second_attempt_and_failures_are_reported(self):
        calls = []
        def opener(request, timeout):
            calls.append(request.full_url)
            self.assertEqual(request.get_header('Host'), 'eduaipolicy.org')
            if request.full_url.endswith('/slow') and calls.count(request.full_url) == 1: raise TimeoutError('timed out')
            if request.full_url.endswith('/broken'): raise urllib.error.HTTPError(request.full_url, 500, 'err', {}, io.BytesIO())
            return Response(404 if request.full_url.endswith('/gone') else 200)
        rows = warm.warm('http://127.0.0.1:3101', ['/ok', '/slow', '/gone', '/broken'], timeout=1, max_seconds=60, opener=opener)
        by = {r['path']: r for r in rows}
        self.assertEqual((by['/slow']['status'], by['/slow']['attempts']), (200, 2))
        self.assertEqual((by['/gone']['status'], by['/gone']['attempts']), (404, 1))
        self.assertEqual((by['/broken']['status'], by['/broken']['attempts']), (500, 2))

    def test_time_budget_skips_the_rest(self):
        ticks = iter([0, 0, 10, 20])
        rows = warm.warm('http://127.0.0.1:3101', ['/a', '/b', '/c'], timeout=1, max_seconds=5, opener=lambda r, timeout: Response(200), clock=lambda: next(ticks))
        self.assertEqual([r.get('skipped') for r in rows], [None, 'time budget', 'time budget'])

    def test_main_writes_a_receipt_and_refuses_non_loopback(self):
        with tempfile.TemporaryDirectory() as d:
            upstream = Path(d) / 'up.conf'; upstream.write_text(UPSTREAM); receipt = Path(d) / 'warm.json'
            code = warm.main(['--path', '/x', '--path', '/y', '--receipt', str(receipt)], opener=lambda r, timeout: Response(200), upstream=upstream)
            self.assertEqual(code, 0)
            data = json.loads(receipt.read_text())
            self.assertEqual((data['origin'], data['requested'], data['warmed'], data['failed']), ('http://127.0.0.1:3102', 2, 2, []))
            with self.assertRaisesRegex(ValueError, 'loopback'):
                warm.main(['--path', '/x', '--origin', 'https://eduaipolicy.org'], opener=lambda r, timeout: Response(200), upstream=upstream)


if __name__ == '__main__':
    unittest.main()
