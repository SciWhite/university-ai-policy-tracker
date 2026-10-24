import {existsSync,readFileSync} from "node:fs";
import {resolve} from "node:path";
import {v6PublicDataRoot,readVerifiedArtifact} from "./v6-artifact-store";
import {summaryBindingMatches,assertSummaryText,type SummaryProjection} from "./change-summary-binding";
import type {ChangeEvent} from "./change-events";
import {MAX_SUMMARY_BYTES,type PublishedChangeSummary,type SummarySelection,type SummaryLanguage} from "./change-summary-types";

export interface ChangeSummaryManifest {
  schemaVersion:"uapt-reviewed-change-summaries-v1";projection:SummaryProjection;
  events:Record<string,Partial<Record<SummaryLanguage,{file:string;sha256:string;bytes:number}>>>;
}
/** Optional independent public family; neither draft directories nor review inboxes are loaders. */
export function readChangeStudentSummary(event:ChangeEvent,projection:SummaryProjection,root?:string):SummarySelection{
  root??=process.env.NODE_ENV==="development"&&process.env.UAPT_LOCAL_QA_CHANGE_SUMMARIES?resolve(process.env.UAPT_LOCAL_QA_CHANGE_SUMMARIES):v6PublicDataRoot("public-change-summaries");
  const pointer=resolve(root,"current.json");if(!existsSync(pointer))return {status:"missing"};
  try{
    const ref=JSON.parse(readFileSync(pointer,"utf8"));
    const manifest=readVerifiedArtifact<ChangeSummaryManifest>(root,ref.path,ref.sha256,1024*1024);
    if(manifest.schemaVersion!=="uapt-reviewed-change-summaries-v1"||(["projectionRevision","projectionSha256","basisSha256","rulesVersion"] as const).some(key=>manifest.projection?.[key]!==projection[key]))return {status:"stale"};
    const refs=Object.hasOwn(manifest.events,event.id)?manifest.events[event.id]:undefined;
    if(!refs)return {status:"missing"};
    const entries:Partial<Record<SummaryLanguage,PublishedChangeSummary>>={};let stale=false;
    for(const language of ["en","zh"] as const){
      const child=refs[language];if(!child)continue;
      const value=readVerifiedArtifact<PublishedChangeSummary>(root,child.file,child.sha256,MAX_SUMMARY_BYTES,child.bytes);
      if(value.schemaVersion!=="uapt-reviewed-change-summary-v1"||value.language!==language||!summaryBindingMatches(value.binding,event,projection)){stale=true;continue;}
      assertSummaryText(value.text);
      if(!/^[a-f0-9]{64}$/.test(value.review?.draftSha256)||!/^[a-f0-9]{64}$/.test(value.review?.reviewSha256)||!Number.isFinite(Date.parse(value.review?.reviewedAt)))throw Error("Missing summary review provenance");
      entries[language]=value;
    }
    return stale?{status:"stale"}:Object.keys(entries).length?{status:"ready",entries}:{status:"missing"};
  }catch{return {status:"failed"};}
}
