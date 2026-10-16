import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {getScopedRecordReleaseDiff} from '../apps/web/lib/release-diffs';
import {getAllUniversityToolRecords} from '../apps/web/lib/tool-records';
import {getStagedPublicSummaryBySlug} from '../apps/web/lib/staged-public-data';
import {getSearchIndexRecords,searchIndexRecords} from '../apps/web/lib/entity-search';
process.env.UAPT_V6_PUBLISHED_PAGES='1';process.env.UAPT_DISABLE_INTERNAL_FETCH='1';
test('Cornell follow-up keeps prior evidence immutable, publishes scoped registry rules and reconciles tools/search/citation',async()=>{
 const read=async(p:string)=>JSON.parse(await readFile(p,'utf8'));const previous=await read('data/public-v6-records/revisions/cornell-v6-20261016.json'),p=await read('data/public-v6-records/revisions/cornell-v6-r2-20261016.json'),slug='cornell-university',s=p.summaries.find((s:any)=>s.entity.slug===slug),old=previous.summaries.find((s:any)=>s.entity.slug===slug);
 assert.deepEqual(s.claims.slice(0,old.claims.length),old.claims);assert.equal(s.claims.length,47);assert.equal(s.officialSources.length,17);assert.deepEqual(p.snapshots,previous.snapshots);assert.deepEqual(p.historical,previous.historical);assert.deepEqual(p.toolsBySlug,previous.toolsBySlug);
 for(const other of previous.summaries.filter((s:any)=>s.entity.slug!==slug))assert.deepEqual(p.summaries.find((s:any)=>s.entity.slug===other.entity.slug),other);
 assert.equal(new Set(s.officialSources.map((x:any)=>x.id)).size,s.officialSources.length);
 for(const c of s.claims.slice(old.claims.length))for(const e of c.evidence){assert.equal(e.attribution.sourceUrl,e.sourceUrl);assert.equal(e.attribution.finalUrl,e.sourceUrl);assert(s.officialSources.some((x:any)=>x.id===e.attribution.id&&x.sourceUrl===e.sourceUrl));}
 const scope=s.claims.find((c:any)=>c.id==='clm-cornell-accepting-implementation-scope');for(const word of ['in-person','undergraduate','graduate','Ithaca','Cornell Tech','CVM','Law'])assert(scope.claimText.includes(word));const registry=s.claims.find((c:any)=>c.id==='clm-cornell-central-registry');for(const word of ['despite not being a finding of guilt','student direction or law','no violation','No fixed retention duration'])assert(registry.claimText.includes(word));
 const actual=await getStagedPublicSummaryBySlug(slug);assert.deepEqual(actual,s);assert(actual!.entity.summary!.includes('47'));assert(actual!.suggestedCitation!.includes('October 16, 2026'));
 const tools=await getAllUniversityToolRecords();assert.deepEqual(tools.filter(x=>x.universitySlug===slug),p.toolsBySlug[slug]);assert.equal(tools.filter(x=>x.universitySlug===slug).length,4);
 const results=searchIndexRecords(await getSearchIndexRecords(),'Cornell');const result=results.find(x=>x.entitySlug===slug);assert(result);assert(JSON.stringify(result).includes('47 source-backed'));assert(!JSON.stringify(result).includes('29 source-backed'));
 const diff=await getScopedRecordReleaseDiff(p.revision);assert(diff);assert.equal(diff.entities[0].previousReleaseId,previous.revision);assert.deepEqual(diff.entities[0].rows.filter(x=>x.changeType==='claim_added').map(x=>x.claimId).sort(),s.claims.slice(old.claims.length).map((x:any)=>x.id).sort());assert.equal(diff.entities[0].rows.filter(x=>x.changeType==='claim_removed').length,0);
 assert.equal((await getScopedRecordReleaseDiff(previous.revision))!.entities[0].rows.filter(x=>x.changeType==='claim_added').length,16);
});
