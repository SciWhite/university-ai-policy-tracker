#!/usr/bin/env python3
"""S1b: Firecrawl search + map leads per school, one school at a time (leads only, never evidence). No stealth or
proxy options; blocked pages stay gaps in capture.py. Needs FIRECRAWL_API_KEY in the environment (never printed) and
the firecrawl CLI (FIRECRAWL_BIN, default ~/.local/bin/firecrawl). Queries come from batch.json:
schools[].firecrawl = {"domain": "ugent.be", "mapQuery": "ai", "queries": ["generatieve AI studenten", ...]}.

  python3 scripts/v6-pipeline/firecrawl_discover.py --workspace <dir> [abbr ...]
Output: firecrawl/<abbr>/search-N.json, map.json, queries.txt, err.log.
"""
import os, subprocess, sys, time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import v6batch as B  # noqa: E402


def main():
    ws, args = B.workspace_from_argv()
    batch = B.load(ws)
    cli = os.environ.get('FIRECRAWL_BIN', str(Path.home() / '.local/bin/firecrawl'))
    for school in B.schools(batch, args):
        cfg = school.get('firecrawl') or {}
        if not cfg.get('domain') or not cfg.get('queries'):
            print(school['abbr'], 'no firecrawl config in batch.json; record a gap in discovery-gaps.json'); continue
        out = ws / 'firecrawl' / school['abbr']; out.mkdir(parents=True, exist_ok=True)
        err = (out / 'err.log').open('a')
        with (out / 'queries.txt').open('a') as log:
            for i, q in enumerate(cfg['queries'], 1):
                query = f"site:{cfg['domain']} {q}"
                log.write(f'{i}\t{query}\n')
                subprocess.run([cli, 'search', query, '--limit', '10', '--json', '--no-domain-tools', '-o', str(out / f'search-{i}.json')], stdout=subprocess.DEVNULL, stderr=err)
                time.sleep(2)
        subprocess.run([cli, 'map', f"https://www.{cfg['domain']}", '--search', cfg.get('mapQuery', 'ai'), '--limit', '100', '--include-subdomains', '--wait', '--json', '-o', str(out / 'map.json')],
                       stdout=subprocess.DEVNULL, stderr=err)
        print(school['abbr'], 'done', flush=True)


if __name__ == '__main__':
    main()
