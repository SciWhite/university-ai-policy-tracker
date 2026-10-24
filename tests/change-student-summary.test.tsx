import React from "react";
import test from "node:test";
import assert from "node:assert/strict";
import {renderToStaticMarkup} from "react-dom/server";
import {mkdtempSync,readFileSync,writeFileSync,rmSync} from "node:fs";
import {tmpdir} from "node:os";
import {resolve} from "node:path";
import {createChangeFixture} from "./fixtures/change-event-fixture";
import {bindChangeSummary,summaryHash,summaryTextHash,summaryBindingMatches,acceptReviewedChangeSummary} from "../apps/web/lib/change-summary-binding";
import {summaryReviewChecks,type ChangeSummaryDraft,type ChangeSummaryReview,type SummaryChangeEvent} from "../apps/web/lib/change-summary-types";
import {readChangeStudentSummary} from "../apps/web/lib/change-summary-store";
import {prepareSummaryReviewPacket,writeSummaryDraft,exportReviewedSummaryPackage} from "../scripts/change-summary-workflow";
import {ChangeStudentSummary} from "../apps/web/components/change-student-summary";
import {changeSummaryCopy} from "../apps/web/lib/change-summary-copy";
import {changeCountsText,changeItemCounts} from "../apps/web/lib/change-counts-copy";
import {SUPPORTED_LOCALES} from "../apps/web/lib/i18n";
import type {ChangeEvent} from "../apps/web/lib/change-events";
import {resetV6ArtifactCache} from "../apps/web/lib/v6-artifact-store";

const event=():ChangeEvent=>({id:"school:r1",slug:"school",revision:"r1",previousRevision:"r0",publishedAt:"2026-10-23T00:00:00Z",url:"/changes/r1/school",rulesVersion:"tracker-events-1.2.0",items:[{id:"claim:c1",claimId:"c1",category:"tracker_correction",theme:"coursework",sourceUrls:["https://school.example/rule"],matchMethod:"claim_id",comparison:"exact_claim_id",oldText:"old condition",newText:"new condition"}],counts:{added:0,modified:1,held:0,affected:1},gaps:[],provenance:[]});
const projection={projectionRevision:"package-r1",projectionSha256:"a".repeat(64),basisSha256:"b".repeat(64),rulesVersion:"tracker-events-1.2.0"};
const text={whatChanged:"Fixture record correction.",studentImpact:"Fixture: check the recorded scope.",basisAndScope:"Fixture only, not a current permission."};
const draft=(e=event()):ChangeSummaryDraft=>({schemaVersion:"uapt-change-summary-draft-v1",binding:bindChangeSummary(e,projection),language:"en",generatedAt:"2026-10-23T01:00:00Z",generator:{kind:"ai",id:"fixture-author"},text});
const review=(d:ChangeSummaryDraft):ChangeSummaryReview=>({schemaVersion:"uapt-change-summary-review-v1",decision:"approved",draftSha256:summaryHash(d),bindingSha256:summaryHash(d.binding),reviewerId:"fixture-independent-reviewer",reviewedAt:"2026-10-23T02:00:00Z",checks:Object.fromEntries(summaryReviewChecks.map(key=>[key,true])) as ChangeSummaryReview["checks"]});

test("record totals distinguish additions, corrections and held Claims without double counting",()=>{
  assert.equal(changeCountsText({affected:35,modified:30,added:5,held:0},"zh"),"涉及 35 条 (更正／调整 30 · 补录 5)");
  const item=event().items[0];assert.deepEqual(changeItemCounts([item,{...item,category:"tracker_addition"},{...item,category:"held"}]),{affected:1,modified:0,added:0,held:1});
  assert.deepEqual(changeItemCounts([{...item,claimId:undefined}]),{affected:1,modified:0,added:0,held:0,unnumberedRecords:1});
});
test("binding covers the exact event, revision pair, Claim texts, topics, sources and projection",()=>{
  const e=event(),binding=bindChangeSummary(e,projection);assert.equal(binding.fromRevision,"r0");assert.equal(binding.items[0].newTextSha256,summaryTextHash("new condition"));
  for(const mutate of [(v:ChangeEvent)=>{v.items[0].newText="changed";},(v:ChangeEvent)=>{v.items[0].sourceUrls.push("https://school.example/other");},(v:ChangeEvent)=>{v.items[0].theme="exams";},(v:ChangeEvent)=>{v.previousRevision="foreign";},(v:ChangeEvent)=>{v.gaps.push("new gap");}]){const changed=structuredClone(e);mutate(changed);assert.equal(summaryBindingMatches(binding,changed,projection),false);}
  assert.equal(summaryBindingMatches(binding,e,{...projection,projectionSha256:"c".repeat(64)}),false);
  assert.throws(()=>bindChangeSummary({...e,items:Array.from({length:129},(_,i)=>({...e.items[0],id:`claim:${i}`,claimId:String(i)}))},projection),/1–128/);
});
test("approval rejects a draft edit, the generator's own review, missing checks and invalid chronology",()=>{
  const d=draft(),r=review(d);assert.equal(acceptReviewedChangeSummary(d,r,event(),projection).text.whatChanged,text.whatChanged);
  assert.throws(()=>acceptReviewedChangeSummary({...d,text:{...d.text,whatChanged:"edited"}},r,event(),projection),/Independent/);
  assert.throws(()=>acceptReviewedChangeSummary(d,{...r,reviewerId:d.generator.id},event(),projection),/Independent/);
  assert.throws(()=>acceptReviewedChangeSummary(d,{...r,checks:{...r.checks,heldPreserved:false}},event(),projection),/Independent/);
  assert.throws(()=>acceptReviewedChangeSummary(d,{...r,reviewedAt:"2026-10-22T00:00:00Z"},event(),projection),/chronology/);
});
test("unreviewed draft content never appears; all seven UIs show a structured fallback",()=>{
  const e=event() as SummaryChangeEvent;e.studentSummary={status:"missing"};
  for(const locale of SUPPORTED_LOCALES){const html=renderToStaticMarkup(<ChangeStudentSummary event={e} items={e.items} locale={locale}/>);assert(html.includes(changeSummaryCopy(locale).pending));assert(html.includes(changeSummaryCopy(locale).template));assert(!html.includes(text.whatChanged));assert(html.includes("1"));}
});
test("only approved text displays with local labels and explicit language fallback; item filters use a template",()=>{
  const e=event(),d=draft(e),approved=acceptReviewedChangeSummary(d,review(d),e,projection);
  const selected:SummaryChangeEvent={...e,studentSummary:{status:"ready",entries:{en:approved}}};
  for(const locale of SUPPORTED_LOCALES){const html=renderToStaticMarkup(<ChangeStudentSummary event={selected} items={e.items} locale={locale}/>);assert(html.includes(changeSummaryCopy(locale).changed));assert(html.includes(text.whatChanged));assert(html.includes('lang="en"'));if(locale!=="en")assert(html.includes(changeSummaryCopy(locale).fallback.replace("{language}",changeSummaryCopy(locale).english)));}
  const larger={...selected,items:[...selected.items,{...selected.items[0],id:"claim:c2",claimId:"c2"}]};const filtered=renderToStaticMarkup(<ChangeStudentSummary event={larger} items={[larger.items[0]]} locale="zh"/>);assert(!filtered.includes(text.whatChanged));assert(filtered.includes(changeSummaryCopy("zh").filtered));
});
test("workflow writes immutable draft/review packets, refuses pending reviews, and packages only approved leaves",()=>{
  const dir=mkdtempSync(resolve(tmpdir(),"uapt-summary-"));
  try{
    const fixture=createChangeFixture(resolve(dir,"history"));
    const h=fixture.histories.school;h.events[0].items[0].sourceUrls=["https://school.example/rule"];
    // Rebind the fixture leaf and manifest after adding explicit evidence.
    const leaf=JSON.stringify(h);writeFileSync(resolve(dir,"history/school.json"),leaf);
    const manifest=JSON.parse(readFileSync(resolve(dir,"history/manifest.json"),"utf8"));manifest.eventHistories.school={file:"school.json",sha256:summaryTextHash(leaf),bytes:Buffer.byteLength(leaf)};
    const raw=JSON.stringify(manifest);writeFileSync(resolve(dir,"history/manifest.json"),raw);writeFileSync(resolve(dir,"history/current.json"),JSON.stringify({path:"manifest.json",sha256:summaryTextHash(raw)}));
    const packet=prepareSummaryReviewPacket(resolve(dir,"history"),"school","event-r1",resolve(dir,"packet"));
    const d=writeSummaryDraft(resolve(dir,"packet/packet.json"),"en",text,"fixture-author",resolve(dir,"draft"));
    const reviewPath=resolve(dir,"review.json"),draftPath=resolve(dir,"draft/draft.json");
    const externalReview={...review(d),reviewedAt:new Date().toISOString()};writeFileSync(reviewPath,JSON.stringify(externalReview));
    const input={draft:{path:draftPath,sha256:summaryTextHash(readFileSync(draftPath,"utf8"))},review:{path:reviewPath,sha256:summaryTextHash(readFileSync(reviewPath,"utf8"))}};
    const result=exportReviewedSummaryPackage(resolve(dir,"history"),[input],dir,resolve(dir,"published"));assert.equal(result.summaries,1);
    let selected=readChangeStudentSummary(packet.event,packet.binding,resolve(dir,"published"));assert.equal(selected.status,"ready");
    const changed=structuredClone(packet.event);changed.items[0].newText="newer";assert.equal(readChangeStudentSummary(changed,packet.binding,resolve(dir,"published")).status,"stale");
    assert.equal(readChangeStudentSummary(packet.event,{...packet.binding,projectionSha256:"c".repeat(64)},resolve(dir,"published")).status,"stale");
    const pending=JSON.parse(readFileSync(resolve(dir,"draft/review-template.json"),"utf8"));writeFileSync(reviewPath,JSON.stringify(pending));input.review.sha256=summaryTextHash(readFileSync(reviewPath,"utf8"));assert.throws(()=>exportReviewedSummaryPackage(resolve(dir,"history"),[input],dir,resolve(dir,"pending-output")),/Independent/);
    assert.throws(()=>prepareSummaryReviewPacket(resolve(dir,"history"),"school","event-r1",resolve(dir,"packet")),/NEW private/);
    const pointer=JSON.parse(readFileSync(resolve(dir,"published/current.json"),"utf8"));writeFileSync(resolve(dir,"published",pointer.path),"{}");resetV6ArtifactCache();selected=readChangeStudentSummary(packet.event,packet.binding,resolve(dir,"published"));assert.equal(selected.status,"failed");
  }finally{rmSync(dir,{recursive:true,force:true});}
});

test("tool counts and unknown legacy counts remain explicit without fabricated Claim identities",()=>{
 const item={...event().items[0],claimId:undefined,recordKind:"tool" as const};
 assert.deepEqual(changeItemCounts([item,item]),{affected:1,added:0,modified:0,held:0,toolRecords:1});
 assert.equal(changeCountsText(changeItemCounts([item]),"zh"),"涉及 1 条 (工具记录 1)");
});
