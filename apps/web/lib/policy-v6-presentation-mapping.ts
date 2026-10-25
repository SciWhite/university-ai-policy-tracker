import {editorialContentHash,validateV6EditorialProjection} from './policy-v6-editorial-projection';
import {presentationEvidenceHash,type PresentationEvidenceAcceptance} from './policy-v6-presentation-evidence';
import {validatePublicClaimDispositions} from './policy-v6-claim-disposition';
import type {LocalV6Bundle} from './policy-v6-bundle';
/** Preparation changes representation only. It supplies no independent acceptance. */
export function preparePresentationEvidence(view:LocalV6Bundle,revision:string){
 if(!revision||view.candidateOnly!==true||view.publication||view.editorialProjection?.reviewState!=='pending_independent_presentation_review')throw Error('Expected frozen unpublished editorial candidate');
 validateV6EditorialProjection(view);validatePublicClaimDispositions(view);
 const target=structuredClone(view);delete target.candidateOnly;
 target.school.revision=revision;target.studentActions!.universityRevisionId=revision;
 target.publication={releaseId:revision,kind:'v6_presentation_integration'};
 for(const row of Object.values(target.studentActions!.claims))if(row.basisObjectType==='private_evidence')row.basisObjectType='presentation_evidence';
 target.editorialProjection!.contentSha256=editorialContentHash(target);
 return {target,requiredAcceptance:{schemaVersion:'uapt-v6-presentation-evidence-acceptance-v1' as const,canonicalRecordSha256:target.school.fingerprint,contentSha256:target.editorialProjection!.contentSha256,evidenceSha256:presentationEvidenceHash(target),scope:'presentation_only' as const}};
}
/** The release owner supplies an independently reviewed exact-target receipt. */
export function acceptPresentationEvidence(view:LocalV6Bundle,revision:string,acceptance:PresentationEvidenceAcceptance){
 const {target,requiredAcceptance}=preparePresentationEvidence(view,revision);
 for(const [k,v]of Object.entries(requiredAcceptance))if(acceptance?.[k as keyof PresentationEvidenceAcceptance]!==v)throw Error('Independent receipt target drift: '+k);
 if(!acceptance.reviewer||!Number.isFinite(Date.parse(acceptance.reviewedAt)))throw Error('Independent reviewer/date required');
 target.presentationEvidenceAcceptance=structuredClone(acceptance);
 target.editorialProjection!.reviewState='accepted_presentation';
 target.editorialProjection!.acceptance={contentSha256:acceptance.contentSha256,reviewer:acceptance.reviewer,reviewedAt:acceptance.reviewedAt,scope:'presentation_only'};
 validatePublicClaimDispositions(target);validateV6EditorialProjection(target);return target;
}
