import {readFileSync, mkdirSync, existsSync, writeFileSync, realpathSync} from 'node:fs';
import {resolve, dirname, relative} from 'node:path';
import {execFileSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
import {V6ArtifactStore, type ShardIndex} from '../apps/web/lib/v6-artifact-store';
import {digest, exportV6Revision} from './export-v6-shards';
import {acceptV6Release} from './lib/v6-release-contract';
import type {PublishedV6Package} from '../apps/web/lib/policy-v6-published';
import type {V6RecordPackage} from '../apps/web/lib/v6-effective-records';
import type {SourceHashBinding} from '../apps/web/lib/source-hash-contract';
import {mergeSourceHashRegistry, type SourceHashRegistry} from '../apps/web/lib/source-hash-registry';

type Ref = {path: string; sha256: string};
export interface V6ReleaseInput {
  schemaVersion: 'uapt-v6-release-input-v1';
  pages: Ref; records: Ref; acceptance: Ref; syncLedger: Ref;
}
const hashPattern = /^[a-f0-9]{64}$/;
function rejectPrivate(value: unknown) {
  if (typeof value === 'string' && /(^|\s)(\.local\/|\/Users\/|\/home\/)/.test(value)) throw Error('Private path in public V6 input');
  if (Array.isArray(value)) return value.forEach(rejectPrivate);
  if (!value || typeof value !== 'object') return;
  for (const [key, item] of Object.entries(value)) {
    if (/^(rawPath|textPath|normalizedTextPath|sourceTextArtifact|privateKey|accessToken|apiKey|password)$/i.test(key) || (typeof item === 'string' && /(^|\s)(\.local\/|\/Users\/|\/home\/)/.test(item))) throw Error('Private material in public V6 input: ' + key);
    rejectPrivate(item);
  }
}

/** A staging-only packer. It never writes current pointers or edits its input packages. */
export function packV6Release(inputPath: string, inputSha256: string, output: string) {
  const base = dirname(realpathSync(inputPath));
  function read(ref: Ref) {
    if (!ref || !hashPattern.test(ref.sha256)) throw Error('Missing frozen V6 input identity');
    const path = realpathSync(resolve(base, ref.path));
    // Frozen bundles may refer to sibling receipts; paths stay private in the input manifest.
    const raw = readFileSync(path);
    if (digest(raw) !== ref.sha256) throw Error('Frozen V6 input changed: ' + ref.path);
    return {path, raw, value: JSON.parse(raw.toString())};
  }
  const input = read({path: inputPath, sha256: inputSha256}).value as V6ReleaseInput;
  if (input.schemaVersion !== 'uapt-v6-release-input-v1') throw Error('Invalid unified V6 release input');
  const pages = read(input.pages), records = read(input.records), acceptance = read(input.acceptance), ledger = read(input.syncLedger);
  rejectPrivate(pages.value); rejectPrivate(records.value);
  const coverage = acceptV6Release(pages.value as PublishedV6Package, records.value as V6RecordPackage);
  const a = acceptance.value;
  if (a.schemaVersion !== 'uapt-v6-packaging-acceptance-v1' || a.decision !== 'accepted_for_packaging' || a.pagesSha256 !== input.pages.sha256 || a.recordsSha256 !== input.records.sha256 || a.syncLedgerSha256 !== input.syncLedger.sha256) throw Error('Acceptance does not bind these exact inputs');
  const bindings = a.sourceHashes as (SourceHashBinding & {unresolvedReason?: string})[];
  if (!Array.isArray(bindings)) throw Error('Explicit source hash kinds required');
  rejectPrivate(bindings);
  const bindingFields = new Set(['sourceUrl','snapshotHash','hashKind','rawSha256','textSha256','verification','unresolvedReason']);
  if (bindings.some(binding => Object.keys(binding).some(key => !bindingFields.has(key)))) throw Error('Unexpected non-public hash binding field');
  const keys = bindings.map(b => b.sourceUrl+':'+b.snapshotHash);
  if (new Set(keys).size !== keys.length) throw Error('Duplicate hash representation binding');
  for (const b of bindings) {
    if (!hashPattern.test(b.snapshotHash) || (b.rawSha256 !== undefined && !hashPattern.test(b.rawSha256)) || (b.textSha256 !== undefined && !hashPattern.test(b.textSha256)) || !/^https?:\/\//.test(b.sourceUrl) || !['raw_captured_bytes','extracted_text_utf8','unknown_legacy'].includes(b.hashKind) ||
      (b.hashKind === 'raw_captured_bytes' && b.rawSha256 !== b.snapshotHash) ||
      (b.hashKind === 'extracted_text_utf8' && b.textSha256 !== b.snapshotHash) ||
      (b.hashKind === 'unknown_legacy' && !b.unresolvedReason)) throw Error('Unspecified or conflicting source hash representation');
  }
  const required = new Set<string>();
  for (const s of (records.value as V6RecordPackage).summaries) {
    for (const source of s.officialSources) required.add(source.sourceUrl+':'+source.snapshotHash);
    for (const e of s.claims.flatMap(c => c.evidence)) {
      required.add(e.sourceUrl+':'+e.sourceSnapshotHash);
      required.add(e.attribution.sourceUrl+':'+e.attribution.snapshotHash);
    }
  }
  if (keys.length !== required.size || keys.some(k => !required.has(k))) throw Error('Incomplete source hash contract coverage');
  const previousProvenance = readFileSync(resolve('data/source-hash-provenance.json'));
  const mergedProvenance = mergeSourceHashRegistry(JSON.parse(previousProvenance.toString()) as SourceHashRegistry, bindings);
  if (ledger.value.syncContractVersion !== '2.0.0') throw Error('Synchronization contract 2.0.0 required');
  execFileSync('python3', [resolve('scripts/policy-inventory.py'), 'sync-gate', ledger.path, '--phase', 'candidate'], {stdio: 'pipe'});
  if (digest(readFileSync(ledger.path)) !== input.syncLedger.sha256) throw Error('Synchronization ledger changed during validation');
  const requested = resolve(output);
  const target = resolve(realpathSync(dirname(requested)), requested.split('/').at(-1)!);
  const dataRoot = realpathSync(resolve('data'));
  if (existsSync(target) || !relative(dataRoot, target).startsWith('..')) throw Error('Use a NEW isolated staging directory outside tracked data');
  mkdirSync(target, {recursive:true});
  exportV6Revision(resolve(target,'public-v6-pages'), 'public-v6-pages', pages.value.releaseId, pages.raw);
  exportV6Revision(resolve(target,'public-v6-records'), 'public-v6-records', records.value.revision, records.raw);
  for (const [family, original] of [['public-v6-pages', pages], ['public-v6-records', records]] as const) {
    const root = resolve(target, family);
    const index = JSON.parse(readFileSync(resolve(root, 'sharded/index.json'), 'utf8')) as ShardIndex;
    const restored = new V6ArtifactStore(root, index).view(records.value.revision);
    if (JSON.stringify(restored) !== JSON.stringify(original.value)) throw Error('Packed V6 readback differs');
  }
  const provenance = JSON.stringify(mergedProvenance,null,2)+'\n';
  writeFileSync(resolve(target,'source-hash-provenance.json'), provenance, {flag:'wx'});
  const receipt = {previousSourceHashRegistrySha256:digest(previousProvenance), sourceHashProvenanceSha256: digest(Buffer.from(provenance)), reconstructedIdentically:true, schemaVersion:'uapt-v6-packaging-receipt-v1', inputSha256, pagesSha256:input.pages.sha256, recordsSha256:input.records.sha256, acceptanceSha256:input.acceptance.sha256, syncLedgerSha256:input.syncLedger.sha256, ...coverage, currentPointerSelected:false, semanticApprovalGranted:false, publicationPerformed:false};
  writeFileSync(resolve(target,'receipt.json'), JSON.stringify(receipt,null,2)+'\n', {flag:'wx'});
  return receipt;
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  if (args.length !== 6 || args[0] !== '--input' || args[2] !== '--sha256' || args[4] !== '--output') throw Error('Use --input <frozen-paired-input> --sha256 <input-byte-hash> --output <new-isolated-directory>');
  process.stdout.write(JSON.stringify(packV6Release(resolve(args[1]), args[3], args[5]))+'\n');
}
