import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {getChangeIndexData,getEntityChangeHistory} from '../apps/web/lib/change-records';
import {readRecordCorrectionChanges} from '../apps/web/lib/record-correction-changes';

async function main(){
 if(process.env.UAPT_BUILD_CORRECTION_CHANGES!=='1') throw new Error('Set UAPT_BUILD_CORRECTION_CHANGES=1 to explicitly regenerate public change projections');
 const dir=path.resolve('data/public-record-repairs/change-cache');
 await mkdir(dir,{recursive:true});
 const entries=await readRecordCorrectionChanges();
 const projections:Record<string,unknown>={'index.json':await getChangeIndexData()};
 for(const entry of entries) projections[`${entry.slug}.json`]=await getEntityChangeHistory(entry.slug);
 const files:Record<string,string>={};
 for(const [name,payload] of Object.entries(projections)){
   const bytes=JSON.stringify(payload,null,2)+'\n';
   await writeFile(path.join(dir,name),bytes);
   files[name]=createHash('sha256').update(bytes).digest('hex');
 }
 const baselineSha256=createHash("sha256").update(await readFile("data/public-record-repairs/change-index-baseline.json")).digest("hex");
 const journalSha256=createHash('sha256').update(await readFile('data/public-record-repairs/change-log.json')).digest('hex');
 await writeFile(path.join(dir,'manifest.json'),JSON.stringify({schemaVersion:'uapt-public-correction-change-cache-v1',journalSha256,baselineSha256,files},null,2)+'\n');
 console.log({projections:Object.keys(files),journalSha256});
}
main().catch(error=>{console.error(error);process.exitCode=1;});
