import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';
import {publicEntitySummarySchema} from '@uapt/shared';
import {getCurrentPublicReleaseManifest,getStagedPublicDatasetForManifest,getStagedPublicDataset} from '../apps/web/lib/staged-public-data';
import {getLoadedPolicySnapshotBySlug} from '../apps/web/lib/policy-snapshots';
import {loadCatalog} from '../apps/mcp/src/catalog';
const slug='massachusetts-institute-of-technology';
test('scoped repair preserves historical release and every other university',async()=>{
 const manifest=await getCurrentPublicReleaseManifest();assert(manifest);
 const old=await getStagedPublicDatasetForManifest(manifest);const current=await getStagedPublicDataset();
 assert.equal(old.publicSummaries.length,current.publicSummaries.length);
 const before=old.publicSummaries.find(s=>s.entity.slug===slug)!;const after=current.publicSummaries.find(s=>s.entity.slug===slug)!;
 assert.equal(before.claims.length,21);assert.equal(after.claims.length,28);
 for(const c of before.claims)assert(after.claims.some(x=>x.id===c.id));
 assert.equal(after.claims.filter(c=>c.reviewState==='needs_review').length,2);
 assert.deepEqual(current.publicSummaries.filter(s=>s.entity.slug!==slug),old.publicSummaries.filter(s=>s.entity.slug!==slug));
 const baseline=publicEntitySummarySchema.parse(JSON.parse(await readFile('data/public-record-repairs/mit-20261010/baseline.json','utf8')));
 assert.deepEqual(JSON.parse(JSON.stringify(before.claims)),baseline.claims);
});
test('MIT corrected snapshot cannot inherit a prior secondary approval',async()=>{
 const snapshot=await getLoadedPolicySnapshotBySlug(slug);assert(snapshot);
 assert.equal(snapshot.validation.effectiveStatus,'needs_review');assert.equal(snapshot.snapshot.review.secondary.decision,'needs_review');
 assert(snapshot.snapshot.statusReasons.includes('review_incomplete'));
 assert.equal(snapshot.validation.expectedBasisFingerprint,snapshot.snapshot.basisFingerprint);
});
test('MCP publishes current reviewed MIT claims and omits held snapshot',async()=>{
 const catalog=await loadCatalog('apps/mcp/.runtime-data/catalog.json');const mit=catalog.records.find(r=>r.summary.entity.slug===slug)!;
 assert.equal(mit.summary.claims.length,26);assert.equal(mit.snapshot,undefined);
 assert(!mit.summary.claims.some(c=>c.claimType==='source_status'));
 assert(mit.summary.claims.find(c=>c.id.endsWith('high-risk-prohibition'))!.claimText.includes('does not permit Medium Risk'));
});

test('bounded claims route preserves the claims contract',async()=>{
 const {GET}=await import('../apps/tulsa-zone/app/api/public/v1/[...path]/route');
 const response=await GET(new Request('https://eduaipolicy.org/api/public/v1/claims/'+slug+'.json'),{params:Promise.resolve({path:['claims',slug+'.json']})});
 const body=await response.json();assert.equal(response.status,200);assert.equal(body.data.claimCount,28);assert.equal(body.data.claims.length,28);assert.equal(body.data.reviewState,'needs_review');
});
test('bounded review widget counts held provisions without approving them',async()=>{
 const {GET}=await import('../apps/tulsa-zone/app/api/public/v1/[...path]/route');
 const response=await GET(new Request('https://eduaipolicy.org/api/public/v1/widgets/review-state/'+slug+'.json'),{params:Promise.resolve({path:['widgets','review-state',slug+'.json']})});
 const body=await response.json();assert.equal(body.data.claimCount,28);assert.equal(body.data.reviewedClaimCount,26);assert.equal(body.data.candidateClaimCount,2);assert.equal(body.data.reviewState,'needs_review');
});
test('bounded API refuses an unlisted university record',async()=>{
 const {GET}=await import('../apps/tulsa-zone/app/api/public/v1/[...path]/route');
 const response=await GET(new Request('https://eduaipolicy.org/api/public/v1/universities/harvard-university.json'),{params:Promise.resolve({path:['universities','harvard-university.json']})});
 assert.equal(response.status,404);
});
