import test from'node:test';import assert from'node:assert/strict';import{mkdtempSync,readFileSync,writeFileSync,copyFileSync,mkdirSync,rmSync}from'node:fs';import{tmpdir}from'node:os';import{join}from'node:path';
import{selectChangeEventStore}from'../apps/web/lib/public-change-history';
const old='qs51-70-v6-complete-r4-20261025',other='qs46-50-v6-r1-20261023';
test('explicit revisions use exact frozen manifests, reject unknown/foreign/hash drift and keep current distinct',()=>{
 const root=mkdtempSync(join(tmpdir(),'uapt-history-selection-'));try{
 const current=JSON.parse(readFileSync('data/public-change-history/current.json','utf8')),registry=JSON.parse(readFileSync('data/public-change-history/revisions.json','utf8'));
 const prior=registry[other];for(const ref of[current,prior])copyFileSync('data/public-change-history/'+ref.path,root+'/'+ref.path);
 writeFileSync(root+'/current.json',JSON.stringify(prior));writeFileSync(root+'/revisions.json',JSON.stringify({[old]:current,[other]:prior}));
 assert.equal(selectChangeEventStore(root)!.manifest.revision,other);assert.equal(selectChangeEventStore(root,old)!.ref.sha256,current.sha256);assert.equal(selectChangeEventStore(root,'missing-revision'),undefined);
 writeFileSync(root+'/revisions.json',JSON.stringify({[old]:prior}));assert.throws(()=>selectChangeEventStore(root,old),/revision mismatch/);
 writeFileSync(root+'/revisions.json',JSON.stringify({[old]:{...current,sha256:'0'.repeat(64)}}));assert.throws(()=>selectChangeEventStore(root,old),/hash|identity|changed/i);
 }finally{rmSync(root,{recursive:true,force:true});}
});

import{retainChangeRevisions}from'../scripts/lib/retain-change-revisions';import{exportV6Revision}from'../scripts/export-v6-shards';import{createHash}from'node:crypto';
test('pack retention registers prior current and keeps exact immutable artifacts; collisions fail closed',()=>{
 const root=mkdtempSync(join(tmpdir(),'uapt-retain-projections-')),source=join(root,'source'),target=join(root,'target');const hash=(b:string)=>createHash('sha256').update(b).digest('hex');
 try{mkdirSync(source+'/public-change-history/objects',{recursive:true});mkdirSync(target+'/public-change-history',{recursive:true});
 const put=(v:unknown)=>{const raw=JSON.stringify(v)+'\n',h=hash(raw),file='objects/'+h+'.json';writeFileSync(source+'/public-change-history/'+file,raw);return{file,sha256:h,bytes:Buffer.byteLength(raw)}};
 const manifest={schemaVersion:'uapt-public-change-history-v2',revision:'old-revision',rulesVersion:'tracker-events-1.2.0',basisSha256:'a'.repeat(64),entries:{},releases:{},eventHistories:{},projectionInput:put({revision:'old-revision'}),eventIndex:put([])};const raw=JSON.stringify(manifest)+'\n',ref={path:'manifest-'+hash(raw)+'.json',sha256:hash(raw)};writeFileSync(source+'/public-change-history/'+ref.path,raw);writeFileSync(source+'/public-change-history/current.json',JSON.stringify(ref));
 for(const [base,rev]of[[source,'old-revision'],[target,'new-revision']])exportV6Revision(base+'/public-v6-change-overviews','public-v6-change-overviews',rev,Buffer.from(JSON.stringify({schemaVersion:'uapt-v6-change-overviews-v1',revision:rev,rulesVersion:'tracker-events-1.2.0',projectionSha256:'b'.repeat(64),basisSha256:'a'.repeat(64),schools:{example:{slug:'example',revision:rev,projectionSha256:'b'.repeat(64),basisSha256:'a'.repeat(64),rulesVersion:'tracker-events-1.2.0',timeline:[]}}})+'\n'));
 const preserved=retainChangeRevisions(source,target);assert.deepEqual(preserved.retainedProjectionRevisions,['old-revision']);assert.equal(readFileSync(target+'/public-change-history/'+ref.path,'utf8'),raw);assert.doesNotThrow(()=>retainChangeRevisions(source,target));
 const index=JSON.parse(readFileSync(target+'/public-v6-change-overviews/sharded/index.json','utf8'));assert.deepEqual(Object.keys(index.revisions).sort(),['new-revision','old-revision']);
 writeFileSync(target+'/public-change-history/'+ref.path,'corrupt');assert.throws(()=>retainChangeRevisions(source,target),/collision/);
 }finally{rmSync(root,{recursive:true,force:true});}
});
