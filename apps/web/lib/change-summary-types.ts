import type {ChangeEvent} from "./change-events";
export const MAX_SUMMARY_ITEMS=128;
export const MAX_SUMMARY_BYTES=128*1024;
export type SummaryLanguage="en"|"zh";
export interface ChangeSummaryText {whatChanged:string;studentImpact:string;basisAndScope:string}
export interface SummaryBinding {
  projectionRevision:string;projectionSha256:string;basisSha256:string;rulesVersion:string;
  slug:string;eventId:string;fromRevision:string|null;toRevision:string;eventSha256:string;
  items:Array<{itemId:string;claimId?:string;category:string;themes:string[];oldTextSha256:string|null;newTextSha256:string|null;sourceUrls:string[];itemSha256:string}>;
}
export interface ChangeSummaryDraft {
  schemaVersion:"uapt-change-summary-draft-v1";binding:SummaryBinding;language:SummaryLanguage;
  generatedAt:string;generator:{kind:"ai";id:string};text:ChangeSummaryText;generationHold?:string[];
}
export const summaryReviewChecks=["trackerChangeOnly","scopePreserved","noNewPermission","heldPreserved","evidenceChecked","languageChecked"] as const;
export interface ChangeSummaryReview {
  schemaVersion:"uapt-change-summary-review-v1";decision:"approved"|"rejected";draftSha256:string;bindingSha256:string;
  reviewerId:string;reviewedAt:string;checks:Record<typeof summaryReviewChecks[number],boolean>;
}
export interface PublishedChangeSummary {
  schemaVersion:"uapt-reviewed-change-summary-v1";binding:SummaryBinding;language:SummaryLanguage;text:ChangeSummaryText;
  review:{draftSha256:string;reviewSha256:string;reviewedAt:string};
}
export interface ReviewedSummaryBundle {status:"ready";entries:Partial<Record<SummaryLanguage,PublishedChangeSummary>>}
export interface PreviewSummaryBundle {status:"preview";localOnly:true;entries:Partial<Record<SummaryLanguage,ChangeSummaryDraft>>}
export interface SummaryUnavailable {status:"missing"|"stale"|"failed"|"held"}
export type SummarySelection=ReviewedSummaryBundle|PreviewSummaryBundle|SummaryUnavailable;
export type SummaryChangeEvent=ChangeEvent&{studentSummary?:SummarySelection};
