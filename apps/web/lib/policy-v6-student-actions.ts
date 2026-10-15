import {createHash} from 'node:crypto';
import registry from '../../../data/policy-v6-student-actions.json';
import {readV6RecordCorrections} from './v6-effective-records';
import type {LabSchool} from './policy-v6';
import procedureSupplements from './enforcement-v4-refresh-data.json';

export type StudentActionKind = 'requirement' | 'source_guidance' | 'site_advice';
export interface StudentAction {en:string;zh:string;kind:StudentActionKind;claimIds:string[]}
export interface StudentGuideClaim {
 id:string;text:string;claimType:string;
 summaryZh?:string;basisObjectType?:'published_supplement';scope?:string;
 deadline?:{en:string;zh:string;quote:string;url:string};
 evidence:{quote:string;url:string;language:string;hash:string;location:string}[];
}
export interface V6StudentActions {
 slug?:string;experience?:'compact_evidence';presentationRevision?:string;
 topics?:Record<string,{en:string;zh:string;meaningEn:string;meaningZh:string}>;
 name:string;recordSha256:string;schoolFingerprint:string;universityRevisionId:string;
 do:StudentAction[];dont:StudentAction[];
 procedures:Record<'investigation'|'outcomes'|'appeal',string[]>;
 scope:{en:string;zh:string};claims:Record<string,StudentGuideClaim>;
 images:{src:string;sha256:string;alt:{en:string;zh:string}}[];
}
/** A newly reviewed projection, never an automatic re-pin of old illustration approvals. */
export function getV6StudentActions(school:LabSchool):V6StudentActions|undefined {
 const guide=(registry.schools as Record<string,V6StudentActions>)[school.slug];
 if(!guide)return undefined;
 const published=readV6RecordCorrections();
 const summary=published?.summaries.find(s=>s.entity.slug===school.slug);
 if(!summary||guide.schoolFingerprint!==school.fingerprint||guide.recordSha256!==published?.recordRevisions[school.slug]?.recordSha256||guide.recordSha256!==createHash('sha256').update(JSON.stringify(summary)).digest('hex'))return undefined;
 for(const row of Object.values(guide.claims)){
  if(row.basisObjectType==='published_supplement'){
   const fact=procedureSupplements['massachusetts-institute-of-technology'].find(f=>f.id===row.id);
   if(!fact||fact.statement!==row.text||fact.evidence.length!==row.evidence.length||fact.evidence.some((e,i)=>e.quote!==row.evidence[i].quote||e.sourceUrl!==row.evidence[i].url||e.sourceSnapshotHash!==row.evidence[i].hash))return undefined;
   continue;
  }
  const claim=summary.claims.find(c=>c.id===row.id);
  if(!claim||!['agent_reviewed','human_reviewed'].includes(claim.reviewState)||claim.claimText!==row.text||JSON.stringify(claim.evidence.map(e=>({quote:e.evidenceSnippet,url:e.sourceUrl,language:e.sourceLanguage,hash:e.sourceSnapshotHash,location:e.snippetLocation??''})))!==JSON.stringify(row.evidence))return undefined;
 }
 if([...guide.do,...guide.dont].some(action=>!action.claimIds.length||action.claimIds.some(id=>!guide.claims[id]))||Object.values(guide.procedures).flat().some(id=>!guide.claims[id]))return undefined;
 return structuredClone(guide);
}
