import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {publicEntitySummarySchema,policySnapshotSchema,policyAnalysisDimensionKeySchema,analysisDimensionStatusSchema} from '@uapt/shared';
import {computePolicySnapshotBasisFingerprint,validatePolicySnapshotAgainstPublicData} from '../apps/web/lib/policy-snapshots';
import {buildPolicyAnalysisProfile} from '../apps/web/lib/policy-analysis';
import {readRecordCorrectionChanges} from '../apps/web/lib/record-correction-changes';
import {getChangeIndexData,getEntityChangeHistory} from '../apps/web/lib/change-records';

const digest=(b:Buffer|string)=>createHash('sha256').update(b).digest('hex');
const save=async(file:string,value:unknown)=>writeFile(file,JSON.stringify(value,null,2)+'\n');
async function main(){
 if(process.env.UAPT_BUILD_CORRECTION_CHANGES!=='1')throw new Error('Explicit local projection preparation required');
 process.env.NEXT_PUBLIC_SITE_URL='https://eduaipolicy.org';
 for(const prefix of ['stanford','oxford']){
  const root=path.resolve('data/public-record-repairs');
  const pin=JSON.parse(await readFile(path.join(root,`${prefix}-current.json`),'utf8'));
  const dir=path.join(root,pin.revision);
  const record=publicEntitySummarySchema.parse(JSON.parse(await readFile(path.join(dir,'record.json'),'utf8')));
  const analysis=JSON.parse(await readFile(path.join(dir,'analysis-dimensions.json'),'utf8'));
  for(const [key,item] of Object.entries(analysis) as [string,any][]){
   policyAnalysisDimensionKeySchema.parse(key);analysisDimensionStatusSchema.parse(item.status);
   if(item.claimIds.some((id:string)=>!record.claims.some(c=>c.id===id)))throw new Error('Missing analysis basis');
  }
  const snap=JSON.parse(await readFile(path.join(dir,'candidate-student-snapshot.json'),'utf8'));
  snap.overallStatus='needs_review';snap.statusReasons=['review_incomplete'];snap.review.reviewState='needs_review';snap.review.agreement='disagree';
  const summaries=prefix==='stanford'?{
   coursework:'BCA guidance treats AI like human assistance. PWR limits major-assignment composition. GSB MBA/MSx instructors may not ban AI for take-home coursework; in-class rules differ.',
   exams:'GSB MBA/MSx instructors may not ban take-home exam AI use. Law’s default rule requires advance written authorization. MD/MSPA prohibits closed-book/no-internet use unless instructors explicitly advise otherwise.',
   disclosure:'BCA recommends acknowledgement of non-incidental AI assistance. MD/MSPA requires disclosure and citation of substantial contributions. Law’s default policy requires advance disclosure and authorization.',
   privacy_data:'Public AI platforms must not receive PHI. AI Playground supports High-Risk non-PHI, with PHI review pending. Institutional data approvals require the correct account and do not grant clinical or coursework permission.',
   approved_tools:'UIT offers ChatGPT Edu, Claude for Education and Gemini Enterprise through an institutional pilot. Standard access and paid higher tiers differ. Students must follow school, course and task rules.',
   research_publication:'MD/MSPA rules require disclosure and citation of substantial AI contributions and prohibit AI authorship. These educational rules do not establish a verified university-wide publication policy.'
  }:{
   coursework:'Follow the AI-use declaration for each summative assessment. Breaching task specifications constitutes cheating and may constitute plagiarism. Permitted AI use requires the prescribed acknowledgement.',
   exams:'Assessment-specific instructions determine permitted AI assistance. Tool access does not grant exam permission. Check the rules for the task, course and department.',
   disclosure:'MPLS thesis statements apply from Trinity Term 2026. Supporting AI code should be declared, excluding debugging. Oxford research policy says substantive use should be declared; conditional prompt/output duties are separate.',
   privacy_data:'University SSO tools have specified data ratings; consumer accounts do not inherit them. Detailed public security guidance has moved. Current custom-GPT and transcription-bot conditions remain unverified.',
   approved_tools:'The retiring Oxford public guide lists ChatGPT Edu, Codex, Gemini and Copilot Chat as SSO platforms. Standard access and paid upgrades differ. Consult successor guidance; tool access is not assessment permission.',
   research_publication:'Discrete-tool substantive research use should be declared; prompts/outputs must be available where relevant. MPLS supporting code is permitted only when it is not substantive output; debugging is exempt from declaration.'
  };
  const claims=new Map(record.claims.map(c=>[c.id,c]));
  for(const d of snap.dimensions){
   d.summary=summaries[d.key as keyof typeof summaries];
   d.actions={do:['Follow the applicable unit, course and task instructions.','Consult the linked original English evidence and current University guidance.'],dont:['Do not infer assessment or clinical permission from tool access.']};
   d.basis.claimIds=d.basis.claimIds.filter((id:string)=>claims.has(id));
   const refs=new Map<string,any>();for(const id of d.basis.claimIds)for(const e of claims.get(id)!.evidence)refs.set(e.sourceUrl,{sourceUrl:e.sourceUrl,sourceSnapshotHash:e.sourceSnapshotHash});
   d.basis.sources=[...refs.values()];
  }
  const ids=[...new Set(snap.dimensions.flatMap((d:any)=>d.basis.claimIds))] as string[];
  const refs=new Map<string,any>();for(const id of ids)for(const e of claims.get(id)!.evidence)refs.set(e.sourceUrl,{sourceUrl:e.sourceUrl,sourceSnapshotHash:e.sourceSnapshotHash});
  snap.basis={claimIds:ids,sources:[...refs.values()]};
  snap.basisFingerprint=computePolicySnapshotBasisFingerprint(snap.releaseId,snap.basis,record.claims);
  snap.translations=[];
  policySnapshotSchema.parse(snap);
  const validation=validatePolicySnapshotAgainstPublicData(snap,record,'public-release-20260924-002');
  if(validation.issues.some(i=>i.code!=='review_incomplete'))throw new Error(JSON.stringify(validation));
  await save(path.join(dir,'candidate-student-snapshot.json'),snap);
  pin.snapshotSha256=digest(await readFile(path.join(dir,'candidate-student-snapshot.json')));pin.candidateSnapshotBasisFingerprint=snap.basisFingerprint;
  await save(path.join(root,`${prefix}-current.json`),pin);await save(path.join(dir,'candidate-manifest.json'),pin);
  const indexFile=path.resolve('data/policy-snapshots/v1/index.json');const index=JSON.parse(await readFile(indexFile,'utf8'));
  const entry=index.entries.find((e:any)=>e.universitySlug===record.entity.slug);
  for(const key of ['universityName','overallStatus','releaseId','generatedAt','basisFingerprint','publicJsonUrl'])entry[key]=snap[key];entry.locales=[];
  await save(indexFile,index);await save(path.resolve('data/policy-snapshots/v1/universities',`${record.entity.slug}.json`),snap);
 }
 const root=path.resolve('data/public-record-repairs');const dir=path.join(root,'change-cache');await mkdir(dir,{recursive:true});
 const projections:Record<string,unknown>={'index.json':await getChangeIndexData()};
 for(const entry of await readRecordCorrectionChanges())projections[`${entry.slug}.json`]=await getEntityChangeHistory(entry.slug);
 const files:Record<string,string>={};for(const [name,value] of Object.entries(projections)){await save(path.join(dir,name),value);files[name]=digest(await readFile(path.join(dir,name)));}
 await save(path.join(dir,'manifest.json'),{schemaVersion:'uapt-public-correction-change-cache-v1',journalSha256:digest(await readFile(path.join(root,'change-log.json'))),baselineSha256:digest(await readFile(path.join(root,'change-index-baseline.json'))),files});
 console.log(JSON.stringify({prepared:Object.keys(projections),studentSummaries:'held',publication:'requires frozen synchronization event and exact candidate acceptance before cutover'}));
}
main().catch(error=>{console.error(error);process.exitCode=1});
