import {createHash} from 'node:crypto';
import type {LocalV6Bundle} from './policy-v6-bundle';
export interface PrivateContextRow {
 recordKey:string;kind:'claim'|'tool'|'historical';name:string;decision:string;reviewState:'needs_review';
 originalRecord:Record<string,unknown>;originalRecordSha256:string;originalText:string;candidateText?:string;
 scope:string;reason:string;accessConditions?:string;
 evidenceRefs:{topicKey:string;groupId:string}[];
}
export interface PrivateRecordContext {schemaVersion:'uapt-private-record-context-v1';slug:string;inputSha256:string;rows:PrivateContextRow[]}
/** Frozen local context is readable but never enters reviewed claims, public tools or snapshots. */
export function validatePrivateRecordContext(view:LocalV6Bundle){
 const context=view.privateRecordContext;if(!context)return;
 if(view.publication||context.schemaVersion!=='uapt-private-record-context-v1'||context.slug!==view.school.slug||!/^[a-f0-9]{64}$/.test(context.inputSha256)||!Array.isArray(context.rows)||new Set(context.rows.map(r=>r.recordKey)).size!==context.rows.length)throw Error('Invalid private record context');
 for(const row of context.rows){
  const original=row.originalRecord;
  const candidateIdentity = row.kind === 'historical' && original.entitySlug === view.school.slug &&
    original.artifactType === 'claim_candidate' && typeof original.runId === 'string' &&
    typeof original.claimId === 'string' && row.recordKey === `candidate-claim:${original.runId}:${original.claimId}`;
  if(row.kind==='claim' && typeof original.id==='string' && view.claims.some(claim=>claim.id===original.id))throw Error('Candidate overlaps reviewed Claim ID');
  const text=typeof original.claimText==='string'?original.claimText:typeof original.description==='string'?original.description:JSON.stringify(original);
  if((!row.recordKey.includes(`:${view.school.slug}:`)&&!candidateIdentity)||!['claim','tool','historical'].includes(row.kind)||row.reviewState!=='needs_review'||!row.name||!row.decision||!row.reason||row.originalText!==text||row.originalRecordSha256!==createHash('sha256').update(JSON.stringify(original)).digest('hex')||!Array.isArray(row.evidenceRefs))throw Error('Invalid private context object binding');
  for(const ref of row.evidenceRefs){const topic=[...view.school.topics,...view.school.additionalTopics].find(t=>t.key===ref.topicKey);if(!topic?.claims.some(g=>g.id===ref.groupId))throw Error('Invalid private context evidence reference');}
 }
}
