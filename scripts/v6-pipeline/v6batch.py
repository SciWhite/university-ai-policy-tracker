"""Shared batch configuration for the V6 pipeline (docs/v6-pipeline.md).

A batch is a workspace directory (normally `.local/policy-v6/<batchId>/`, never committed) that
holds data only: batch.json, per-school inputs, captures, discovery leads, reviews, receipts.
Every script lives in scripts/v6-pipeline/ and reads the workspace from `--workspace <dir>` or
UAPT_V6_WORKSPACE. Nothing batch-specific is hard-coded in a script any more (2026-11-21 audit:
112 per-batch copies, 9 host-release.py forks).
"""
import hashlib, json, os, re, sys
from datetime import datetime, timezone
from pathlib import Path

SCHEMA = 'uapt-v6-batch-v1'
REPO = Path(__file__).resolve().parents[2]
SLUG = re.compile(r'^[a-z0-9][a-z0-9-]{1,120}$')
ABBR = re.compile(r'^[a-z0-9][a-z0-9-]{0,30}$')
TOPIC_KEYS = ['coursework', 'exams', 'disclosure', 'privacy_data', 'approved_tools', 'research_publication',
              'academic_integrity', 'teaching_guidance', 'security_procurement']

# Discovery vocabulary (union of the three 2026-11 batches); batch.json may add more.
DEFAULT_KEYWORDS = [
    "artificial-intelligence", "artificial intelligence", "generative", "genai", "gen-ai", "chatgpt", "copilot", "ai-tools", "ai tools",
    "academic-integrity", "academic integrity", "integrity", "plagiarism", "misconduct", "assessment", "exam",
    "kunstliche", "künstliche", "ki-", "generative-ki", "kunstig", "intelligens", "人工智能", "生成式", "大模型", "学术",
    "kecerdasan", "inteligencia", "integridad", "intelligenza", "integrita", "kunstmatige", "generatieve", "fraude", "artificiell",
    "generativ", "fusk", "intelligence-artificielle", "intelligence artificielle", "ia-generative", "plagiat", "intel·ligència",
    "intelligencia-artificial", "integritat", "생성형", "인공지능", "연구윤리", "生成ai", "人工知能", "生成系", "kunstmatige-intelligentie", "ai"]
DEFAULT_CONTENT_PATTERN = (
    r"generative ai|genai|gen ai|chatgpt|copilot|large language model|artificial intelligence|\bAI\b|"
    r"künstliche intelligenz|generative ki|\bKI\b|kunstig intelligens|generativ ai|人工智能|生成式|大模型|"
    r"kecerdasan buatan|inteligencia artificial|\bIA\b|intelligenza artificiale|kunstmatige intelligentie|generatieve ai|"
    r"artificiell intelligens|intelligence artificielle|IA générative|\bIAG\b|intel·ligència artificial|生成AI|生成系AI|人工知能|생성형|인공지능")
DEFAULT_MULTI_SUFFIXES = ["edu.au", "ac.uk", "edu.cn", "edu.my", "ac.za", "ac.at", "ac.nz", "utm.my", "ac.kr", "ac.jp"]


class BatchError(Exception):
    pass


def workspace_from_argv(argv=None):
    """Pop `--workspace <dir>` from argv (or use UAPT_V6_WORKSPACE); returns (workspace, remaining args)."""
    argv = list(sys.argv[1:] if argv is None else argv)
    ws = os.environ.get('UAPT_V6_WORKSPACE')
    if '--workspace' in argv:
        i = argv.index('--workspace'); ws = argv[i + 1]; del argv[i:i + 2]
    if not ws:
        raise BatchError('Pass --workspace <batch dir> or set UAPT_V6_WORKSPACE')
    return Path(ws).resolve(), argv


def load(workspace):
    ws = Path(workspace).resolve()
    path = ws / 'batch.json'
    if not path.is_file():
        raise BatchError('No batch.json in ' + str(ws) + ' (start from scripts/v6-pipeline/batch.example.json)')
    batch = json.loads(path.read_text())
    validate(batch)
    batch['_workspace'] = ws
    return batch


def validate(batch):
    if batch.get('schemaVersion') != SCHEMA:
        raise BatchError('batch.json schemaVersion must be ' + SCHEMA)
    for key in ('batchId', 'revision'):
        if not isinstance(batch.get(key), str) or not batch[key]:
            raise BatchError('batch.json needs ' + key)
    if batch.get('mode') not in ('add', 'update'):
        raise BatchError('batch.json mode must be "add" (new V6 schools) or "update" (page-only update of V6 schools)')
    schools = batch.get('schools')
    if not isinstance(schools, list) or not schools:
        raise BatchError('batch.json needs a non-empty schools list')
    seen_slug, seen_abbr = set(), set()
    for s in schools:
        if not SLUG.match(s.get('slug', '')) or not ABBR.match(s.get('abbr', '')) or not s.get('language') or not str(s.get('rank', '')):
            raise BatchError('Each school needs slug, abbr, rank and language: ' + json.dumps(s)[:200])
        if s['slug'] in seen_slug or s['abbr'] in seen_abbr:
            raise BatchError('Duplicate school: ' + s['slug'])
        seen_slug.add(s['slug']); seen_abbr.add(s['abbr'])
    english_only = batch.get('englishOnlySlugs', [])
    if not set(english_only) <= seen_slug:
        raise BatchError('englishOnlySlugs must be schools of this batch')
    return batch


def schools(batch, only=()):
    only = set(only)
    return [s for s in batch['schools'] if not only or s['abbr'] in only or s['slug'] in only]


def by_abbr(batch):
    return {s['abbr']: s for s in batch['schools']}


def site(host, suffixes=None):
    host = (host or '').lower().removeprefix('www.'); parts = host.split('.')
    for m in suffixes or DEFAULT_MULTI_SUFFIXES:
        if host.endswith('.' + m) or host == m:
            return '.'.join(parts[-(m.count('.') + 2):])
    return '.'.join(parts[-2:])


def norm(url):
    from urllib.parse import urlsplit
    s = urlsplit(url.strip())
    return (s.hostname or '').lower().removeprefix('www.') + s.path.rstrip('/') + (('?' + s.query) if s.query else '')


def multi_suffixes(batch):
    return DEFAULT_MULTI_SUFFIXES + list(batch.get('discovery', {}).get('multiPartSuffixes', []))


def official_domains(batch, school):
    """Sites of the school's current official sources, plus declared parent bodies (batch.json extraDomains)."""
    ws = batch['_workspace']
    pub = json.loads((ws / school['slug'] / 'public.json').read_text())['data']
    from urllib.parse import urlsplit
    suffixes = multi_suffixes(batch)
    return {site(urlsplit(s['sourceUrl']).hostname, suffixes) for s in pub['officialSources']} | set(school.get('extraDomains', []))


def sha256_file(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def tree_digest(paths):
    """One SHA256 over (relative path, file hash) pairs; changes when any input changes."""
    h = hashlib.sha256()
    for rel, digest in sorted(paths):
        h.update(f'{rel}\0{digest}\n'.encode())
    return h.hexdigest()


def now():
    return datetime.now(timezone.utc).isoformat().replace('+00:00', 'Z')


def write_json(path, value):
    path = Path(path); path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n')


def gate_path(ws, name):
    return Path(ws) / 'gates' / f'{name}.json'


def read_gate(ws, name):
    path = gate_path(ws, name)
    return json.loads(path.read_text()) if path.is_file() else None
