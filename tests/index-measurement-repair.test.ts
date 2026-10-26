import { test } from "node:test";
import assert from "node:assert/strict";
import { isConfirmedEmptyDiff, emptyDiffMetadata, frozenLegacyEventState, isIndexPolicySitemapAlias } from "../apps/web/lib/change-index-policy";
import type {ChangeRecord} from "../apps/web/lib/change-records";
import {requestTrafficKind, browserTrafficKind, splitMeasuredTraffic, inheritSessionTrafficKinds} from "../apps/web/lib/analytics-traffic";
import {withBingAiWindow} from "../apps/web/lib/analytics-window";
import {parseBingAiOverviewCsv, type BingAiPerformanceSnapshot} from "../apps/web/lib/bing-ai-performance";
import {listMirroredAnalyticsEventWindow} from "../apps/web/lib/analytics-store";
import {localizeSurfaceMetadata} from "../apps/web/lib/surface-localization";

const record = {slug:"kcl",releaseId:"public-release-20260924-002",previousReleaseId:"public-release-20260921-001",diffRows:[],diffLines:[],added:0,modified:0,removed:0,claimMetadataChanged:0,evidenceChanged:0,newlyExtractedClaims:0,policyTextChanged:0,sourceAdded:0,sourceRemoved:0,sourceSnapshotChanged:0,sourceTextChanged:0,trackerRemovedClaims:0} as unknown as ChangeRecord;
const basis={releaseId:record.releaseId!,locale:"en",alias:false,eventState:"none" as const};
test("confirmed empty scope cannot absorb substantive events, baselines, aliases or locale decisions",()=>{
 assert.equal(isConfirmedEmptyDiff(record,basis),true);
 assert.equal(frozenLegacyEventState(basis.releaseId,record.slug),"none");
 assert.equal(frozenLegacyEventState("qs25-31-v6-r1-20261020","kcl"),"present");
 assert.equal(frozenLegacyEventState("future","kcl"),"unknown");
 assert.equal(isIndexPolicySitemapAlias("university-of-warwick"),true);
 assert.equal(isIndexPolicySitemapAlias("the-university-of-warwick"),false);
 for(const patch of [{slug:"not-approved"},{releaseId:"future-release"},{previousReleaseId:undefined},{previousReleaseId:"changed-predecessor"},{sourceSnapshotChanged:1},{claimMetadataChanged:1},{publicationKind:"scoped_record_correction"},{diffRows:[{}]},{diffLines:[{}]},{sourceTextChanged:undefined}])assert.equal(isConfirmedEmptyDiff({...record,...patch} as ChangeRecord,basis),false);
 for(const patch of [{eventState:"present"},{eventState:"unknown"},{locale:"fr"},{alias:true}])assert.equal(isConfirmedEmptyDiff(record,{...basis,...patch} as typeof basis),false);
 const meta=emptyDiffMetadata("https://eduaipolicy.org/changes/public-release-20260924-002/kcl");
 assert.equal(meta.robots.index,false);assert.equal(meta.alternates.canonical.includes('/universities/'),false);
 const localized=localizeSurfaceMetadata(meta,"/changes/public-release-20260924-002/kcl","zh");
 assert.deepEqual(localized.alternates?.languages,{});assert.equal((localized.robots as {index:boolean}).index,false);
 assert.ok(String(localized.alternates?.canonical).includes('/zh/changes/'));
});
test("only explicit test evidence is excluded, including unmarked events in that same session",()=>{
 const rows=[{sessionId:"qa",payload:{traffic_kind:"qa"}},{sessionId:"qa",payload:{}},{sessionId:"real",payload:{country:"CA",pages:100}},{sessionId:"other",payload:{}}];
 const inherited=inheritSessionTrafficKinds(rows);assert.equal(splitMeasuredTraffic(inherited.slice(1)).excluded.length,1);
 const split=splitMeasuredTraffic(rows);assert.equal(split.excluded.length,2);assert.equal(split.included.length,2);
 assert.equal(requestTrafficKind(new Headers({cookie:"other_uapt_traffic_kind=qa"})),"unclassified");
 assert.equal(requestTrafficKind(new Headers({cookie:"a=1; uapt_traffic_kind=internal; theme=dark"})),"internal");
 assert.equal(requestTrafficKind(new Headers({"x-uapt-traffic-kind":"monitor"})),"monitor");
 assert.equal(requestTrafficKind(new Headers({"user-agent":"UAPT-Monitor/1.0"})),"monitor");
 assert.equal(browserTrafficKind(),"unclassified");
});
test("AI dates honor selected period and missing days are never zero-filled totals",()=>{
 const snap={available:true,dateRows:[{key:"2026-10-01",citations:4,citedPages:2},{key:"2026-10-02",citations:0,citedPages:0}],pageRows:[{key:"old",citations:99}],totals:{citations:4,averageCitedPages:1}} as BingAiPerformanceSnapshot;
 assert.equal(withBingAiWindow(snap,"2026-10-01","2026-10-02").window?.citations,4);
 const partial=withBingAiWindow(snap,"2026-10-02","2026-10-03");
 assert.equal(partial.window?.complete,false);assert.equal(partial.window?.missingDays,1);assert.equal(partial.window?.citations,null);assert.equal(partial.window?.observedCitations,0);
 assert.equal(partial.pageRows[0].citations,99);
 assert.throws(()=>parseBingAiOverviewCsv('Date,Citations,Cited Pages\n2/30/2026,1,1'),/Invalid/);
 assert.throws(()=>parseBingAiOverviewCsv('Date,Citations,Cited Pages\n10/1/2026,1,1\n10/1/2026,2,2'),/Duplicate/);
});
test("RPC paging uses a frozen upper bound and declares truncation at the row limit",async()=>{
 const original=globalThis.fetch, saved={...process.env};const bounds:string[]=[];
 process.env.SUPABASE_URL="https://example.invalid";process.env.SUPABASE_ANON_KEY="fixture";process.env.SUPABASE_ANALYTICS_SECRET="fixture";
 const until=new Date("2026-10-26T00:00:00Z");
 try {
  globalThis.fetch=async(_u,init)=>{const b=JSON.parse(String(init?.body));bounds.push(b.p_until);return Response.json(Array.from({length:b.p_limit},(_,i)=>({id:String(b.p_offset+i),created_at:"2026-10-25T12:00:00Z",event_name:"page_view",pathname:"/",source:"client"})));};
  const full=await listMirroredAnalyticsEventWindow(new Date("2026-10-01"),{until});assert.equal(full.complete,false);assert.equal(full.rows.length,20000);assert.deepEqual([...new Set(bounds)],[until.toISOString()]);
  globalThis.fetch=async()=>Response.json([]);assert.equal((await listMirroredAnalyticsEventWindow(new Date("2026-10-01"),{until})).complete,true);
  globalThis.fetch=async()=>new Response("fixture",{status:503});await assert.rejects(listMirroredAnalyticsEventWindow(new Date("2026-10-01"),{until}));
 } finally {globalThis.fetch=original;for(const k of ["SUPABASE_URL","SUPABASE_ANON_KEY","SUPABASE_ANALYTICS_SECRET"]){if(saved[k]===undefined)delete process.env[k];else process.env[k]=saved[k];}}
});
test("dashboard totals, conversion events and source shares use the same exclusions", async()=>{
 const {getAnalyticsDashboard,parseAnalyticsDashboardQuery}=await import('../apps/web/lib/private-analytics-dashboard');
 const original=globalThis.fetch, saved={...process.env};
 process.env.SUPABASE_URL="https://example.invalid";process.env.SUPABASE_ANON_KEY="fixture";process.env.SUPABASE_ANALYTICS_SECRET="fixture";
 try {
  const base={created_at:"2026-10-23T12:00:00Z",device_type:"desktop",country_code:"CA",pathname:"/universities/kcl",source:"client",source_category:"direct",source_name:"direct"};
  const events=[{...base,id:"q1",event_name:"page_view",session_id:"qa",payload:{traffic_kind:"qa"}},{...base,id:"q2",event_name:"official_source_click",session_id:"qa",payload:{}},{...base,id:"r1",event_name:"page_view",session_id:"real",visitor_id:"real",payload:{}},{...base,id:"r2",event_name:"official_source_click",session_id:"real",visitor_id:"real",payload:{}}];
  globalThis.fetch=async(input,init)=>String(input).includes('uapt_private_analytics_rollup')?Response.json(null):String(input).includes('uapt_list_analytics_events_window')?Response.json(JSON.parse(String(init?.body)).p_offset===0?events:[]):new Response("unconfigured fixture",{status:503});
  const data=await getAnalyticsDashboard(parseAnalyticsDashboardQuery(new URLSearchParams({from:"2026-10-19",to:"2026-10-25",compare:"none"})));
  assert.equal(data.onsite.current.summary.pageViews,1);
  assert.equal(data.onsite.current.summary.sessions,1);
  assert.equal(data.onsite.current.summary.events,2);
  assert.equal(data.onsite.current.quality.excludedTestEvents,2);
  assert.equal(data.onsite.current.quality.excludedTestPageViews,1);
  assert.equal(data.onsite.current.unknownSourceShare,0);
  assert.equal(data.meta.measurement.complete,true);
  const countryFiltered=await getAnalyticsDashboard(parseAnalyticsDashboardQuery(new URLSearchParams({from:"2026-10-19",to:"2026-10-25",compare:"none",country:"ca"})));
  assert.equal(countryFiltered.onsite.current.summary.pageViews,1);
  assert.equal(countryFiltered.onsite.current.quality.excludedTestEvents,2);
  globalThis.fetch=async()=>new Response("failed fixture",{status:503});
  const failed=await getAnalyticsDashboard(parseAnalyticsDashboardQuery(new URLSearchParams({from:"2026-10-19",to:"2026-10-25"})));
  assert.equal(failed.meta.measurement.complete,false);assert.equal(failed.meta.measurement.error,"event_window_unavailable");assert.equal(failed.meta.comparison.onsite.eligible,false);
 } finally {globalThis.fetch=original;for(const k of ["SUPABASE_URL","SUPABASE_ANON_KEY","SUPABASE_ANALYTICS_SECRET"]){if(saved[k]===undefined)delete process.env[k];else process.env[k]=saved[k];}}
});
