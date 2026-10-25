import registeredProjections from '../../../data/public-change-history/revisions.json';
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { historyManifest, ChangeEventStore, selectChangeEventStore } from "./public-change-history";
import { readV6ChangeOverview } from "./v6-change-overviews";
import { readV6RecordCorrections } from "./v6-effective-records";
import { v6PublicDataRoot } from "./v6-artifact-store";
import type { ChangeOverview } from "./change-events";
import type { EventHistory } from "./change-events";
import type {ChangeRecord} from "./change-records";
import {readVerifiedArtifact} from "./v6-artifact-store";
import {changeCategoryKeys} from "./v6-changes-copy";
import {readChangeStudentSummary} from "./change-summary-store";
import {readLocalChangeSummaryPreview} from "./change-summary-preview";
import type {ChangeEvent} from "./change-events";
import type {SummaryChangeEvent} from "./change-summary-types";

export type SelectedChangeOverview = {status:"ready";overview:ChangeOverview}|{status:"unavailable"|"failed";revision?:string};

/** Development-only public artifact pilot; private inventory is never a loader. */
async function selectedStore(revision?:string) {
  const pilot=process.env.NODE_ENV==="development"&&process.env.UAPT_LOCAL_QA_CHANGE_PACKAGE;
  const base=pilot?resolve(pilot):undefined;
  const root=base?resolve(base,"public-change-history"):(await historyManifest()).root;
  const store=selectChangeEventStore(root,revision,registeredProjections);
  if(!store)return undefined;
  return {store,overviewRoot:base?resolve(base,"public-v6-change-overviews"):v6PublicDataRoot("public-v6-change-overviews")};
}

function withStudentSummary(event:ChangeEvent,store:ChangeEventStore):SummaryChangeEvent{
  const ref=store.ref;
  const projection={projectionRevision:store.manifest.revision!,projectionSha256:ref.sha256,basisSha256:store.manifest.basisSha256,rulesVersion:store.manifest.rulesVersion!};
  return {...event,studentSummary:readLocalChangeSummaryPreview(event,projection)??readChangeStudentSummary(event,projection)};
}

/** The page and API use the same verified, per-school leaf. Never read the event index here. */
export async function loadSelectedChangeOverview(slug:string,pageRecordSha256?:string):Promise<SelectedChangeOverview> {
  let revision:string|undefined;
  try {
    const policy=readV6RecordCorrections(),pin=policy?.recordRevisions[slug];
    revision=policy?.revision;
    if(!pin||!revision||!pageRecordSha256||pin.recordSha256!==pageRecordSha256)return {status:"unavailable"};
    const selected=await selectedStore();
    if(!selected||selected.store.manifest.revision!==revision)return {status:"unavailable",revision};
    const ref=JSON.parse(readFileSync(resolve(selected.store.root,"current.json"),'utf8'));
    const overview=readV6ChangeOverview(revision,slug,{recordSha256:pageRecordSha256,projectionSha256:ref.sha256,basisSha256:selected.store.manifest.basisSha256},selected.overviewRoot);
    return overview?{status:"ready",overview}:{status:"unavailable",revision};
  }catch{return {status:"failed",revision};}
}

/** Whole-school history is for the history page, never the compact V6 module. */
export async function loadSelectedChangeHistory(slug:string):Promise<EventHistory|undefined> {
  if(!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug))return undefined;
  const selected=await selectedStore();
  if(!selected)return undefined;
  const history=selected.store.history(selected.store.manifest.revision!,slug);
  if(!history)return undefined;
  const policy=readV6RecordCorrections(),pin=policy?.recordRevisions[slug];
  if(pin&&(policy?.revision!==history.revision||pin.recordSha256!==history.currentRecordSha256))throw Error("School history does not match the selected public record");
  return {...history,events:history.events.map(event=>withStudentSummary(event,selected.store))};
}

/** Retired catalog identities keep the name bound to the selected public history package. */
export async function loadSelectedHistoricalName(slug:string):Promise<string|undefined>{
  if(!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug))return undefined;
  const selected=await selectedStore();
  const ref=selected&&Object.hasOwn(selected.store.manifest.entries,slug)?selected.store.manifest.entries[slug]:undefined;
  if(!selected||!ref)return undefined;
  const rows=readVerifiedArtifact<ChangeRecord[]>(selected.store.root,ref.file,ref.sha256,4*1024*1024,ref.bytes);
  if(!Array.isArray(rows)||rows.some(row=>row.slug!==slug))throw Error("Historical identity scope mismatch");
  return rows.find(row=>typeof row.name==="string"&&row.name.trim())?.name;
}
/** Global browsing alone reads the light preview index; school pages never do. */
export async function loadSelectedChangeEventIndex(revision?:string){
  const selected=await selectedStore(revision);if(!selected)return undefined;
  const store=selected.store,rows=store.index(),ids=new Set<string>();
  // Historical index identity is the verified frozen projection, independent of the active policy revision.
  for(const row of rows){
    if(!row||!Object.hasOwn(store.manifest.eventHistories!,row.slug)||!/^[a-z0-9-]+$/.test(row.revision)||row.id!==`${row.slug}:${row.revision}`||row.url!==`/changes/${row.revision}/${row.slug}`||ids.has(row.id)||!Array.isArray(row.categories)||row.categories.some(key=>!changeCategoryKeys.includes(key))||!Array.isArray(row.themes)||row.publishedAt!==null&&!Number.isFinite(Date.parse(row.publishedAt)))throw Error("Event index identity mismatch");
    ids.add(row.id);
  }
  rows.sort((a,b)=>(Date.parse(b.publishedAt??"")||0)-(Date.parse(a.publishedAt??"")||0)||a.id.localeCompare(b.id));
  const ref=store.ref;
  return {identity:{revision:store.manifest.revision!,basisSha256:store.manifest.basisSha256,projectionSha256:ref.sha256 as string,rulesVersion:store.manifest.rulesVersion!},rows,history:(slug:string)=>store.history(store.manifest.revision!,slug),historicalName:(slug:string)=>{
    const entry=Object.hasOwn(store.manifest.entries,slug)?store.manifest.entries[slug]:undefined;if(!entry)return undefined;
    const values=readVerifiedArtifact<ChangeRecord[]>(store.root,entry.file,entry.sha256,4*1024*1024,entry.bytes);
    if(!Array.isArray(values)||values.some(row=>row.slug!==slug))throw Error("Historical identity scope mismatch");
    return values.find(row=>row.name?.trim())?.name;
  }};
}
export async function changeEventsResponse(request:Request,params:{revision:string;slug:string;kind?:"history"|"overview"}) {
  const headers={'Cache-Control':'private, no-store, no-transform'};
  if(!/^[a-z0-9-]+$/.test(params.revision)||!/^[a-z0-9-]+$/.test(params.slug))return Response.json({error:"Invalid change identity"},{status:400,headers});
  try{
    const selected=await selectedStore(params.revision);
    if(!selected)return Response.json({error:"Requested projection revision is unavailable"},{status:409,headers});
    if(selected.store.manifest.revision!==params.revision)return Response.json({error:"Requested projection revision is unavailable"},{status:409,headers});
    if(params.kind==="overview"){
      // Read the record fingerprint frozen in this exact historical projection.
      // Consulting today's record package would couple old URLs to active data.
      const history=selected.store.history(params.revision,params.slug);
      if(!history?.currentRecordSha256)return Response.json({error:"Compatible university policy basis unavailable"},{status:503,headers});
      const ref=selected.store.ref;
      const overview=readV6ChangeOverview(params.revision,params.slug,{recordSha256:history.currentRecordSha256,projectionSha256:ref.sha256,basisSha256:selected.store.manifest.basisSha256},selected.overviewRoot);
      return Response.json(overview??{error:"Overview unavailable"},{status:overview?200:503,headers});
    }
    const history=selected.store.history(params.revision,params.slug);
    if(!history)return Response.json({error:"University history not found"},{status:404,headers});
    const eventRevision=new URL(request.url).searchParams.get("eventRevision");
    if(eventRevision){const event=history.events.find(e=>e.revision===eventRevision);return Response.json(event?withStudentSummary(event,selected.store):{error:"Revision event not found"},{status:event?200:404,headers});}
    return Response.json({...history,events:history.events.map(event=>withStudentSummary(event,selected.store))},{headers});
  }catch{return Response.json({error:"Event artifact validation failed; history is unavailable"},{status:503,headers});}
}
