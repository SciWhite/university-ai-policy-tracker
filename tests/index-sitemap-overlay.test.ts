import assert from 'node:assert/strict';
import test from 'node:test';
import {applyIndexSitemapOverlay} from '../apps/web/lib/index-sitemap-overlay';

test('bounded sitemap cleanup preserves every unrelated entry and date byte for byte', () => {
 const removed='<url><loc>https://eduaipolicy.org/changes/public-release-20260921-001/aalto-university</loc><lastmod>2026-09-21</lastmod></url>';
 const protectedEntry='<url><loc>https://eduaipolicy.org/changes/university-of-hong-kong</loc><lastmod>2026-10-20T13:24:00Z</lastmod></url>';
 const xml='<?xml version="1.0"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'+removed+protectedEntry+'</urlset>';
 assert.equal(applyIndexSitemapOverlay(xml,'changes.xml'),xml.replace(removed,''));
 assert.equal(applyIndexSitemapOverlay(xml,'core.xml'),xml);
 assert.throws(()=>applyIndexSitemapOverlay('<html>upstream error</html>','changes.xml'));
 assert.throws(()=>applyIndexSitemapOverlay(xml,'unknown.xml'));
});
