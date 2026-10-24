import React from "react";
import test from "node:test";
import assert from "node:assert/strict";
import {renderToStaticMarkup} from "react-dom/server";
import {mkdtempSync,mkdirSync,writeFileSync,rmSync} from "node:fs";
import {tmpdir} from "node:os";
import {resolve} from "node:path";
import {bindChangeSummary,summaryTextHash} from "../apps/web/lib/change-summary-binding";
import {readLocalChangeSummaryPreview,type ChangeSummaryPreviewManifest} from "../apps/web/lib/change-summary-preview";
import {readChangeStudentSummary} from "../apps/web/lib/change-summary-store";
import {ChangeStudentSummary} from "../apps/web/components/change-student-summary";
import {changeSummaryCopy} from "../apps/web/lib/change-summary-copy";
import {SUPPORTED_LOCALES} from "../apps/web/lib/i18n";
import type {ChangeEvent} from "../apps/web/lib/change-events";
import type {ChangeSummaryDraft} from "../apps/web/lib/change-summary-types";
import {resetV6ArtifactCache} from "../apps/web/lib/v6-artifact-store";

const projection={projectionRevision:"package-r1",projectionSha256:"a".repeat(64),basisSha256:"b".repeat(64),rulesVersion:"tracker-events-1.2.0"};
const event:ChangeEvent={id:"epfl:r1",slug:"epfl",revision:"r1",previousRevision:"r0",publishedAt:"2026-10-24T00:00:00Z",url:"/changes/r1/epfl",rulesVersion:"tracker-events-1.2.0",counts:{added:0,modified:1,held:0,affected:1},gaps:[],provenance:[],items:[{id:"claim:c1",claimId:"c1",category:"tracker_correction",theme:"approved_tools",matchMethod:"claim_id",comparison:"exact_claim_id",oldText:"Old tool scope.",newText:"New tool scope.",sourceUrls:["https://school.example/tool"]}]};
const draft:ChangeSummaryDraft={schemaVersion:"uapt-change-summary-draft-v1",binding:bindChangeSummary(event,projection),language:"en",generatedAt:"2026-10-24T01:00:00Z",generator:{kind:"ai",id:"fixture-author"},text:{whatChanged:"PRIVATE UNREVIEWED CANDIDATE",studentImpact:"Check the tool scope.",basisAndScope:"Historical tracker revision only."}};

function fixture(run:(root:string,manifest:ChangeSummaryPreviewManifest,save:()=>void)=>void){
  const root=mkdtempSync(resolve(tmpdir(),"uapt-local-preview-")),prior={NODE_ENV:process.env.NODE_ENV,UAPT_LOCAL_QA_CHANGE_SUMMARY_PREVIEW:process.env.UAPT_LOCAL_QA_CHANGE_SUMMARY_PREVIEW};
  mkdirSync(resolve(root,"preview"));mkdirSync(resolve(root,"drafts"));
  const raw=JSON.stringify(draft);writeFileSync(resolve(root,"drafts/en.json"),raw);
  const manifest:ChangeSummaryPreviewManifest={schemaVersion:"uapt-local-change-summary-preview-v1",publicationApproved:false,draftRoot:"../drafts",entries:[{slug:"epfl",eventId:event.id,language:"en",file:"en.json",sha256:summaryTextHash(raw),bytes:Buffer.byteLength(raw)}]};
  const save=()=>writeFileSync(resolve(root,"preview/manifest.json"),JSON.stringify(manifest));save();
  Object.assign(process.env,{NODE_ENV:"development",UAPT_LOCAL_QA_CHANGE_SUMMARY_PREVIEW:resolve(root,"preview/manifest.json")});
  try{run(root,manifest,save);}finally{for(const [key,value] of Object.entries(prior)){if(value===undefined)delete process.env[key];else process.env[key]=value;}rmSync(root,{recursive:true,force:true});resetV6ArtifactCache();}
}
test("candidate preview requires an explicit dev opt-in, while production and the public store ignore it",()=>fixture((root)=>{
  assert.equal(readLocalChangeSummaryPreview(event,projection)?.status,"preview");
  assert.equal(readChangeStudentSummary(event,projection,resolve(root,"drafts")).status,"missing");
  process.env.NODE_ENV="production";assert.equal(readLocalChangeSummaryPreview(event,projection),undefined);
  process.env.NODE_ENV="development";delete process.env.UAPT_LOCAL_QA_CHANGE_SUMMARY_PREVIEW;assert.equal(readLocalChangeSummaryPreview(event,projection),undefined);
}));
test("the preview is restricted to the three chosen schools and rejects mixed or duplicate scope",()=>fixture((root,manifest,save)=>{
  assert.equal(readLocalChangeSummaryPreview({...event,slug:"harvard-university"},projection),undefined);
  manifest.entries.push({...manifest.entries[0],slug:"harvard-university",eventId:"harvard-university:r1"});save();assert.equal(readLocalChangeSummaryPreview(event,projection)?.status,"failed");
  manifest.entries=[manifest.entries[0],manifest.entries[0]];save();assert.equal(readLocalChangeSummaryPreview(event,projection)?.status,"failed");
}));
test("changed text/basis and damaged files cannot display candidate text",()=>fixture((root)=>{
  assert.equal(readLocalChangeSummaryPreview({...event,items:[{...event.items[0],newText:"Newer"}]},projection)?.status,"stale");
  assert.equal(readLocalChangeSummaryPreview(event,{...projection,projectionSha256:"c".repeat(64)})?.status,"stale");
  writeFileSync(resolve(root,"drafts/en.json"),"{}");resetV6ArtifactCache();assert.equal(readLocalChangeSummaryPreview(event,projection)?.status,"failed");
}));
test("all seven local review UIs show actual candidate text with a pending label and never claim approval",()=>fixture(()=>{
  const selection=readLocalChangeSummaryPreview(event,projection);assert(selection?.status==="preview");
  for(const locale of SUPPORTED_LOCALES){const html=renderToStaticMarkup(<ChangeStudentSummary event={{...event,studentSummary:selection}} items={event.items} locale={locale}/>);assert(html.includes(draft.text.whatChanged));assert(html.includes(changeSummaryCopy(locale).preview));assert(html.includes(changeSummaryCopy(locale).previewNotice));assert(!html.includes(changeSummaryCopy(locale).reviewed));assert(html.includes('data-summary-state="preview"'));}
  const filtered=renderToStaticMarkup(<ChangeStudentSummary event={{...event,items:[...event.items,{...event.items[0],id:"claim:c2",claimId:"c2"}],studentSummary:selection}} items={event.items} locale="zh"/>);assert(!filtered.includes(draft.text.whatChanged));assert(filtered.includes(changeSummaryCopy("zh").filteredPreview));
}));

test('a source-held candidate shows a hold notice and never its unapproved text',()=>fixture((root,manifest,save)=>{
 const held={...draft,generationHold:['assessment_must_not_conflicts_with_should_not_excerpt']};const raw=JSON.stringify(held);writeFileSync(resolve(root,'drafts/en.json'),raw);manifest.entries[0].sha256=summaryTextHash(raw);manifest.entries[0].bytes=Buffer.byteLength(raw);save();resetV6ArtifactCache();
 const selection=readLocalChangeSummaryPreview(event,projection);assert.equal(selection?.status,'held');
 const html=renderToStaticMarkup(<ChangeStudentSummary event={{...event,studentSummary:selection}} items={event.items} locale="zh"/>);assert(html.includes(changeSummaryCopy('zh').held));assert(!html.includes(draft.text.whatChanged));
}));
