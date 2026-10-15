import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {getV5RecordReleaseDiff} from '../apps/web/lib/release-diffs';

process.env.UAPT_V6_PUBLISHED_PAGES='1';
process.env.NEXT_PUBLIC_UAPT_V6_PUBLISHED_PAGES='1';
process.env.UAPT_DISABLE_INTERNAL_FETCH='1';
test('published PKU V5 history diff carries every added/corrected ID and the frozen before/after evidence',async()=>{
  const revision='pku-v5-20261014-r3';
  const p=JSON.parse(await readFile(`data/public-v6-records/revisions/${revision}.json`,'utf8'));
  const diff=await getV5RecordReleaseDiff(revision);
  assert(diff);assert.equal(diff.releaseId,revision);assert.equal(diff.publicationKind,'scoped_record_correction');
  assert.equal(diff.previousReleaseId,'baseline-pku-v5-20261014');assert.equal(diff.entities.length,1);
  const entity=diff.entities[0],expected=p.changesBySlug['peking-university'];
  assert.equal(entity.entitySlug,'peking-university');assert.equal(entity.recordSha256,p.recordRevisions[entity.entitySlug].recordSha256);
  assert.deepEqual(entity.rows.filter(r=>r.changeType==='claim_added').map(r=>r.claimId).sort(),[...expected.addedClaimIds].sort());
  const changed=new Set(entity.rows.filter(r=>r.claimId&&r.oldClaim&&r.newClaim).map(r=>r.claimId));
  assert.deepEqual([...changed].sort(),[...expected.updatedClaimIds].sort());
  assert.equal(expected.addedClaimIds.length,56);assert.equal(expected.updatedClaimIds.length,7);
  assert.equal(entity.sourceAdded-entity.sourceRemoved,45);
  for(const row of entity.rows.filter(r=>r.claimId)){
    if(row.oldClaim)assert.equal(row.oldClaim.claimText,p.historical[entity.entitySlug].baseline.claims.find((c:any)=>c.id===row.claimId).claimText);
    if(row.newClaim)assert.equal(row.newClaim.claimText,p.summaries.find((s:any)=>s.entity.slug===entity.entitySlug).claims.find((c:any)=>c.id===row.claimId).claimText);
  }
  assert.equal(await getV5RecordReleaseDiff('pku-v5-missing'),undefined);
  assert.equal(await getV5RecordReleaseDiff('v6-chicago-tools-20261014'),undefined);
});
