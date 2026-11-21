#!/usr/bin/env python3
"""S4b pre-release ChatGPT check: write one Markdown brief per school from the frozen review packets, for the pre-release ChatGPT check.

ChatGPT cannot open the local candidate, so it gets exactly the text students will see (English, plus the Chinese
copy), every cited official quote with its URL, the tools, the gaps, and the list of official sources we captured.
Usage: chatgpt_brief.py --workspace <dir> [review-dir] [out-dir]. Output: chatgpt-prerelease/<abbr>.md and ALL.md. Private fields (hashes, record ids) are left out."""
import json, pathlib, sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
import v6batch as Bt  # noqa: E402

P, args = Bt.workspace_from_argv()
BATCH = Bt.load(P)
R = P / (args[0] if len(args) > 0 else BATCH.get('reviewDir', 'review'))
OUT = P / (args[1] if len(args) > 1 else 'chatgpt-prerelease')
OUT.mkdir(exist_ok=True)
EDITION = BATCH.get('rankingEdition', 'QS 2026')
allmd = []
for school in BATCH['schools']:
    slug, rank, abbr = school['slug'], school['rank'], school['abbr']
    f = R / f'{slug}.json'
    if not f.exists():
        continue
    t = json.loads(f.read_text())['target']
    s = t['school']
    L = [f"# {s['name']} ({EDITION} {rank}) — page text to check", '',
         f"**Title:** {t['hero']['title']['en']}  ", f"**Overall scope:** {t['hero']['scope']['en']}  ",
         f"**Chinese scope:** {t['hero']['scope']['zh']}", '']
    L.append('## Topics')
    for tp in s['topics'] + s['additionalTopics']:
        zh = t['topicSummaries'].get(tp['key'], {})
        L += ['', f"### {tp['title']} — status `{tp['status']}` ({tp.get('statusLabel', '')})",
              f"Summary: {tp['summary']}", f"Scope: {tp['scope']}", f"Chinese summary: {zh.get('zh', '')}"]
        seen = set()
        for c in tp.get('claims', []):
            for e in c.get('evidence', []):
                q = ' '.join(e['quote'].split())
                if (q, e['url']) in seen:
                    continue
                seen.add((q, e['url']))
                L.append(f"- Quote ({e.get('title') or c.get('text')}; {e['url']}): \"{q[:700]}{'…' if len(q) > 700 else ''}\"")
    acts = t['studentActions']
    for side in ('do', 'dont'):
        L += ['', f"## {'Do' if side == 'do' else 'Don’t'}"]
        for a in acts.get(side, []):
            L.append(f"- [{a.get('kind')}] {a['text']['en'] if isinstance(a.get('text'), dict) else a.get('en') or a.get('text')} / 中文: {a['text']['zh'] if isinstance(a.get('text'), dict) else a.get('zh', '')}")
    L += ['', '## Tools']
    for tool in t.get('tools', []):
        L.append(f"- {tool['rawToolName']}: availability `{tool['availability']}`, {tool.get('endorsementType')}. {tool.get('description', '')} How to obtain: {tool.get('howToObtain', '')} Cost: {tool.get('costToUser', '')}")
    if not t.get('tools'):
        L.append('- (none shown)')
    L += ['', '## Stated gaps (what the page says is unknown)'] + [f"- {g}" for g in t.get('gaps', [])]
    cited = {}
    for tp in s['topics'] + s['additionalTopics']:
        for c in tp.get('claims', []):
            for e in c.get('evidence', []):
                cited.setdefault(e['url'], e.get('title') or '')
    for x in t.get('sources', []):
        cited.setdefault(x.get('sourceUrl'), x.get('citationTitle') or '')
    L += ['', '## Official sources used on this page'] + [f"- {title} — {url}" for url, title in cited.items()]
    md = '\n'.join(L) + '\n'
    (OUT / f'{abbr}.md').write_text(md)
    allmd.append(md)
(OUT / 'ALL.md').write_text('\n\n---\n\n'.join(allmd))
print('briefs', len(allmd), 'bytes', len('\n'.join(allmd).encode()))
