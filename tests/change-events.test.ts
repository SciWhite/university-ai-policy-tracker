import test from 'node:test';import assert from'node:assert/strict';import{mkdtempSync,readFileSync,writeFileSync,rmSync}from'node:fs';import{tmpdir}from'node:os';import{join}from'node:path';
import{buildEventHistories,buildChangeOverview,eventHash,overviewWindow,type ScopedEventSource}from'../apps/web/lib/change-events';
import{ChangeEventStore}from'../apps/web/lib/public-change-history';import{exportV6Revision}from'../scripts/export-v6-shards';import{readV6ChangeOverview}from'../apps/web/lib/v6-change-overviews';
import{resetV6ArtifactCache,v6ArtifactStats}from'../apps/web/lib/v6-artifact-store';import{validateChangeEventReceipt}from'../scripts/validate-change-event-projection';
import{fixtureInput,summary,createChangeFixture}from'./fixtures/change-event-fixture';
const temporary=(fn:(root:string)=>void)=>{const root=mkdtempSync(join(tmpdir(),'uapt-events-'));try{fn(root)}finally{rmSync(root,{recursive:true,force:true})}};

test('two revisions keep their own dates, real Claim text and stable IDs even when text is reverted',()=>{
 const input=fixtureInput(),first=input.schools.school.sources[0] as ScopedEventSource;
 input.schools.school.sources.push({...first,revision:'event-r2',previousRevision:'event-r1',publishedAt:'2026-10-24T00:00:00Z',before:first.current,current:first.before!});
 const history=buildEventHistories(input).school;
 assert.deepEqual(history.events.map(e=>e.id),['school:event-r2','school:event-r1']);
 for(const e of history.events){assert.equal(e.items[0].comparison,'exact_claim_id');assert.equal(e.counts.affected,1);assert.equal(e.items[0].category,'tracker_correction');}
 assert.equal(overviewWindow(buildChangeOverview(history,'b'.repeat(64)),'2026-10-23','2026-10-23').count,1);
});
test('a shared release without school changes emits no event; duplicate sources deduplicate and conflicting events fail',()=>{
 const input=fixtureInput(),source=input.schools.school.sources[0] as ScopedEventSource;
 input.schools.school.sources.push(structuredClone(source));assert.equal(buildEventHistories(input).school.events.length,1);
 input.schools.school.sources[1]={...source,current:summary('conflicting')};assert.throws(()=>buildEventHistories(input),/Conflicting event/);
 input.schools.school.sources=[{...source,before:source.current,changes:{addedClaimIds:[],updatedClaimIds:[],heldClaimIds:[]}}];assert.equal(buildEventHistories(input).school.events.length,0);
});
test('missing old records do not become additions; held evidence remains distinct from a policy repeal',()=>{
 const input=fixtureInput(),source=input.schools.school.sources[0] as ScopedEventSource;
 source.before=undefined;source.changes.addedClaimIds=['c1','c1'];let h=buildEventHistories(input).school;
 assert.equal(h.events[0].counts.added,0);assert(h.events[0].items.every(i=>!i.comparison));assert(h.coverage.gaps.includes('previous_record_unavailable'));
 source.before=summary('old');source.changes.heldClaimIds=['c1','c1'];source.held=source.before.claims;source.current={...source.current,claims:source.current.claims.filter(c=>c.id!=='c1')};
 h=buildEventHistories(input).school;assert.equal(h.events[0].counts.held,1);assert.equal(h.events[0].items.find(i=>i.claimId==='c1')?.category,'held');
});
test('overview is a bounded independent shard, mismatched policy or projection cannot be read',()=>temporary(root=>{
 const f=createChangeFixture(root),family=join(root,'family');exportV6Revision(family,'public-v6-change-overviews','event-r1',Buffer.from(JSON.stringify(f.overviews)));
 const expected={recordSha256:eventHash(summary()),projectionSha256:f.ref.sha256,basisSha256:f.input.basisSha256};resetV6ArtifactCache();
 assert(readV6ChangeOverview('event-r1','school',expected,family));assert(v6ArtifactStats().largestFile<10240);
 assert.throws(()=>readV6ChangeOverview('event-r1','school',{...expected,recordSha256:'0'.repeat(64)},family),/Stale/);
 assert.equal(readV6ChangeOverview('missing','school',expected,family),undefined);
 const big=structuredClone(f.histories.school);big.coverage.gaps=['x'.repeat(11000)];assert.throws(()=>buildChangeOverview(big,'b'.repeat(64)),/exceeds/);
 assert.throws(()=>overviewWindow(f.overviews.schools.school,'2026-11-02','2026-10-01'),/interval/);
}));
test('v2 store and contract validate actual artifacts; corrupt files, stale index and missing events fail',()=>temporary(root=>{
 const f=createChangeFixture(root),verify=()=>validateChangeEventReceipt(join(root,'changes.json'),join(root,'scope.json'),join(root,'data.json'),'b'.repeat(64));
 assert.equal(verify().events,1);
 const store=new ChangeEventStore(root,{path:'manifest.json',sha256:f.ref.sha256});assert.throws(()=>store.history('other-revision','school'),/revision mismatch/);
 writeFileSync(join(root,'rss-events.json'),'{}');assert.throws(verify,/hash mismatch/);
}));
test('changed scope, unknown rules, duplicate index and out-of-window RSS are rejected',()=>{
 for(const scenario of ['scope','rules','index','window','data'])temporary(root=>{
  const f=createChangeFixture(root),receipt=f.receipt as any;
  if(scenario==='data')writeFileSync(join(root,'data.json'),JSON.stringify([summary('new unbound policy text')]));
  if(scenario==='scope'){const s=JSON.parse(readFileSync(join(root,'scope.json'),'utf8'));s.changedRevisionsBySlug.school=[];writeFileSync(join(root,'scope.json'),JSON.stringify(s));}
  if(scenario==='rules')receipt.rulesVersion='invented';
  if(scenario==='index'){const m=JSON.parse(readFileSync(join(root,'manifest.json'),'utf8'));const index=JSON.parse(readFileSync(join(root,'index.json'),'utf8'));index.push(index[0]);writeFileSync(join(root,'index.json'),JSON.stringify(index));m.eventIndex.sha256=eventHash(index);m.eventIndex.bytes=Buffer.byteLength(JSON.stringify(index));writeFileSync(join(root,'manifest.json'),JSON.stringify(m));receipt.projectionArtifact.sha256=eventHash(m);}
  if(scenario==='window'){const s=JSON.parse(readFileSync(join(root,'rss-events.json'),'utf8'));s.window.end='2026-09-01T00:00:00Z';writeFileSync(join(root,'rss-events.json'),JSON.stringify(s));receipt.eventSurfaces.rss.sha256=eventHash(s);}
  writeFileSync(join(root,'changes.json'),JSON.stringify(receipt));assert.throws(()=>validateChangeEventReceipt(join(root,'changes.json'),join(root,'scope.json'),join(root,'data.json'),'b'.repeat(64)));
 });
});


test('V6 theme bindings preserve multiple topics without inflating Claim counts and windows use UTC',()=>{
 const input=fixtureInput(),source=input.schools.school.sources[0] as ScopedEventSource;
 input.schools.school.themeOrder=['coursework','exams'];source.claimThemes={c1:['coursework','exams']};source.publishedAt='2026-10-23T00:30:00+08:00';
 const history=buildEventHistories(input).school,overview=buildChangeOverview(history,'b'.repeat(64));
 assert.equal(history.events[0].counts.affected,1);assert.deepEqual(history.events[0].items[0].themes,['coursework','exams']);
 assert.deepEqual(overview.themeOrder,['coursework','exams']);assert.equal(overviewWindow(overview,'2026-10-22','2026-10-22').count,1);
 assert.throws(()=>overviewWindow(overview,'2026-02-30','2026-03-01'),/interval/);
});

// Real regressions: metadata is retained but excluded by default; legacy objects are not invented Claims.
test('metadata-only revisions are secondary and leave default preview slots to substantive records',()=>{
 const input=fixtureInput(),source=input.schools.school.sources[0] as ScopedEventSource;
 input.schools.school.sources=[{...source,before:source.current,metadataChanged:true,changes:{addedClaimIds:[],updatedClaimIds:[],heldClaimIds:[]}}];
 const event=buildEventHistories(input).school.events[0];
 assert.equal(event.items[0].category,'record_maintenance');assert.equal(event.counts.affected,0);
});
test('legacy tool records without Claim IDs count separately and retain distinct revisions',()=>{
 const input=fixtureInput();
 const row={entitySlug:'school',releaseId:'event-r1',changeType:'claim_modified',matchMethod:'claim_id',newClaim:{claimType:'ai_tool_treatment',claimText:'Recorded tool access.',evidence:[{sourceUrl:'https://school.example/tool'}]}};
 const record={slug:'school',releaseId:'event-r1',lastChangedAt:'2026-10-23T00:00:00Z',publicationKind:'scoped_record_correction',diffRows:[row,row]} as any;
 input.schools.school.sources=[{kind:'record_repair',record},{kind:'record_repair',record:{...record,releaseId:'event-r2',diffRows:[{...row,releaseId:'event-r2'}]}}];
 const history=buildEventHistories(input).school;
 assert.equal(history.events.length,2);
 for(const event of history.events){assert.equal(event.items.length,1);assert.equal(event.items[0].claimId,undefined);assert.equal(event.items[0].recordKind,'tool');assert.equal(event.counts.affected,1);assert.equal(event.counts.toolRecords,1);assert.equal(event.counts.modified,0);assert.equal(event.items[0].comparison,undefined);}
});

test('unnumbered privacy and integrity objects count once without pretending to be Claims',()=>{
 const input=fixtureInput();
 const row={entitySlug:'school',releaseId:'event-r1',changeType:'claim_modified',matchMethod:'claim_id',newClaim:{claimType:'privacy',claimText:'Historical privacy scope.',evidence:[{sourceUrl:'https://school.example/privacy'}]}};
 input.schools.school.sources=[{kind:'record_repair',record:{slug:'school',releaseId:'event-r1',lastChangedAt:'2026-10-23T00:00:00Z',publicationKind:'scoped_record_correction',diffRows:[row,row]} as any}];
 const event=buildEventHistories(input).school.events[0];assert.equal(event.items.length,1);assert.equal(event.items[0].claimId,undefined);assert.equal(event.counts.affected,1);assert.equal(event.counts.unnumberedRecords,1);assert.equal(event.counts.modified,0);
});
