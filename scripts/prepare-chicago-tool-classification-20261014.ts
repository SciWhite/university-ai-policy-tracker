import {readFile,writeFile,access} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {publicEntitySummarySchema,universityToolRecordSchema} from '@uapt/shared';
import {loadCatalog,catalogPayloadSchema,digest} from '../apps/mcp/src/catalog';
const dir='.local/chicago-tools-20261014',parent='v6-ntu-chicago-20261014-r2',revision='v6-chicago-tools-20261014',slug='university-of-chicago';
const read=async(p:string)=>JSON.parse(await readFile(p,'utf8'));
const write=(p:string,v:unknown)=>writeFile(p,JSON.stringify(v,null,2)+'\n');
const hash=(v:string|Buffer)=>createHash('sha256').update(v).digest('hex');
async function main(){
 for(const kind of ['records','pages','history'])if(await access(`data/public-v6-${kind}/revisions/${revision}.json`).then(()=>true,()=>false))throw Error('Immutable revision already exists');
 const records=await read(`data/public-v6-records/revisions/${parent}.json`),pages=await read(`data/public-v6-pages/revisions/${parent}.json`);
 const before=structuredClone(records.summaries.find((s:any)=>s.entity.slug===slug));
 const summary=records.summaries.find((s:any)=>s.entity.slug===slug),now=new Date().toISOString(),changed:string[]=[];
 for(const claim of summary.claims){
  let value;try{value=JSON.parse(claim.claimValue);}catch{continue;}
  if(!value?.rawToolName)continue;
  if(value.endorsementType!=='officially_endorsed')throw Error('Unexpected parent classification');
  // The approval table is evidence of data/use conditions, not recommendation,
  // procurement completion, self-hosting, or universal account eligibility.
  value.endorsementType='not_specified';
  if(value.rawToolName==='AI tools embedded in Chrome extensions'){
   value.availability='under_review';
   value.howToObtain=value.howToObtain.replace('Listed data/use approval:','Specific-use review required; approval is not established:');
   claim.claimText='UChicago asks users of AI tools embedded in Chrome extensions to contact the University about their specific use case. Extensions should be carefully vetted because of browsing, keystroke and sensitive-data risks; this entry does not establish approval or assessment permission.';
  }
  claim.claimValue=JSON.stringify(value);claim.lastCheckedAt=now;changed.push(claim.id);
 }
 if(changed.length!==58)throw Error('Expected complete 58-tool classification set');
 summary.lastCheckedAt=now;summary.lastChangedAt=now;
 const checked=publicEntitySummarySchema.parse(summary),fp=hash(JSON.stringify(checked));records.summaries[records.summaries.findIndex((s:any)=>s.entity.slug===slug)]=checked;
 const tools=checked.claims.filter(c=>changed.includes(c.id!)).map(c=>{const v=JSON.parse(c.claimValue!);return universityToolRecordSchema.parse({universitySlug:slug,universityName:checked.entity.name,...v,reviewState:'agent_reviewed',evidence:c.evidence.map(e=>({sourceUrl:e.sourceUrl,evidenceSnippet:e.evidenceSnippet,snapshotHash:e.sourceSnapshotHash,reviewState:'agent_reviewed'}))});});
 records.toolsBySlug[slug]=tools;records.parentRevisionId=parent;records.revision=revision;records.publishedAt=now;
 records.changeSummary={en:'UChicago tool classifications corrected: directory approval is not institutional recommendation; Chrome AI extensions require specific-use review. Existing evidence, access conditions and assessment rules are preserved. This is a Tracker correction, not a new University policy.',zh:'更正芝加哥工具分类：目录准入不等于校方推荐；Chrome AI 扩展须按具体用途审核。保留原有证据、获取条件及考核规则。这是 Tracker 记录更正，不代表大学新颁政策。'};
 records.historical[slug]={baseline:before,snapshot:null,heldClaims:records.heldBySlug[slug]??[]};
 for(const school of pages.slugs)records.changesBySlug[school]={addedClaimIds:[],updatedClaimIds:school===slug?changed:[],heldClaimIds:[]};
 records.recordRevisions[slug]={...records.recordRevisions[slug],universityRevisionId:revision,recordSha256:fp,publishedAt:now};
 records.analysisOverrides[slug].recordSha256=fp;
 pages.releaseId=revision;pages.parentRevisionId=parent;pages.publishedAt=now;pages.changeSummary=records.changeSummary;
 for(const d of Object.values(pages.locales)as any[]){
  const school=d.schools.find((s:any)=>s.slug===slug),view=d.views[slug];
  school.fingerprint=fp;school.revision=revision;school.checkedAt=now;
  for(const topic of [...school.topics,...school.additionalTopics])for(const c of topic.claims){if(!changed.includes(c.id))continue;const actual=checked.claims.find(x=>x.id===c.id)!;c.text=actual.claimText;c.checkedAt=actual.lastCheckedAt;}
  view.school=school;view.claims=checked.claims;
  // Existing presentation contract: directory membership does not assert endorsement.
  view.tools=tools.map(t=>({...t,relationship:'institutional_directory'}));
  view.publication={...view.publication,releaseId:revision,publishedAt:now};
  view.auditCoverage={...view.auditCoverage,publicClaimIds:checked.claims.map(c=>c.id),originalObjectCount:checked.claims.length,institutionAuditStatus:'PARTIAL'};
 }
 for(const[folder,value,key]of [['public-v6-records',records,'revision'],['public-v6-pages',pages,'releaseId']]as const){
  const file=`data/${folder}/revisions/${revision}.json`;await write(file,value);const entry={path:`revisions/${revision}.json`,sha256:hash(await readFile(file)),[key]:revision};
  const registry=await read(`data/${folder}/revisions.json`);registry[revision]=entry;await write(`data/${folder}/revisions.json`,registry);await write(`data/${folder}/current.json`,{...entry,slugs:pages.slugs});
 }
 const history=await read(dir+'/history-export.json');history.basisRevision=revision;const historyPath=`data/public-v6-history/revisions/${revision}.json`;await write(historyPath,history);await write('data/public-v6-history/current.json',{path:`revisions/${revision}.json`,sha256:hash(await readFile(historyPath)),basisRevision:revision});
 const pins=await read('apps/web/lib/policy-v6-review.json');pins.followupCorrections[slug]={fingerprint:fp,reviewedAt:now,method:'agent_scoped_tool_classification_review',revision};await write('apps/web/lib/policy-v6-review.json',pins);
 const catalog=await loadCatalog('.local/ntu-chicago-v6-20261014/mcp-catalog.json');catalog.exportedAt=now;const row=catalog.records.find(r=>r.summary.entity.slug===slug)!;
 row.summary=checked;row.tools=tools;Object.assign(row,{...records.recordRevisions[slug],recordPublishedAt:now});
 const validated=catalogPayloadSchema.parse(catalog);await write(dir+'/mcp-catalog.json',{sha256:digest(validated),payload:validated});await loadCatalog(dir+'/mcp-catalog.json');
 await write(dir+'/decisions.json',{revision,checkedAt:now,changedClaimIds:changed,remainingClaimIds:[],currentClaimCount:101,currentToolCount:58,institutionAuditStatus:'PARTIAL',recommendationNotEstablished:58,conditionallyAllowed:57,underReview:1,officialUrl:'https://genai.uchicago.edu/generative-ai-tools/approved-and-restricted-ai-tools',reason:'Approval conditions and enterprise-support labels do not establish recommendation, universal licences, completed procurement, or universal student access. Preserve the exact support/payment labels and restrictions; do not invent a stronger endorsement enum.'});
 console.log(JSON.stringify({revision,recordSha256:fp,claims:checked.claims.length,tools:tools.length,changedClaimIds:changed.length}));
}
main().catch(e=>{console.error(e);process.exitCode=1});
