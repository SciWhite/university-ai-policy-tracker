import {mkdirSync,writeFileSync}from 'node:fs';import{resolve}from'node:path';import{pathToFileURL}from'node:url';
import{buildEventHistories,buildChangeOverview,eventHash,eventPreview,CHANGE_RULES_VERSION,type ChangeProjectionInput,type ScopedEventSource}from'../../apps/web/lib/change-events';
import type{PublicEntitySummary}from'@uapt/shared';
export const summary=(text='new')=>({entity:{slug:'school'},claims:[{id:'c1',claimType:'teaching',claimText:text,evidence:[{sourceUrl:'https://school.example/rule',evidenceSnippet:text}]},{id:'c2',claimType:'research',claimText:'same',evidence:[]}],officialSources:[]})as unknown as PublicEntitySummary;
export function fixtureInput():ChangeProjectionInput{
 const current=summary();return{schemaVersion:'uapt-change-history-input-v2',revision:'event-r1',basisSha256:'a'.repeat(64),rulesVersion:CHANGE_RULES_VERSION,schools:{school:{currentRevision:'event-r1',currentRecordSha256:eventHash(current),currentClaimIds:['c1','c2'],gaps:[],sources:[{kind:'scoped',slug:'school',revision:'event-r1',previousRevision:'event-r0',publishedAt:'2026-10-23T00:00:00Z',current,before:summary('old'),held:[],changes:{addedClaimIds:[],updatedClaimIds:['c1'],heldClaimIds:[]},gaps:[],metadataChanged:false} satisfies ScopedEventSource]}}};
}
export function createChangeFixture(root:string,basisSha256='b'.repeat(64)){
 mkdirSync(root,{recursive:true});const write=(file:string,value:unknown)=>{const raw=JSON.stringify(value);writeFileSync(resolve(root,file),raw);return{file,sha256:eventHash(value),bytes:Buffer.byteLength(raw)}};
 const input=fixtureInput(),histories=buildEventHistories(input),history=histories.school;
 const index=history.events.map(e=>({...eventPreview(e),slug:'school'}));
 const manifest={schemaVersion:'uapt-public-change-history-v2',revision:input.revision,basisSha256:input.basisSha256,rulesVersion:CHANGE_RULES_VERSION,entries:{},releases:{},projectionInput:write('input.json',input),eventHistories:{school:write('school.json',history)},eventIndex:write('index.json',index)};
 const ref=write('manifest.json',manifest);
 const overviews={schemaVersion:'uapt-v6-change-overviews-v1',revision:input.revision,basisSha256:input.basisSha256,rulesVersion:CHANGE_RULES_VERSION,projectionSha256:ref.sha256,schools:{school:buildChangeOverview(history,ref.sha256)}};
 const overviewRef=write('overviews.json',overviews);
 const bound=(r:{file:string;sha256:string})=>({path:r.file,sha256:r.sha256,basisSha256});
 const eventSurfaces=Object.fromEntries(['history','universityChanges','latestDiff','changesIndex','recentChanges','rss'].map(surface=>[surface,bound(write(surface+'-events.json',{schemaVersion:'uapt-change-event-surface-v1',surface,checkedSlugs:['school'],projectionSha256:ref.sha256,rulesVersion:CHANGE_RULES_VERSION,eventIds:history.events.map(e=>e.id),...(['recentChanges','rss'].includes(surface)?{window:{start:'2026-01-01T00:00:00Z',end:'2026-12-31T23:59:59Z',limit:10}}:{})}))]));
 const receipt={schemaVersion:'uapt-policy-surface-receipt-v1',surface:'changes',basisSha256,checkedAt:new Date().toISOString(),checkedSlugs:['school'],checks:Object.fromEntries(['universityChanges','history','latestDiff','changesIndex','recentChanges','rss'].map(c=>[c,true])),projectionArtifact:bound(ref),overviewArtifact:bound(overviewRef),inputBasisSha256:input.basisSha256,projectionRevision:input.revision,rulesVersion:CHANGE_RULES_VERSION,eventSurfaces};
 write('changes.json',receipt);write('data.json',[summary()]);
 write('scope.json',{schemaVersion:'uapt-policy-sync-scope-v1',universities:[{slug:'school',publicClaimIds:['c1','c2']}],changedUrls:['https://eduaipolicy.org/universities/school'],changedRevisionsBySlug:{school:['event-r1']}});
 return{input,histories,ref,overviews,receipt,root};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)createChangeFixture(process.argv[2],process.argv[3]);
