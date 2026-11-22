// S4 freeze one review packet per school against the parent release. Public claims stay exactly the canonical
// record; the V6 presentation adds topics, actions and tools from the captured official excerpts. Refuses unless the
// locale gate (G3) passed. mode "add" freezes new V6 schools; mode "update" re-freezes listed V6 schools against a
// parent that already has them. Output: <reviewDir>/<slug>.json + manifest.json for the independent agent review.
//   tsx --tsconfig apps/web/tsconfig.json scripts/v6-pipeline/packets.ts --workspace <dir>
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { publicEntitySummarySchema, universityToolRecordSchema } from '../../packages/shared/src/index';
import { getStagedPublicDataset } from '../../apps/web/lib/staged-public-data';
import { editorialContentHash } from '../../apps/web/lib/policy-v6-editorial-projection';
import { preparePresentationEvidence } from '../../apps/web/lib/policy-v6-presentation-mapping';
import { acceptV6SchoolInput } from '../../apps/web/lib/policy-v6-input';
import { validateV6Completeness } from '../../apps/web/lib/policy-v6-completeness';
import { selectTree } from '../../scripts/content-release/lib';
import { loadBatch, requireGatePassed, workspaceFromArgv } from './batch';

const { ws: P } = workspaceFromArgv();
const BATCH = loadBatch(P);
const PARENT = BATCH.parentRelease;
const SLUGS = BATCH.schools.map(school => school.slug);
const OUT = P + '/' + (BATCH.reviewDir ?? 'review');
const raw = (value: unknown) => Buffer.from(JSON.stringify(value, null, 2) + '\n');
const hash = (value: Buffer | string) => createHash('sha256').update(value).digest('hex');
const jhash = (value: unknown) => hash(JSON.stringify(value));
const read = (p: string) => JSON.parse(readFileSync(p, 'utf8'));
const write = (file: string, data: unknown) => writeFileSync(file, raw(data), { flag: 'wx', mode: 0o600 });
const revision = BATCH.revision;
const topics = (v: any) => [...v.school.topics, ...v.school.additionalTopics];

async function main() {
  requireGatePassed(P, 'locale');
  process.env.NEXT_PUBLIC_SITE_URL = 'https://eduaipolicy.org';
  const manifest = read(PARENT + '/manifest.json');
  selectTree(manifest.contentId, PARENT + '/tree', manifest);
  const dataset = await getStagedPublicDataset();
  const catalog = read(PARENT + '/tree/mcp/catalog.json').payload.records;
  const selection = read(P + '/selection.json');
  const frozen: Record<string, unknown> = {};
  for (const [slug, ref] of (Object.entries(selection) as [string, { path: string; sha256: string; sourceBundleSha256: string }][]).filter(([slug]) => SLUGS.includes(slug))) {
    const localBytes = readFileSync(P + '/' + ref.path);
    assert.equal(hash(localBytes), ref.sha256);
    const view = JSON.parse(localBytes.toString());
    const canonical = JSON.parse(JSON.stringify(publicEntitySummarySchema.parse(dataset.publicSummaries.find(s => s.entity.slug === slug))));
    // The universities API route adds `policySnapshot` (a link to the school's policy snapshot) at serve time; it is not
    // part of the release record, so it is left out of the comparison.
    const { policySnapshot: _servedLink, ...liveRecord } = read(P + '/' + slug + '/public.json').data;
    assert.deepEqual(canonical, liveRecord, slug + ': live API record differs from the parent release record');
    assert.deepEqual(canonical, catalog.find((r: any) => r.summary.entity.slug === slug).summary);
    const tools = read(P + '/' + slug + '/public-tools.json').map((t: unknown) => universityToolRecordSchema.parse(t));
    const audited = read(P + '/' + slug + '/audit.json').recordAudit;
    const canonicalHash = jhash(canonical);
    const decisions = canonical.claims.map((c: any) => {
      const audit = audited.find((x: any) => x.originalId === c.id);
      assert.ok(audit, c.id);
      const mode = ['VERIFIED', 'OVERSTATED', 'UNDERSTATED'].includes(audit.status) && audit.evidenceIds.length ? 'scoped_reference' : audit.status === 'STALE' ? 'historical_only' : 'excluded_pending_review';
      const reason = mode === 'scoped_reference' ? 'Original public statement retained with its source scope.' : 'Original public statement preserved in the record. The reviewed presentation uses bounded official-source excerpts.';
      return { claimId: c.id, claimSha256: jhash(c), mode, scope: audit.scope, reason, historyHref: '/changes/' + slug };
    });
    view.candidateOnly = true;
    for (const key of ['privatePreparation', 'auditCoverage', 'workflowHolds', 'heldDraftIds', 'localChangeProposals', 'localReferenceGuide', 'privateRecordContext']) delete view[key];
    view.remainingRecordKeys = [];
    const reviewedClaims = view.claims;
    view.claims = canonical.claims;
    view.sources = canonical.officialSources;
    view.claimScopes = Object.fromEntries(decisions.map((x: any) => [x.claimId, x.scope]));
    view.claimDispositions = decisions;
    view.school.fingerprint = canonicalHash;
    view.school.heldClaims = [];
    view.school.revision = revision;
    view.school.newReviewPending = true;
    view.school.reviewedClaimCount = canonical.claims.length;
    view.sourceBundleSha256 = canonicalHash;
    view.gaps = view.gaps.map((g: string) => g.includes('audit manifest') ? 'Some older tracker records could not be matched to the sources captured for this page; they are kept out of this page and stay in the record history until a later crawl re-checks them.' : g);
    const guide = view.studentActions;
    guide.schoolFingerprint = canonicalHash;
    guide.recordSha256 = jhash(canonical.claims);
    guide.presentationRevision = revision;
    guide.universityRevisionId = revision;
    const needed = new Set<string>([...guide.do, ...guide.dont].flatMap((a: any) => a.claimIds).concat(Object.values(guide.procedures).flat() as string[]));
    const remapped: Record<string, string> = {};
    const copy: Record<string, unknown> = {};
    for (const id of needed) {
      const original = guide.claims[id];
      assert.ok(original?.evidence.length, slug + ' ' + id);
      const options = topics(view);
      const score = (t: any) => original.evidence.filter((e: any) => t.claims.some((group: any) => group.evidence.some((r: any) => e.url === r.url && e.hash === r.hash && (r.quote.includes(e.quote) || e.quote.includes(r.quote))))).length;
      const best = options.reduce((a: any, b: any) => score(a) >= score(b) ? a : b);
      const procedure = (Object.values(guide.procedures).flat() as string[]).includes(id);
      const candidateTopics: Record<string, string> = { academic_integrity: 'academic_integrity', research: 'research_publication', teaching: 'teaching_guidance', privacy: 'privacy_data' };
      const key = procedure ? 'academic_integrity' : candidateTopics[original.claimType] ?? 'coursework';
      const topic = score(best) > 0 && !procedure ? best : options.find((x: any) => x.key === key);
      assert.ok(topic, id);
      const groupId = 'presentation-' + hash(id).slice(0, 16);
      const sourceEvidence = original.evidence.map((e: any) => {
        const attribution = reviewedClaims.find((c: any) => c.id === id)?.evidence.find((x: any) => x.sourceUrl === e.url)?.attribution;
        const source = topics(view).flatMap((t: any) => t.claims.flatMap((g: any) => g.evidence)).find((x: any) => x.url === e.url && x.hash === e.hash);
        return { ...e, title: source?.title ?? attribution?.citationTitle ?? new URL(e.url).hostname, retrievedAt: source?.retrievedAt ?? attribution?.retrievedAt };
      });
      topic.claims.push({ id: groupId, text: original.text, evidence: sourceEvidence });
      const publicId = topic.key + ':' + groupId;
      copy[publicId] = { ...original, id: publicId, basisObjectType: 'private_evidence', basisRef: { topicKey: topic.key, groupId }, scope: topic.scope };
      remapped[id] = publicId;
    }
    guide.claims = copy;
    for (const a of [...guide.do, ...guide.dont]) a.claimIds = a.claimIds.map((id: string) => remapped[id]);
    for (const key of Object.keys(guide.procedures)) guide.procedures[key] = guide.procedures[key].map((id: string) => remapped[id]);
    for (const topic of topics(view)) topic.evidenceScope = topic.scope;
    view.editorialProjection = { schemaVersion: 'uapt-v6-editorial-projection-v1', canonicalRecordSha256: canonicalHash, contentSha256: editorialContentHash(view), reviewState: 'pending_independent_presentation_review', researchApprovalGranted: false, publicationApprovalGranted: false };
    const accepted = acceptV6SchoolInput({ school: view.school, bundle: view }, canonical, canonicalHash);
    assert.equal(accepted.kind, 'bundle');
    validateV6Completeness(accepted, 'en', false);
    const { target, requiredAcceptance } = preparePresentationEvidence(view, revision);
    frozen[slug] = { candidate: view, target, requiredAcceptance, canonical, tools, localDraftSha256: ref.sha256,
      dispositionCounts: Object.fromEntries([...new Set(decisions.map((x: any) => x.mode))].map(mode => [mode, decisions.filter((x: any) => x.mode === mode).length])) };
  }
  assert.deepEqual(Object.keys(frozen).sort(), SLUGS.slice().sort(), 'selection.json must cover every school of the batch');
  mkdirSync(OUT, { mode: 0o700 });
  const hashes: Record<string, string> = {};
  for (const [slug, bundle] of Object.entries(frozen)) {
    const to = OUT + '/' + slug + '.json';
    write(to, bundle);
    hashes[slug] = hash(readFileSync(to));
  }
  write(OUT + '/manifest.json', { revision, mode: BATCH.mode, parentContentId: manifest.contentId, schoolPacketSha256: hashes, englishOnlySlugs: BATCH.englishOnlySlugs ?? [], deploymentAuthorizedBy: BATCH.deploymentAuthorizedBy ?? null, deploymentNote: BATCH.deploymentNote ?? 'Prepared to accepted/release-ready only; a release needs its own request (AGENTS.md).' });
  console.log(JSON.stringify(hashes, null, 1));
}
main().catch(e => { console.error(e); process.exitCode = 1; });
