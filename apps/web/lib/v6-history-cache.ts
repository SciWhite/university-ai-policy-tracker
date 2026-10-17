import pointer from '../../../data/public-v6-history/current.json';
import shardIndex from '../../../data/public-v6-history/sharded/index.json';
import {readV6RecordCorrections,v6RecordSlugs} from './v6-effective-records';
import {V6ArtifactStore,readVerifiedArtifact,v6PublicDataRoot,type ShardIndex} from './v6-artifact-store';
import type {ChangeRecord} from './change-records';
/** Frozen per-school histories; no first-visitor global diff calculation or retained aggregate. */
export function v6FrozenHistory(slug:string){
 const correction=readV6RecordCorrections();
 if(!correction||correction.revision!==pointer.basisRevision||!correction.recordRevisions[slug])return undefined;
 const root=v6PublicDataRoot('public-v6-history');
 if(process.env.UAPT_V6_LEGACY_DATA!=='1'&&Object.hasOwn(shardIndex.revisions,pointer.basisRevision)){
  const store=new V6ArtifactStore(root,shardIndex as ShardIndex);
  const manifest=store.manifest(pointer.basisRevision,pointer.sha256)!;
  const selected=store.view<{schemaVersion:string;basisRevision:string}>(pointer.basisRevision)!;
  if(selected.schemaVersion!=='uapt-bounded-public-history-v1'||selected.basisRevision!==pointer.basisRevision)throw Error('Invalid public history identity');
  if([...manifest.scope].sort().join(',')!==v6RecordSlugs().sort().join(','))throw Error('Invalid public history scope');
  return store.field<ChangeRecord[]>(pointer.basisRevision,['records',slug]);
 }
 const value=readVerifiedArtifact<{schemaVersion:string;basisRevision:string;records:Record<string,ChangeRecord[]>}>(root,pointer.path,pointer.sha256,128*1024*1024);
 if(value.schemaVersion!=='uapt-bounded-public-history-v1'||value.basisRevision!==pointer.basisRevision||Object.keys(value.records).sort().join(',')!==v6RecordSlugs().sort().join(','))throw Error('Invalid public history identity or scope');
 return structuredClone(value.records[slug]);
}
