#!/usr/bin/env python3
"""S1d: choose the sources to capture per school: every current official source, batch.json extraSources, then the
discovered pages with the most AI-policy content and keyword PDFs. Writes sources.tsv (abbr, key, language, url).

  python3 scripts/v6-pipeline/select_sources.py --workspace <dir> [--extra N]
"""
import collections, json, re, sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import v6batch as B  # noqa: E402

SKIP = re.compile(r'/(tag|tags|category|author|feed|search|login|wp-login|news/page|page/\d+)(/|$)|\?(s|q|page)=|#|/print/|/events?/\d{4}', re.I)


def main():
    ws, args = B.workspace_from_argv()
    batch = B.load(ws)
    extra = int(args[args.index('--extra') + 1]) if '--extra' in args else int(batch.get('discovery', {}).get('extraPerSchool', 10))
    rows = []
    for school in batch['schools']:
        abbr, slug = school['abbr'], school['slug']
        pub = json.loads((ws / slug / 'public.json').read_text())['data']
        seen, count = set(), collections.Counter()

        def add(url, kind):
            key = B.norm(url)
            if key in seen or not url.startswith('http'):
                return
            seen.add(key); count[abbr] += 1
            rows.append((abbr, f'{kind}{count[abbr]:02d}', school['language'], url))
        for s in sorted({s['sourceUrl'] for s in pub['officialSources']}):
            add(s, 'o')
        for url in school.get('extraSources', []):
            add(url, 'x')
        disc = ws / 'discovery' / f'{abbr}.json'
        if disc.exists():
            d = json.loads(disc.read_text()); picked = 0
            for p in d['pages']:
                if picked >= extra:
                    break
                if p.get('success') and (p.get('aiHits') or 0) >= 6 and not SKIP.search(p['url']) and B.norm(p['url']) not in seen:
                    add(p['url'], 'd'); picked += 1
            for url in list(d.get('pdfLinks', {}))[:4]:
                add(url, 'p')
    (ws / 'sources.tsv').write_text(''.join('\t'.join(r) + '\n' for r in rows))
    print(dict(collections.Counter(r[0] for r in rows)))


if __name__ == '__main__':
    main()
