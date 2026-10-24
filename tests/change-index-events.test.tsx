import React from "react";
import test from "node:test";
import assert from "node:assert/strict";
import {renderToStaticMarkup} from "react-dom/server";
import {eventIndexFilters,eventIndexQuery,eventIndexDefaults,eventIndexCandidates,paginateEventIndex,eventSurfaceRows,type ChangeIndexEvent,type EventIndexPage} from "../apps/web/lib/change-index-events";
import {ChangeIndexEventsBrowser} from "../apps/web/components/change-index-events-browser";
import {changeIndexEventsCopy} from "../apps/web/lib/change-index-events-copy";
import {changeHistoryCopy} from "../apps/web/lib/change-history-copy";
import {SUPPORTED_LOCALES} from "../apps/web/lib/i18n";
import {buildChangeEventFeed} from "../apps/web/lib/change-event-feed";

const row=(revision:string,publishedAt:string|null,slug="harvard"):ChangeIndexEvent=>({id:`${slug}:${revision}`,slug,revision,publishedAt,url:`/changes/${revision}/${slug}`,name:slug==="harvard"?"Harvard University":"Another University",localizedName:slug==="harvard"?"哈佛大学":"其他大学",country:"United States",counts:{added:0,modified:1,held:0,affected:1},categories:["tracker_correction"],themes:["coursework"]});
const identity={revision:"package-r1",basisSha256:"a".repeat(64),projectionSha256:"b".repeat(64),rulesVersion:"tracker-events-1.2.0"};
const facets={topics:["coursework"],countries:["United States"]};
test("global browsing retains multiple revisions per university and dates select the earlier event",()=>{
  const rows=[row("new","2026-10-23"),row("earlier","2026-05-26")];
  const result=paginateEventIndex(eventIndexCandidates(rows,eventIndexDefaults),{...eventIndexDefaults,start:"2026-05-01",end:"2026-05-31"},facets);
  assert.equal(result.total,1);assert.equal(result.schoolCount,1);assert.deepEqual(result.rows.map(row=>row.revision),["earlier"]);
});
test("counts are based on the complete filtered set, with bounded pagination and no school deduplication",()=>{
  const rows=Array.from({length:19},(_,i)=>row(`r${i}`,"2026-10-23",i<10?"harvard":"other"));
  const result=paginateEventIndex(rows,{...eventIndexDefaults,page:2},facets);
  assert.equal(result.total,19);assert.equal(result.schoolCount,2);assert.equal(result.pages,3);assert.equal(result.rows.length,8);assert.equal(result.rows[0].revision,"r8");
  assert.equal(paginateEventIndex(rows,{...eventIndexDefaults,page:999},facets).page,3);
});
test("default categories retain held and unclassified history while source-only updates stay secondary",()=>{
  const rows=[row("correction","2026-10-23"),{...row("source","2026-10-23"),categories:["source_update" as const]},{...row("held",null),categories:["held" as const]},{...row("unknown",null),categories:["historical_unclassified" as const]}];
  assert.deepEqual(eventIndexCandidates(rows,eventIndexDefaults).map(row=>row.revision),["correction","held","unknown"]);
  assert.equal(eventIndexCandidates(rows,{...eventIndexDefaults,category:"all"}).length,4);
  const result=paginateEventIndex(rows,{...eventIndexDefaults,start:"2026-10-23",end:"2026-10-23"},facets);assert.equal(result.coverage.unknownDates,2);assert.equal(result.total,2);
  assert.equal(eventIndexCandidates(rows,{...eventIndexDefaults,q:"哈佛"}).length,3);
});
test("date validation, UTC boundaries, coverage and URL round-trip never manufacture event dates",()=>{
  for(const query of ["kind=policy_changed","from=2026-02-30&to=2026-03-01","from=2026-10-23","page=-1","page=1.5"]){assert.throws(()=>eventIndexFilters(new URLSearchParams(query)));}
  const f={...eventIndexDefaults,q:"Harvard",category:"held" as const,page:3,start:"2026-01-01",end:"2026-10-23"};assert.deepEqual(eventIndexFilters(eventIndexQuery(f)),f);
  const rows=[row("offset","2026-10-23T23:30:00-04:00")];
  assert.equal(paginateEventIndex(rows,{...eventIndexDefaults,start:"2026-10-24",end:"2026-10-24"},facets).total,1);
  assert.equal(paginateEventIndex(rows,{...eventIndexDefaults,start:"2026-10-20",end:"2026-10-23"},facets).coverage.before,true);
  assert.equal(paginateEventIndex(rows,{...eventIndexDefaults,start:"2026-10-20",end:"2026-10-24"},facets).coverage.partial,true);
});
test("latest is one real event per school; recent and RSS share a bounded dated event window",()=>{
  const rows=[row("r3","2026-10-23T00:00:00Z"),row("r2","2026-10-22T00:00:00Z"),row("other","2026-10-21T00:00:00Z","other"),row("undated",null,"third")];
  assert.deepEqual(eventSurfaceRows(rows,"latest").map(row=>row.id),["harvard:r3","other:other","third:undated"]);
  const window={start:"2026-10-22T00:00:00Z",end:"2026-10-23T00:00:00Z",limit:2};assert.deepEqual(eventSurfaceRows(rows,"recent",window).map(row=>row.id),["harvard:r3","harvard:r2"]);
  assert.throws(()=>eventSurfaceRows(rows,"recent",{...window,limit:101}));
  const rss=buildChangeEventFeed(rows,identity,"https://eduaipolicy.org/","https://eduaipolicy.org/feeds/recent-changes.xml");
  assert.equal((rss.match(/<item>/g)??[]).length,3);assert(rss.includes('isPermaLink="false">harvard:r2'));assert(!rss.includes('>third:undated<'));assert(rss.includes(identity.projectionSha256));assert(rss.includes("/changes/r2/harvard"));assert(!rss.includes("Invalid Date"));
});
test("all seven locales SSR only one bounded page with independent event identities",()=>{
  const rows=Array.from({length:12},(_,i)=>row(`r${i}`,"2026-10-23"));
  const initial:EventIndexPage={schemaVersion:"uapt-change-event-index-v1",...identity,...paginateEventIndex(rows,eventIndexDefaults,facets)};
  for(const locale of SUPPORTED_LOCALES){const html=renderToStaticMarkup(<ChangeIndexEventsBrowser initial={initial} locale={locale}/>);assert(html.includes(changeIndexEventsCopy(locale).search));assert(html.includes(changeHistoryCopy(locale).matches.replace("{n}","12")));assert.equal((html.match(/data-event-id=/g)??[]).length,8);assert(!html.includes('type="date"'));assert(html.includes(`/changes/r0/harvard`));}
});
