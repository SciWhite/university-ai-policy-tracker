import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {V6ArtifactStore, type ShardIndex} from '../apps/web/lib/v6-artifact-store';
import {buildPublicEntitySummaryResponse} from '@uapt/shared';
import type {V6RecordPackage} from '../apps/web/lib/v6-effective-records';
const root='data/public-v6-records';
const index=JSON.parse(readFileSync(root+'/sharded/index.json','utf8'))as ShardIndex;
const store=new V6ArtifactStore(root,index);
const current=store.view<V6RecordPackage>('qs35-40-v6-r4-meta-20261022')!;
const previous=store.view<V6RecordPackage>('qs35-40-v6-r3-20261022')!;
const slugs=['snu','manchester','monash','ubc','columbia','u-tokyo'];
test('six current citations use checked date in every API copy; policy and historical evidence stay frozen',()=>{
 for(const slug of slugs){
  const s=current.summaries.find(s=>s.entity.slug===slug)!;
  const before=previous.summaries.find(s=>s.entity.slug===slug)!;
  assert.deepEqual(s.claims,before.claims);assert.equal(s.lastCheckedAt,before.lastCheckedAt);
  assert.deepEqual(current.heldBySlug[slug],previous.heldBySlug[slug]);
  assert.deepEqual(current.historical[slug],previous.historical[slug]);
  const response=buildPublicEntitySummaryResponse(s);
  for(const citation of [response.suggestedCitation,response.data.suggestedCitation,response.citation.suggestedCitation])assert(citation.includes('Last checked '+s.lastCheckedAt!.slice(0,10)+'.'));
 }
});
test('completed workflow labels leave current requirements without clearing real independent gaps',()=>{
 for(const slug of ['ubc','columbia']){
  const s=current.summaries.find(s=>s.entity.slug===slug)!;const text=s.limitations.join('\n');
  assert(!text.includes('req:publication.sync_pending_authorized_release'));
  assert(!text.includes('req:acceptance.stage_coverage_pending_independent_coordinator_acceptance'));
  assert(text.includes('PARTIAL'));assert(text.includes('private_historical_held_inventory_not_fully_reconciled'));
  if(slug==='columbia')assert(text.includes('gap:visual_qa.independent_browser_visual_acceptance_pending'));
 }
});
test('Monash indexes all cited source versions without changing unknown legacy hash representation',()=>{
 const s=current.summaries.find(s=>s.entity.slug==='monash')!;
 const keys=new Set(s.officialSources.map(s=>s.sourceUrl+':'+s.snapshotHash));
 for(const c of s.claims)for(const e of c.evidence)assert(keys.has(e.sourceUrl+':'+e.sourceSnapshotHash));
 assert.equal(s.officialSources.length,17);
 const legacyClaim=s.claims.find(c=>c.id==='uapt-monash-20260510-cl-006')!;
 const legacy=s.officialSources.find(s=>s.sourceUrl===legacyClaim.evidence[0].sourceUrl&&s.snapshotHash===legacyClaim.evidence[0].sourceSnapshotHash)!;
 const registry=JSON.parse(readFileSync('data/source-hash-provenance.json','utf8'));
 const binding=registry.entries.find((e:any)=>e.sourceUrl===legacy.sourceUrl&&e.snapshotHash===legacy.snapshotHash);
 assert.equal(binding.hashKind,'unknown_legacy');
});
