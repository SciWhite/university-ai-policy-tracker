import index from '../../../data/public-v6-history/repairs/qs25-31-20261020/index.json';
import {readVerifiedArtifact,v6PublicDataRoot} from './v6-artifact-store';
import type {ChangeRecord} from './change-records';

/** Bounded, immutable display repair; original history and policy revisions stay intact. */
export function v6HistoryRepair(slug:string,revision:string):ChangeRecord|undefined {
  if(revision!==index.recordRevision)return undefined;
  const entry=(index.records as Record<string,{path:string;sha256:string}>)[slug];
  if(!entry)return undefined;
  const record=readVerifiedArtifact<ChangeRecord>(v6PublicDataRoot('public-v6-history'),entry.path,entry.sha256,4*1024*1024);
  if(record.slug!==slug||record.releaseId!==revision||record.publicationKind!=='scoped_record_correction')throw Error('History repair identity mismatch');
  return record;
}
