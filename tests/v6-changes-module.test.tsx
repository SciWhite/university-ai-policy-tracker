import React from "react";
import test from "node:test";
import assert from "node:assert/strict";
import {renderToStaticMarkup} from "react-dom/server";
import {PolicyV6ChangesClient} from "../apps/web/components/policy-v6-changes-client";
import {changeWindow,visibleChangeWindow} from "../apps/web/lib/v6-changes-window";
import {v6ChangesCopy,v6ChangeTopicTitle} from "../apps/web/lib/v6-changes-copy";
import {SUPPORTED_LOCALES} from "../apps/web/lib/i18n";
import type {ChangeOverview,EventPreview} from "../apps/web/lib/change-events";

function preview(revision:string,publishedAt:string|null,categories:EventPreview["categories"]=["tracker_correction"]):EventPreview {
  return {id:`school:${revision}`,revision,publishedAt,url:`/changes/${revision}/school`,counts:{added:0,modified:1,held:0,affected:1},categories,themes:["coursework"]};
}
function overview(timeline:EventPreview[]):ChangeOverview {
  return {schemaVersion:"uapt-v6-change-overview-v1",revision:"package-r1",slug:"school",projectionSha256:"a".repeat(64),basisSha256:"b".repeat(64),recordSha256:"c".repeat(64),rulesVersion:"tracker-events-1.2.0",recordedFrom:"2026-08-01T00:00:00Z",themeOrder:["coursework"],gaps:[],timeline};
}
test("inclusive UTC calendar windows cover 90 dates across leap day and DST",()=>{
  assert.deepEqual(changeWindow("2026-10-23"),{start:"2026-07-26",end:"2026-10-23"});
  assert.deepEqual(changeWindow("2024-03-30",30),{start:"2024-03-01",end:"2024-03-30"});
  const view=overview([preview("r1","2026-10-23T00:30:00+08:00"),preview("r2","2026-10-23T23:30:00-08:00")]);
  const result=visibleChangeWindow(view,"2026-10-22","2026-10-23");
  assert(result.kind!=="invalid");assert.deepEqual(result.previews.map(e=>e.revision),["r1"]);
});
test("earlier revisions remain filterable; full result count is independent of the three previews",()=>{
  const view=overview(Array.from({length:5},(_,i)=>preview(`r${i}`,`2026-10-${23-i}T12:00:00Z`)));
  const all=visibleChangeWindow(view,"2026-10-01","2026-10-23");
  assert(all.kind!=="invalid");assert.equal(all.count,5);assert.equal(all.previews.length,3);
  const earlier=visibleChangeWindow(view,"2026-10-19","2026-10-19");
  assert(earlier.kind!=="invalid");assert.deepEqual(earlier.previews.map(e=>e.revision),["r4"]);
});
test("invalid, before-coverage, partial and empty periods stay distinct; default omits page/source-only events",()=>{
  const view=overview([preview("source","2026-10-23",["source_update"]),preview("page","2026-10-22",["page_update"]),preview("metadata","2026-10-22",["record_maintenance"]),preview("held",null,["held"])]);
  assert.equal(visibleChangeWindow(view,"2026-02-30","2026-03-01").kind,"invalid");
  assert.equal(visibleChangeWindow(view,"2026-10-24","2026-10-23").kind,"invalid");
  assert.equal(visibleChangeWindow(view,"2026-01-01","2026-07-31").kind,"before");
  assert.equal(visibleChangeWindow(view,"2026-07-31","2026-08-03").kind,"partial");
  const result=visibleChangeWindow(view,"2026-10-01","2026-10-23");
  assert(result.kind!=="invalid");assert.equal(result.kind,"empty");assert.equal(result.count,0);assert.equal(result.undated,1);
});
test("SSR is collapsed with at most three previews; all seven locales preserve labels and history destinations",()=>{
  const view=overview(Array.from({length:5},(_,i)=>preview(`r${i}`,`2026-10-${23-i}`)));
  for(const locale of SUPPORTED_LOCALES){
    const html=renderToStaticMarkup(<PolicyV6ChangesClient slug="school" recordSha256={view.recordSha256} locale={locale} today="2026-10-23" initial={{status:"ready",overview:view}}/>);
    assert(html.includes(v6ChangesCopy(locale).title));assert(!html.includes('id="record-changes" open'));
    assert.equal((html.match(/class="v6-changes-event"/g)??[]).length,3);
    assert(html.includes(v6ChangesCopy(locale).count.replace("{n}","5")));
    assert(html.includes(`${locale==="en"?"":"/"+locale}/changes/school`));
    assert(!html.includes("/api/public/v1/changes/events/"));
  }
});
test("unavailable and failed SSR never claim zero updates or render an empty result",()=>{
  for(const status of ["unavailable","failed"] as const){
    const html=renderToStaticMarkup(<PolicyV6ChangesClient slug="school" locale="zh" today="2026-10-23" initial={{status,revision:"package-r1"}}/>);
    assert(!html.includes("0 次记录更新"));assert(!html.includes(v6ChangesCopy("zh").empty));
    assert(html.includes(status==="failed"?v6ChangesCopy("zh").failed:v6ChangesCopy("zh").unavailable));
  }
});

test("historical Claim categories keep their labels instead of becoming invented V6 topic assignments",()=>{
  assert.equal(v6ChangeTopicTitle("ai_tool_treatment","zh"),"AI 工具使用规则");
  assert.equal(v6ChangeTopicTitle("privacy","zh"),"隐私");
  assert.equal(v6ChangeTopicTitle("privacy_data","zh"),"数据安全");
  assert.equal(v6ChangeTopicTitle("teaching","zh"),"教学");
  assert.equal(v6ChangeTopicTitle("research","zh"),"研究");
  assert.equal(v6ChangeTopicTitle("unknown","zh"),v6ChangesCopy("zh").other);
});

test("metadata-only revisions do not masquerade as zero revised Claim records",()=>{
  const item=preview("metadata","2026-10-23");item.counts={added:0,modified:0,held:0,affected:0};
  const view=overview([item]);
  const html=renderToStaticMarkup(<PolicyV6ChangesClient slug="school" locale="zh" today="2026-10-23" initial={{status:"ready",overview:view}}/>);
  assert(!html.includes("修订 0 条"));assert(html.includes("1 次记录更新"));
});
