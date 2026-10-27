import test from 'node:test';import assert from 'node:assert/strict';
import registry from '../apps/web/lib/university-marks-local.json';
import {getLocalTitleMark,isLocalMarkFile} from '../apps/web/lib/local-university-marks';
import {GET} from '../apps/web/app/api/local/university-marks/[filename]/route';
test('local title candidates preserve role, backing and native2x limits and stay unavailable in production',async()=>{
 const prior=process.env.NODE_ENV;
 try{
  Object.assign(process.env,{NODE_ENV:'development'});
  for(const [slug,entry]of Object.entries(registry.titleEntries)){
   const mark=getLocalTitleMark(slug,'hero');assert(mark);assert.equal(mark.role,'title');assert.equal(mark.backing,entry.backing);
   assert.equal(mark.publicationApproved,false);assert.equal(mark.publicUseReviewRequired,true);
   assert(mark.displayWidth*2<=entry.width&&mark.displayHeight*2<=entry.height);
   assert.equal(getLocalTitleMark(slug,'small'),undefined);assert(isLocalMarkFile(entry.file));
   const params={params:Promise.resolve({filename:entry.file})};
   assert.equal((await GET(new Request(`https://untrusted.example/api/local/university-marks/${entry.file}`),params)).status,404);
   Object.assign(process.env,{NODE_ENV:'production'});assert.equal(getLocalTitleMark(slug,'hero'),undefined);assert.equal(isLocalMarkFile(entry.file),false);
   assert.equal((await GET(new Request(`http://127.0.0.1/api/local/university-marks/${entry.file}`),params)).status,404);
   Object.assign(process.env,{NODE_ENV:'development'});
  }
  assert.equal(getLocalTitleMark('deakin-university','hero'),undefined,'unverified third-party title remains a fallback');
 }finally{if(prior===undefined)delete process.env.NODE_ENV;else Object.assign(process.env,{NODE_ENV:prior});}
});
