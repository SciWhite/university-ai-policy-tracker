import {readFile,writeFile,mkdir,copyFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {existsSync} from 'node:fs';
import {publicEntitySummarySchema, policySnapshotSchema,NO_ADVICE_BOUNDARY} from '@uapt/shared';
import {reviewedClaimsFingerprint} from '../apps/web/lib/index-recovery-basis';
import {computePolicySnapshotBasisFingerprint} from '../apps/web/lib/policy-snapshots';
import {getPolicyScenePilot} from '../apps/web/lib/policy-scene-pilot';

const slug='massachusetts-institute-of-technology';
const folder='data/public-record-repairs/mit-20261010';
const hash=(s:string|Buffer)=>createHash('sha256').update(s).digest('hex');
const json=async(p:string)=>JSON.parse(await readFile(p,'utf8'));
const write=async(p:string,v:unknown)=>writeFile(p,JSON.stringify(v,null,2)+'\n');

async function main(){
 const bytes=await readFile(`${folder}/record.json`);
 const record=publicEntitySummarySchema.parse(JSON.parse(bytes.toString()));
 const baseline=publicEntitySummarySchema.parse(await json(`${folder}/baseline.json`));
 const now=record.lastCheckedAt!;
 await write('data/public-record-repairs/current.json',{schemaVersion:'uapt-public-record-repairs-v1',revision:'mit-20261010',slug,publicationApproved:true,publishedAt:now,baselineClaimsFingerprint:reviewedClaimsFingerprint(baseline.claims),recordSha256:hash(bytes),scope:'MIT only; global historical release manifests remain unchanged'});
 const snapshotPath=`data/policy-snapshots/v1/universities/${slug}.json`;
 if(!existsSync(`${folder}/historical-student-snapshot.json`))await copyFile(snapshotPath,`${folder}/historical-student-snapshot.json`);
 const snapshot=await json(`${folder}/historical-student-snapshot.json`);
 const selected:Record<string,string[]>={coursework:[`clm-${slug}-course-policy-framework`],exams:[],disclosure:[`clm-${slug}-disclosure`],privacy_data:[`clm-${slug}-high-risk-prohibition`],approved_tools:[`clm-${slug}-approved-tools-list`],research_publication:[`clm-${slug}-thesis-ai-acknowledgment`]};
 const basis=(ids:string[])=>({claimIds:ids,sources:[...new Map(ids.flatMap(id=>record.claims.find(c=>c.id===id)!.evidence.map(e=>[e.sourceUrl,{sourceUrl:e.sourceUrl,sourceSnapshotHash:e.sourceSnapshotHash}] as const))).values()]});
 snapshot.dimensions=snapshot.dimensions.map((d:any)=>({key:d.key,status:({coursework:'unclear',exams:'not_mentioned',disclosure:'recommended',privacy_data:'restricted',approved_tools:'conditionally_allowed',research_publication:'recommended'} as any)[d.key],summary:({coursework:'Course-specific rules determine assessment permission; MIT does not impose a single classroom AI policy.',exams:'No universal exam permission is established; follow the actual exam instructions.',disclosure:'MIT Libraries provides citation guidance; applicable class and publication requirements may differ.',privacy_data:'Public GenAI must not receive Medium Risk MIT data; no GenAI tool may receive High Risk MIT data.',approved_tools:'MIT-licensed tool access is subject to eligibility and data restrictions and is not assessment permission.',research_publication:'The August 2026 committee report recommends thesis AI-use statements and excluding AI from co-authorship; this is not a newly established mandatory thesis rule.'} as any)[d.key],actions:{do:[],dont:[]},basis:basis(selected[d.key])}));
 snapshot.basis=basis(Object.values(selected).flat());snapshot.basisFingerprint=computePolicySnapshotBasisFingerprint(snapshot.releaseId,snapshot.basis,record.claims);
 snapshot.generatedAt=now;snapshot.overallStatus='needs_review';snapshot.statusReasons=['review_incomplete'];snapshot.summary='MIT data restrictions and tool access are separate from course permission. This corrected student summary awaits independent secondary review; consult the current reviewed claims and official sources.';
 snapshot.scope='mixed';snapshot.academicContexts=['assignment','exam','thesis','research','administrative_work'];
 snapshot.review={reviewMethod:'dual_agent',reviewState:'needs_review',primary:{agentId:'codex-mit-repair-author',model:'GPT-6',decision:'approve',reviewedAt:now,notes:'Current sources recaptured and scoped claims checked; no second reviewer claimed.'},secondary:{agentId:'independent-review-pending',model:'not-run',decision:'needs_review',reviewedAt:now,notes:'No secondary review conducted for this revision. Timestamp records the pending state.'},agreement:'disagree',reviewedAt:now};
 snapshot.limitations=[NO_ADVICE_BOUNDARY,'This corrected student summary awaits independent secondary review; it is not an official MIT determination.','Tool availability is not permission for a class, assessment, thesis, or research project.','English official evidence is canonical; the interface language does not imply a translated policy.','Two historical IS&T provisions remain unverified for current applicability.'];snapshot.translations=[];
 policySnapshotSchema.parse(snapshot);await write(snapshotPath,snapshot);
 const index=await json('data/policy-snapshots/v1/index.json');const entry=index.entries.find((e:any)=>e.universitySlug===slug);Object.assign(entry,{overallStatus:snapshot.overallStatus,generatedAt:now,basisFingerprint:snapshot.basisFingerprint,locales:[]});await write('data/policy-snapshots/v1/index.json',index);
 let schoolsSource=await readFile('apps/tulsa-zone/lib/schools.ts','utf8');for(const list of ['newRuntimeUniversitySlugs','runtimeUniversitySlugs']){const marker=`export const ${list} = [`;const section=schoolsSource.split(marker)[1].split('] as const')[0];if(!section.includes('"'+slug+'"'))schoolsSource=schoolsSource.replace(marker,marker+'\n  "'+slug+'",');}await writeFile('apps/tulsa-zone/lib/schools.ts',schoolsSource);
 const pkg=await json('apps/tulsa-zone/content/revisions/universities-v5-b-20261009.json');
 const originalScene=getPolicyScenePilot(slug,baseline.claims,true,false,{isPreview:true});if(!originalScene)throw Error('Missing reviewed MIT illustration');
 const scene=structuredClone(originalScene);
 const href=(suffix:string)=>`#claim-clm-${slug}-${suffix}`;
 scene.guidance='Follow your course rules. Public GenAI tools must not receive Medium Risk MIT data; no GenAI tool may receive High Risk MIT data. Licensed access is not assessment permission.';
 scene.scopeDetail='Current IS&T restrictions apply by data classification. Citation guidance and committee recommendations must not be treated as a universal mandatory coursework rule.';
 scene.snapshotNotice='Current claims were corrected on October 10, 2026. The student summary awaits independent secondary review; two historical provisions are held.';
 scene.quickGuide!.scopeNote=scene.guidance;
 scene.quickGuide!.do.checks=[{text:'Read the AI policy for your course and assignment.',evidenceHref:href('course-policy-framework') as any},{text:'Follow applicable citation and disclosure guidance.',evidenceHref:href('disclosure') as any},{text:'Check licensed access and data classification.',evidenceHref:href('approved-tools-list') as any}];
 scene.quickGuide!.dont.checks=[{text:'Never enter High Risk MIT data into GenAI.',evidenceHref:href('high-risk-prohibition') as any},{text:'Do not enter Medium Risk MIT data into public GenAI.',evidenceHref:href('high-risk-prohibition') as any},{text:'Do not treat tool access as assessment permission.',evidenceHref:href('approved-tools-list') as any}];
 const sceneZh=structuredClone(scene);sceneZh.eyebrow='本站使用指南';sceneZh.title='先查课程要求，再核对数据风险。';sceneZh.guidance='遵守课程及作业说明。公开生成式 AI 不得接收 MIT 中风险数据；任何生成式 AI 都不得接收高风险数据。工具访问权不等于评估许可。';sceneZh.scopeDetail='按数据等级核对 IS&T 限制；引用指导和委员会建议不等于全校作业强制要求。';sceneZh.snapshotNotice='已按当前官网修正主张；学生摘要等待独立复核，两项历史规定仍待核查。';sceneZh.quickGuide!.scopeNote=sceneZh.guidance;
 sceneZh.quickGuide!.do.checks.forEach((c,i)=>c.text=['查本课程及作业的 AI 规则。','遵守适用的引用与披露要求。','核对授权访问及数据风险等级。'][i]);sceneZh.quickGuide!.dont.checks.forEach((c,i)=>c.text=['不要把高风险 MIT 数据输入任何生成式 AI。','不要把中风险 MIT 数据输入公开生成式 AI。','不要将工具访问权当作评估许可。'][i]);
 const allowed=new Set(['id','group','sourceNature','appliesToAI','modality','statement','translationSourceHash','localSummary','emphasis','deadlines','scope','conditions','exceptions','evidence']);
 const allRecords=(await json('apps/web/lib/enforcement-v4-refresh-data.json'))[slug];
 const records=allRecords.map((r:any)=>Object.fromEntries(Object.entries(r).filter(([k])=>allowed.has(k))));
 const suspension=records.find((r:any)=>r.id==='mit-fact-07');
 const c=record.claims.find(c=>c.id===`clm-${slug}-suspension-return-limits`)!;const source=c.evidence[0];
 suspension.statement='Suspension removes a student from MIT for a defined period and is noted on the transcript and internal grade report. Return requires permission through OSCCS after satisfying the conditions; approval does not guarantee return to the same department, program, lab, or position.';
 suspension.localSummary={en:suspension.statement,zh:'停学有期限并记入成绩单及内部成绩记录。满足条件后须经 OSCCS 申请获准返校；批准返校不保证回到原系、项目、实验室或职位。'};suspension.translationSourceHash=hash(suspension.statement);
 // Refresh every display evidence passage against the captured current source.
 const provenance=await json(`${folder}/source-provenance.json`);
 const normalize=(text:string)=>text.replace(/\s+/g,' ').trim();
 for(const display of records){
   if(display.id==='mit-fact-07')display.evidence=[
     {sourceUrl:'https://cod.mit.edu/rules/section11/',quote:'Removal of a student from the Institute for a defined period of time.'},
     {sourceUrl:'https://cod.mit.edu/rules/section11/',quote:'Suspension is noted on a respondent’s transcript and internal grade report, but not on the end-of-term grade summaries.'},
     {sourceUrl:'https://cod.mit.edu/rules/section11/',quote:'At the end of a suspension period, a suspended student must apply for permission to return to MIT through OSCCS, demonstrating that all requirements of the suspension have been satisfied.'},
     {sourceUrl:source.sourceUrl,quote:source.evidenceSnippet}
   ];
   display.evidence=await Promise.all(display.evidence.map(async(e:any)=>{
     const provenanceSource=provenance.find((p:any)=>p.sourceUrl===e.sourceUrl);if(!provenanceSource)throw Error(`No current source for ${e.sourceUrl}`);
     const text=await readFile(`.local/mit-repair-evidence/${provenanceSource.key}.txt`,'utf8');const q=normalize(e.quote);const offset=normalize(text).indexOf(q);if(offset<0)throw Error(`Nonverbatim display evidence ${display.id}`);
     let cursor=0,lineStart=0,lineEnd=0;
     text.split('\n').forEach((line,i)=>{const n=normalize(line).length;if(cursor<=offset&&offset<cursor+n+1)lineStart=i+1;if(cursor<=offset+q.length-1&&offset+q.length-1<cursor+n+1)lineEnd=i+1;cursor+=n+1;});
     return {sourceId:`mit-current-${provenanceSource.key}-${provenanceSource.normalizedTextSha256.slice(0,12)}`,sourceUrl:e.sourceUrl,sourceSnapshotHash:provenanceSource.normalizedTextSha256,retrievedAt:provenanceSource.retrievedAt,quote:q,lineStart,lineEnd};
   }));
 }
 const fp=reviewedClaimsFingerprint(record.claims)!;
 pkg.schools[slug]={slug,claimsFingerprint:fp,scene,sceneZh,records,heldClaims:record.claims.filter(c=>c.reviewState==='needs_review').map(c=>({id:c.id,text:c.claimText,sourceUrl:c.evidence[0].sourceUrl}))};
 pkg.revision='universities-v5-mit-20261010';pkg.recordCounts[slug]=records.length;pkg.scenePins[slug]=fp;
 pkg.releaseScope.newRouteSlugs.unshift(slug);pkg.releaseScope.newRouteSchoolCount++;pkg.releaseScope.includedSchoolCount++;
 const packagePath=`apps/tulsa-zone/content/revisions/${pkg.revision}.json`;await write(packagePath,pkg);await write('apps/tulsa-zone/content/current.json',{revision:pkg.revision,sha256:hash(await readFile(packagePath))});
 for(const name of ['mit-mechanism-hero-v2.jpg','mit-mechanism-do-v3.jpg','mit-mechanism-dont-v3.jpg']){const target=`apps/tulsa-zone/public/assets/policy-scenes/${name}`;await mkdir('apps/tulsa-zone/public/assets/policy-scenes',{recursive:true});await copyFile(`apps/web/public/assets/policy-scenes/${name}`,target);}
 console.log(JSON.stringify({claims:record.claims.length,reviewed:26,held:2,schools:Object.keys(pkg.schools).length,mitSupplementRecords:records.length,claimsFingerprint:fp,contentRevision:pkg.revision}));
}
main().catch(e=>{console.error(e);process.exitCode=1;});
