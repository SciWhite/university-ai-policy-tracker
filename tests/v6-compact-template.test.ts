import {test} from 'node:test';
import assert from 'node:assert/strict';
import {getPolicyV6Data} from '../apps/web/lib/policy-v6';
import {readV6RecordCorrections} from '../apps/web/lib/v6-effective-records';
import {publishedV6Bundle} from '../apps/web/lib/policy-v6-published';
import {getV6StudentActions} from '../apps/web/lib/policy-v6-student-actions';
import {policyV6StatusTone} from '../apps/web/lib/policy-v6-status';
import {readFile} from 'node:fs/promises';
process.env.UAPT_V6_PUBLISHED_PAGES='1';
process.env.NEXT_PUBLIC_UAPT_V6_PUBLISHED_PAGES='1';
process.env.UAPT_DISABLE_INTERNAL_FETCH='1';
test('all published V6 schools bind independent actions and full original evidence; stale projections fail closed',async()=>{
 const pointer=JSON.parse(await readFile('data/public-v6-pages/current.json','utf8'));
 const recordPointer=JSON.parse(await readFile('data/public-v6-records/current.json','utf8'));
 const records=readV6RecordCorrections()!;
 for(const slug of pointer.slugs){
  for(const locale of ['en','zh'] as const){
   const data=await getPolicyV6Data(locale,slug),school=data.schools.find(s=>s.slug===slug)!,guide=data.studentActions;
   const bundle=publishedV6Bundle(slug,locale);
   if(bundle?.publication?.kind==='v6_presentation_integration'){
    assert.equal(guide,undefined,slug+' must not inherit approval for local student advice');
    assert.equal(school.newReviewPending,true);
    assert.equal(bundle.publicationApproved,false);
    assert.equal(bundle.studentActions,undefined);
    assert.equal(bundle.privateRecordContext,undefined);
    assert.equal(bundle.tools.length,0);
    for(const topic of [...school.topics,...school.additionalTopics]){assert.equal(topic.status,'unclear');assert.equal(topic.actions.length,0);assert(topic.claims.every(c=>c.basisObjectType==='source'));}
    continue;
   }
   if(!guide){assert.equal(getV6StudentActions(school),undefined,slug+' has no accepted action binding');continue;}
   assert(guide,slug);assert.equal(guide.slug,slug);assert.equal(guide.experience,'compact_evidence');
   assert(guide.do.length>0);assert(guide.dont.length>0);
   const record=records.summaries.find((s:any)=>s.entity.slug===slug);
   for(const action of [...guide.do,...guide.dont])for(const id of action.claimIds){
    const row=guide.claims[id];assert(row,slug+' '+id);
    assert(row.evidence.length);assert(action.en&&action.zh);
    if(row.basisObjectType!=='published_supplement')assert.equal(row.text,record.claims.find((c:any)=>c.id===id).claimText);
   }
   for(const ids of Object.values(guide.procedures))for(const id of ids)assert(guide.claims[id],id);
   assert.equal(getV6StudentActions({...school,fingerprint:'wrong'}),undefined);
   if(slug!=='imperial-college-london')assert.equal(getV6StudentActions({...school,topics:school.topics.map((t,i)=>i? t:{...t,summary:'changed'})}),undefined);
   // Legacy cohorts retain their accepted action maps; full core-topic maps are optional.
   if(guide.topics)for(const [key,topic] of Object.entries(guide.topics))assert(topic.en&&topic.zh,slug+' '+key);
  }
 }
 assert(pointer.slugs.includes('peking-university'));assert.equal(pointer.v5Slugs.length,0);
});
test('status colours retain meaning independently of school',()=>{
 for(const slug of ['imperial-college-london','ucl','eth-zurich']){
  assert.equal(policyV6StatusTone('restricted',slug),'prohibited');
  assert.equal(policyV6StatusTone('recommended',slug),'allowed');
  assert.equal(policyV6StatusTone('conditionally_allowed',slug),'caution');
  assert.equal(policyV6StatusTone('not_mentioned',slug),'neutral');
 }
});

test('homepage links are central university roots, not policy or department pages',async()=>{
 const homepages=JSON.parse(await readFile('apps/web/lib/university-homepages.json','utf8'));
 const pointer=JSON.parse(await readFile('data/public-v6-pages/current.json','utf8'));
 for(const slug of Object.keys(homepages)){const url=new URL(homepages[slug]);assert.equal(url.protocol,'https:');assert.equal(url.pathname,'/');assert(!/^(ist|uit|genai|its|libguides|scielab|oerc)\./.test(url.hostname));}
});
