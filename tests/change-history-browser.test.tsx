import React from "react";
import test from "node:test";
import assert from "node:assert/strict";
import {renderToStaticMarkup} from "react-dom/server";
import {selectChangeHistory,selectedItemCount} from "../apps/web/lib/change-history-selection";
import {ChangeHistoryBrowser} from "../apps/web/components/change-history-browser";
import {ChangeEventContent} from "../apps/web/components/change-event-content";
import {changeHistoryCopy} from "../apps/web/lib/change-history-copy";
import {v6ChangesCopy} from "../apps/web/lib/v6-changes-copy";
import type {ChangeEvent,EventHistory} from "../apps/web/lib/change-events";
import {SUPPORTED_LOCALES} from "../apps/web/lib/i18n";
import {mkdtempSync,writeFileSync,readFileSync,rmSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {createChangeFixture} from "./fixtures/change-event-fixture";
import {eventHash} from "../apps/web/lib/change-events";
import {loadSelectedHistoricalName} from "../apps/web/lib/change-events-api";

const event=(revision:string,date:string|null):ChangeEvent=>({id:`school:${revision}`,revision,slug:"school",publishedAt:date,url:`/changes/${revision}/school`,rulesVersion:"tracker-events-1.2.0",items:[{id:"claim:c1",claimId:"c1",category:"tracker_correction",theme:"coursework",themes:["coursework","exams"],matchMethod:"claim_id",comparison:"exact_claim_id",oldText:"old condition",newText:"new condition",sourceUrls:["https://school.example/rule"]}],counts:{added:0,modified:1,held:0,affected:1},gaps:[],provenance:[]});
const history=(events:ChangeEvent[]):EventHistory=>({schemaVersion:"uapt-school-change-events-v2",revision:"package-r1",slug:"school",basisSha256:"a".repeat(64),rulesVersion:"tracker-events-1.2.0",currentClaimIds:["c1"],themeOrder:["coursework","exams"],events,coverage:{recordedFrom:"2026-05-01",gaps:[]}});
const defaults={category:"default" as const,topic:"all"};

test("school history defaults to all dates and an earlier revision survives a date filter",()=>{
  const view=history([event("new","2026-10-23"),event("earlier","2026-05-01")]);
  const all=selectChangeHistory(view,defaults);assert(all.kind!=="invalid");assert.equal(all.count,2);
  const early=selectChangeHistory(view,{...defaults,start:"2026-05-01",end:"2026-05-01"});assert(early.kind!=="invalid");assert.deepEqual(early.rows.map(r=>r.event.revision),["earlier"]);
});
test("category and explicit multi-topic membership select items without duplicate Claim counts",()=>{
  const e=event("r1","2026-10-23");e.items.push({id:"held:c2",claimId:"c2",category:"held",theme:"other",matchMethod:"none",oldText:"held historical condition",sourceUrls:[]});
  let selected=selectChangeHistory(history([e]),{category:"tracker_correction",topic:"exams"});assert(selected.kind!=="invalid");assert.equal(selected.count,1);assert.equal(selectedItemCount(selected.rows[0].items),1);
  selected=selectChangeHistory(history([e]),{category:"held",topic:"all"});assert(selected.kind!=="invalid");assert.equal(selected.rows[0].items[0].claimId,"c2");
  assert.equal(selectedItemCount([e.items[0],e.items[0]]),1);
});
test("source-only events are secondary; all dates retains undated records and custom dates do not",()=>{
  const source=event("source","2026-10-23");source.items=[{id:"source:url",category:"source_update",theme:"sources",matchMethod:"none",sourceUrls:["https://school.example/rule"]}];
  const view=history([source,event("undated",null)]);
  const ordinary=selectChangeHistory(view,defaults);assert(ordinary.kind!=="invalid");assert.equal(ordinary.count,1);assert.equal(ordinary.unknownDates,1);
  const all=selectChangeHistory(view,{category:"all",topic:"all"});assert(all.kind!=="invalid");assert.equal(all.count,2);
  const dated=selectChangeHistory(view,{...defaults,start:"2026-10-01",end:"2026-10-23"});assert(dated.kind!=="invalid");assert.equal(dated.count,0);assert.equal(dated.unknownDates,1);
});
test("history dates distinguish invalid, before, partial and no matching records",()=>{
  const view=history([event("r1","2026-10-23")]);
  assert.equal(selectChangeHistory(view,{...defaults,start:"2026-02-30",end:"2026-03-01"}).kind,"invalid");
  assert.equal(selectChangeHistory(view,{...defaults,start:"2020-01-01",end:"2020-01-02"}).kind,"before");
  assert.equal(selectChangeHistory(view,{...defaults,start:"2020-01-01",end:"2026-10-23"}).kind,"partial");
  assert.equal(selectChangeHistory(view,{...defaults,start:"2026-10-01",end:"2026-10-02"}).kind,"empty");
});
test("SSR pagination counts every match before slicing; all seven locales have all-history defaults",()=>{
  const view=history(Array.from({length:9},(_,i)=>event(`r${i}`,`2026-10-${23-i}`)));
  for(const locale of SUPPORTED_LOCALES){const html=renderToStaticMarkup(<ChangeHistoryBrowser history={view} locale={locale}/>);assert(html.includes(changeHistoryCopy(locale).allDates));assert(html.includes(changeHistoryCopy(locale).matches.replace("{n}","9")));assert.equal((html.match(/id="revision-r/g)??[]).length,6);assert(!html.includes('type="date"'));assert(!html.includes('href="/changes/foreign'))}
});
test("the shared renderer shows exact Claim text only and keeps held text outside a deletion diff",()=>{
  const e=event("r1","2026-10-23");
  let html=renderToStaticMarkup(<ChangeEventContent event={e} locale="zh"/>);assert(html.includes('v6-changes-line--remove'));assert(html.includes('lang="en"'));assert(html.includes('old condition'));
  e.items[0].comparison=undefined;html=renderToStaticMarkup(<ChangeEventContent event={e} locale="zh"/>);assert(!html.includes('v6-changes-line--remove'));assert(html.includes(v6ChangesCopy("zh").noText));
  e.items[0].category="held";html=renderToStaticMarkup(<ChangeEventContent event={e} locale="zh"/>);assert(!html.includes('v6-changes-line--remove'));assert(html.includes(v6ChangesCopy("zh").retained));
});

test("a retired catalog name comes from the selected frozen package and foreign-school rows are rejected",async()=>{
  const directory=mkdtempSync(join(tmpdir(),"uapt-history-name-")),root=join(directory,"public-change-history");
  const previous={NODE_ENV:process.env.NODE_ENV,UAPT_LOCAL_QA_CHANGE_PACKAGE:process.env.UAPT_LOCAL_QA_CHANGE_PACKAGE};
  try{
    createChangeFixture(root);
    Object.assign(process.env,{NODE_ENV:"development",UAPT_LOCAL_QA_CHANGE_PACKAGE:directory});
    const writeName=(slug:string)=>{
      const rows=[{slug,name:"Frozen historical university"}],raw=JSON.stringify(rows);
      writeFileSync(join(root,"legacy.json"),raw);
      const manifest=JSON.parse(readFileSync(join(root,"manifest.json"),"utf8"));
      manifest.entries.school={file:"legacy.json",sha256:eventHash(rows),bytes:Buffer.byteLength(raw)};
      writeFileSync(join(root,"manifest.json"),JSON.stringify(manifest));
      writeFileSync(join(root,"current.json"),JSON.stringify({path:"manifest.json",sha256:eventHash(manifest)}));
    };
    writeName("school");
    assert.equal(await loadSelectedHistoricalName("constructor"),undefined);
    assert.equal(await loadSelectedHistoricalName("school"),"Frozen historical university");
    writeName("another-school");await assert.rejects(()=>loadSelectedHistoricalName("school"),/identity scope/);
  }finally{
    for(const [key,value] of Object.entries(previous)){if(value===undefined)delete process.env[key];else process.env[key]=value;}
    rmSync(directory,{recursive:true,force:true});
  }
});

test('legacy tool text stays readable without inventing an exact Claim comparison',()=>{
 const e=event('r1','2026-10-23');e.items=[{id:'claim:legacy-tool-hash',category:'tracker_correction',theme:'ai_tool_treatment',recordKind:'tool',newText:'Historical tool scope retained.',sourceUrls:['https://school.example/tool'],matchMethod:'claim_id'}];
 const html=renderToStaticMarkup(<ChangeEventContent event={e} locale="zh"/>);
 assert(html.includes('工具记录 1'));assert(html.includes('Historical tool scope retained.'));
 assert(!html.includes('v6-changes-line--remove'));assert(!html.includes('v6-changes-line--add'));
});
