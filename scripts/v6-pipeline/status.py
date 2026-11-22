#!/usr/bin/env python3
"""Where a batch stands and what runs next (docs/v6-pipeline.md §2). Read-only.

  python3 scripts/v6-pipeline/status.py --workspace <dir> [--init]

--init creates the workspace directories next to batch.json. G0 checks the per-school inputs every later stage needs:
<slug>/public.json (live API record, 1 worker), <slug>/public-tools.json and <slug>/historical-inventory.json (private
inventory revision), and the parent release directory (manifest.json + tree/).
"""
import json, sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import v6batch as B  # noqa: E402

DIRS = ['captures', 'discovery', 'firecrawl', 'chatgpt-audit', 'inputs', 'gates', 'source-metadata', 'review']


def status(ws, batch):
    rows, problems = [], []
    parent = Path(batch.get('parentRelease', ''))
    parent = parent if parent.is_absolute() else ws / parent
    if not (parent / 'manifest.json').is_file() or not (parent / 'tree').is_dir():
        problems.append(f'G0: parentRelease {parent} has no manifest.json + tree/')
    for s in batch['schools']:
        a, slug = s['abbr'], s['slug']
        missing = [n for n in ('public.json', 'public-tools.json', 'historical-inventory.json') if not (ws / slug / n).is_file()]
        problems += [f'G0 {a}: {slug}/{n} missing' for n in missing]
        rows.append({'abbr': a, 'inputs': not missing,
                     'crawl': (ws / 'discovery' / f'{a}.json').is_file(), 'firecrawl': (ws / 'firecrawl' / a / 'leads.json').is_file(),
                     'chatgpt': (ws / 'chatgpt-audit' / f'{a}.json').is_file(), 'captures': len(list((ws / 'captures' / a).glob('*.json'))),
                     'draft': (ws / 'inputs' / f'{a}.json').is_file(), 'view': (ws / slug / 'view.json').is_file(),
                     'packet': (ws / batch.get('reviewDir', 'review') / f'{slug}.json').is_file(),
                     'findings': (ws / batch.get('reviewDir', 'review') / 'findings' / f'{slug}.json').is_file()})
    gates = {name: (B.read_gate(ws, name) or {}).get('status', 'not run') for name in ('discovery', 'locale')}
    receipts = (ws / batch.get('reviewDir', 'review') / 'independent-review.json').is_file()
    assembled = (ws / batch.get('outDir', 'release-candidate') / 'assembly-receipt.json').is_file()
    if problems: step = 'Provide the G0 inputs listed above.'
    elif not all(r['crawl'] and r['firecrawl'] and r['chatgpt'] for r in rows): step = 'S1 discovery: pnpm v6:run --workspace <ws> (harness background command; read its summary), plus the ChatGPT audit per school (save-clip.sh), then v6:run again.'
    elif gates['discovery'] != 'pass': step = 'Dispose remaining leads or record typed gaps, then pnpm v6:run (captures queued rows and reruns G1).'
    elif not all(r['view'] for r in rows): step = 'S3 drafting (prompts/DRAFT-BRIEF.md) -> build_view.py -> finalize.ts.'
    elif gates['locale'] != 'pass': step = 'gates.py locale (Chinese on every /zh/ row).'
    elif not all(r['packet'] for r in rows): step = 'finalize.ts (full run, writes selection.json) -> packets.ts.'
    elif not receipts: step = 'S4 independent review rounds (prompts/REVIEW-SPEC.md) until accept, then receipts.py.'
    elif not assembled: step = 'S5 check-meta.ts, then S6 assemble.ts.'
    else: step = 'S6 readback.py (local candidate) + sync-basis.ts + make_event.py candidate -> pnpm content:bundle -> owner approval of the bundle SHA256.'
    return {'batchId': batch['batchId'], 'mode': batch['mode'], 'schools': rows, 'gates': gates, 'receipts': receipts, 'assembled': assembled, 'problems': problems, 'next': step}


def main():
    ws, args = B.workspace_from_argv()
    batch = B.load(ws)
    if '--init' in args:
        for d in DIRS: (ws / d).mkdir(exist_ok=True)
        for s in batch['schools']: (ws / s['slug']).mkdir(exist_ok=True)
    print(json.dumps(status(ws, batch), ensure_ascii=False, indent=1))


if __name__ == '__main__':
    try: main()
    except B.BatchError as error:
        print('status error: ' + str(error), file=sys.stderr); sys.exit(2)
