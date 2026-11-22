#!/usr/bin/env python3
"""S1b: Firecrawl leads -> capture rows (keys f01..). Firecrawl output is never evidence. Every official, uncaptured,
policy-looking lead is a *candidate* (firecrawl/<abbr>/leads.json, "candidate": true); the best --cap of them are
queued in firecrawl-sources.tsv. The discovery gate (gates.py discovery) requires every candidate to be captured or
disposed in discovery-dispositions.json, so nothing is silently dropped at the cap.

  python3 scripts/v6-pipeline/firecrawl_sources.py --workspace <dir> [--cap N] [abbr ...]
"""
import json, re, sys, urllib.parse
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import v6batch as B  # noqa: E402

AI = re.compile(r'\bai\b|\bia\b|artificial|intel[·.]?lig|inteligencia|intelligence|generati|genai|chatgpt|copilot|gemini|kunstmatige|kunstig|'
                r'生成|人工知能|인공지능|생성형|plagi|integrity|integrit|misconduct|fraude|fusk|disciplin|exam|examen|thesis|thèse|mémoire|'
                r'masterproef|examensarbete|treball|論文|不正|부정|학칙|regulation|règlement|reglement|normativa|policy|policies|guideline|richtlijn|riktlinje|directive', re.I)
SKIP = re.compile(r'/(news|nieuws|actualit|noticia|event|evenement|agenda|blog|people|profile|staff-directory|search|study|courses?|course-finder|opleidingen|programmes?|portal/en/publications|publications?|researchers?)\b|PROSPERO|pure\.|/phd-|centres-doctoral|\.(jpg|png|gif|mp4|zip)$|/tag/|/page/\d', re.I)
POL = re.compile(r'polic|guideline|guidance|guide|rule|regul|reglement|règlement|normativa|integrit|misconduct|plagi|fraud|fusk|disciplin|exam|assessment|avaluaci|évaluation|beoordel|thesis|thèse|mémoire|masterproef|examensarbete|declara|déclar|verklaring|acceptable|use-of|utilisation|gebruik|användning|ús-|uso|students?|étudiant|estudiant|student|学生|규정|지침|가이드|留意|指針|方針|ガイドライン|不正|懲戒|試験|論文', re.I)


def main():
    ws, args = B.workspace_from_argv()
    cap = 25
    if '--cap' in args:
        i = args.index('--cap'); cap = int(args[i + 1]); del args[i:i + 2]
    batch = B.load(ws)
    suffixes = B.multi_suffixes(batch)
    out = ws / 'firecrawl-sources.tsv'
    rows = out.read_text().splitlines() if out.exists() else []
    for school in B.schools(batch, args):
        abbr = school['abbr']; d = ws / 'firecrawl' / abbr
        if not d.is_dir():
            print(abbr, 'no firecrawl output'); continue
        domains = B.official_domains(batch, school)
        seen = {B.norm(json.loads(f.read_text())['url']) for f in (ws / 'captures' / abbr).glob('*.json')}
        seen |= {B.norm(r.split('\t')[3]) for r in rows if r.startswith(abbr + '\t')}
        seen |= B.queued_urls(ws, abbr)  # sources.tsv, chatgpt-sources.tsv, extra-sources.tsv: never queue a URL twice
        leads = {}
        for f in sorted(d.glob('search-*.json')) + [d / 'map.json']:
            if not f.exists(): continue
            data = json.loads(f.read_text()).get('data')
            items = (data.get('web') or data.get('links') or []) if isinstance(data, dict) else (data or [])
            for it in items:
                u = (it.get('url') or '').strip()
                if u.startswith('https://'):
                    leads.setdefault(u, {'url': u, 'title': (it.get('title') or '')[:200], 'description': (it.get('description') or '')[:300], 'from': f.name})
        for v in leads.values():
            v['official'] = B.site(urllib.parse.urlsplit(v['url']).hostname or '', suffixes) in domains
            v['alreadyCaptured'] = B.norm(v['url']) in seen
            v['score'] = len(AI.findall(v['url'] + ' ' + v['title'] + ' ' + v['description'])) + (3 if v['from'].startswith('search') else 0) + (2 if v['url'].lower().endswith('.pdf') else 0)
            v['candidate'] = v['official'] and not SKIP.search(v['url']) and v['score'] >= 2 and bool(POL.search(v['url'] + ' ' + v['title']))
        ranked = sorted(leads.values(), key=lambda x: -x['score'])
        new = [v for v in ranked if v['candidate'] and not v['alreadyCaptured']]
        n = sum(1 for r in rows if r.startswith(abbr + '\t'))
        for v in new[:cap]:
            n += 1; v['queued'] = f'f{n:02d}'
            rows.append('\t'.join([abbr, v['queued'], school['language'], v['url'].replace(' ', '%20')]))
        B.write_json(d / 'leads.json', ranked)
        print(abbr, 'leads', len(leads), 'official', sum(v['official'] for v in leads.values()), 'candidates', sum(v['candidate'] for v in leads.values()),
              'new', len(new), 'queued', min(cap, len(new)), '(the rest need a disposition before the discovery gate passes)' if len(new) > cap else '')
    out.write_text('\n'.join(rows) + ('\n' if rows else ''))


if __name__ == '__main__':
    main()
