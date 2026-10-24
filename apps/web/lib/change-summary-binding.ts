import {primaryChangeCategory} from "./change-event-rules";
import {createHash} from "node:crypto";
import {isDeepStrictEqual} from "node:util";
import type {ChangeEvent} from "./change-events";
import {MAX_SUMMARY_ITEMS,summaryReviewChecks,type SummaryBinding,type ChangeSummaryDraft,type ChangeSummaryReview,type PublishedChangeSummary} from "./change-summary-types";
export const summaryHash=(value:unknown)=>createHash("sha256").update(JSON.stringify(value)).digest("hex");
export const summaryTextHash=(text:string)=>createHash("sha256").update(text).digest("hex");
const hash=/^[a-f0-9]{64}$/;
export type SummaryProjection=Pick<SummaryBinding,"projectionRevision"|"projectionSha256"|"basisSha256"|"rulesVersion">;
export function bindChangeSummary(event:ChangeEvent,projection:SummaryProjection):SummaryBinding{
  const items=event.items.filter(item=>primaryChangeCategory(item.category));
  if(items.length<1||items.length>MAX_SUMMARY_ITEMS)throw Error("Summary requires 1–128 record items");
  if(event.rulesVersion!==projection.rulesVersion||event.id!==`${event.slug}:${event.revision}`||![projection.projectionSha256,projection.basisSha256].every(value=>hash.test(value)))throw Error("Summary projection identity mismatch");
  return {projectionRevision:projection.projectionRevision,projectionSha256:projection.projectionSha256,basisSha256:projection.basisSha256,rulesVersion:projection.rulesVersion,slug:event.slug,eventId:event.id,fromRevision:event.previousRevision??null,toRevision:event.revision,eventSha256:summaryHash(event),items:items.map(item=>({itemId:item.id,...(item.claimId?{claimId:item.claimId}:{}),category:item.category,themes:[...new Set(item.themes??[item.theme])].sort(),oldTextSha256:item.oldText===undefined?null:summaryTextHash(item.oldText),newTextSha256:item.newText===undefined?null:summaryTextHash(item.newText),sourceUrls:[...new Set(item.sourceUrls)].sort(),itemSha256:summaryHash(item)})).sort((a,b)=>a.itemId.localeCompare(b.itemId))};
}
export function summaryBindingMatches(binding:SummaryBinding,event:ChangeEvent,projection:SummaryProjection){
  try{return isDeepStrictEqual(binding,bindChangeSummary(event,projection));}catch{return false;}
}
export function assertSummaryText(value:ChangeSummaryDraft["text"]){
  if(!value||Object.keys(value).sort().join(",")!=="basisAndScope,studentImpact,whatChanged"||Object.values(value).some(text=>typeof text!=="string"||!text.trim()||text.length>1200||/[<>]/.test(text)))throw Error("Invalid or oversized summary text");
}
/** Engineering acceptance of a supplied independent review, never AI self-approval. */
export function acceptReviewedChangeSummary(draft:ChangeSummaryDraft,review:ChangeSummaryReview,event:ChangeEvent,projection:SummaryProjection,now=new Date()):PublishedChangeSummary{
  if(draft.schemaVersion!=="uapt-change-summary-draft-v1"||!["en","zh"].includes(draft.language)||draft.generator?.kind!=="ai"||!draft.generator.id||!summaryBindingMatches(draft.binding,event,projection))throw Error("Stale or invalid summary draft");
  if(draft.binding.items.some(item=>!item.sourceUrls.length))throw Error("Summary source URLs required for publication");
  if(draft.generationHold?.length)throw Error("Summary is held for source/Claim review");
  assertSummaryText(draft.text);
  if(review.schemaVersion!=="uapt-change-summary-review-v1"||review.decision!=="approved"||review.draftSha256!==summaryHash(draft)||review.bindingSha256!==summaryHash(draft.binding)||!review.reviewerId?.trim()||review.reviewerId.trim()===draft.generator.id.trim()||summaryReviewChecks.some(key=>review.checks?.[key]!==true))throw Error("Independent summary review required");
  const generated=Date.parse(draft.generatedAt),reviewed=Date.parse(review.reviewedAt);
  if(!Number.isFinite(generated)||!Number.isFinite(reviewed)||reviewed<generated||reviewed>now.getTime()+300000)throw Error("Invalid summary review chronology");
  return {schemaVersion:"uapt-reviewed-change-summary-v1",binding:draft.binding,language:draft.language,text:draft.text,review:{draftSha256:summaryHash(draft),reviewSha256:summaryHash(review),reviewedAt:review.reviewedAt}};
}
