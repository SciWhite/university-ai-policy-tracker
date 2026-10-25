import {acceptedPresentationEvidence} from './policy-v6-presentation-evidence';
import {createHash} from 'node:crypto';
import type {LocalV6Bundle} from './policy-v6-bundle';
export interface PublicClaimDisposition {claimId:string;claimSha256:string;mode:'scoped_reference'|'historical_only'|'excluded_pending_review';scope:string;reason:string;historyHref:string}
const sha=(v:unknown)=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
/** Complete canonical records remain available; only explicitly selected references enter conclusions. */
export function validatePublicClaimDispositions(view:LocalV6Bundle){
 if(!view.claimDispositions)return;
 if(view.privateRecordContext||view.localReferenceGuide||view.localChangeProposals||view.workflowHolds||view.heldDraftIds||view.auditCoverage||view.remainingRecordKeys?.length)throw Error("Private audit context in public Claim presentation");
 const rows=view.claimDispositions,claims=new Map(view.claims.map(c=>[c.id,c]));
 if(rows.length!==claims.size||new Set(rows.map(r=>r.claimId)).size!==rows.length)throw Error('Incomplete public Claim disposition set');
 for(const r of rows){const c=claims.get(r.claimId);if(!c||r.claimSha256!==sha(c)||!r.scope||!r.reason||r.historyHref!==`/changes/${view.school.slug}`||!['scoped_reference','historical_only','excluded_pending_review'].includes(r.mode))throw Error('Invalid public Claim disposition binding');}
 const allowed=new Set(rows.filter(r=>r.mode==='scoped_reference').map(r=>r.claimId));
 const guide=view.publicReferenceGuide;
 if(guide&&[...Object.values(guide.topics).flat(),...guide.submissionClaimIds].some(id=>!allowed.has(id)))throw Error('Excluded Claim entered public reference guide');
 for(const t of [...view.school.topics,...view.school.additionalTopics])for(const g of t.claims)if(claims.has(g.id)&&!allowed.has(g.id))throw Error('Excluded Claim entered current topic');
 if(view.analysisProjection?.profile.dimensions.some(d=>d.evidenceClaimIds.some(id=>!allowed.has(id))))throw Error('Excluded Claim entered Analysis');
 if(view.studentActions&&[...view.studentActions.do,...view.studentActions.dont].some(a=>a.claimIds.some(id=>!allowed.has(id)&&!(view.studentActions?.claims[id]?.basisObjectType==='presentation_evidence'&&acceptedPresentationEvidence(view))&&!(view.candidateOnly===true&&view.publicationApproved===false&&!view.publication&&view.studentActions?.claims[id]?.basisObjectType==='private_evidence'))))throw Error('Excluded Claim entered student actions');
}
export function currentReferenceClaims(view:LocalV6Bundle){const modes=new Map(view.claimDispositions?.map(r=>[r.claimId,r.mode]));return view.claims.filter(c=>!modes.size||modes.get(c.id??'')==='scoped_reference');}
