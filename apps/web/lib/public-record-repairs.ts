import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {publicEntitySummarySchema, type PublicEntitySummary} from '@uapt/shared';
import {reviewedClaimsFingerprint} from './index-recovery-basis';

// Explicit reviewed scope. This is not a loader for private crawl candidates.
export const repairedUniversitySlugs = ['massachusetts-institute-of-technology'] as const;
export function isRepairedUniversity(slug: string) {
  return (repairedUniversitySlugs as readonly string[]).includes(slug);
}

export async function applyPublishedRecordRepairs(repoRoot: string, summaries: PublicEntitySummary[]) {
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
  return summaries.map(s => s.entity.slug === manifest.slug ? repaired : s);
}
