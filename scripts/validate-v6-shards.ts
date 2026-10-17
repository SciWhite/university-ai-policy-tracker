import {readFileSync, readdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {V6ArtifactStore, type ShardIndex} from '../apps/web/lib/v6-artifact-store';
import legacy from '../data/v6-legacy-package-baseline.json';

/** New revisions must use shards. Existing frozen packages are preserved byte-for-byte. */
export function validateV6Shards(root=process.cwd()) {
 const hash=(raw:Buffer)=>createHash('sha256').update(raw).digest('hex');
 const frozen=legacy.files as Record<string,string>;
 let revisions=0;
 for(const family of ['public-v6-pages','public-v6-records','public-v6-history']){
  const directory=resolve(root,'data',family),index=JSON.parse(readFileSync(resolve(directory,'sharded/index.json'),'utf8'))as ShardIndex;
  const store=new V6ArtifactStore(directory,index);
  for(const file of readdirSync(resolve(directory,'revisions')).filter(f=>f.endsWith('.json'))){
   const relative=`data/${family}/revisions/${file}`;
   if(!frozen[relative])throw Error('New aggregate V6 revision is prohibited; use pnpm v6:shards: '+relative);
   if(hash(readFileSync(resolve(root,relative)))!==frozen[relative])throw Error('Frozen legacy package changed: '+relative);
  }
  for(const [revision,entry]of Object.entries(index.revisions)){
   const value=store.view<Record<string,unknown>>(revision)!;
   const old=frozen[`data/${family}/revisions/${revision}.json`];
   if(old){
    if(entry.sourceSha256!==old)throw Error('Shard baseline differs from frozen package');
    if(JSON.stringify(value)!==JSON.stringify(JSON.parse(readFileSync(resolve(directory,'revisions',revision+'.json'),'utf8'))))throw Error('Shard reconstruction differs: '+revision);
   }
   revisions++;
  }
  const pointer=JSON.parse(readFileSync(resolve(directory,'current.json'),'utf8'));
  const revision=pointer.releaseId??pointer.revision??pointer.basisRevision;
  const manifest=store.manifest(revision,pointer.sha256);
  if(!manifest)throw Error('Current V6 revision has no shard manifest: '+family);
 }
 for(const file of Object.keys(frozen))if(hash(readFileSync(resolve(root,file)))!==frozen[file])throw Error('Missing/changed frozen package: '+file);
 return {revisions,legacyFilesPreserved:Object.keys(frozen).length};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)process.stdout.write(JSON.stringify(validateV6Shards())+'\n');
