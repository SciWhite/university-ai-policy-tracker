"""scripts/v6-pipeline/run.py (pnpm v6:run) and the capture error path.
Temporary workspaces only; curl and pdftotext are fakes on PATH; no network, no Crawl4AI, no Firecrawl."""
import contextlib, io, json, os, stat, subprocess, sys, tempfile, unittest
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
PIPE = REPO / 'scripts/v6-pipeline'
sys.path.insert(0, str(PIPE))
import v6batch as B  # noqa: E402
import capture  # noqa: E402
import gates  # noqa: E402

FAKE_CURL = r'''#!/usr/bin/env python3
"""Fake curl: --output <file>, --write-out; the URL decides the outcome. Each call is logged to $FAKE_CURL_LOG."""
import os, sys
args = sys.argv[1:]; url = args[-1]; out = args[args.index('--output') + 1]
with open(os.environ['FAKE_CURL_LOG'], 'a') as f: f.write(url + '\n')
if 'blocked' in url:
    open(out, 'wb').write(b'<html>Forbidden</html>'); print(f'403\ttext/html\t{url}', end=''); sys.exit(0)
if url.endswith('.pdf'):
    open(out, 'wb').write(b'%PDF-1.7 broken'); print(f'200\tapplication/pdf\t{url}', end=''); sys.exit(0)
open(out, 'wb').write(b'<html><p>Generative AI rules for students.</p></html>'); print(f'200\ttext/html; charset=utf-8\t{url}', end='')
'''
FAKE_PDFTOTEXT = '''#!/bin/sh
# Fake pdftotext that fails like batch 4's PDF did (exit 99), after writing a partial file.
echo partial > "$2"
echo "Syntax Error: Couldn't find trailer dictionary" >&2
exit 99
'''


def write(path, value):
    path = Path(path); path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(value if isinstance(value, str) else json.dumps(value, ensure_ascii=False))
    return path


class Env(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory(); root = Path(self.tmp.name)
        self.ws = root / 'ws'; self.bin = root / 'bin'; self.curl_log = root / 'curl.log'
        for name, body in (('curl', FAKE_CURL), ('pdftotext', FAKE_PDFTOTEXT)):
            p = write(self.bin / name, body); p.chmod(p.stat().st_mode | stat.S_IXUSR)
        write(self.ws / 'batch.json', {'schemaVersion': 'uapt-v6-batch-v1', 'batchId': 'b-run', 'mode': 'add', 'revision': 'v6-run',
                                       'parentRelease': 'parent', 'capture': {'workers': 3},
                                       'schools': [{'slug': 'alpha-university', 'rank': '1', 'abbr': 'alpha', 'language': 'en'}]})
        write(self.ws / 'alpha-university/public.json', {'data': {'officialSources': [{'sourceUrl': 'https://www.alpha.edu/ai'},
                                                                                       {'sourceUrl': 'https://www.alpha.edu/rules.pdf'}]}})
        # Layers 1-2 already ran (their output is what the driver resumes from); Firecrawl named one blocked page.
        write(self.ws / 'discovery/alpha.json', {'pages': [{'url': 'https://www.alpha.edu/genai', 'success': True, 'aiHits': 9}], 'pdfLinks': {}})
        write(self.ws / 'firecrawl/alpha/search-1.json', {'data': {'web': [{'url': 'https://www.alpha.edu/blocked/ai-policy', 'title': 'Generative AI policy for students'}]}})
        write(self.ws / 'firecrawl/alpha/map.json', {'data': {'links': []}})
        self.env = {**os.environ, 'PATH': f'{self.bin}{os.pathsep}{os.environ["PATH"]}', 'FAKE_CURL_LOG': str(self.curl_log),
                    'UAPT_CRAWL4AI_PYTHON': str(self.bin / 'no-such-python'), 'UAPT_V6_RUN_POLL': '0.05'}

    def tearDown(self):
        self.tmp.cleanup()

    def fetches(self):
        return self.curl_log.read_text().splitlines() if self.curl_log.exists() else []

    def run_driver(self, *args):
        r = subprocess.run([sys.executable, str(PIPE / 'run.py'), '--workspace', str(self.ws), *args], capture_output=True, text=True, env=self.env, timeout=120)
        summary = json.loads(r.stdout) if r.stdout.strip() else None
        return r.returncode, summary, r


class DriverResumeTest(Env):
    def test_reruns_resume_and_only_fetch_new_rows(self):
        code, summary, r = self.run_driver('--until', 'capture')
        self.assertEqual(code, 0, r.stderr + r.stdout)
        first = sorted(self.fetches())
        self.assertEqual(first, ['https://www.alpha.edu/ai', 'https://www.alpha.edu/blocked/ai-policy', 'https://www.alpha.edu/genai', 'https://www.alpha.edu/rules.pdf'])
        for n in range(1, 7):
            self.assertTrue((self.ws / f'run/stage-{n}/receipt.json').is_file(), n)
        self.assertFalse((self.ws / 'run/stage-8').exists())
        self.assertIn('--until', summary['next'])
        # The broken PDF is a typed text gap, not a crash.
        pdf = json.loads((self.ws / 'captures/alpha/o02.json').read_text())
        self.assertEqual((pdf['status'], pdf['textError']['type'], pdf['textError']['exitCode']), ('200', 'pdftotext_failed', 99))
        self.assertFalse((self.ws / 'captures/alpha/o02.txt').exists())

        # Rerun to G1: nothing is fetched again; the renderer is unavailable, so the 403 stays an access gap.
        code, summary, r = self.run_driver()
        self.assertEqual(code, 0, r.stderr + r.stdout)
        self.assertEqual(sorted(self.fetches()), first)
        self.assertEqual(json.loads((self.ws / 'run/stage-6/receipt.json').read_text())['fetched'], 0)
        self.assertTrue(summary['stages']['7-render-capture'].startswith('skipped'))
        self.assertTrue(any('access gaps' in g for g in summary['gaps']))
        alpha = summary['schools']['alpha']
        self.assertEqual((alpha['queued'], alpha['pendingCapture'], alpha['accessGap']), (4, 0, 1))
        self.assertEqual(alpha['missingLayers'], ['chatgpt'])
        self.assertEqual(summary['g1']['status'], 'fail')
        self.assertTrue(summary['next'].startswith('S1c ChatGPT audit for alpha'))
        self.assertEqual(json.loads((self.ws / 'run/summary.json').read_text())['next'], summary['next'])

        # A ChatGPT audit arrives: its new official URL is queued and fetched, nothing else; G1 passes.
        write(self.ws / 'chatgpt-audit/alpha.json', {'documents': [{'url': 'https://www.alpha.edu/ai'}, {'url': 'https://www.alpha.edu/assessment'}], 'omissions': []})
        code, summary, r = self.run_driver()
        self.assertEqual(code, 0, r.stderr + r.stdout)
        self.assertEqual(self.fetches()[len(first):], ['https://www.alpha.edu/assessment'])
        self.assertEqual((self.ws / 'chatgpt-sources.tsv').read_text(), 'alpha\tc01\ten\thttps://www.alpha.edu/assessment\n')
        self.assertEqual(summary['g1']['status'], 'pass', summary)
        self.assertEqual(summary['schools']['alpha']['textGap'], 0)  # the broken PDF was no ChatGPT/Firecrawl lead
        self.assertTrue(summary['next'].startswith('G1 passed. S3 drafting: one Sonnet subagent per school'))

    def test_failed_stage_exits_nonzero_but_later_stages_still_run(self):
        (self.ws / 'discovery/alpha.json').unlink()  # discover has work, and there is no Crawl4AI
        code, summary, r = self.run_driver()
        self.assertEqual(code, 1, r.stderr)
        self.assertTrue(summary['stages']['1-discover'].startswith('failed (Crawl4AI is not importable'))
        self.assertEqual(json.loads((self.ws / 'run/stage-1/receipt.json').read_text())['todo'], ['alpha'])
        self.assertTrue(summary['stages']['6-capture'].startswith('done'))
        self.assertTrue(summary['next'].startswith('Fix stage 1 discover'))
        # A recorded crawl gap clears it on the rerun.
        write(self.ws / 'discovery-gaps.json', {'alpha': {'crawl': 'robots.txt disallows the policy site'}})
        code, summary, _ = self.run_driver()
        self.assertEqual(code, 0)
        self.assertEqual(summary['stages']['1-discover'], 'done')

    def test_select_append_keeps_keys_when_discovery_changes(self):
        self.run_driver('--until', 'capture')
        before = (self.ws / 'sources.tsv').read_text()
        write(self.ws / 'discovery/alpha.json', {'pages': [{'url': 'https://www.alpha.edu/new-guidance', 'success': True, 'aiHits': 20},
                                                           {'url': 'https://www.alpha.edu/genai', 'success': True, 'aiHits': 9}], 'pdfLinks': {}})
        self.run_driver('--until', 'select')
        after = (self.ws / 'sources.tsv').read_text()
        self.assertTrue(after.startswith(before))
        self.assertEqual(after[len(before):], 'alpha\td04\ten\thttps://www.alpha.edu/new-guidance\n')
        self.run_driver('--until', 'select')
        self.assertEqual((self.ws / 'sources.tsv').read_text(), after)  # idempotent

    def test_usage_errors_and_missing_inputs_exit_2(self):
        self.assertEqual(self.run_driver('--until', 'draft')[0], 2)
        (self.ws / 'alpha-university/public.json').unlink()
        code, _, r = self.run_driver()
        self.assertEqual(code, 2)
        self.assertIn('G0 inputs missing', r.stderr)


class CaptureErrorPathTest(Env):
    def test_one_failing_row_never_stops_the_pool(self):
        rows = [f'alpha\tk{i:02d}\ten\thttps://host{i % 3}.alpha.edu/page{i}' for i in range(9)]
        old_path = os.environ['PATH']; os.environ['PATH'] = self.env['PATH']; os.environ['FAKE_CURL_LOG'] = str(self.curl_log)
        real = capture.capture

        def flaky(ws, line):
            if '\tk04\t' in line: raise RuntimeError('worker crashed')
            return real(ws, line)
        capture.HOST_SPACING = 0
        try:
            with contextlib.redirect_stdout(io.StringIO()):
                result = capture.run(self.ws, rows, workers=4, one=flaky)
        finally:
            os.environ['PATH'] = old_path; capture.HOST_SPACING = 4.0
        self.assertEqual((result['total'], result['fetched'], result['errors']), (9, 8, 1))
        self.assertFalse((self.ws / 'captures/alpha/k04.json').exists())  # retried on the next run
        log = [json.loads(l) for l in (self.ws / 'logs/capture.jsonl').read_text().splitlines()]
        self.assertEqual((log[0]['event'], log[-1]['event'], log[-1]['errors']), ('start', 'end', 1))
        self.assertEqual([e['outcome'] for e in log if e.get('key') == 'k04'], ['error'])

    def test_cli_records_text_gap_and_key_conflict(self):
        write(self.ws / 'sources.tsv', 'alpha\to01\ten\thttps://www.alpha.edu/rules.pdf\nalpha\to02\ten\thttps://www.alpha.edu/ai\n')
        write(self.ws / 'captures/alpha/o02.json', {'key': 'o02', 'url': 'https://www.alpha.edu/something-else', 'status': '200'})
        r = subprocess.run([sys.executable, str(PIPE / 'capture.py'), '--workspace', str(self.ws)], capture_output=True, text=True, env=self.env, timeout=60)
        self.assertEqual(r.returncode, 1, r.stderr)  # the conflict is a real failure ...
        counts = json.loads(r.stdout.strip().splitlines()[-1])
        self.assertEqual((counts['fetched'], counts['textErrors'], counts['conflicts']), (1, 1, 1))
        receipt = json.loads((self.ws / 'captures/alpha/o01.json').read_text())  # ... the PDF is a typed gap
        self.assertEqual(receipt['textError']['type'], 'pdftotext_failed')
        self.assertNotIn('textSha256', receipt)
        self.assertEqual(json.loads((self.ws / 'captures/alpha/o02.json').read_text())['url'], 'https://www.alpha.edu/something-else')

    def test_gate_counts_text_gaps_separately(self):
        batch = B.load(self.ws)
        write(self.ws / 'discovery-gaps.json', {'alpha': {'crawl': 'x', 'chatgpt': 'y'}})
        write(self.ws / 'firecrawl/alpha/leads.json', [{'url': 'https://www.alpha.edu/rules.pdf', 'candidate': True}])
        write(self.ws / 'captures/alpha/f01.json', {'key': 'f01', 'url': 'https://www.alpha.edu/rules.pdf', 'status': '200',
                                                    'textError': {'type': 'pdftotext_failed', 'detail': ''}})
        report, failures = gates.discovery_gate(self.ws, batch)
        self.assertEqual(failures, [])
        self.assertEqual((report['alpha']['captured'], report['alpha']['textGap'], report['alpha']['textGaps']), (0, 1, ['f01']))

    def test_one_key_queued_for_two_urls_is_refused(self):
        write(self.ws / 'sources.tsv', 'alpha\tx01\ten\thttps://www.alpha.edu/a\n')
        write(self.ws / 'extra-sources.tsv', 'alpha\tx01\ten\thttps://www.alpha.edu/b\nalpha\tx01\ten\thttps://www.alpha.edu/a\n')
        with self.assertRaises(B.BatchError):
            capture.read_rows(self.ws, ['sources.tsv', 'extra-sources.tsv'])
        write(self.ws / 'extra-sources.tsv', 'alpha\tx01\ten\thttps://www.alpha.edu/a/\n')
        self.assertEqual(len(capture.read_rows(self.ws, ['sources.tsv', 'extra-sources.tsv'])), 1)

    def test_workers_come_from_batch_json(self):
        self.assertEqual(capture.workers_for(B.load(self.ws)), 3)
        with self.assertRaises(B.BatchError):
            capture.workers_for({'capture': {'workers': 0}})

    def test_rows_interleave_by_host(self):
        rows = ['a\t1\ten\thttps://x.edu/1', 'a\t2\ten\thttps://x.edu/2', 'a\t3\ten\thttps://y.edu/1']
        self.assertEqual([r.split('\t')[1] for r in capture.interleave_by_host(rows)], ['1', '3', '2'])


if __name__ == '__main__':
    unittest.main()
