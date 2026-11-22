#!/usr/bin/env python3
"""S2b rendered capture for pages a normal browser receives but plain HTTP is refused (HTTP 403 to curl). Crawl4AI
headless Chromium with robots.txt respected; no challenge solving. A page that shows a challenge or no content stays a
gap. The receipt says hashKind=rendered_dom: the hash is of the rendered HTML, not of the server's raw bytes.

  python3 scripts/v6-pipeline/render_capture.py --workspace <dir> abbr:key [abbr:key ...]   (UAPT_CRAWL4AI_PYTHON)
"""
import asyncio, hashlib, json, re, sys
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import v6batch as B  # noqa: E402
from capture import html_lines  # noqa: E402  (same text extraction as plain captures)

CHALLENGE = re.compile(r"just a moment|verify you are human|captcha|access denied|attention required|enable javascript and cookies|prove you are a human|security check|vérification de sécurité", re.I)


async def main():
    from crawl4ai import AsyncWebCrawler, BrowserConfig, CrawlerRunConfig, CacheMode
    ws, items = B.workspace_from_argv()
    B.load(ws)
    async with AsyncWebCrawler(config=BrowserConfig(headless=True, verbose=False)) as crawler:
        for item in items:
            abbr, key = item.split(':')
            d = ws / 'captures' / abbr; meta = json.loads((d / f'{key}.json').read_text())
            r = await crawler.arun(meta['url'], config=CrawlerRunConfig(cache_mode=CacheMode.BYPASS, check_robots_txt=True, page_timeout=60000, delay_before_return_html=4.0))
            html = (r.html or '') if r.success else ''
            text = html_lines(html.encode()) if html else ''
            if not r.success or r.status_code not in (200, 301, 302) or len(text) < 400 or (CHALLENGE.search(text[:3000]) and len(text) < 3000):
                print(abbr, key, 'still a gap', r.status_code, len(text)); continue
            raw = d / f'{key}.body'; txt = d / f'{key}.txt'
            raw.write_bytes(html.encode()); txt.write_text(text)
            meta.update(status='200', kind='html', hashKind='rendered_dom', renderer='crawl4ai-chromium', plainHttpStatus=meta['status'],
                        retrievedAt=datetime.now(timezone.utc).isoformat().replace('+00:00', 'Z'), finalUrl=r.url,
                        rawSha256=hashlib.sha256(raw.read_bytes()).hexdigest(), textSha256=hashlib.sha256(txt.read_bytes()).hexdigest(), textChars=len(text), error='')
            (d / f'{key}.json').write_text(json.dumps(meta, indent=2, ensure_ascii=False) + '\n')
            print(abbr, key, 'rendered', len(text), meta['url'][:90])
            await asyncio.sleep(4)


if __name__ == '__main__':
    asyncio.run(main())
