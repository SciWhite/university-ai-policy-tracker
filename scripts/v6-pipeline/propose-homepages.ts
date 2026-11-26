import { realpathSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { setTimeout } from 'node:timers/promises';
import { parseArgs } from 'node:util';
import type { PublicEntitySummary } from '@uapt/shared';
import { loadSelected } from '../content-release/correct';
import { isOfficialHomepageCandidate } from '../../apps/web/lib/university-homepage-validate';
import { legacyUniversityHomepage } from '../../apps/web/lib/university-homepage';

function propose(summary: PublicEntitySummary) {
  const counts = new Map<string, number>();
  const urls = new Set(summary.officialSources.filter(source => source.official !== false).map(source => source.sourceUrl));
  for (const source of urls) {
    let url: URL;
    try { url = new URL(source); } catch { continue; }
    if (!['https:', 'http:'].includes(url.protocol)) continue;
    const labels = url.hostname.replace(/^www\./, '').split('.');
    const suffixLength = /^(ac|co|com|edu|gov|net|org|sch)$/.test(labels.at(-2) ?? '') && labels.at(-1)?.length === 2 ? 2 : 1;
    if (labels.length <= suffixLength) continue;
    const domain = labels.slice(-suffixLength - 1).join('.');
    counts.set(domain, (counts.get(domain) ?? 0) + 1);
  }
  const ranked = [...counts].sort(([a, x], [b, y]) => y - x || a.localeCompare(b));
  const top = ranked.find(([domain]) => isOfficialHomepageCandidate(`https://${domain}/`, summary));
  return top ? { url: `https://${top[0]}/`, sourceCount: top[1] } : null;
}

const lastRequestByHost = new Map<string, number>();
async function verify(candidateUrl: string) {
  let url = new URL(candidateUrl);
  let status: number | null = null;
  try {
    for (let hop = 0; hop < 10; hop++) {
      // Pace each hop explicitly so redirects are subject to the same limit.
      const host = url.hostname.replace(/\.$/, '');
      const last = lastRequestByHost.get(host);
      if (last !== undefined) {
        const delay = last + 1000 - performance.now();
        if (delay > 0) await setTimeout(Math.ceil(delay));
      }
      lastRequestByHost.set(host, performance.now());
      status = null;
      const response = await fetch(url, {
        method: 'GET', redirect: 'manual', signal: AbortSignal.timeout(15_000),
        headers: { 'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36' },
      });
      status = response.status;
      const location = response.headers.get('location');
      await response.body?.cancel();
      if (!location || ![301, 302, 303, 307, 308].includes(status)) {
        return { finalUrl: url.href, status };
      }
      const next = new URL(location, url);
      if (!['https:', 'http:'].includes(next.protocol) || next.username || next.password) throw Error('Unsafe homepage redirect');
      url = next;
    }
    throw Error('Too many redirects');
  } catch (error) {
    return { finalUrl: url.href, status, error: (error as Error).message };
  }
}

async function main() {
  const { values } = parseArgs({ options: {
    'data-root': { type: 'string', default: 'data' },
    out: { type: 'string' },
    verify: { type: 'boolean', default: false },
  } });
  const source = realpathSync(values['data-root']);
  let out: string | undefined;
  if (values.out) {
    const dir = realpathSync(path.dirname(values.out));
    if (dir.split(path.sep).some(part => ['data', 'tree', 'releases', 'objects'].includes(part)) ||
        dir === source || dir.startsWith(source + path.sep) || !values.out.endsWith('.json')) {
      throw Error('--out must name a new candidate .json file outside release data directories');
    }
    out = path.join(dir, path.basename(values.out));
  }

  const { pages, records } = loadSelected(source);
  const bySlug = new Map<string, PublicEntitySummary>(records.summaries.map((record: PublicEntitySummary) => [record.entity.slug, record]));
  const schools = [];
  for (const slug of pages.slugs as string[]) {
    if (pages.officialHomepages?.[slug] || legacyUniversityHomepage(slug)) continue;
    const summary = bySlug.get(slug);
    const candidate = summary ? propose(summary) : null;
    schools.push({ slug, candidate, ...(values.verify && candidate ? { verification: await verify(candidate.url) } : {}) });
  }
  const json = JSON.stringify({ schemaVersion: 'uapt-v6-homepage-candidates-v1', revision: pages.releaseId, verified: values.verify, schools }, null, 2) + '\n';
  if (out) writeFileSync(out, json, {flag: 'wx'});
  else process.stdout.write(json);
}
main().catch(error => { console.error(error); process.exitCode = 1; });
