import {readFileSync} from "node:fs";
import {dirname,resolve} from "node:path";
import {readVerifiedArtifact} from "./v6-artifact-store";
import {summaryBindingMatches,assertSummaryText,type SummaryProjection} from "./change-summary-binding";
import type {ChangeEvent} from "./change-events";
import {MAX_SUMMARY_BYTES,type ChangeSummaryDraft,type SummaryLanguage,type SummarySelection} from "./change-summary-types";

export const CHANGE_SUMMARY_PREVIEW_SCHOOLS=["epfl","cornell-university","massachusetts-institute-of-technology"] as const;
export interface ChangeSummaryPreviewManifest {
  schemaVersion:"uapt-local-change-summary-preview-v1";publicationApproved:false;draftRoot:string;
  entries:Array<{slug:string;eventId:string;language:SummaryLanguage;file:string;sha256:string;bytes:number}>;
}
/** An explicitly enabled local review view. Never called by the public summary store. */
export function readLocalChangeSummaryPreview(event:ChangeEvent,projection:SummaryProjection):SummarySelection|undefined{
  const file=process.env.UAPT_LOCAL_QA_CHANGE_SUMMARY_PREVIEW;
  if(process.env.NODE_ENV!=="development"||!file||!(CHANGE_SUMMARY_PREVIEW_SCHOOLS as readonly string[]).includes(event.slug))return undefined;
  try{
    const raw=readFileSync(file);if(raw.length>32*1024)throw Error("Oversized summary preview manifest");
    const manifest=JSON.parse(raw.toString()) as ChangeSummaryPreviewManifest;
    if(manifest.schemaVersion!=="uapt-local-change-summary-preview-v1"||manifest.publicationApproved!==false||!Array.isArray(manifest.entries)||manifest.entries.length>6||manifest.entries.some(entry=>!(CHANGE_SUMMARY_PREVIEW_SCHOOLS as readonly string[]).includes(entry.slug)||entry.eventId.split(":")[0]!==entry.slug||!["en","zh"].includes(entry.language))||new Set(manifest.entries.map(entry=>`${entry.eventId}:${entry.language}`)).size!==manifest.entries.length)throw Error("Invalid three-school preview scope");
    const refs=manifest.entries.filter(entry=>entry.eventId===event.id);if(!refs.length)return undefined;
    const root=resolve(dirname(file),manifest.draftRoot),entries:Partial<Record<SummaryLanguage,ChangeSummaryDraft>>={};
    for(const ref of refs){
      const draft=readVerifiedArtifact<ChangeSummaryDraft>(root,ref.file,ref.sha256,MAX_SUMMARY_BYTES,ref.bytes);
      if(draft.schemaVersion!=="uapt-change-summary-draft-v1"||draft.language!==ref.language||draft.binding.slug!==event.slug||draft.generator?.kind!=="ai"||!draft.generator.id)throw Error("Invalid summary preview draft");
      if(!summaryBindingMatches(draft.binding,event,projection))return {status:"stale"};
      if(draft.generationHold?.length)return {status:"held"};
      assertSummaryText(draft.text);entries[draft.language]=draft;
    }
    return {status:"preview",localOnly:true,entries};
  }catch{return {status:"failed"};}
}
