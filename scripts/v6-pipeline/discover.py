#!/usr/bin/env python3
"""S1a discovery: keyword-ranked crawl from each school's current official sources (Crawl4AI, robots.txt respected).

  python3 scripts/v6-pipeline/discover.py --workspace <dir> [abbr ...]   (needs a Crawl4AI venv: UAPT_CRAWL4AI_PYTHON)

Writes discovery/<abbr>.json: every page reached (url, title, status, depth, AI-keyword hits) and keyword PDF links
on the same site. Leads only; capture.py fetches the chosen sources. Vocabulary: v6batch defaults plus
batch.json discovery.keywords / discovery.contentPattern / discovery.multiPartSuffixes.
"""
import asyncio, json, re, sys, urllib.parse
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import v6batch as B  # noqa: E402


async def crawl(ws, batch, school, keywords, content, suffixes):
    from crawl4ai import AsyncWebCrawler, BrowserConfig, CrawlerRunConfig, CacheMode
    from crawl4ai.deep_crawling import BestFirstCrawlingStrategy
    from crawl4ai.deep_crawling.scorers import KeywordRelevanceScorer
    from crawl4ai.deep_crawling.filters import FilterChain, DomainFilter
    abbr, slug = school['abbr'], school['slug']
    cfg_disc = batch.get('discovery', {})
    pub = json.loads((ws / slug / 'public.json').read_text())['data']
    seeds = sorted({s['sourceUrl'] for s in pub['officialSources']})
    pages, pdfs = {}, {}
    browser = BrowserConfig(headless=True, verbose=False, user_agent='Mozilla/5.0 (compatible; UAPT-policy-discovery/1.0; +https://eduaipolicy.org)')
    async with AsyncWebCrawler(config=browser) as crawler:
        for seed in seeds:
            if seed.lower().endswith('.pdf'):
                pdfs.setdefault(seed, {'from': 'official_source', 'text': ''}); continue
            dom = B.site(urllib.parse.urlsplit(seed).hostname or '', suffixes)
            run = CrawlerRunConfig(
                deep_crawl_strategy=BestFirstCrawlingStrategy(max_depth=cfg_disc.get('maxDepth', 1), max_pages=cfg_disc.get('maxPagesPerSeed', 14), include_external=False,
                                                              url_scorer=KeywordRelevanceScorer(keywords=keywords, weight=1.0),
                                                              filter_chain=FilterChain([DomainFilter(allowed_domains=[dom])])),
                cache_mode=CacheMode.BYPASS, check_robots_txt=True, page_timeout=45000, semaphore_count=2, mean_delay=2.0, stream=False, verbose=False)
            try:
                results = await crawler.arun(seed, config=run)
            except Exception as e:  # one failing seed must not stop the school
                pages.setdefault(seed, {'url': seed, 'status': None, 'error': str(e)[:200], 'depth': 0}); continue
            for r in results:
                md = (r.markdown.raw_markdown if hasattr(r.markdown, 'raw_markdown') else str(r.markdown or '')) if r.success else ''
                meta = r.metadata or {}
                pages[r.url] = {'url': r.url, 'status': r.status_code, 'success': r.success, 'depth': meta.get('depth'), 'score': meta.get('score'),
                                'title': (meta.get('title') or '')[:200], 'chars': len(md), 'aiHits': len(content.findall(md)), 'seed': seed,
                                'error': (r.error_message or '')[:200] if not r.success else ''}
                for link in (r.links or {}).get('internal', []) + (r.links or {}).get('external', []):
                    href = link.get('href', ''); text = (link.get('text') or '') + ' ' + href
                    if href.lower().split('?')[0].endswith('.pdf') and content.search(text) and B.site(urllib.parse.urlsplit(href).hostname or '', suffixes) == dom:
                        pdfs.setdefault(href, {'from': r.url, 'text': (link.get('text') or '')[:160]})
    out = {'abbr': abbr, 'slug': slug, 'seeds': seeds, 'pages': sorted(pages.values(), key=lambda p: -(p.get('aiHits') or 0)), 'pdfLinks': pdfs, 'crawledAt': B.now()}
    B.write_json(ws / 'discovery' / f'{abbr}.json', out)
    print(abbr, 'pages', len(pages), 'ok', sum(1 for p in pages.values() if p.get('success')), 'pdfLinks', len(pdfs), flush=True)


async def main():
    ws, args = B.workspace_from_argv()
    batch = B.load(ws)
    disc = batch.get('discovery', {})
    keywords = B.DEFAULT_KEYWORDS + list(disc.get('keywords', []))
    content = re.compile(B.DEFAULT_CONTENT_PATTERN + (('|' + disc['contentPattern']) if disc.get('contentPattern') else ''), re.I)
    suffixes = B.multi_suffixes(batch)
    sem = asyncio.Semaphore(int(disc.get('parallelSchools', 3)))  # each school's own crawl stays polite

    async def one(school):
        async with sem:
            await crawl(ws, batch, school, keywords, content, suffixes)
    chosen = B.schools(batch, args)
    results = await asyncio.gather(*(one(s) for s in chosen), return_exceptions=True)  # one school never cancels the others
    failed = [(s['abbr'], r) for s, r in zip(chosen, results) if isinstance(r, BaseException)]
    for abbr, error in failed:
        print(abbr, 'failed', f'{type(error).__name__}: {error}'[:300], file=sys.stderr, flush=True)
    return 1 if failed else 0


if __name__ == '__main__':
    sys.exit(asyncio.run(main()))
