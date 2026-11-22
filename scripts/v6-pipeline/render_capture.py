#!/usr/bin/env python3
"""S2b rendered capture for pages a normal browser receives but plain HTTP is refused (HTTP 403 to curl). Crawl4AI
headless Chromium with robots.txt respected; no challenge solving. A page that shows a challenge or no content stays a
gap. The receipt says hashKind=rendered_dom: the hash is of the rendered HTML, not of the server's raw bytes.

  python3 scripts/v6-pipeline/render_capture.py --workspace <dir> abbr:key [abbr:key ...]   (UAPT_CRAWL4AI_PYTHON)

Every attempt that stays a gap is written into the receipt as renderAttempt {at, statusCode, textChars, outcome}, so
run.py never retries the same row; one failing page never stops the others (exit 1 only on unexpected errors).
"""
import asyncio, hashlib, json, os, re, sys
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
    errors = 0
    async with AsyncWebCrawler(config=BrowserConfig(headless=True, verbose=False)) as crawler:
        for item in items:
            abbr, key = item.split(':')
            d = ws / 'captures' / abbr; path = d / f'{key}.json'
            try:
                meta = json.loads(path.read_text())
                try:
                    r = await crawler.arun(meta['url'], config=CrawlerRunConfig(cache_mode=CacheMode.BYPASS, check_robots_txt=True, page_timeout=60000, delay_before_return_html=4.0))
                except Exception as e:  # noqa: BLE001 — a renderer crash on one page is that page's gap
                    meta['renderAttempt'] = {'at': B.now(), 'statusCode': None, 'textChars': 0, 'outcome': 'renderer_error', 'detail': f'{type(e).__name__}: {e}'[:300]}
                    write(path, meta); print(abbr, key, 'renderer error', flush=True); continue
                html = (r.html or '') if r.success else ''
                text = html_lines(html.encode()) if html else ''
                if not r.success or r.status_code not in (200, 301, 302) or len(text) < 400 or (CHALLENGE.search(text[:3000]) and len(text) < 3000):
                    outcome = 'challenge' if text and CHALLENGE.search(text[:3000]) else 'no_content'
                    meta['renderAttempt'] = {'at': B.now(), 'statusCode': r.status_code, 'textChars': len(text), 'outcome': outcome}
                    write(path, meta); print(abbr, key, 'still a gap', r.status_code, len(text), flush=True); continue
                raw = d / f'{key}.body'; txt = d / f'{key}.txt'
                raw.write_bytes(html.encode()); txt.write_text(text)
                meta.pop('renderAttempt', None)
                meta.update(status='200', kind='html', hashKind='rendered_dom', renderer='crawl4ai-chromium', plainHttpStatus=meta['status'],
                            retrievedAt=datetime.now(timezone.utc).isoformat().replace('+00:00', 'Z'), finalUrl=r.url,
                            rawSha256=hashlib.sha256(raw.read_bytes()).hexdigest(), textSha256=hashlib.sha256(txt.read_bytes()).hexdigest(), textChars=len(text), error='')
                write(path, meta)
                print(abbr, key, 'rendered', len(text), meta['url'][:90], flush=True)
            except Exception as e:  # noqa: BLE001
                errors += 1; print(abbr, key, 'error', f'{type(e).__name__}: {e}'[:300], file=sys.stderr, flush=True)
            finally:
                await asyncio.sleep(4)  # same-host politeness on every path, gaps included
    return 1 if errors else 0


def write(path, meta):
    tmp = path.with_suffix('.json.tmp')
    tmp.write_text(json.dumps(meta, indent=2, ensure_ascii=False) + '\n')
    os.replace(tmp, path)

if __name__ == '__main__':
    sys.exit(asyncio.run(main()))
