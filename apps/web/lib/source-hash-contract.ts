import type {PublicEntitySummary, SourceAttribution} from '@uapt/shared';
import registry from '../../../data/source-hash-provenance.json';
import type {SourceHashKind, SourceHashBinding} from './source-hash-registry';
export type {SourceHashKind, SourceHashBinding} from './source-hash-registry';
export function sourceHashBinding(source: Pick<SourceAttribution, 'sourceUrl' | 'snapshotHash'>): SourceHashBinding {
  const entry = registry.entries.find(e => e.sourceUrl === source.sourceUrl && e.snapshotHash === source.snapshotHash);
  return entry ? {...entry, hashKind: entry.hashKind as SourceHashKind} : {...source, hashKind: 'unknown_legacy'};
}
export function sourceHashContract(summary: PublicEntitySummary) {
  // Key by URL AND captured version: neither a hostname nor a hash alone is identity.
  const sources = new Map<string, SourceHashBinding>();
  for (const s of [...summary.officialSources, ...summary.claims.flatMap(c => c.evidence.map(e => ({sourceUrl:e.sourceUrl,snapshotHash:e.sourceSnapshotHash})))]) sources.set(s.sourceUrl+':'+s.snapshotHash, sourceHashBinding({sourceUrl:s.sourceUrl,snapshotHash:s.snapshotHash}));
  return {
    schemaVersion: 'uapt-source-hash-contract-v1', algorithm: 'sha256',
    appliesTo: ['officialSources[].snapshotHash', 'claims[].evidence[].sourceSnapshotHash', 'claims[].evidence[].attribution.snapshotHash'],
    definitions: {
      raw_captured_bytes: 'SHA-256 of the retained capture file bytes, not necessarily HTTP wire or compressed response bytes.',
      extracted_text_utf8: 'SHA-256 of the retained extracted text encoded as UTF-8. Extraction and normalization are capture-specific; not an HTML/PDF byte hash.',
      unknown_legacy: 'The retained public record does not establish the representation. Do not assume raw bytes or infer kind from a quote locator.',
      recordFingerprint: 'A separate digest of serialized policy-record JSON; not a source snapshot hash.',
      approval: 'A matching hash establishes identity only, not policy accuracy, currentness, scope or review approval.'
    },
    sources: [...sources.values()]
  };
}
/** Additive envelope metadata: canonical records and their review fingerprints stay unchanged. */
export function withSourceHashContract<T extends object>(response: T, summary: PublicEntitySummary) {
  return {...response, sourceHashContract: sourceHashContract(summary)};
}
