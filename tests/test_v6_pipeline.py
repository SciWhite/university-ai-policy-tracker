"""scripts/v6-pipeline: batch config, the discovery gate (G1), the locale gate (G3) and stage refusals.
Runs on temporary workspaces only; no network, no Crawl4AI, no Firecrawl."""
import io, json, os, subprocess, sys, tempfile, unittest, zipfile
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
PIPE = REPO / 'scripts/v6-pipeline'
sys.path.insert(0, str(PIPE))
import v6batch as B  # noqa: E402
import gates  # noqa: E402
import capture  # noqa: E402
import readback  # noqa: E402

KEYS = B.TOPIC_KEYS


def write(path, value):
    path = Path(path); path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(value if isinstance(value, str) else json.dumps(value, ensure_ascii=False))
    return path


def batch_json(**extra):
    return {'schemaVersion': 'uapt-v6-batch-v1', 'batchId': 'b-test', 'mode': 'add', 'revision': 'v6-test', 'parentRelease': 'parent',
            'schools': [{'slug': 'alpha-university', 'rank': '1', 'abbr': 'alpha', 'language': 'en'}], **extra}


def zh_input():
    return {'do': [{'text': 'Ask', 'refs': ['p1']}], 'dont': [{'text': 'Paste', 'refs': ['exam']}], 'procedures': {'appeal': ['appeal']},
            'tools': [{'rawToolName': 'Copilot'}],
            'zh': {'hero': ['阿尔法大学的 AI 使用指引', '范围'], 'topics': [['标签', '摘要', '范围']] * 9, 'do': ['先询问'], 'dont': ['不要粘贴'],
                   'tools': {'Copilot': ['说明', '获取', '费用']}, 'claims': {'p1': '证据一', 'exam': '考试规定', 'appeal': '申诉'}}}


class Workspace(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory(); self.ws = Path(self.tmp.name)
        write(self.ws / 'batch.json', batch_json())
        write(self.ws / 'alpha-university/public.json', {'data': {'officialSources': [{'sourceUrl': 'https://www.alpha.edu/ai'}]}})
        self.batch = B.load(self.ws)

    def tearDown(self):
        self.tmp.cleanup()

    def receipt(self, key, url, status='200'):
        write(self.ws / 'captures/alpha' / f'{key}.json', {'key': key, 'url': url, 'status': status})


class BatchConfigTest(Workspace):
    def test_rejects_bad_mode_duplicates_and_foreign_english_only(self):
        for bad in (batch_json(mode='publish'), batch_json(schools=[batch_json()['schools'][0]] * 2), batch_json(englishOnlySlugs=['beta-university'])):
            with self.assertRaises(B.BatchError):
                B.validate(bad)

    def test_official_domains_include_declared_parent_bodies(self):
        self.batch['schools'][0]['extraDomains'] = ['parent.ac.jp']
        self.assertEqual(B.official_domains(self.batch, self.batch['schools'][0]), {'alpha.edu', 'parent.ac.jp'})


class DiscoveryGateTest(Workspace):
    def complete_layers(self):
        write(self.ws / 'discovery/alpha.json', {'pages': []})
        write(self.ws / 'firecrawl/alpha/leads.json', [{'url': 'https://alpha.edu/rules', 'candidate': True}, {'url': 'https://alpha.edu/news', 'candidate': False}])
        write(self.ws / 'chatgpt-audit/alpha.json', {'documents': [{'url': 'https://www.alpha.edu/policy.pdf'}, {'url': 'https://elsewhere.org/x'}], 'omissions': []})

    def test_missing_layer_fails_until_gap_recorded(self):
        report, failures = gates.discovery_gate(self.ws, self.batch)
        self.assertEqual(len([f for f in failures if 'discovery missing' in f]), 3)
        write(self.ws / 'discovery-gaps.json', {'alpha': {'crawl': 'robots disallow', 'firecrawl': 'quota', 'chatgpt': 'project unavailable'}})
        self.assertEqual(gates.discovery_gate(self.ws, self.batch)[1], [])

    def test_every_official_lead_is_captured_or_disposed(self):
        self.complete_layers()
        _, failures = gates.discovery_gate(self.ws, self.batch)
        self.assertEqual(sorted(f.rsplit(' ', 1)[-1] for f in failures), ['https://alpha.edu/rules', 'https://www.alpha.edu/policy.pdf'])
        self.receipt('c01', 'https://alpha.edu/policy.pdf', status='403')  # an access gap resolves the lead
        write(self.ws / 'discovery-dispositions.json', {'alpha': {'https://alpha.edu/rules*': {'disposition': 'not_material', 'note': 'library rules'}}})
        report, failures = gates.discovery_gate(self.ws, self.batch)
        self.assertEqual(failures, [])
        self.assertEqual((report['alpha']['accessGap'], report['alpha']['disposed']), (1, 1))

    def test_disposition_needs_a_known_reason_and_note(self):
        self.complete_layers()
        write(self.ws / 'discovery-dispositions.json', {'alpha': {'https://alpha.edu/rules': {'disposition': 'skip'}}})
        with self.assertRaises(B.BatchError):
            gates.discovery_gate(self.ws, self.batch)

    def test_queued_row_without_receipt_fails(self):
        write(self.ws / 'discovery-gaps.json', {'alpha': {'crawl': 'x', 'firecrawl': 'y', 'chatgpt': 'z'}})
        write(self.ws / 'sources.tsv', 'alpha\to01\ten\thttps://www.alpha.edu/ai\n')
        self.assertIn('queued capture o01', gates.discovery_gate(self.ws, self.batch)[1][0])

    def test_require_refuses_changed_inputs(self):
        write(self.ws / 'discovery-gaps.json', {'alpha': {'crawl': 'x', 'firecrawl': 'y', 'chatgpt': 'z'}})
        self.assertEqual(gates.run_gate('discovery', self.ws, self.batch)['status'], 'pass')
        gates.require(self.ws, self.batch, 'discovery')
        self.receipt('o01', 'https://www.alpha.edu/ai')
        with self.assertRaisesRegex(B.BatchError, 'Inputs changed'):
            gates.require(self.ws, self.batch, 'discovery')

    def test_build_view_refuses_before_discovery_gate(self):
        result = subprocess.run([sys.executable, str(PIPE / 'build_view.py'), '--workspace', str(self.ws)], capture_output=True, text=True)
        self.assertNotEqual(result.returncode, 0)
        self.assertIn('Gate discovery has not passed', result.stderr)


class LocaleGateTest(Workspace):
    def test_complete_input_passes(self):
        self.assertEqual(gates.input_locale_problems(zh_input()), [])

    def test_missing_zh_claim_and_english_text_fail(self):
        inp = zh_input(); del inp['zh']['claims']['appeal']; inp['zh']['do'] = ['Ask first']
        self.assertEqual(gates.input_locale_problems(inp), ['zh.do must translate every do item', 'zh.claims missing appeal (the /zh/ evidence row would show English)'])

    def test_gate_covers_inputs_and_views_and_exempts_declared_english_only(self):
        write(self.ws / 'inputs/alpha.json', zh_input())
        result = gates.run_gate('locale', self.ws, self.batch)
        self.assertEqual(result['status'], 'fail')
        self.assertIn('alpha: view.json missing (run finalize)', result['failures'])
        batch = json.loads((self.ws / 'batch.json').read_text()); batch['englishOnlySlugs'] = ['alpha-university']
        write(self.ws / 'batch.json', batch)
        self.assertEqual(gates.run_gate('locale', self.ws, B.load(self.ws))['status'], 'pass')


class StageTest(Workspace):
    def test_firecrawl_marks_candidates_and_caps_the_queue(self):
        d = self.ws / 'firecrawl/alpha'
        write(d / 'search-1.json', {'data': {'web': [{'url': f'https://alpha.edu/ai-policy-{i}', 'title': 'Generative AI policy for students'} for i in range(3)] +
                                    [{'url': 'https://other.org/ai-policy', 'title': 'AI policy'}, {'url': 'https://alpha.edu/news/ai', 'title': 'AI news'}]}})
        result = subprocess.run([sys.executable, str(PIPE / 'firecrawl_sources.py'), '--workspace', str(self.ws), '--cap', '2'], capture_output=True, text=True)
        self.assertEqual(result.returncode, 0, result.stderr)
        leads = json.loads((d / 'leads.json').read_text())
        self.assertEqual(sum(l['candidate'] for l in leads), 3)
        self.assertEqual(len((self.ws / 'firecrawl-sources.tsv').read_text().splitlines()), 2)
        _, failures = gates.discovery_gate(self.ws, self.batch)
        self.assertEqual(len([f for f in failures if 'neither captured nor disposed' in f]), 3)

    def test_chatgpt_sources_keeps_official_domains_only(self):
        write(self.ws / 'chatgpt-audit/alpha.json', {'documents': [{'url': 'https://alpha.edu/a.pdf'}, {'url': 'https://news.example.com/x'}], 'omissions': [{'url': 'https://www.alpha.edu/ai'}]})
        self.receipt('o01', 'https://www.alpha.edu/ai')
        subprocess.run([sys.executable, str(PIPE / 'chatgpt_sources.py'), '--workspace', str(self.ws)], check=True, capture_output=True)
        self.assertEqual((self.ws / 'chatgpt-sources.tsv').read_text(), 'alpha\tc01\ten\thttps://alpha.edu/a.pdf\n')

    def test_select_sources_numbers_keys_per_school(self):
        write(self.ws / 'discovery/alpha.json', {'pages': [{'url': 'https://alpha.edu/genai', 'success': True, 'aiHits': 9}], 'pdfLinks': {'https://alpha.edu/rules.pdf': {}}})
        subprocess.run([sys.executable, str(PIPE / 'select_sources.py'), '--workspace', str(self.ws)], check=True, capture_output=True)
        rows = [l.split('\t')[1] for l in (self.ws / 'sources.tsv').read_text().splitlines()]
        self.assertEqual(rows, ['o01', 'd02', 'p03'])

    def test_capture_text_extraction(self):
        self.assertEqual(capture.html_lines(b'<html><script>x()</script><p>One</p><li>Two  words</li></html>'), 'One\nTwo words\n')
        buf = io.BytesIO()
        with zipfile.ZipFile(buf, 'w') as z:
            z.writestr('word/document.xml', '<w:document><w:p><w:r><w:t>Rule &amp; one</w:t></w:r></w:p><w:p><w:r><w:t>Two</w:t></w:r></w:p></w:document>')
        self.assertEqual(capture.docx_lines(buf.getvalue()), 'Rule & one\nTwo\n')

    def test_status_reports_g0_inputs_and_next_step(self):
        sys.path.insert(0, str(PIPE))
        import status
        report = status.status(self.ws, self.batch)
        self.assertIn('G0 alpha: alpha-university/public-tools.json missing', report['problems'])
        self.assertTrue(report['next'].startswith('Provide the G0 inputs'))


class ReadbackSourceMetadataTest(unittest.TestCase):
    """readback.py source-metadata rule, on wuhan-university (batch 6): its 4 displayed official sources are fetch_failed
    gaps, so its pages render 0 blocks although the school has metadata documents for other URLs."""
    SLUG = 'wuhan-university'
    GAPS = ['https://aix.whu.edu.cn/', 'https://oldwww.lib.whu.edu.cn/webfile/category/1104.html',
            'https://oldwww.lib.whu.edu.cn/webfile/category/1105.html', 'https://oldwww.lib.whu.edu.cn/webfile/category/AI_navigator.html']
    DOCS = ['https://uc.whu.edu.cn/info/1520/128641.htm', 'https://info.whu.edu.cn/info/1452/5373.htm']
    META = {'schools': {SLUG: [{'url': u} for u in DOCS]},
            'gaps': {SLUG: [{'url': u, 'reason': 'fetch_failed', 'detail': 'HTTP 403', 'checkedOn': '2026-11-22'} for u in GAPS]}}

    def html(self, urls, blocks=0):
        cards = ''.join(f'<a href="{u}" target="_blank" rel="noopener noreferrer" data-analytics-entity-slug="{self.SLUG}">x</a>' for u in urls)
        return '<main class="policy-v6">' + cards + '<div class="policy-v6-sourceMeta"></div>' * blocks + '</main>'

    def errors(self, urls, blocks=0, meta=None):
        meta = meta or self.META
        row = {'status': 200, 'v6Layout': True, 'applicationError': False, **readback.source_cards(self.html(urls, blocks), self.SLUG, meta)}
        return [p for p in (f'/universities/{self.SLUG}', f'/zh/universities/{self.SLUG}', f'/fr/universities/{self.SLUG}') if readback.row_error(p, row, meta)]

    def test_all_fetch_failed_cards_expect_no_blocks(self):
        row = readback.source_cards(self.html(self.GAPS), self.SLUG, self.META)
        self.assertEqual(row, {'sourceCards': 4, 'expectedSourceMetadata': 0, 'fetchFailedSourceCards': 4, 'renderedSourceMetadata': 0})
        self.assertEqual(self.errors(self.GAPS), [])
        cards = ['https://www.aix.whu.edu.cn', 'https://oldwww.lib.whu.edu.cn/webfile/category/1104.html/'] + self.GAPS[2:]
        self.assertEqual(readback.source_cards(self.html(cards), self.SLUG, self.META)['fetchFailedSourceCards'], 4)  # same key as v6SourceUrlKey

    def test_attempt_20_row_without_the_count_still_fails(self):
        old = {'status': 200, 'sourceCards': 4, 'expectedSourceMetadata': 0, 'renderedSourceMetadata': 0, 'v6Layout': True, 'applicationError': False}
        self.assertTrue(readback.row_error(f'/universities/{self.SLUG}', old, self.META))

    def test_missing_blocks_are_still_caught(self):
        self.assertEqual(len(self.errors([])), 3)  # no cards found at all
        self.assertEqual(len(self.errors(self.GAPS[:3] + ['https://aix.whu.edu.cn/other'])), 3)  # one card is neither documented nor a gap
        self.assertEqual(len(self.errors(self.GAPS + self.DOCS[:1])), 3)  # a documented card without its block
        self.assertEqual(len(self.errors(self.GAPS, blocks=1)), 3)  # a block nobody expects
        self.assertEqual(self.errors(self.GAPS + self.DOCS[:1], blocks=1), [])

    def test_only_fetch_failed_gaps_count(self):
        other = {'schools': self.META['schools'], 'gaps': {self.SLUG: [{'url': u, 'reason': 'not_official'} for u in self.GAPS]}}
        self.assertEqual(len(self.errors(self.GAPS, meta=other)), 3)
        both = {'schools': {self.SLUG: [{'url': u} for u in self.DOCS + self.GAPS[:1]]}, 'gaps': self.META['gaps']}
        self.assertEqual(len(self.errors(self.GAPS, meta=both)), 3)  # a documented URL needs its block even if also listed as a gap
        self.assertEqual(self.errors(self.GAPS, meta={'schools': {}, 'gaps': {}}), [])  # no documents: nothing expected, as before


if __name__ == '__main__':
    unittest.main()
