import {readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {reviewedClaimsFingerprint} from '../apps/web/lib/index-recovery-basis';
import {getStagedPublicSummaryBySlug} from '../apps/web/lib/staged-public-data';
const hash=(v:string|Buffer)=>createHash('sha256').update(v).digest('hex');
const norm=(s:string)=>s.replace(/\s+/g,' ').trim();
const json=async(p:string)=>JSON.parse(await readFile(p,'utf8'));
const write=async(p:string,v:unknown)=>writeFile(p,JSON.stringify(v,null,2)+'\n');
async function main(){
 const evidenceRoot=process.env.UAPT_IMPERIAL_EVIDENCE_ROOT;if(!evidenceRoot)throw Error('Explicit private source evidence root required');
 const slug='imperial-college-london';const root='apps/tulsa-zone/content';const pin=await json(root+'/current.json');const pkg=await json(`${root}/revisions/${pin.revision}.json`);
 const before=JSON.stringify(Object.fromEntries(Object.entries(pkg.schools).filter(([s])=>s!==slug)));
 const record=await getStagedPublicSummaryBySlug(slug);if(!record)throw Error('Published Imperial repair unavailable');
 const school=pkg.schools[slug];const fp=reviewedClaimsFingerprint(record.claims)!;
 const provenance=await json(path.join(evidenceRoot,'source-provenance.json'));
 for(const display of school.records){
  if(['icl-misconduct-appeal-deadline','icl-appeal-grounds'].includes(display.id)){
   display.scope.qualifiers.push('Applies under the Academic Misconduct procedure; postgraduate research misconduct is dealt with under Ordinance D17.');
   display.exceptions.push('This record does not establish appeal deadlines under the separate PGR research-misconduct procedure.');
  }
  if(display.id==='icl-detection-evidence-report')display.conditions.push("Originality/plagiarism checking is distinct from AI-writing detection. Imperial states it does not use Turnitin's AI-writing detection in assessment in 2026–27.");
  for(const e of display.evidence){
   const p=provenance.find((p:any)=>p.sourceUrl===e.sourceUrl);if(!p)throw Error(`Missing current source for ${e.sourceUrl}`);
   const bytes=await readFile(path.join(evidenceRoot,p.normalizedFilePath??p.extractedTextPath));if(hash(bytes)!==p.normalizedSha256)throw Error('Captured source hash mismatch');
   const lines=bytes.toString().split('\n').map(l=>l.replace(/^\d{5}: /,''));const full=norm(lines.join('\n'));
   if(display.id==='icl-detection-evidence-report' && e.quote.startsWith('25. Any allegation')){const start=full.indexOf('25. Any allegation');const end=full.indexOf('26. Any allegation',start);if(start<0||end<0)throw Error('Misconduct report source span missing');e.quote=full.slice(start,end).trim();}
   if(display.id==='imperial-college-london-bing-v5-01')e.quote=lines.slice(137,139).join('\n');
   const q=norm(e.quote);const offset=full.indexOf(q);if(offset<0)throw Error(`Display quote is not verbatim: ${display.id}`);
   let cursor=0,start=0,end=0;
   lines.forEach((l,i)=>{const n=norm(l).length;if(n){if(cursor<=offset&&offset<cursor+n+1)start=i+1;if(cursor<=offset+q.length-1&&offset+q.length-1<cursor+n+1)end=i+1;cursor+=n+1;}});
   Object.assign(e,{quote:q,lineStart:start,lineEnd:end,sourceId:`imperial-current-${p.idHint}-${p.normalizedSha256.slice(0,12)}`,sourceSnapshotHash:p.normalizedSha256,retrievedAt:p.retrievedAtUtc});
  }
 }
 const scene=school.scene;const href=(suffix:string)=>`#claim-clm-${slug}-${suffix}`;
 scene.evidenceLabel='Read the reviewed claims and original evidence';scene.evidenceHref=href('dept-assessment-policy');
 scene.guidance='Check the assessment brief and university rules. Library acknowledgment guidance is recommended; permitted dAIsy use in assessed work requires acknowledgment and transparency. Tool access does not grant assessment permission.';
 scene.scopeDetail='Course and task permissions, tool access, data handling, and misconduct procedures have distinct scopes. PGR research misconduct is routed to Ordinance D17.';
 scene.snapshotNotice='Current claims checked against official sources on October 11, 2026. The separately revised student summary awaits a new dual-agent review.';
 scene.quickGuide.scopeNote=scene.guidance;
 scene.quickGuide.do.checks=[{text:'Check the current assessment brief and applicable university rules.',evidenceHref:href('dept-assessment-policy')},{text:'Acknowledge permitted dAIsy use in assessed work; follow task-specific requirements.',evidenceHref:href('ai-acknowledgment')},{text:'Check institutional access, eligibility and data handling.',evidenceHref:'#claim-cl-imperial-college-london-institutional-ai-service-17'}];
 scene.quickGuide.dont.checks=[{text:'Do not use AI for assessed work without the required permission.',evidenceHref:href('ai-misconduct')},{text:'Do not ignore applicable acknowledgment requirements.',evidenceHref:href('ai-acknowledgment')},{text:'Do not treat dAIsy access as assessment permission.',evidenceHref:'#claim-cl-imperial-college-london-institutional-ai-service-17'}];
 for(const card of scene.storyCards??[]){if(card.placement==='disclosure'){card.summary='Library guidance recommends acknowledgment; permitted dAIsy use in assessed work requires acknowledgment and transparency. Follow the task-specific format.';card.evidenceHref=href('ai-acknowledgment');}else card.evidenceHref=card.placement==='approved_tools'?'#claim-cl-imperial-college-london-institutional-ai-service-17':href('dept-assessment-policy');}
 const zh=structuredClone(scene);zh.title='先查课程许可，再核对披露与数据条件。';zh.eyebrow='本站使用指南';zh.guidance='核对作业说明及大学规则。图书馆建议披露 AI 使用；获准在评估作品中使用 dAIsy 时，必须说明并保持透明。工具访问权不等于评估许可。';zh.scopeDetail='课程许可、工具访问、数据处理及学术不端程序的适用范围不同。研究生科研不端转由 D17 条例处理。';zh.snapshotNotice='2026 年 10 月 11 日已核对官网主张；另行修订的学生摘要仍待新的双代理复核。';zh.evidenceLabel='查看已审核主张与官方原文';zh.quickGuide.scopeNote=zh.guidance;
 zh.quickGuide.do.checks.forEach((c:any,i:number)=>c.text=['核对本次作业说明及大学规则。','获准使用 dAIsy 完成评估作品时按要求披露。','核对机构访问资格及数据处理条件。'][i]);zh.quickGuide.dont.checks.forEach((c:any,i:number)=>c.text=['未获所需许可时不要用 AI 制作评估作品。','不要忽略适用的披露要求。','不要把 dAIsy 访问权当作作业许可。'][i]);
 zh.storyCards.forEach((c:any)=>{if(c.placement==='disclosure'){c.title='说明获准的 AI 使用';c.summary='图书馆建议披露；获准在评估作品中使用 dAIsy 时须说明并保持透明，按本任务要求选择格式。';}else if(c.placement==='approved_tools'){c.title='访问工具前，先核对任务许可';c.summary='机构提供 dAIsy，不代表允许用于本次评估作品。';}else{c.title='遵守本次评估要求';c.summary='院系可对具体评估允许或禁止使用 AI；先查最新作业说明。';}});
 school.sceneZh=zh;school.claimsFingerprint=fp;pkg.scenePins[slug]=fp;pkg.recordCounts[slug]=school.records.length;
 if(before!==JSON.stringify(Object.fromEntries(Object.entries(pkg.schools).filter(([s])=>s!==slug))))throw Error('Unexpected change outside Imperial');
 pkg.revision='universities-v5-imperial-20261011';const target=`${root}/revisions/${pkg.revision}.json`;await write(target,pkg);await write(root+'/current.json',{revision:pkg.revision,sha256:hash(await readFile(target))});
 console.log(JSON.stringify({revision:pkg.revision,schools:Object.keys(pkg.schools).length,imperialDisplayRecords:school.records.length,fingerprint:fp,otherSchoolsUnchanged:true}));
}
main().catch(e=>{console.error(e.message);process.exitCode=1});
