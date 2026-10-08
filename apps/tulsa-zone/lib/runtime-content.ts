import {cache} from 'react';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {reviewedClaimsFingerprint} from '@/lib/index-recovery-basis';
const permitted=new Set(['id','group','sourceNature','appliesToAI','statement','translationSourceHash','localSummary','emphasis','deadlines','scope','conditions','exceptions','evidence']);
export const loadTulsaContent=cache(async(slug:string,claims:any[])=>{
 if(slug!=='university-of-tulsa')return null;
 const root=process.env.UAPT_TULSA_CONTENT_ROOT;
 if(!root)throw new Error('Tulsa content root is required');
 const pointer=JSON.parse(await readFile(path.join(root,'current.json'),'utf8'));
 if(!/^[a-z0-9-]{1,80}$/.test(pointer.revision)||!/^[a-f0-9]{64}$/.test(pointer.sha256))throw new Error('Invalid Tulsa pointer');
 const bytes=await readFile(path.join(root,'revisions',pointer.revision+'.json'));
 if(createHash('sha256').update(bytes).digest('hex')!==pointer.sha256)throw new Error('Tulsa content hash mismatch');
 const value=JSON.parse(bytes.toString());
 if(value.schemaVersion!==1||value.revision!==pointer.revision||value.slug!==slug||value.publicationApproved!==true||value.claimsFingerprint!==reviewedClaimsFingerprint(claims)||!Array.isArray(value.records)||value.records.length!==6)throw new Error('Incompatible Tulsa content');
 const ids=new Set<string>();
 for(const f of value.records){
  if(Object.keys(f).some(k=>!permitted.has(k))||typeof f.statement!=='string'||!f.id.startsWith(slug+'-bing-v5-')||ids.has(f.id)||!Array.isArray(f.evidence)||!f.evidence.length)throw new Error('Invalid Tulsa record');
  ids.add(f.id);
  if(createHash('sha256').update(f.statement).digest('hex')!==f.translationSourceHash)throw new Error('Tulsa translation source mismatch');
  for(const e of f.evidence){if(typeof e.quote!=='string'||!/^https:\/\//.test(e.sourceUrl)||!/^([a-f0-9]{64}|sha256:[a-f0-9]{64})$/.test(e.sourceSnapshotHash)||e.lineEnd<e.lineStart)throw new Error('Invalid evidence');}
 }
 return value;
});
