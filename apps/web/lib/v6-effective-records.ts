import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {publicEntitySummarySchema,policySnapshotSchema,universityToolRecordSchema,type PublicEntitySummary,type PolicySnapshot,type UniversityToolRecord} from '@uapt/shared';
import pointer from '../../../data/public-v6-records/current.json';
import {publishedV6Enabled} from './policy-v6-published-gate';
export interface RecordRevision {universityRevisionId:string;datasetReleaseId:string;recordSha256:string;publishedAt:string}
interface Package {schemaVersion:string;revision:string;publishedAt:string;datasetReleaseId:string;publicationApproved:true;summaries:PublicEntitySummary[];snapshots:Record<string,PolicySnapshot>;toolsBySlug:Record<string,UniversityToolRecord[]>;recordRevisions:Record<string,RecordRevision>;heldBySlug:Record<string,PublicEntitySummary['claims']>;historical:Record<string,{baseline:PublicEntitySummary;snapshot:PolicySnapshot|null;heldClaims:PublicEntitySummary['claims']}>;aliasesBySlug:Record<string,string[]>;changesBySlug:Record<string,{addedClaimIds:string[];updatedClaimIds:string[];heldClaimIds:string[]}>}
let cached:Package|undefined;
export function readV6RecordCorrections(){
 if(!publishedV6Enabled())return undefined;
 if(!cached){const root=resolve(process.cwd(),process.cwd().endsWith('/apps/tulsa-zone')||process.cwd().endsWith('/apps/web')?'../../data/public-v6-records':'data/public-v6-records');const file=resolve(root,pointer.path);if(!file.startsWith(root+'/'))throw Error('Invalid record correction path');const bytes=readFileSync(file);if(createHash('sha256').update(bytes).digest('hex')!==pointer.sha256)throw Error('Changed scoped record correction artifact');const j=JSON.parse(bytes.toString())as Package;if(j.schemaVersion!=='uapt-v6-effective-records-v1'||j.publicationApproved!==true||j.revision!==pointer.revision||j.summaries.map(s=>s.entity.slug).join(',')!==pointer.slugs.join(','))throw Error('Invalid scoped record correction identity');j.summaries=j.summaries.map(s=>publicEntitySummarySchema.parse(s));for(const s of Object.values(j.snapshots))policySnapshotSchema.parse(s);for(const list of Object.values(j.toolsBySlug))list.forEach(t=>universityToolRecordSchema.parse(t));cached=j;}
 return cached;
}
export function v6CorrectedSummary(slug:string){const s=readV6RecordCorrections()?.summaries.find(s=>s.entity.slug===slug);return s?structuredClone(s):undefined;}
export function v6RecordRevision(slug:string){return readV6RecordCorrections()?.recordRevisions[slug];}
export function v6CorrectedSnapshot(slug:string){const s=readV6RecordCorrections()?.snapshots[slug];return s?structuredClone(s):undefined;}
export function applyV6RecordCorrections(summaries:PublicEntitySummary[]){const c=readV6RecordCorrections();if(!c)return summaries;const bySlug=new Map(c.summaries.map(s=>[s.entity.slug,s]));return summaries.map(s=>bySlug.get(s.entity.slug)??s);}
