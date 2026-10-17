import test from "node:test";
import assert from "node:assert/strict";
import {mkdirSync, mkdtempSync, readFileSync, readdirSync, writeFileSync, symlinkSync} from "node:fs";
import {tmpdir} from "node:os";
import {resolve} from "node:path";
import {createHash} from "node:crypto";
import {ByteLru, BoundedAsyncCache} from "../apps/web/lib/bounded-cache";
import {V6ArtifactStore,resetV6ArtifactCache,v6ArtifactStats,type ShardIndex} from "../apps/web/lib/v6-artifact-store";
import {exportV6Revision} from "../scripts/export-v6-shards";
import {publishedV6School,readPublishedV6Revision} from "../apps/web/lib/policy-v6-published";
import {v6SummaryAtRevision,readV6RecordCorrectionRevision} from "../apps/web/lib/v6-effective-records";
import {v6FrozenHistory} from "../apps/web/lib/v6-history-cache";
import {GET} from "../apps/tulsa-zone/app/api/public/v1/[...path]/route";
import {validateV6Shards} from "../scripts/validate-v6-shards";

process.env.UAPT_V6_PUBLISHED_PAGES="1";
process.env.UAPT_DISABLE_INTERNAL_FETCH="1";
const sha=(b:Buffer)=>createHash('sha256').update(b).digest('hex');
const read=(p:string)=>JSON.parse(readFileSync(p,'utf8'));

test("every frozen page, record and history revision reconstructs without losing fields or order",()=>{
 for(const family of ['public-v6-pages','public-v6-records','public-v6-history']){
  const root=resolve('data',family),index=read(root+'/sharded/index.json') as ShardIndex,store=new V6ArtifactStore(root,index);
  for(const [revision,entry]of Object.entries(index.revisions)){
   const raw=readFileSync(root+'/revisions/'+revision+'.json');assert.equal(sha(raw),entry.sourceSha256);
   assert.equal(JSON.stringify(store.view(revision)),JSON.stringify(JSON.parse(raw.toString())),family+' '+revision);
   if(family==='public-v6-pages')assert.equal(JSON.stringify(readPublishedV6Revision(revision)),JSON.stringify(JSON.parse(raw.toString())));
   if(family==='public-v6-records')assert.equal(JSON.stringify(readV6RecordCorrectionRevision(revision)),JSON.stringify(JSON.parse(raw.toString())));
  }
 }
});

test("a cold single-school lookup does not read the legacy aggregate or other school shards",()=>{
 delete process.env.UAPT_V6_LEGACY_DATA;
 resetV6ArtifactCache();
 const school=publishedV6School('ucl','en')!;
 const summary=v6SummaryAtRevision('ucl')!;
 const history=v6FrozenHistory('ucl')!;
 assert.equal(summary.claims.length,14);assert.equal(school.slug,'ucl');assert(history.length);
 const stats=v6ArtifactStats();
 assert(stats.files<=6,JSON.stringify(stats));
 assert(stats.largestFile<1024*1024,JSON.stringify(stats));
 assert(stats.bytes<2*1024*1024,JSON.stringify(stats));
 // Returned values cannot corrupt a shared immutable blob.
 school.topics.pop();summary.claims.pop();history.pop();
 assert.equal(publishedV6School('ucl','en')!.topics.length,6);
 assert.equal(v6SummaryAtRevision('ucl')!.claims.length,14);
 assert(v6FrozenHistory('ucl')!.length>history.length);
});

test("current and historical single-school readers match the preserved legacy reader",()=>{
 const index=read('data/public-v6-records/sharded/index.json')as ShardIndex;
 for(const revision of Object.keys(index.revisions)){
  const original=read('data/public-v6-records/revisions/'+revision+'.json');
  for(const summary of original.summaries)assert.deepEqual(v6SummaryAtRevision(summary.entity.slug,revision),summary);
 }
 const pointer=read('data/public-v6-history/current.json'),old=read('data/public-v6-history/'+pointer.path);
 for(const slug of Object.keys(old.records))assert.deepEqual(v6FrozenHistory(slug),old.records[slug]);
 assert.equal(v6SummaryAtRevision('missing'),undefined);
 assert.equal(readPublishedV6Revision('missing'),undefined);
});

test("single-school changes link uses its own revision while release deltas remain unchanged",async()=>{
 const response=await GET(new Request('http://localhost/api/public/v1/policy-pages/v6/changes/latest.json'),{params:Promise.resolve({path:['policy-pages','v6','changes','latest.json']})});
 const payload=await response.json();
 const ucl=payload.changes.find((s:{slug:string})=>s.slug==='ucl');
 assert.equal(ucl.href,'/changes/v6-audit-fix-20261014/ucl');
 assert.deepEqual(ucl.addedClaimIds,[]);
 const current=readV6RecordCorrectionRevision(payload.releaseId)!;
 for(const school of payload.changes){
  const revision=current.recordRevisions[school.slug].universityRevisionId;
  assert.equal(school.href,`/changes/${revision}/${school.slug}`);
  assert(v6SummaryAtRevision(school.slug,revision));
 }
});

test("export is repeatable, reuses unchanged blobs, and refuses changed frozen revisions",()=>{
 const root=mkdtempSync(resolve(tmpdir(),'uapt-shard-export-'));
 const make=(revision:string,tail='one')=>Buffer.from(JSON.stringify({schemaVersion:'uapt-bounded-public-history-v1',basisRevision:revision,records:{ucl:[{text:'constant'}],cornell:[{text:tail}]}}));
 exportV6Revision(root,'public-v6-history','test-one',make('test-one'));
 const before=readdirSync(root+'/sharded/objects').length;
 exportV6Revision(root,'public-v6-history','test-one',make('test-one'));
 assert.equal(readdirSync(root+'/sharded/objects').length,before);
 exportV6Revision(root,'public-v6-history','test-two',make('test-two','two'));
 assert.equal(readdirSync(root+'/sharded/objects').length,before+1);
 assert.throws(()=>exportV6Revision(root,'public-v6-history','test-one',make('test-one','changed')));
 const index=read(root+'/sharded/index.json')as ShardIndex;
 assert.deepEqual(new V6ArtifactStore(root,index).field('test-two',['records','ucl']),[{text:'constant'}]);
});

test("the repository gate rejects new aggregate revisions instead of letting quadratic copies return",()=>{
 const root=mkdtempSync(resolve(tmpdir(),'uapt-shard-gate-'));
 const family=resolve(root,'data/public-v6-pages');
 mkdirSync(family+'/sharded',{recursive:true});mkdirSync(family+'/revisions');
 writeFileSync(family+'/sharded/index.json',JSON.stringify({schemaVersion:'uapt-v6-shard-index-v1',family:'public-v6-pages',revisions:{}}));
 writeFileSync(family+'/revisions/new-copy.json','{}');
 assert.throws(()=>validateV6Shards(root),/New aggregate V6 revision is prohibited/);
});

test("corrupt blobs, wrong basis, invalid manifests and paths fail closed",()=>{
 const root=mkdtempSync(resolve(tmpdir(),'uapt-shard-integrity-'));
 const raw=Buffer.from(JSON.stringify({schemaVersion:'uapt-bounded-public-history-v1',basisRevision:'test',records:{ucl:[{text:'original'}]}}));
 exportV6Revision(root,'public-v6-history','test',raw);
 const index=read(root+'/sharded/index.json')as ShardIndex,store=new V6ArtifactStore(root,index);
 assert.throws(()=>store.manifest('test','a'.repeat(64)));
 assert.throws(()=>new V6ArtifactStore(root,{...index,revisions:{test:{...index.revisions.test,path:'../outside.json'}}}).view('test'));
 const file=resolve(root,'sharded/objects',readdirSync(root+'/sharded/objects')[0]);
 writeFileSync(file,'corrupted\n');resetV6ArtifactCache();
 assert.throws(()=>store.field('test',['records','ucl']));
 const manifestFile=resolve(root,index.revisions.test.path);
 const outside=resolve(mkdtempSync(resolve(tmpdir(),'uapt-outside-')),'other.json');writeFileSync(outside,'{}');
 const linked='sharded/revisions/link.json';symlinkSync(outside,resolve(root,linked));
 assert.throws(()=>new V6ArtifactStore(root,{...index,revisions:{test:{...index.revisions.test,path:linked}}}).view('test'));
 writeFileSync(manifestFile,'{}');resetV6ArtifactCache();assert.throws(()=>store.view('test'));
});

test("LRU enforces byte and item limits, skips oversize objects, and evicts the least recently used",()=>{
 const cache=new ByteLru<string>(2,10);
 cache.set('a','a',4);cache.set('b','b',4);assert.equal(cache.get('a'),'a');cache.set('c','c',4);
 assert.equal(cache.get('b'),undefined);assert.equal(cache.get('a'),'a');cache.set('huge','huge',11);assert.equal(cache.get('huge'),undefined);
 assert(cache.stats().bytes<=10);assert(cache.stats().entries<=2);
});

test("many immutable revisions cannot grow retained artifact memory past its shared budget",()=>{
 const root=mkdtempSync(resolve(tmpdir(),'uapt-shard-budget-'));
 const payload='x'.repeat(300_000);
 for(let n=0;n<90;n++){
  const revision='budget-'+n;
  exportV6Revision(root,'public-v6-history',revision,Buffer.from(JSON.stringify({schemaVersion:'uapt-bounded-public-history-v1',basisRevision:revision,records:{ucl:[{text:payload+n}]}})));
 }
 const index=read(root+'/sharded/index.json')as ShardIndex,store=new V6ArtifactStore(root,index);
 resetV6ArtifactCache();
 for(const revision of Object.keys(index.revisions))store.field(revision,['records','ucl']);
 const stats=v6ArtifactStats().cache;
 assert(stats.evictions>0);assert(stats.bytes<=stats.maxBytes);assert(stats.entries<=stats.maxEntries);
 assert.equal((store.field<{text:string}[]>('budget-0',['records','ucl']))![0].text,payload+'0');
});

test("async cache deduplicates, limits concurrent work, drops rejected/oversize results and bounds the wait queue",async()=>{
 const cache=new BoundedAsyncCache<string>(2,10,1,1);let resolveFirst!:(s:string)=>void;let calls=0;
 const one=cache.get('a',()=>{calls++;return new Promise<string>(r=>resolveFirst=r);});
 const same=cache.get('a',async()=>{throw Error('duplicate');});assert.equal(same,one);
 const two=cache.get('b',async()=>{calls++;return'b';});
 await assert.rejects(cache.get('c',async()=>'c'),/queue is full/);
 await Promise.resolve();resolveFirst('a');assert.deepEqual(await Promise.all([one,same,two]),['a','a','b']);assert.equal(calls,2);
 await assert.rejects(cache.get('fail',async()=>{throw Error('failed');}));
 assert.equal(await cache.get('fail',async()=>'ok'),'ok');
 await cache.get('big',async()=>'x'.repeat(100));let rebuilt=false;await cache.get('big',async()=>{rebuilt=true;return'x'.repeat(100);});assert(rebuilt);
 assert.equal(cache.stats().active,0);assert.equal(cache.stats().pending,0);assert(cache.stats().bytes<=10);
});
