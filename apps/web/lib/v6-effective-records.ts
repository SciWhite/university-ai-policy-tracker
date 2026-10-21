import {createHash} from 'node:crypto';
import {publicEntitySummarySchema,policySnapshotSchema,universityToolRecordSchema,type PublicEntitySummary,type PolicySnapshot,type UniversityToolRecord} from '@uapt/shared';
import pointer from '../../../data/public-v6-records/current.json';
import revisions from '../../../data/public-v6-records/revisions.json';
import shardIndex from '../../../data/public-v6-records/sharded/index.json';
import {publishedV6Enabled} from './policy-v6-published-gate';
import {readPublishedV6Revision} from './policy-v6-published';
import {V6ArtifactStore, readVerifiedArtifact, v6PublicDataRoot, type ShardIndex} from './v6-artifact-store';
import {getLocalQACandidateRecords} from './v6-qa-candidate';
export interface RecordRevision {universityRevisionId:string;datasetReleaseId:string;recordSha256:string;publishedAt:string;baselineRevisionId?:string;previousRevisionId?:string}
export interface V6RecordPackage {schemaVersion:string;revision:string;publishedAt:string;datasetReleaseId:string;publicationApproved:true;parentRevisionId?:string;changeSummary?:{en:string;zh:string};summaries:PublicEntitySummary[];snapshots:Record<string,PolicySnapshot>;toolsBySlug:Record<string,UniversityToolRecord[]>;recordRevisions:Record<string,RecordRevision>;heldBySlug:Record<string,PublicEntitySummary['claims']>;historical:Record<string,{baseline:PublicEntitySummary;snapshot:PolicySnapshot|null;heldClaims:PublicEntitySummary['claims']}>;aliasesBySlug:Record<string,string[]>;changesBySlug:Record<string,{addedClaimIds:string[];updatedClaimIds:string[];heldClaimIds:string[]}>;analysisOverrides?:Record<string,{recordSha256:string;dimensions:Record<string,{claimIds:string[];status:string;summary:string}>}>}
const useShards=(revision:string)=>process.env.UAPT_V6_LEGACY_DATA!=='1'&&Object.hasOwn(shardIndex.revisions,revision);
const store=()=>new V6ArtifactStore(v6PublicDataRoot('public-v6-records'),shardIndex as ShardIndex,(value,path)=>{
  if(path[0]==='summaries')publicEntitySummarySchema.parse(value);
  if(path[0]==='snapshots')policySnapshotSchema.parse(value);
  if(path[0]==='toolsBySlug')(value as unknown[]).forEach(t=>universityToolRecordSchema.parse(t));
});
export function readV6RecordCorrections(){
  if (process.env.NODE_ENV === "development" && process.env.UAPT_LOCAL_QA_CANDIDATE_RECORDS) {
    const candidate = getLocalQACandidateRecords();
    if (candidate) return candidate;
  }
  return readV6RecordCorrectionRevision(pointer.revision);
}
/** No aggregate package is retained; fields are lazy per-school readers. */
export function readV6RecordCorrectionRevision(revision:string):V6RecordPackage|undefined{
 if(!publishedV6Enabled())return undefined;
 if (process.env.NODE_ENV === "development" && process.env.UAPT_LOCAL_QA_CANDIDATE_RECORDS) {
   const candidate = getLocalQACandidateRecords();
   if (candidate && candidate.revision === revision) return candidate;
 }
 const entry=(revisions as Record<string,{path:string;sha256:string}>)[revision];
 const selected=useShards(revision)?store().view<V6RecordPackage>(revision,entry?.sha256??(revision===pointer.revision?pointer.sha256:undefined)):entry?readVerifiedArtifact<V6RecordPackage>(v6PublicDataRoot('public-v6-records'),entry.path,entry.sha256,128*1024*1024):undefined;
 if(!selected)return undefined;
 const slugs=useShards(revision)?store().manifest(revision)!.scope:selected.summaries.map(s=>s.entity.slug);
 const pages=readPublishedV6Revision(revision);
 if(selected.schemaVersion!=='uapt-v6-effective-records-v1'||selected.publicationApproved!==true||selected.revision!==revision||slugs.join(',')!==[...(pages?.slugs??[]),...(pages?.v5Slugs??[])].join(','))throw Error('Invalid scoped record correction identity');
 if(!useShards(revision)){
  selected.summaries.forEach(s=>publicEntitySummarySchema.parse(s));
  Object.values(selected.snapshots).forEach(s=>policySnapshotSchema.parse(s));
  Object.values(selected.toolsBySlug).flat().forEach(t=>universityToolRecordSchema.parse(t));
 }
 return selected;
}
export function v6RecordSlugs(revision=pointer.revision):string[]{
 if(!publishedV6Enabled())return [];
 if (process.env.NODE_ENV === "development" && process.env.UAPT_LOCAL_QA_CANDIDATE_RECORDS) {
   const selected = readV6RecordCorrections();
   if (selected) return selected.summaries.map(s => s.entity.slug);
 }
 if(useShards(revision)){readV6RecordCorrectionRevision(revision);return [...store().manifest(revision)!.scope];}
 return readV6RecordCorrectionRevision(revision)?.summaries.map(s=>s.entity.slug)??[];
}
export function v6SummaryAtRevision(slug:string,revision?:string):PublicEntitySummary|undefined{
  const selected=readV6RecordCorrections();
  if(!selected)return undefined;
  const targetRevision = revision ?? selected.revision ?? pointer.revision;
  if(selected.revision === targetRevision) {
    const s = selected.summaries.find(s=>s.entity.slug===slug);
    if (s) return structuredClone(s);
  }
  const revPkg = readV6RecordCorrectionRevision(targetRevision);
  if(!revPkg)return undefined;
  return useShards(targetRevision)?store().field<PublicEntitySummary>(targetRevision,['summaries',slug]):structuredClone(revPkg.summaries.find(s=>s.entity.slug===slug));
}
export function v6CorrectedSummary(slug:string){
  const selected = readV6RecordCorrections();
  if (selected) {
    const s = selected.summaries.find(s=>s.entity.slug===slug);
    if (s) return structuredClone(s);
  }
  return v6SummaryAtRevision(slug);
}
export function v6RecordRevision(slug:string){return readV6RecordCorrections()?.recordRevisions[slug];}
export function v6CorrectedSnapshot(slug:string){return structuredClone(readV6RecordCorrections()?.snapshots[slug]);}
export function v6CorrectedTools(slug:string){return structuredClone(readV6RecordCorrections()?.toolsBySlug[slug]);}
export function v6ReviewedAnalysisOverride(summary:PublicEntitySummary, customPackage?: V6RecordPackage){
 const pin=(customPackage ?? readV6RecordCorrections())?.analysisOverrides?.[summary.entity.slug];
 if(!pin||createHash('sha256').update(JSON.stringify(summary)).digest('hex')!==pin.recordSha256)return undefined;
 return pin.dimensions;
}
export function applyV6RecordCorrections(summaries:PublicEntitySummary[]){
 const selected=new Set(v6RecordSlugs());
 return summaries.map(s=>selected.has(s.entity.slug)?v6CorrectedSummary(s.entity.slug)!:s);
}
/** Frozen baseline identity belongs to a school record, not its presentation cohort. */
export function v6BaselineRevision(slug:string,selected=readV6RecordCorrections()){return selected?.recordRevisions[slug]?.baselineRevisionId??(slug==='peking-university'?'baseline-pku-v5-20261014':'baseline-v6-pages-20261013');}
