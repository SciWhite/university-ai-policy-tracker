import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {publicEntitySummarySchema, type PublicEntitySummary} from '@uapt/shared';
import {readRecordCorrectionChanges, readCorrectionChangeCache} from './record-correction-changes';
import {reviewedClaimsFingerprint} from './index-recovery-basis';

// Explicit reviewed scope. This is not a loader for private crawl candidates.
export const repairedUniversitySlugs = ['massachusetts-institute-of-technology', 'imperial-college-london'] as const;
export function isRepairedUniversity(slug: string) {
  return (repairedUniversitySlugs as readonly string[]).includes(slug);
}

export async function applyPublishedRecordRepairs(repoRoot: string, summaries: PublicEntitySummary[]) {
  await readRecordCorrectionChanges(repoRoot);
  await readCorrectionChangeCache("index.json");
  const bytes = await readFile(path.join(repoRoot, 'data/public-record-repairs/mit-20261010/record.json'));
  const manifest = JSON.parse(await readFile(path.join(repoRoot, 'data/public-record-repairs/current.json'), 'utf8'));
  if (manifest.schemaVersion !== 'uapt-public-record-repairs-v1' || manifest.publicationApproved !== true ||
      manifest.slug !== repairedUniversitySlugs[0] || manifest.recordSha256 !== createHash('sha256').update(bytes).digest('hex')) {
    throw new Error('Invalid published record repair');
  }
  const repaired = publicEntitySummarySchema.parse(JSON.parse(bytes.toString()));
  if (repaired.entity.slug !== manifest.slug || repaired.entitySlug !== manifest.slug) throw new Error('Repair scope mismatch');
  const base = summaries.find(s => s.entity.slug === manifest.slug);
  if (!base || reviewedClaimsFingerprint(base.claims) !== manifest.baselineClaimsFingerprint) {
    throw new Error('Record repair baseline changed; independent revalidation required');
  }
  const originalIds = new Set(base.claims.map(c => c.id));
  if ([...originalIds].some(id => !repaired.claims.some(c => c.id === id))) throw new Error('Repair silently dropped a historical claim');
  if (new Set(repaired.claims.map(c => c.id)).size !== repaired.claims.length) throw new Error('Duplicate repaired claim');
  const withMit = summaries.map(s => s.entity.slug === manifest.slug ? repaired : s);
  try { await readFile(path.join(repoRoot, 'data/public-record-repairs/imperial-current.json')); } catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return withMit; throw error; }
  return applyImperialPublishedRepair(repoRoot, withMit);
}


export type RepairAnalysisContext = {
  revision: string;
  publicationApproved: boolean;
  fingerprint: string;
  dimensions: Record<string, {status: string; claimIds: string[]; summary: string}>;
};
const contexts = new WeakMap<PublicEntitySummary, RepairAnalysisContext>();
const claimsDigest = (summary: PublicEntitySummary) => createHash('sha256').update(JSON.stringify(summary.claims)).digest('hex');
export function getRepairAnalysisContext(summary: PublicEntitySummary): RepairAnalysisContext | undefined {
  const context = contexts.get(summary);
  if (context && context.fingerprint !== claimsDigest(summary)) throw new Error('Repair analysis basis changed; revalidation required');
  return context;
}
function safeRevision(revision: string) {
  if (!/^imperial-(?:candidate-)?[a-z0-9-]+$/.test(revision)) throw new Error('Unsafe Imperial repair revision');
  return revision;
}
export async function loadImperialRepair(repoRoot: string, revision: string, publicationApproved: boolean) {
  const dir = path.join(repoRoot, 'data/public-record-repairs', safeRevision(revision));
  const [recordBytes, analysisBytes, snapshotBytes, manifestBytes] = await Promise.all([
    readFile(path.join(dir, 'record.json')), readFile(path.join(dir, 'analysis-dimensions.json')),
    readFile(path.join(dir, 'candidate-student-snapshot.json')), readFile(path.join(dir, 'candidate-manifest.json'))
  ]);
  const manifest = JSON.parse(manifestBytes.toString());
  const hash = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex');
  if (manifest.schemaVersion !== 'uapt-public-record-repairs-v1' || manifest.slug !== 'imperial-college-london' ||
      manifest.revision !== revision || manifest.publicationApproved !== publicationApproved ||
      manifest.recordSha256 !== hash(recordBytes) || manifest.analysisSha256 !== hash(analysisBytes) ||
      manifest.snapshotSha256 !== hash(snapshotBytes)) throw new Error('Imperial repair artifact identity mismatch');
  const repaired = publicEntitySummarySchema.parse(JSON.parse(recordBytes.toString()));
  if (repaired.entity.slug !== manifest.slug || repaired.entitySlug !== manifest.slug ||
      new Set(repaired.claims.map(c => c.id)).size !== repaired.claims.length) throw new Error('Invalid Imperial repair scope');
  if (!publicationApproved && repaired.claims.some(c => c.reviewState !== 'needs_review')) throw new Error('Candidate review state must remain held');
  if (publicationApproved && (manifest.independentAcceptance !== 'passed' || repaired.claims.some(c => !['agent_reviewed','human_reviewed'].includes(c.reviewState)))) throw new Error('Published repair lacks reviewed claims');
  const dimensions = JSON.parse(analysisBytes.toString()) as RepairAnalysisContext['dimensions'];
  contexts.set(repaired, {revision, publicationApproved, fingerprint:claimsDigest(repaired), dimensions});
  return {repaired, manifest, snapshot:JSON.parse(snapshotBytes.toString())};
}
function replaceImperial(summaries: PublicEntitySummary[], repaired: PublicEntitySummary, manifest: any) {
  const base = summaries.find(s => s.entity.slug === manifest.slug);
  if (!base || reviewedClaimsFingerprint(base.claims) !== manifest.baselineClaimsFingerprint) throw new Error('Imperial repair baseline changed');
  if (base.claims.some(c => !repaired.claims.some(r => r.id === c.id))) throw new Error('Imperial repair dropped a historical Claim ID');
  return summaries.map(s => s.entity.slug === manifest.slug ? repaired : s);
}
async function applyImperialPublishedRepair(repoRoot: string, summaries: PublicEntitySummary[]) {
  const pin = JSON.parse(await readFile(path.join(repoRoot, 'data/public-record-repairs/imperial-current.json'), 'utf8'));
  const loaded = await loadImperialRepair(repoRoot, pin.revision, true);
  if (pin.recordSha256 !== loaded.manifest.recordSha256 || pin.analysisSha256 !== loaded.manifest.analysisSha256 || pin.snapshotSha256 !== loaded.manifest.snapshotSha256) throw new Error('Published Imperial pin mismatch');
  return replaceImperial(summaries, loaded.repaired, loaded.manifest);
}
export const candidateRepairSlugs = ['imperial-college-london'] as const;
export function isCandidateRepairUniversity(slug: string) {
  return process.env.NODE_ENV !== 'production' && (candidateRepairSlugs as readonly string[]).includes(slug);
}
export function isCandidateRepairPreview(slug: string) {
  return isCandidateRepairUniversity(slug) && process.env.UAPT_CANDIDATE_REPAIR_SLUG === slug;
}
export async function loadCandidateRecordRepair(repoRoot: string, slug = 'imperial-college-london') {
  if (slug !== 'imperial-college-london' || process.env.NODE_ENV === 'production') throw new Error('Candidate repairs are local only');
  return loadImperialRepair(repoRoot, process.env.UAPT_CANDIDATE_REPAIR_REVISION || 'imperial-candidate-20261011-r3', false);
}
export async function applyCandidateRecordRepairs(repoRoot: string, summaries: PublicEntitySummary[], slug = 'imperial-college-london') {
  const loaded = await loadCandidateRecordRepair(repoRoot, slug);
  // A local candidate may replace the same already-reviewed published repair after validating its original baseline.
  const base = summaries.find(s => s.entity.slug === slug);
  if (base && getRepairAnalysisContext(base)?.publicationApproved) {
    if (base.claims.some(c => !loaded.repaired.claims.some(r => r.id === c.id))) throw new Error('Candidate dropped a published Claim ID');
    return summaries.map(s => s.entity.slug === slug ? loaded.repaired : s);
  }
  return replaceImperial(summaries, loaded.repaired, loaded.manifest);
}
