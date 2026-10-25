import {createHash} from 'node:crypto';
import type {LocalV6Bundle} from './policy-v6-bundle';
export interface PresentationEvidenceAcceptance {
 schemaVersion:'uapt-v6-presentation-evidence-acceptance-v1';
 canonicalRecordSha256:string;contentSha256:string;evidenceSha256:string;
 reviewer:string;reviewedAt:string;scope:'presentation_only';
}
/** Binds all topic quotations, scope and locations, including evidence outside actions. */
export function presentationEvidenceHash(view:LocalV6Bundle){
 return createHash('sha256').update(JSON.stringify([...view.school.topics,...view.school.additionalTopics].map(t=>({key:t.key,scope:t.evidenceScope??t.scope,claims:t.claims,sources:t.sources,evidenceGap:t.evidenceGap??null})))).digest('hex');
}
export function acceptedPresentationEvidence(view:LocalV6Bundle){
 const a=view.presentationEvidenceAcceptance,p=view.editorialProjection;
 const contentSha256=createHash('sha256').update(JSON.stringify({slug:view.school.slug,recordSha256:view.school.fingerprint,topicSummaries:view.topicSummaries,topicScopes:view.topicScopes,studentActions:view.studentActions})).digest('hex');
 return Boolean(a&&view.publication&&view.candidateOnly!==true&&view.publicationApproved===false&&
  a.schemaVersion==='uapt-v6-presentation-evidence-acceptance-v1'&&a.scope==='presentation_only'&&
  a.canonicalRecordSha256===view.school.fingerprint&&a.contentSha256===p?.contentSha256&&
  a.contentSha256===contentSha256&&a.evidenceSha256===presentationEvidenceHash(view)&&a.reviewer&&Number.isFinite(Date.parse(a.reviewedAt))&&
  p?.reviewState==='accepted_presentation'&&p.acceptance?.contentSha256===a.contentSha256&&
  p.acceptance?.reviewer===a.reviewer&&p.acceptance?.reviewedAt===a.reviewedAt);
}
