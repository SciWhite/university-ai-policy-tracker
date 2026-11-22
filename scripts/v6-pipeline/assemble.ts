// S6 assemble the content release for a batch (docs/v6-pipeline.md). mode "add" publishes new V6 schools; mode
// "update" replaces the V6 presentation of listed V6 schools (page-only, public claims unchanged). Refuses unless
// the locale gate passed and the accepted review receipts match the frozen packets; runs the Chinese coverage gate
// on the assembled pages before building anything. Builds <outDir>/runtime with the parent linked in.
//   tsx --tsconfig apps/web/tsconfig.json scripts/v6-pipeline/assemble.ts --workspace <dir>
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync,readFileSync,writeFileSync,copyFileSync,linkSync,existsSync } from 'node:fs';
import path from 'node:path';
import { publicHistoryBasisV2 } from '../../apps/web/lib/public-history-basis';
import { ChangeEventStore } from '../../apps/web/lib/public-change-history';
import { buildChangeOverview,buildEventHistories,eventPreview } from '../../apps/web/lib/change-events';
import { getEntityChangeHistory } from '../../apps/web/lib/change-records';
import { getScopedRecordReleaseDiff } from '../../apps/web/lib/release-diffs';
import { getV6PageInput } from '../../apps/web/lib/policy-v6-page-input';
import { acceptPresentationEvidence } from '../../apps/web/lib/policy-v6-presentation-mapping';
import { toolPresentationHash } from '../../apps/web/lib/policy-v6-tool-presentation';
import { v6CompletenessContentHash } from '../../apps/web/lib/policy-v6-completeness';
import { v6FrozenHistory } from '../../apps/web/lib/v6-history-cache';
import { acceptV6Release } from '../../scripts/lib/v6-release-contract';
import { validateChangePackage } from '../../scripts/lib/change-package';
import { retainChangeRevisions } from '../../scripts/lib/retain-change-revisions';
import { exportV6Revision } from '../../scripts/export-v6-shards';
import { exportMcpCatalog } from '../../scripts/export-mcp-catalog';
import { loadSelected,MergedTree } from '../../scripts/content-release/correct';
import { selectTree } from '../../scripts/content-release/lib';
import { buildContentRelease } from '../../scripts/content-release/build';
import { loadBatch, requireGatePassed, workspaceFromArgv } from './batch';
import { pagesZhProblems } from './locale-gate';

const {ws:P}=workspaceFromArgv();
const BATCH=loadBatch(P);
const PARENT=BATCH.parentRelease;
if(!BATCH.contentId)throw Error('batch.json needs contentId');
const CONTENT_ID=BATCH.contentId;
const UPDATE=BATCH.mode==='update';
const parentRoot=PARENT+'/tree', data=parentRoot+'/data';
const reviewRoot=P+'/'+(BATCH.reviewDir??'review'),out=P+'/'+(BATCH.outDir??'release-candidate');
const overlay=out+'/overlay', nextData=overlay+'/data';
const raw=(v:unknown)=>Buffer.from(JSON.stringify(v)+'\n');
const sha=(bytes:Buffer|string)=>createHash('sha256').update(bytes).digest('hex');
const jsha=(v:unknown)=>sha(JSON.stringify(v));
const read=(p:string)=>JSON.parse(readFileSync(p,'utf8'));
const write=(p:string,d:unknown)=>writeFileSync(p,raw(d),{flag:'wx'});
const mkdir=(p:string)=>mkdirSync(p,{recursive:true,mode:0o700});

function shard(family:string,revision:string,value:any,pointerKey:string,extras={}) {
  const dest=nextData+'/'+family;
  mkdir(dest+'/sharded');
  copyFileSync(data+'/'+family+'/sharded/index.json',dest+'/sharded/index.json');
  const filename='revisions/'+revision+'.json';
  const manifest=exportV6Revision(dest,family,revision,raw(value));
  const prior=read(data+'/'+family+'/revisions.json');
  const ref={path:filename,sha256:manifest.sourceSha256};
  write(dest+'/revisions.json',{...prior,[revision]:ref});
  write(dest+'/current.json',{...ref,[pointerKey]:revision,...extras});
}

async function main() {
  requireGatePassed(P,'locale');
  // English-only V6 presentations need the capability on codex/v6-english-first-20261117 (ea719b70), not merged.
  if((BATCH.englishOnlySlugs??[]).length)throw Error('englishOnlySlugs needs the English-only V6 capability, which is not in main');
  if(!BATCH.changeSummary?.en||!BATCH.changeSummary?.zh)throw Error('batch.json needs changeSummary.en and changeSummary.zh');
  process.env.NEXT_PUBLIC_SITE_URL='https://eduaipolicy.org';
  const manifest=read(PARENT+'/manifest.json');
  const expected=read(reviewRoot+'/manifest.json');
  const approval=read(reviewRoot+'/independent-review.json');
  assert.equal(expected.parentContentId,manifest.contentId);
  assert.equal(approval.decision,'accepted');
  assert.ok(approval.reviewer&&Number.isFinite(Date.parse(approval.reviewedAt)));
  assert.deepEqual(approval.packetSha256,expected.schoolPacketSha256);
  const slugs=Object.keys(expected.schoolPacketSha256);
  assert.deepEqual(Object.keys(approval.receipts).sort(),slugs.slice().sort());
  assert.deepEqual(slugs.slice().sort(),BATCH.schools.map(x=>x.slug).sort(),'review manifest must cover exactly the batch schools');
  selectTree(manifest.contentId,parentRoot,manifest);
  const parent=loadSelected(data);
  const pages=structuredClone(parent.pages),records=structuredClone(parent.records),history=structuredClone(parent.history);
  const revision=expected.revision,at=new Date().toISOString();
  const changeSummary=BATCH.changeSummary;
  Object.assign(pages,{releaseId:revision,publishedAt:at,parentRevisionId:parent.revision,publicationKind:'v6_presentation_integration',englishOnlySlugs:expected.englishOnlySlugs,changeSummary});
  Object.assign(records,{revision,publishedAt:at,parentRevisionId:parent.revision,changeSummary});
  history.basisRevision=revision;
  const oldChanges=new ChangeEventStore(data+'/public-change-history',read(data+'/public-change-history/current.json'));
  const projection=structuredClone(oldChanges.input());
  projection.revision=revision;
  for(const slug of slugs) {
    const packetFile=reviewRoot+'/'+slug+'.json';
    assert.equal(sha(readFileSync(packetFile)),expected.schoolPacketSha256[slug]);
    const packet=read(packetFile), receipt=approval.receipts[slug];
    assert.equal(receipt.reviewer,approval.reviewer);
    assert.equal(receipt.reviewedAt,approval.reviewedAt);
    assert.equal(pages.slugs.includes(slug),UPDATE,slug+(UPDATE?': update mode needs a V6 school of the parent':': add mode needs a school that is not V6 yet'));
    const accepted=acceptPresentationEvidence(packet.candidate,revision,receipt);
    assert.deepEqual(accepted.claims,packet.canonical.claims);
    assert.deepEqual(accepted.sources,packet.canonical.officialSources);
    const englishOnly=expected.englishOnlySlugs.includes(slug);
    assert.equal((accepted as {presentationLocale?:string}).presentationLocale??null,englishOnly?'en':null);
    const keyed={
      schemaVersion:'uapt-v6-tool-presentation-acceptance-v1' as const,
      canonicalToolsSha256:jsha(packet.tools),displaySha256:toolPresentationHash(accepted),
      reviewer:approval.reviewer,reviewedAt:approval.reviewedAt,scope:'presentation_only' as const,
    };
    accepted.toolPresentationAcceptance=keyed;
    let entry:any, previousRevision:string;
    if(!UPDATE){
    pages.slugs.push(slug);
    records.summaries.push(packet.canonical);
    const excluded=accepted.claimDispositions!.filter(row=>row.mode!=='scoped_reference').map(row=>row.claimId);
    if (excluded.length) (records.mcpPresentationExclusions??={})[slug]=excluded;
    records.toolsBySlug[slug]=packet.tools;
    records.heldBySlug[slug]=[];
    records.historical[slug]={baseline:packet.canonical,snapshot:null,heldClaims:[]};
    records.aliasesBySlug[slug]=packet.canonical.entity.aliases;
    records.changesBySlug[slug]={addedClaimIds:[],updatedClaimIds:[],heldClaimIds:[]};
    // The pre-V6 record is the exact existing dataset summary, retained as a baseline.
    records.recordRevisions[slug]={universityRevisionId:revision,datasetReleaseId:records.datasetReleaseId,recordSha256:jsha(packet.canonical),publishedAt:at,baselineRevisionId:records.datasetReleaseId};
    const old=await getEntityChangeHistory(slug);
    history.records[slug]=old?.releaseRecords??[];
    entry=projection.schools[slug]??= {
      currentClaimIds:[],
      sources:(old?.releaseRecords??[]).map(record=>({kind:'legacy',record})),
      gaps:old?.releaseRecords?.length?[]:['No separate pre-V6 tracker event history was available for this school.'],
    };
    assert.ok(!entry.currentRecordSha256,slug);
    entry.currentRecordSha256=jsha(packet.canonical);
    previousRevision=records.datasetReleaseId;
    } else {
    const idx=records.summaries.findIndex((x:any)=>x.entity.slug===slug);
    assert.deepEqual(records.summaries[idx],packet.canonical);
    const excludedU=accepted.claimDispositions!.filter(row=>row.mode!=='scoped_reference').map(row=>row.claimId);
    if (excludedU.length) (records.mcpPresentationExclusions??={})[slug]=excludedU;
    assert.deepEqual(records.toolsBySlug[slug],packet.tools);
    const prior=records.recordRevisions[slug];
    assert.equal(prior.recordSha256,jsha(packet.canonical));
    records.recordRevisions[slug]={...prior,universityRevisionId:revision,publishedAt:at,previousRevisionId:prior.universityRevisionId};
    // The record moves to this revision with no claim change (page-only update): this revision's changes are empty;
    // the parent's entry described an earlier revision and must not be re-announced in this event.
    records.changesBySlug[slug]={addedClaimIds:[],updatedClaimIds:[],heldClaimIds:[]};
    entry=projection.schools[slug];
    assert.ok(entry&&entry.currentRecordSha256===jsha(packet.canonical),slug);
    previousRevision=entry.currentRevision;
    }
    entry.currentRevision=revision;
    entry.currentClaimIds=packet.canonical.claims.map((c:any)=>c.id);
    entry.themeOrder=[...accepted.school.topics,...accepted.school.additionalTopics].map(t=>t.key);
    entry.sources.unshift({
      kind:'scoped',slug,revision,previousRevision,publishedAt:at,
      current:packet.canonical,before:packet.canonical,held:[],changes:records.changesBySlug[slug],gaps:[],
      metadataChanged:true,pageUpdate:BATCH.pageUpdate??(UPDATE?'Updated the English and Simplified Chinese V6 policy guide with newer official sources.':englishOnly?'Added the English V6 policy guide.':'Added the English and Simplified Chinese V6 policy guides.'),
    });
    for(const [locale,part] of Object.entries(pages.locales) as [string,any][]) {
      const view=structuredClone(accepted);
      if (locale==='zh'&&!englishOnly) {
        for(const topic of [...view.school.topics,...view.school.additionalTopics]){
          topic.title=view.topicLabels[topic.key].zh;
          topic.statusLabel=view.topicLabels[topic.key+':status'].zh;
          topic.summary=view.topicSummaries![topic.key].zh;
          topic.summaryLanguage='zh';
          topic.scope=view.topicScopes![topic.key].zh;
        }
      }
      view.completenessReview={schemaVersion:'uapt-v6-completeness-review-v1',
        contentSha256:v6CompletenessContentHash({school:view.school,bundle:view}),
        reviewer:approval.reviewer,reviewedAt:approval.reviewedAt,scope:'presentation_only',policySemanticsApproved:false};
      if(UPDATE){
        const si=part.schools.findIndex((x:any)=>x.slug===slug);
        assert.ok(si>=0&&part.views[slug],slug+' '+locale);
        part.schools[si]=view.school;
        part.views[slug]=view;
      } else {
        part.schools.push(view.school);
        part.views[slug]=view;
        part.entities[slug]=packet.canonical.entity;
      }
    }
  }

  // G3 on what will be published: every /zh/ row of every batch school has Chinese (englishOnlySlugs exempt).
  const zhProblems=pagesZhProblems(pages,slugs);
  if(Object.keys(zhProblems).length)throw Error('Chinese coverage gate failed; nothing built:\n'+JSON.stringify(zhProblems,null,1).slice(0,4000));
  const coverage=acceptV6Release(pages,records);
  mkdirSync(out,{mode:0o700});
  assert.equal(coverage.slugs.length,parent.pages.slugs.length+(UPDATE?0:slugs.length));
  mkdir(nextData);
  shard('public-v6-pages',revision,pages,'releaseId',{slugs:pages.slugs,v5Slugs:pages.v5Slugs??[]});
  shard('public-v6-records',revision,records,'revision');
  shard('public-v6-history',revision,history,'basisRevision');

  // Source metadata for every V6 school (parent file plus this batch's schools), or the parent's unchanged.
  if(BATCH.sourceMetadataFile)copyFileSync(path.resolve(P,BATCH.sourceMetadataFile),nextData+'/public-v6-source-metadata.json');
  const merged=MergedTree.create(parentRoot,out+'/merged',overlay);
  projection.basisSha256=await publicHistoryBasisV2(merged.root,projection.rulesVersion);
  const eventHistories=buildEventHistories(projection);
  for(const slug of slugs){
    const event=eventHistories[slug].events.find(e=>e.revision===revision);
    assert.ok(event&&event.items.some(i=>i.category==='page_update'),slug+': no page_update event');
    assert.equal(event.counts.affected,0);
  }
  const ch=nextData+'/public-change-history';
  mkdir(ch+'/objects');
  const put=(v:unknown)=>{
    const bytes=raw(v),sha256=sha(bytes),file='objects/'+sha256+'.json';
    if(!existsSync(ch+'/'+file)) writeFileSync(ch+'/'+file,bytes);
    return {file,sha256,bytes:bytes.length};
  };
  const oldManifest=oldChanges.manifest;
  for(const ref of [...Object.values(oldManifest.entries),...Object.values(oldManifest.releases)]){
    const bytes=readFileSync(data+'/public-change-history/'+ref.file);
    assert.equal(sha(bytes),ref.sha256);
    if(!existsSync(ch+'/'+ref.file))writeFileSync(ch+'/'+ref.file,bytes);
  }
  const eventIndex=Object.values(eventHistories).flatMap(h=>h.events.map(e=>({...eventPreview(e),slug:h.slug})))
    .sort((a,b)=>(Date.parse(b.publishedAt??'')||0)-(Date.parse(a.publishedAt??'')||0)||a.id.localeCompare(b.id));
  const changeManifest={
    schemaVersion:'uapt-public-change-history-v2',revision,basisSha256:projection.basisSha256,rulesVersion:projection.rulesVersion,
    projectionInput:put(projection),entries:oldManifest.entries,releases:oldManifest.releases,
    eventHistories:Object.fromEntries(Object.entries(eventHistories).map(([slug,content])=>[slug,put(content)])),eventIndex:put(eventIndex),
  };
  const bytes=raw(changeManifest);
  const changeRef={path:'manifest-'+sha(bytes)+'.json',sha256:sha(bytes)};
  writeFileSync(ch+'/'+changeRef.path,bytes);
  const overviews={schemaVersion:'uapt-v6-change-overviews-v1' as const,revision,basisSha256:projection.basisSha256,rulesVersion:projection.rulesVersion,projectionSha256:changeRef.sha256,
    schools:Object.fromEntries(Object.entries(eventHistories).filter(([,h])=>h.currentRecordSha256).map(([s,h])=>[s,buildChangeOverview(h,changeRef.sha256)]))};
  assert.deepEqual(Object.keys(overviews.schools).sort(),pages.slugs.slice().sort());
  const ov=nextData+'/public-v6-change-overviews';
  mkdir(ov+'/sharded'); mkdir(ov+'/revisions');
  copyFileSync(data+'/public-v6-change-overviews/sharded/index.json',ov+'/sharded/index.json');
  const overviewBytes=raw(overviews);
  exportV6Revision(ov,'public-v6-change-overviews',revision,overviewBytes);
  const overviewRef={revision,path:'revisions/'+revision+'.json',sha256:sha(overviewBytes)};
  writeFileSync(ov+'/'+overviewRef.path,overviewBytes);
  write(ov+'/current.json',overviewRef);
  validateChangePackage(ch,changeRef,overviews);
  retainChangeRevisions(data,nextData);
  write(ch+'/current.json',changeRef);

  merged.apply(overlay);
  merged.select();
  for(const slug of slugs) {
    for(const locale of Object.keys(pages.locales))assert.equal(getV6PageInput(slug,locale as any).kind,'bundle');
    assert.deepEqual(v6FrozenHistory(slug),history.records[slug]);
  }
  const diff=await getScopedRecordReleaseDiff(revision);
  assert.deepEqual(diff?.entities.map(e=>e.entitySlug).sort(),slugs.slice().sort());
  assert.ok(diff?.entities.every(e=>!e.rows.length));
  const exportResult=await exportMcpCatalog({root:merged.root,output:out+'/catalog.json'});
  for(const slug of slugs){
    const record=records.summaries.find((r:any)=>r.entity.slug===slug);
    const row=exportResult.coverage.find(x=>x.slug===slug);
    assert.ok(row&&row.revision===revision);
    assert.deepEqual([...row.claimIds].sort(),record.claims.map((c:any)=>c.id).sort());
  }
  const runtime=out+'/runtime';
  const parentDir=runtime+'/releases/'+manifest.contentId;
  mkdir(parentDir);
  copyFileSync(PARENT+'/manifest.json',parentDir+'/manifest.json');
  for (const [rel] of manifest.files) {
    const to=parentDir+'/tree/'+rel;
    mkdir(path.dirname(to));
    linkSync(parentRoot+'/'+rel,to);
  }
  await buildContentRelease({contentRoot:runtime,contentId:CONTENT_ID,source:parentRoot,overlay,
    parentContentId:manifest.contentId,mcpCatalog:out+'/catalog.json'});
  write(out+'/assembly-receipt.json',{revision,mode:BATCH.mode,batchId:BATCH.batchId,coverage,changeRef,overviewRef,claimScope:slugs,reviewer:approval.reviewer,parentId:manifest.contentId,zhCoverage:'passed',productionChanged:false});
  console.log('Candidate built and validated',revision);
}
main().catch(error=>{console.error(error);process.exitCode=1;});
