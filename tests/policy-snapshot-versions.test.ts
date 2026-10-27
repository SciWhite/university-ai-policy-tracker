import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import test from 'node:test';

const files=['data/policy-snapshots/v1/index.json','data/policy-snapshots/v1/reviews/uapt-6-independent-review.json','data/policy-snapshots/v1/universities/harvard-university.json','data/public-v6-records/current.json'];
const hashes=()=>files.map(file=>createHash('sha256').update(readFileSync(file)).digest('hex'));
for(const flag of ['none','UAPT_V6_PUBLISHED_PAGES','NEXT_PUBLIC_UAPT_V6_PUBLISHED_PAGES','both']){
 test(`snapshot validator separates historical review and current versions: ${flag}`,()=>{
  const env={...process.env};delete env.UAPT_V6_PUBLISHED_PAGES;delete env.NEXT_PUBLIC_UAPT_V6_PUBLISHED_PAGES;
  if(flag!=='none')env[flag==='both'?'UAPT_V6_PUBLISHED_PAGES':flag]='1';
  if(flag==='both')env.NEXT_PUBLIC_UAPT_V6_PUBLISHED_PAGES='1';
  const before=hashes();const result=spawnSync(process.execPath,['--import','tsx','scripts/validate-policy-snapshot.ts'],{env,encoding:'utf8',timeout:60000});
  assert.equal(result.status,0,result.stdout+result.stderr);assert.deepEqual(hashes(),before);
  const line=result.stdout.split('\n').find(line=>line.startsWith('Current runtime snapshot versions '));assert(line);
  const versions=JSON.parse(line.slice(line.indexOf(': ')+2));assert.equal(versions.length,24);
  const harvard=versions.find((v:{slug:string})=>v.slug==='harvard-university');
  assert.equal(harvard.status,flag==='none'?'strong':'needs_review');
  assert.deepEqual(harvard.issueCodes,flag==='none'?[]:['review_incomplete']);
  assert.equal(harvard.basisFingerprint,harvard.expectedBasisFingerprint);
  if(flag!=='none'){
   for(const slug of ['unsw-sydney','university-of-sydney'])assert.equal(versions.find((v:{slug:string})=>v.slug===slug).status,'stale');
   for(const slug of ['cornell-university','ubc','tsinghua-university'])assert(versions.find((v:{slug:string})=>v.slug===slug).issueCodes.includes('basis_source_missing'));
  }
 });
}
