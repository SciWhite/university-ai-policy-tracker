import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, mkdir, readFile, writeFile, cp, rm} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {readRecordCorrectionChanges} from '../apps/web/lib/record-correction-changes';
import {getEntityChangeHistory,getChangeIndexData} from '../apps/web/lib/change-records';
import {getReleaseDiff,getLatestEntityReleaseDiff,getLatestReleaseDiff} from '../apps/web/lib/release-diffs';

test('scoped policy corrections appear in history, indexes and complete claim diffs without rewriting global history', async()=>{
 const entries=await readRecordCorrectionChanges();
 const index=await getChangeIndexData();
 const latest=await getLatestReleaseDiff();
 assert.equal(latest.releaseId,'public-release-20260924-002');
 const publishedBaseline=JSON.parse(await readFile('data/public-record-repairs/change-index-baseline.json','utf8'));
 const scopedSlugs=new Set(entries.map(entry=>entry.slug));
 assert.equal(index.data.records.length,publishedBaseline.data.records.length);
 for(const row of publishedBaseline.data.records) if(!scopedSlugs.has(row.slug)) assert.deepEqual(index.data.records.find(r=>r.slug===row.slug),row);
 assert.ok(index.data.records.every(r=>r.canonicalUrl.startsWith('https://eduaipolicy.org/')&&r.publicJsonUrl.startsWith('https://eduaipolicy.org/')));
 assert.equal(latest.scopedCorrections?.length,2);
 assert.ok(latest.entities.every(entity => entity.rows.every(row => !row.newClaim?.claimId?.startsWith('cl-imperial-current-'))));
 assert.equal(latest.entities.find(e => e.entitySlug==='imperial-college-london')?.rows.some(row => row.newSnapshotHash==='91e1d2fd709853d7fc4b9f1797544b57b678367116cdd1e35cf68ad01904844f'),false);
 for(const entry of entries){
  const history=await getEntityChangeHistory(entry.slug);
  const diff=await getLatestEntityReleaseDiff(entry.slug);
  assert.ok(history&&diff);
  const record=JSON.parse(await readFile(path.join('data/public-record-repairs',entry.revision,'record.json'),'utf8'));
  const baseline=JSON.parse(await readFile(path.join('data/public-record-repairs',entry.revision,'baseline.json'),'utf8'));
  const newIds=new Set(record.claims.map((c:any)=>c.id));
  const oldIds=new Set(baseline.claims.map((c:any)=>c.id));
  assert.equal(history.record.claimCount,newIds.size);
  assert.equal(history.record.releaseId,entry.revision);
  assert.equal(history.record.lastChangedAt,entry.publishedAt);
  assert.ok(history.releaseRecords.some(r=>r.releaseId?.startsWith('public-release-')));
  assert.equal(diff.newlyExtractedClaims,[...newIds].filter(id=>!oldIds.has(id)).length);
  const touched=new Set(diff.rows.filter(r=>r.newClaim).map(r=>r.newClaim?.claimId));
  for(const claim of record.claims) {
    const before=baseline.claims.find((c:any)=>c.id===claim.id);
    if(!before||before.claimText!==claim.claimText||before.claimValue!==claim.claimValue) assert.ok(touched.has(claim.id),claim.id);
  }
  assert.equal(diff.recordSha256,entry.recordSha256);
  assert.ok(diff.rows.every(row=>row.changeExplanation.startsWith('Tracker audit correction')));
  const indexed=index.data.records.find(r=>r.slug===entry.slug);
  assert.equal(indexed?.claimCount,newIds.size);
  assert.equal(indexed?.releaseId,entry.revision);
 }
 const historical=await getReleaseDiff('public-release-20260715-005');
 assert.equal(historical?.publicationKind,undefined);
});

test('publication fails when a policy pin advances without its matching change-log entry',async()=>{
 const root=await mkdtemp(path.join(os.tmpdir(),'uapt-change-log-'));
 try {
  const dir=path.join(root,'data/public-record-repairs');
  await mkdir(dir,{recursive:true});
  for(const file of ['current.json','imperial-current.json','change-log.json']) await cp(path.join('data/public-record-repairs',file),path.join(dir,file));
  const pin=JSON.parse(await readFile(path.join(dir,'imperial-current.json'),'utf8'));
  pin.revision='imperial-unsynchronized';
  await writeFile(path.join(dir,'imperial-current.json'),JSON.stringify(pin));
  await assert.rejects(readRecordCorrectionChanges(root),/requires a synchronized change log/);
 }finally{await rm(root,{recursive:true,force:true});}
});
