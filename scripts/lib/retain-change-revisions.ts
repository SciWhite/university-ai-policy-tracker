import{existsSync,readFileSync,writeFileSync,mkdirSync}from'node:fs';
import{resolve,dirname}from'node:path';import{createHash}from'node:crypto';
import{ChangeEventStore}from'../../apps/web/lib/public-change-history';import{readVerifiedArtifact,type ShardIndex,type ShardManifest,type ShardNode}from'../../apps/web/lib/v6-artifact-store';
const digest=(b:Buffer)=>createHash('sha256').update(b).digest('hex');
/** Retain exact prior projection URLs in an isolated package; never rewrites a frozen artifact. */
export function retainChangeRevisions(sourceBase:string,targetBase:string){
 const old=resolve(sourceBase,'public-change-history'),next=resolve(targetBase,'public-change-history');
 const read=(p:string)=>JSON.parse(readFileSync(p,'utf8'));
 function copy(root:string,target:string,file:string,hash:string,bytes?:number){
  if(!/^(manifest-[a-f0-9]{64}\.json|objects\/[a-f0-9]{64}\.json|sharded\/(objects\/[a-f0-9]{64}\.json|revisions\/[a-z0-9-]+\.json))$/.test(file))throw Error('Invalid retained artifact path');
  readVerifiedArtifact(root,file,hash,128*1024*1024,bytes);const raw=readFileSync(resolve(root,file));const dest=resolve(target,file);mkdirSync(dirname(dest),{recursive:true});if(existsSync(dest)){if(digest(readFileSync(dest))!==hash)throw Error('Retained immutable artifact collision');}else writeFileSync(dest,raw,{flag:'wx'});
 }
 const current=read(resolve(old,'current.json')),store=new ChangeEventStore(old,current),sourceRegistry=existsSync(resolve(old,'revisions.json'))?read(resolve(old,'revisions.json')):{};
 const registry={...sourceRegistry};if(registry[store.manifest.revision!]&&JSON.stringify(registry[store.manifest.revision!])!==JSON.stringify(current))throw Error('Conflicting prior current revision');registry[store.manifest.revision!]=current;
 const targetRegistry=existsSync(resolve(next,'revisions.json'))?read(resolve(next,'revisions.json')):{};
 for(const[revision,ref]of Object.entries(registry)as[string,{path:string;sha256:string}][]){
  const frozen=new ChangeEventStore(old,ref);if(frozen.manifest.revision!==revision)throw Error('Retained revision identity mismatch');
  if(targetRegistry[revision]&&JSON.stringify(targetRegistry[revision])!==JSON.stringify(ref))throw Error('Retained revision registry collision');
  const m=frozen.manifest;for(const f of[...Object.values(m.entries),...Object.values(m.releases),...Object.values(m.eventHistories!),m.projectionInput!,m.eventIndex!])copy(old,next,f.file,f.sha256,f.bytes);
  copy(old,next,ref.path,ref.sha256);targetRegistry[revision]=ref;
 }
 writeFileSync(resolve(next,'revisions.json'),JSON.stringify(targetRegistry,null,2)+'\n');
 const overviewOld=resolve(sourceBase,'public-v6-change-overviews'),overviewNext=resolve(targetBase,'public-v6-change-overviews');
 const oldIndex=read(resolve(overviewOld,'sharded/index.json'))as ShardIndex,newIndex=read(resolve(overviewNext,'sharded/index.json'))as ShardIndex;
 if(oldIndex.family!==newIndex.family||newIndex.family!=='public-v6-change-overviews')throw Error('Retained overview family mismatch');
 for(const[revision,entry]of Object.entries(oldIndex.revisions)){
  if(newIndex.revisions[revision]&&JSON.stringify(newIndex.revisions[revision])!==JSON.stringify(entry))throw Error('Retained overview revision collision');
  const m=readVerifiedArtifact<ShardManifest>(overviewOld,entry.path,entry.sha256,128*1024*1024);if(m.revision!==revision||m.family!==oldIndex.family||m.sourceSha256!==entry.sourceSha256)throw Error('Retained overview manifest identity mismatch');
  function walk(n:ShardNode){if(n.kind==='blob')copy(overviewOld,overviewNext,'sharded/objects/'+n.sha256+'.json',n.sha256,n.bytes);else if(n.kind==='object')n.entries.forEach(([,c])=>walk(c));else if(n.kind==='array')n.items.forEach(walk);}
  walk(m.root);copy(overviewOld,overviewNext,entry.path,entry.sha256);newIndex.revisions[revision]=entry;
 }
 writeFileSync(resolve(overviewNext,'sharded/index.json'),JSON.stringify(newIndex)+'\n');
 return{retainedProjectionRevisions:Object.keys(registry),retainedOverviewRevisions:Object.keys(oldIndex.revisions),frozenArtifactsRewritten:false};
}
