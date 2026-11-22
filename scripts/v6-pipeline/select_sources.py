#!/usr/bin/env python3
"""S1d: choose the sources to capture per school: every current official source, batch.json extraSources, then the
discovered pages with the most AI-policy content and keyword PDFs. Writes sources.tsv (abbr, key, language, url).

  python3 scripts/v6-pipeline/select_sources.py --workspace <dir> [--extra N] [--append]

--append (what run.py uses) keeps every existing row and key and only adds new URLs, numbering on from the school's
last key; existing d/p rows count toward --extra and the four keyword PDFs. A key never changes its URL once queued,
because a capture receipt is keyed by abbr/key. Without --append the file is rewritten (only safe before capture).
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
    out = ws / 'sources.tsv'
    existing = [tuple(l.split('\t')[:4]) for l in out.read_text().splitlines() if l.strip()] if '--append' in args and out.is_file() else []
    rows = list(existing)
    added = collections.Counter()
    for school in batch['schools']:
        abbr, slug = school['abbr'], school['slug']
        pub = json.loads((ws / slug / 'public.json').read_text())['data']
        mine = [r for r in existing if r[0] == abbr]
        seen, count = {B.norm(r[3]) for r in mine}, collections.Counter({abbr: len(mine)})
        kept = collections.Counter(r[1][:1] for r in mine)

        def add(url, kind):
            key = B.norm(url)
            if key in seen or not url.startswith('http'):
                return
            seen.add(key); count[abbr] += 1; added[abbr] += 1
            rows.append((abbr, f'{kind}{count[abbr]:02d}', school['language'], url))
        for s in sorted({s['sourceUrl'] for s in pub['officialSources']}):
            add(s, 'o')
        for url in school.get('extraSources', []):
            add(url, 'x')
        disc = ws / 'discovery' / f'{abbr}.json'
        if disc.exists():
            d = json.loads(disc.read_text()); picked = kept['d']
            for p in d['pages']:
                if picked >= extra:
                    break
                if p.get('success') and (p.get('aiHits') or 0) >= 6 and not SKIP.search(p['url']) and B.norm(p['url']) not in seen:
                    add(p['url'], 'd'); picked += 1
            for url in list(d.get('pdfLinks', {}))[:max(0, 4 - kept['p'])]:
                add(url, 'p')
    out.write_text(''.join('\t'.join(r) + '\n' for r in rows))
    print(json.dumps({'rows': dict(collections.Counter(r[0] for r in rows)), 'added': dict(added)}))


if __name__ == '__main__':
    main()
