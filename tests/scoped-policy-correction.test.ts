import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {loadImperialRepair} from '../apps/web/lib/public-record-repairs';
import {buildPolicyAnalysisProfile} from '../apps/web/lib/policy-analysis';
import {validatePolicySnapshotAgainstPublicData} from '../apps/web/lib/policy-snapshots';
import {loadCatalog} from '../apps/mcp/src/catalog';
import {PolicyService} from '../apps/mcp/src/policy';

const root=process.cwd();
test('scoped repairs consume every valid dimension and keep student summaries held with exact source bases',async()=>{
 for(const [prefix,slug,count] of [['stanford','stanford-university',15],['oxford','university-of-oxford',16]] as const){
  const {repaired,snapshot}=await loadImperialRepair(root,`${prefix}-20261011-codex`,true,slug);
  assert.equal(repaired.claims.length,count);assert.equal(buildPolicyAnalysisProfile(repaired).dimensions.length,11);
  const validation=validatePolicySnapshotAgainstPublicData(snapshot,repaired,'public-release-20260924-002');
  assert.equal(validation.effectiveStatus,'needs_review');assert(validation.issues.every(i=>i.code==='review_incomplete'));
  assert.equal(validation.expectedBasisFingerprint,snapshot.basisFingerprint);
  for(const c of repaired.claims)for(const e of c.evidence){assert.equal(e.sourceUrl,e.attribution.sourceUrl);assert.equal(e.sourceSnapshotHash,e.attribution.snapshotHash);assert(e.id);assert.equal(e.sourceLanguage,'en');}
  const exams=snapshot.dimensions.find((d:any)=>d.key==='exams');assert(exams);
  if(prefix==='stanford'){assert.match(exams.summary,/may not ban/);assert.match(exams.summary,/unless instructors/);assert(!exams.summary.includes('unless restricted'));}
  else{assert(repaired.claims.find(c=>c.id==='clm-university-of-oxford-ai-pgr-permitted-uses')!.claimText.startsWith('For MPLS'));assert.equal(repaired.claims.find(c=>c.id==='clm-university-of-oxford-ai-security-risk-assessment')!.claimType,'source_status');}
 }
});
test('invalid analysis status is refused by the loader before it can cause an SSR failure',async()=>{
 const temporary=await mkdtemp(path.join(tmpdir(),'uapt-scoped-'));const revision='stanford-20261011-codex';
 try{
  const dir=path.join(temporary,'data/public-record-repairs',revision);await mkdir(dir,{recursive:true});
  for(const name of ['record.json','analysis-dimensions.json','candidate-student-snapshot.json','candidate-manifest.json'])await writeFile(path.join(dir,name),await readFile(path.join(root,'data/public-record-repairs',revision,name)));
  const file=path.join(dir,'analysis-dimensions.json');const a=JSON.parse(await readFile(file,'utf8'));a.exams.status='prohibited_by_default';const bytes=JSON.stringify(a);await writeFile(file,bytes);
  const mfile=path.join(dir,'candidate-manifest.json');const m=JSON.parse(await readFile(mfile,'utf8'));m.analysisSha256=createHash('sha256').update(bytes).digest('hex');await writeFile(mfile,JSON.stringify(m));
  await assert.rejects(()=>loadImperialRepair(temporary,revision,true,'stanford-university'));
 }finally{await rm(temporary,{recursive:true,force:true});}
});
