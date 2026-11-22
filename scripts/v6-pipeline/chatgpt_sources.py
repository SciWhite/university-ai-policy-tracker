#!/usr/bin/env python3
"""S1c: turn ChatGPT audit leads into capture rows. ChatGPT text is never evidence: this only lists the official URLs it
named (documents, omissions, topic documents, tools) that are not captured yet, so capture.py can fetch them; drafting
cites captures only. Official = a site of the school's current official sources or batch.json extraDomains.

  python3 scripts/v6-pipeline/chatgpt_sources.py --workspace <dir> [abbr ...]   -> appends c01.. rows to chatgpt-sources.tsv
"""
import json, sys, urllib.parse
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import v6batch as B  # noqa: E402
from gates import chatgpt_urls  # noqa: E402


def main():
    ws, args = B.workspace_from_argv()
    batch = B.load(ws)
    out = ws / 'chatgpt-sources.tsv'
    existing = out.read_text().splitlines() if out.exists() else []
    suffixes = B.multi_suffixes(batch)
    for school in B.schools(batch, args):
        abbr = school['abbr']
        audit_file = ws / 'chatgpt-audit' / f'{abbr}.json'
        if not audit_file.exists():
            print(abbr, 'no ChatGPT audit yet'); continue
        domains = B.official_domains(batch, school)
        seen = {B.norm(json.loads(f.read_text())['url']) for f in (ws / 'captures' / abbr).glob('*.json')}
        seen |= {B.norm(l.split('\t')[3]) for l in existing if l.startswith(abbr + '\t')}
        seen |= B.queued_urls(ws, abbr)  # never queue a URL another queue already holds
        n = sum(1 for l in existing if l.startswith(abbr + '\t'))
        added, offsite = 0, []
        for u in chatgpt_urls(json.loads(audit_file.read_text())):
            if B.site(urllib.parse.urlsplit(u).hostname, suffixes) not in domains: offsite.append(u); continue
            if B.norm(u) in seen: continue
            seen.add(B.norm(u)); n += 1; added += 1
            existing.append('\t'.join([abbr, f'c{n:02d}', school['language'], u]))
        print(abbr, 'domains', sorted(domains), 'added', added, 'offsite', len(offsite), offsite[:4])
    out.write_text('\n'.join(existing) + ('\n' if existing else ''))


if __name__ == '__main__':
    main()
