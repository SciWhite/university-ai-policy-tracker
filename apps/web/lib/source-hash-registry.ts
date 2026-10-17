export type SourceHashKind = 'raw_captured_bytes' | 'extracted_text_utf8' | 'unknown_legacy';
export interface SourceHashBinding {
  sourceUrl: string;
  snapshotHash: string;
  hashKind: SourceHashKind;
  rawSha256?: string;
  textSha256?: string;
  verification?: string;
  unresolvedReason?: string;
}
export interface SourceHashRegistry {
  schemaVersion: 'uapt-source-hash-registry-v1';
  entries: SourceHashBinding[];
}
const sha256 = /^[a-f0-9]{64}$/;
/** Append captured versions; a later package must not erase historical provenance. */
export function mergeSourceHashRegistry(previous: SourceHashRegistry, incoming: SourceHashBinding[]): SourceHashRegistry {
  if (previous.schemaVersion !== 'uapt-source-hash-registry-v1') throw Error('Invalid source hash registry');
  const entries = new Map<string, SourceHashBinding>();
  for (const binding of [...previous.entries, ...incoming]) {
    if (!/^https?:\/\//.test(binding.sourceUrl) || !sha256.test(binding.snapshotHash) ||
      !['raw_captured_bytes','extracted_text_utf8','unknown_legacy'].includes(binding.hashKind) ||
      (binding.rawSha256 !== undefined && !sha256.test(binding.rawSha256)) ||
      (binding.textSha256 !== undefined && !sha256.test(binding.textSha256)) ||
      (binding.hashKind === 'raw_captured_bytes' && binding.rawSha256 !== binding.snapshotHash) ||
      (binding.hashKind === 'extracted_text_utf8' && binding.textSha256 !== binding.snapshotHash)) throw Error('Invalid source hash binding');
    const key = binding.sourceUrl + ':' + binding.snapshotHash;
    const old = entries.get(key);
    if (!old) {entries.set(key, {...binding}); continue;}
    for (const field of ['rawSha256','textSha256'] as const) {
      if (old[field] && binding[field] && old[field] !== binding[field]) throw Error('Conflicting historical source hash binding: ' + key);
    }
    if (old.hashKind !== 'unknown_legacy' && binding.hashKind !== 'unknown_legacy' && old.hashKind !== binding.hashKind) throw Error('Conflicting source representation: ' + key);
    // A fresh explicit binding may resolve a gap; unknown metadata cannot downgrade it.
    const resolved = binding.hashKind === 'unknown_legacy' ? old : binding;
    const merged = {...old, ...binding, ...resolved};
    if (merged.hashKind !== 'unknown_legacy') delete merged.unresolvedReason;
    entries.set(key, merged);
  }
  return {schemaVersion: 'uapt-source-hash-registry-v1', entries: [...entries.values()]};
}
