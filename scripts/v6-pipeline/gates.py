#!/usr/bin/env python3
"""Hard gates of the V6 pipeline (docs/v6-pipeline.md §3). Each writes gates/<name>.json in the
workspace with status, counts, failures, the next action and an inputs hash; the next stage
refuses unless the gate passed on exactly the current inputs.

  gates.py --workspace <dir> discovery   G1: discovery complete before drafting
  gates.py --workspace <dir> locale      G3: Chinese on every shown row (inputs and built views)

G1 (2026-11-21 audit, R4): every school has all three discovery layers (Crawl4AI crawl,
Firecrawl leads, ChatGPT audit) or a typed gap; every official URL a layer named is captured
(any HTTP outcome; non-200 is a typed access gap) or carries a disposition in
discovery-dispositions.json; every queued capture row has a receipt. Live checks found
omissions after release in 3 of 3 batches because drafting started before discovery ended.

G3: batches 1-2 shipped 197 /zh/ evidence rows in English because nothing checked them. Every
row a /zh/ page shows must have Chinese text: hero, nine topic labels/status labels/summaries/
scopes, every Do/Don't, every evidence row linked from Do/Don't/procedures (summaryZh) and every
tool's display copy. englishOnlySlugs in batch.json are the only exemption and are listed.
"""
import json, re, sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import v6batch as B  # noqa: E402

CJK = re.compile(r'[㐀-鿿]')
LAYERS = ('crawl', 'firecrawl', 'chatgpt')
DISPOSITIONS = {'covered', 'not_material', 'duplicate', 'out_of_scope', 'superseded'}
QUEUE_FILES = B.QUEUE_FILES


def _json(path, default=None):
    path = Path(path)
    return json.loads(path.read_text()) if path.is_file() else default


def chatgpt_urls(audit):
    """Every URL the ChatGPT audit names (documents, omissions, topic documents, tools)."""
    urls = [d.get('url') for d in audit.get('documents', [])] + [o.get('url') for o in audit.get('omissions', [])]
    urls += [u for t in (audit.get('topics') or {}).values() if isinstance(t, dict) for u in (t.get('documentUrls') or [])]
    urls += [t.get('url') for t in audit.get('tools', []) if isinstance(t, dict)]
    return [u.strip().replace(' ', '%20') for u in urls if isinstance(u, str) and u.strip().startswith('https://')]


def _disposed(url, dispositions):
    key = B.norm(url)
    for pattern, row in dispositions.items():
        p = B.norm(pattern[:-1]) if pattern.endswith('*') else B.norm(pattern)
        if (pattern.endswith('*') and key.startswith(p)) or key == p:
            if not isinstance(row, dict) or row.get('disposition') not in DISPOSITIONS or not row.get('note'):
                raise B.BatchError(f'Invalid disposition for {pattern}: needs disposition in {sorted(DISPOSITIONS)} and a note')
            return row['disposition']
    return None


def discovery_inputs(ws, batch):
    files = [ws / 'batch.json', ws / 'discovery-gaps.json', ws / 'discovery-dispositions.json'] + [ws / q for q in QUEUE_FILES]
    for s in batch['schools']:
        a = s['abbr']
        files += [ws / 'discovery' / f'{a}.json', ws / 'firecrawl' / a / 'leads.json', ws / 'chatgpt-audit' / f'{a}.json']
        files += sorted((ws / 'captures' / a).glob('*.json'))
    return B.tree_digest((str(p.relative_to(ws)), B.sha256_file(p)) for p in files if p.is_file())


def discovery_gate(ws, batch):
    gaps = _json(ws / 'discovery-gaps.json', {})
    dispositions_all = _json(ws / 'discovery-dispositions.json', {})
    queued = {}
    for name in QUEUE_FILES:
        for line in (ws / name).read_text().splitlines() if (ws / name).is_file() else []:
            if line.strip():
                abbr, key, _, url = line.split('\t')[:4]
                queued.setdefault(abbr, []).append((name, key, url))
    report, failures = {}, []
    for s in batch['schools']:
        a = s['abbr']; problems = []
        receipts = {p.stem: json.loads(p.read_text()) for p in sorted((ws / 'captures' / a).glob('*.json'))}
        captured = {B.norm(r['url']): r for r in receipts.values()}
        layer_state = {}
        for layer, path in (('crawl', ws / 'discovery' / f'{a}.json'), ('firecrawl', ws / 'firecrawl' / a / 'leads.json'), ('chatgpt', ws / 'chatgpt-audit' / f'{a}.json')):
            if path.is_file(): layer_state[layer] = 'done'
            elif (gaps.get(a) or {}).get(layer): layer_state[layer] = 'gap: ' + gaps[a][layer]
            else: problems.append(f'{layer} discovery missing (run it or record a gap in discovery-gaps.json)')
        for name, key, url in queued.get(a, []):
            if key not in receipts: problems.append(f'queued capture {key} ({name}) has no receipt: {url}')
        domains = B.official_domains(batch, s)
        suffixes = B.multi_suffixes(batch)
        from urllib.parse import urlsplit
        leads = []
        audit = _json(ws / 'chatgpt-audit' / f'{a}.json')
        if audit:
            leads += [('chatgpt', u) for u in chatgpt_urls(audit) if B.site(urlsplit(u).hostname, suffixes) in domains]
        fire = _json(ws / 'firecrawl' / a / 'leads.json', [])
        leads += [('firecrawl', l['url']) for l in fire if l.get('candidate')]
        dispositions = dispositions_all.get(a, {})
        resolved = {'captured': 0, 'accessGap': 0, 'textGap': 0, 'disposed': 0}
        unresolved = []
        for layer, url in dict.fromkeys(leads):
            receipt = captured.get(B.norm(url))
            if receipt:
                # non-200 = access gap; 200 without text (capture.py textError) = text gap; both are typed and resolved
                resolved['captured' if receipt.get('status') == '200' and not receipt.get('textError') else
                         'textGap' if receipt.get('status') == '200' else 'accessGap'] += 1
            elif _disposed(url, dispositions):
                resolved['disposed'] += 1
            else:
                unresolved.append(f'{layer}: {url}')
        problems += [f'lead neither captured nor disposed: {u}' for u in unresolved]
        text_gaps = sorted(k for k, r in receipts.items() if r.get('textError'))
        report[a] = {'layers': layer_state, 'leads': len(dict.fromkeys(leads)), **resolved, 'captures': len(receipts),
                     'textGaps': text_gaps, 'problems': problems}
        failures += [f'{a}: {p}' for p in problems]
    return report, failures


def _text(value):
    return isinstance(value, str) and value.strip() != ''


def _zh(value):
    return _text(value) and bool(CJK.search(value))


def input_locale_problems(inp):
    """Chinese in inputs/<abbr>.json (INPUT-SPEC zh block)."""
    zh = inp.get('zh') or {}
    out = []
    hero = zh.get('hero') or []
    if len(hero) != 2 or not all(_zh(x) for x in hero): out.append('zh.hero needs [title, scope] in Chinese')
    topics = zh.get('topics') or []
    if len(topics) != len(B.TOPIC_KEYS) or not all(isinstance(t, list) and len(t) == 3 and all(_zh(x) for x in t) for t in topics):
        out.append('zh.topics needs nine [label, summary, scope] entries in Chinese')
    for side in ('do', 'dont'):
        rows = zh.get(side) or []
        if len(rows) != len(inp.get(side, [])) or not all(_zh(x) for x in rows): out.append(f'zh.{side} must translate every {side} item')
    tools = zh.get('tools') or {}
    for tool in inp.get('tools', []):
        row = tools.get(tool.get('rawToolName'))
        if not (isinstance(row, list) and len(row) == 3 and all(_text(x) for x in row)): out.append('zh.tools missing ' + str(tool.get('rawToolName')))
    refs = {r for a in inp.get('do', []) + inp.get('dont', []) for r in a.get('refs', [])} | {r for v in (inp.get('procedures') or {}).values() for r in v}
    claims = zh.get('claims') or {}
    for ref in sorted(refs):
        if not _zh(claims.get(ref)): out.append('zh.claims missing ' + ref + ' (the /zh/ evidence row would show English)')
    return out


def view_locale_problems(view):
    """Chinese on every row a built V6 view shows on /zh/ (finalize output or packet target)."""
    out = []
    topics = (view.get('school') or {}).get('topics', []) + (view.get('school') or {}).get('additionalTopics', [])
    for t in topics:
        k = t['key']
        for label, value in ((f'topicLabels.{k}', view.get('topicLabels', {}).get(k, {}).get('zh')),
                             (f'topicLabels.{k}:status', view.get('topicLabels', {}).get(k + ':status', {}).get('zh')),
                             (f'topicSummaries.{k}', view.get('topicSummaries', {}).get(k, {}).get('zh')),
                             (f'topicScopes.{k}', view.get('topicScopes', {}).get(k, {}).get('zh'))):
            if not _zh(value): out.append(label + '.zh missing')
    hero = view.get('hero') or {}
    for part in ('title', 'scope'):
        if not _zh((hero.get(part) or {}).get('zh')): out.append(f'hero.{part}.zh missing')
    guide = view.get('studentActions') or {}
    linked = set()
    for side in ('do', 'dont'):
        for i, action in enumerate(guide.get(side, [])):
            if not _zh(action.get('zh')): out.append(f'studentActions.{side}[{i}].zh missing')
            linked |= set(action.get('claimIds', []))
    linked |= {c for ids in (guide.get('procedures') or {}).values() for c in ids}
    for cid in sorted(linked):
        row = (guide.get('claims') or {}).get(cid)
        if row is None: out.append('linked evidence row missing: ' + cid)
        elif not _zh(row.get('summaryZh')): out.append('evidence row has no summaryZh (English on /zh/): ' + cid)
    copy = ((view.get('toolDisplayCopy') or {}).get('zh') or {})
    for tool in view.get('tools', []):
        if not _text((copy.get(tool.get('rawToolName')) or {}).get('description')): out.append('toolDisplayCopy.zh missing ' + str(tool.get('rawToolName')))
    return out


def locale_gate(ws, batch):
    english_only = set(batch.get('englishOnlySlugs', []))
    report, failures, hashes = {}, [], []
    for s in batch['schools']:
        a, slug = s['abbr'], s['slug']
        if slug in english_only:
            report[a] = {'exempt': 'englishOnlySlugs'}; continue
        problems = []
        inp_path, view_path = ws / 'inputs' / f'{a}.json', ws / slug / 'view.json'
        if not inp_path.is_file(): problems.append('inputs file missing')
        else:
            problems += ['input: ' + p for p in input_locale_problems(json.loads(inp_path.read_text()))]
            hashes.append((str(inp_path.relative_to(ws)), B.sha256_file(inp_path)))
        if not view_path.is_file(): problems.append('view.json missing (run finalize)')
        else:
            problems += ['view: ' + p for p in view_locale_problems(json.loads(view_path.read_text()))]
            hashes.append((str(view_path.relative_to(ws)), B.sha256_file(view_path)))
        report[a] = {'problems': problems}
        failures += [f'{a}: {p}' for p in problems]
    return report, failures, B.tree_digest(hashes)


def run_gate(name, ws, batch):
    if name == 'discovery':
        report, failures = discovery_gate(ws, batch)
        digest = discovery_inputs(ws, batch)
        next_action = 'Capture or dispose every listed lead (discovery-dispositions.json), record typed gaps (discovery-gaps.json), then run the gate again.'
    elif name == 'locale':
        report, failures, digest = locale_gate(ws, batch)
        next_action = 'Add the missing Chinese to inputs/<abbr>.json (zh block, zh.claims for every linked ref), rerun build_view + finalize, then this gate.'
    else:
        raise B.BatchError('Unknown gate ' + name)
    result = {'schemaVersion': 'uapt-v6-gate-v1', 'gate': name, 'batchId': batch['batchId'], 'checkedAt': B.now(),
              'status': 'fail' if failures else 'pass', 'inputsSha256': digest, 'schools': report,
              'failures': failures, 'nextAction': next_action if failures else None}
    B.write_json(B.gate_path(ws, name), result)
    return result


def require(ws, batch, name):
    """Refuse a stage unless the gate passed on the current inputs."""
    gate = B.read_gate(ws, name)
    if not gate or gate.get('status') != 'pass':
        raise B.BatchError(f'Gate {name} has not passed; run: python3 scripts/v6-pipeline/gates.py --workspace {ws} {name}')
    current = discovery_inputs(ws, batch) if name == 'discovery' else locale_gate(ws, batch)[2]
    if gate.get('inputsSha256') != current:
        raise B.BatchError(f'Inputs changed after gate {name} passed; run the gate again')
    return gate


def main(argv=None):
    ws, args = B.workspace_from_argv(argv)
    if len(args) != 1:
        raise B.BatchError('usage: gates.py --workspace <dir> <discovery|locale>')
    batch = B.load(ws)
    result = run_gate(args[0], ws, batch)
    print(json.dumps({k: result[k] for k in ('gate', 'status', 'inputsSha256')} | {'failures': result['failures'][:20], 'failureCount': len(result['failures'])}, ensure_ascii=False, indent=1))
    return 0 if result['status'] == 'pass' else 1


if __name__ == '__main__':
    try: sys.exit(main())
    except B.BatchError as error:
        print('gate error: ' + str(error), file=sys.stderr); sys.exit(2)
