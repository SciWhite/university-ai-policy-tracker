import pointer from '../../../data/public-v6-history/current.json';
import shardIndex from '../../../data/public-v6-history/sharded/index.json';
import {readV6RecordCorrections,v6RecordSlugs} from './v6-effective-records';
import {V6ArtifactStore,readVerifiedArtifact,v6PublicDataRoot,type ShardIndex} from './v6-artifact-store';
import {getLocalQACandidateHistory} from './v6-qa-candidate';
import type {ChangeRecord} from './change-records';

/**
 * Strict shape validation for frozen history records.
 * Fails closed on legacy object envelopes ({ baseline, revisions }), foreign slugs,
 * missing release IDs, or malformed record rows.
 */
export function validateFrozenHistory(slug: string, value: unknown): ChangeRecord[] {
  if (!Array.isArray(value)) {
    throw new Error(
      `Invalid frozen history payload for ${slug}: expected ChangeRecord array, got ${value && typeof value === 'object' ? 'object' : typeof value}`
    );
  }
  for (let i = 0; i < value.length; i++) {
    const row = value[i];
    if (!row || typeof row !== 'object' || Array.isArray(row)) {
      throw new Error(`Invalid frozen history row at index ${i} for ${slug}: expected object`);
    }
    const rec = row as Record<string, unknown>;
    if (typeof rec.slug === 'string') {
      if (rec.slug !== slug) {
        throw new Error(`Foreign slug in frozen history row at index ${i} for ${slug}: got "${rec.slug}"`);
      }
    } else if (i === 0) {
      throw new Error(`Missing or invalid slug in frozen history row at index ${i} for ${slug}: expected "${slug}"`);
    } else if (rec.slug === undefined) {
      // Older frozen rows may omit slug: the verified per-school shard supplies scope.
      // Preserve the original row and shared immutable cache; never add fields here.
    } else {
      throw new Error(`Invalid slug type in frozen history row at index ${i} for ${slug}: expected string`);
    }
    if (typeof rec.releaseId !== 'string' || !rec.releaseId.trim()) {
      throw new Error(`Missing or invalid releaseId in frozen history row at index ${i} for ${slug}`);
    }
    if (!Array.isArray(rec.diffRows)) {
      throw new Error(`Missing or invalid diffRows in frozen history row at index ${i} for ${slug}: expected array`);
    }
  }
  return value as ChangeRecord[];
}

/** Frozen per-school histories; no first-visitor global diff calculation or retained aggregate. */
export function v6FrozenHistory(slug:string): ChangeRecord[] | undefined {
 if(process.env.NODE_ENV==='development'){
  const qaHistory=getLocalQACandidateHistory();
  if(qaHistory){
   if(!qaHistory.records[slug])return undefined;
   return validateFrozenHistory(slug,qaHistory.records[slug]);
  }
 }
 const correction=readV6RecordCorrections();
 if(!correction||correction.revision!==pointer.basisRevision||!correction.recordRevisions[slug])return undefined;
 const root=v6PublicDataRoot('public-v6-history');
 if(process.env.UAPT_V6_LEGACY_DATA!=='1'&&Object.hasOwn(shardIndex.revisions,pointer.basisRevision)){
  const store=new V6ArtifactStore(root,shardIndex as ShardIndex);
  const manifest=store.manifest(pointer.basisRevision,pointer.sha256)!;
  const selected=store.view<{schemaVersion:string;basisRevision:string}>(pointer.basisRevision)!;
  if(selected.schemaVersion!=='uapt-bounded-public-history-v1'||selected.basisRevision!==pointer.basisRevision)throw Error('Invalid public history identity');
  if([...manifest.scope].sort().join(',')!==v6RecordSlugs().sort().join(','))throw Error('Invalid public history scope');
  const raw = store.field<unknown>(pointer.basisRevision,['records',slug]);
  return validateFrozenHistory(slug, raw);
 }
 const value=readVerifiedArtifact<{schemaVersion:string;basisRevision:string;records:Record<string,unknown>}>(root,pointer.path,pointer.sha256,128*1024*1024);
 if(value.schemaVersion!=='uapt-bounded-public-history-v1'||value.basisRevision!==pointer.basisRevision||Object.keys(value.records).sort().join(',')!==v6RecordSlugs().sort().join(','))throw Error('Invalid public history identity or scope');
 return validateFrozenHistory(slug, structuredClone(value.records[slug]));
}
