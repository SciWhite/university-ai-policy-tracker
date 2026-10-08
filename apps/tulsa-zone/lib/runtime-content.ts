import {cache} from 'react';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {reviewedClaimsFingerprint} from '@/lib/index-recovery-basis';
import {isRuntimeUniversity,runtimeUniversitySlugs} from './schools';
const permitted=new Set(['id','group','sourceNature','appliesToAI','statement','translationSourceHash','localSummary','emphasis','deadlines','scope','conditions','exceptions','evidence']);
const counts:Record<string,number>={'university-of-glasgow':10,'imperial-college-london':6,'university-of-sydney':10,'university-of-exeter':9,'keele-university':8,'university-of-auckland':14,'cardiff-university':6,'flinders-university':10,'university-of-aberdeen':10,'university-of-tulsa':6};
const loadPackage=cache(async()=>{
 const root=process.env.UAPT_TULSA_CONTENT_ROOT;
 if(!root)throw new Error('Runtime content root required');
 const pointer=JSON.parse(await readFile(path.join(root,'current.json'),'utf8'));
 if(!/^[a-z0-9-]{1,80}$/.test(pointer.revision)||!/^[a-f0-9]{64}$/.test(pointer.sha256))throw new Error('Invalid content pointer');
 const bytes=await readFile(path.join(root,'revisions',pointer.revision+'.json'));
 if(createHash('sha256').update(bytes).digest('hex')!==pointer.sha256)throw new Error('Content hash mismatch');
 const value=JSON.parse(bytes.toString());
 if(value.schemaVersion!==2||value.appCompatibility!=='uapt-v5-zone-v2'||value.revision!==pointer.revision||value.publicationApproved!==true||Object.keys(value.schools??{}).length!==runtimeUniversitySlugs.length)throw new Error('Incompatible content package');
 for(const slug of runtimeUniversitySlugs){
  const school=value.schools[slug];
  if(!school||school.slug!==slug||school.scene?.slug!==slug||!Array.isArray(school.records)||school.records.length!==counts[slug])throw new Error('Invalid school payload');
  const ids=new Set<string>();
  for(const f of school.records){
   if(Object.keys(f).some(k=>!permitted.has(k))||typeof f.statement!=='string'||!(f.id.startsWith(slug+'-')||(slug==='imperial-college-london'&&f.id.startsWith('icl-'))||(slug==='university-of-sydney'&&f.id.startsWith('usyd-')))||ids.has(f.id)||!Array.isArray(f.evidence)||!f.evidence.length)throw new Error('Invalid record');
   ids.add(f.id);
   if(f.translationSourceHash&&createHash('sha256').update(f.statement).digest('hex')!==f.translationSourceHash)throw new Error('Translation mismatch');
   for(const e of f.evidence){if(typeof e.quote!=='string'||!/^https:\/\//.test(e.sourceUrl)||!/^([a-f0-9]{64}|sha256:[a-f0-9]{64})$/.test(e.sourceSnapshotHash)||e.lineEnd<e.lineStart)throw new Error('Invalid evidence');}
  }
 }
 return value;
});
export const loadTulsaContent=cache(async(slug:string,claims:any[])=>{
 if(!isRuntimeUniversity(slug))return null;
 const school=(await loadPackage()).schools[slug];
 if(school.claimsFingerprint!==reviewedClaimsFingerprint(claims))throw new Error('Canonical claim fingerprint mismatch');
 return school;
});
