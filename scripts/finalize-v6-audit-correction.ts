import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {publicEntitySummarySchema,universityToolRecordSchema,policySnapshotSchema, NO_ADVICE_BOUNDARY, type PolicySnapshot,type PolicySnapshotDimensionStatus} from '@uapt/shared';
import {computePolicySnapshotBasisFingerprint,validatePolicySnapshotAgainstPublicData} from '../apps/web/lib/policy-snapshots';
async function main(){
const dir='.local/v6-audit-fix';const raw=JSON.parse(await readFile(dir+'/prepared-records.json','utf8'));const pages=JSON.parse(await readFile(dir+'/prepared-pages.json','utf8'));const digest=(o:unknown)=>createHash('sha256').update(JSON.stringify(o)).digest('hex');
const normalize=(o:any):any=>{if(Array.isArray(o))return o.map(normalize);if(o&&typeof o==='object')return Object.fromEntries(Object.entries(o).map(([k,v])=>[k,typeof v==='string'&&/(At|Modified)$/.test(k)&&v.endsWith('+00:00')?v.replace(/\+00:00$/,'Z'):normalize(v)]));return o;};
const bindingProof=JSON.parse(await readFile(dir+'/source-binding-proof.json','utf8'));
for(const data of Object.values(pages.locales) as any[]){
 const view=data.views['california-institute-of-technology'];
 view.hero.scope.en='In HSS, use AI only as explicitly allowed by the instructor in the course materials; assume other uses are disallowed. Bi 1 rules are course-specific. Admissions rules concern applications; tool access does not approve assessment or sensitive-data use.';
 view.hero.scope.zh='HSS 仅允许教师在课程材料中明确准许的 AI 使用方式；未明确准许的用途应视为不允许。Bi 1 规则仅适用于该课程。招生规则针对申请；工具可用不代表作业或敏感资料获准。';
 const school=data.schools.find((s:any)=>s.slug==='california-institute-of-technology');
 school.topics.find((t:any)=>t.key==='exams').summary='In HSS, the course-material permissions apply to all assignments, including exams; uses not specifically allowed should be assumed disallowed. Bi 1 is a separate course example with its own assessment design, not an institute-wide rule.';
 data.views.ucl.remainingRecordKeys=['enforcement:ucl:ucl-disciplinary-investigation-notice-deadline','enforcement:ucl:ucl-disciplinary-appeal-committee-format'];
 data.views['national-university-of-singapore'].remainingRecordKeys=['enforcement:national-university-of-singapore:nus-fact-5'];
}

for(const summary of raw.summaries){const proof=bindingProof[summary.entity.slug];if(!proof)continue;
 for(const claim of summary.claims)for(const e of claim.evidence){
  const id=e.id?.replace(/:part-\d+$/,'');const b=proof.bindings[id];if(!b)throw Error('Missing verified original binding '+e.id);
  if(!b.quote.includes(e.evidenceSnippet))throw Error('Quote part changed '+e.id);
  const source=proof.sources[b.sourceId];const oldAttribution=structuredClone(e.attribution);
  e.sourceUrl=b.url;e.sourceSnapshotHash=b.rawSha256;e.attribution.sourceUrl=b.url;e.attribution.snapshotHash=b.rawSha256;
  if(b.correctedSourceMapping){const matching=summary.officialSources.find((a:any)=>a.sourceUrl===b.url);if(!matching)throw Error('Missing verified source title '+b.sourceId);e.attribution={...matching,snapshotHash:b.rawSha256};}
  e.snippetLocation=(b.correctedSourceMapping?'Corrected source binding; ':'')+'Continuous extracted-text characters '+b.charStart+'–'+b.charEnd+'; extracted text SHA256 '+b.textSha256+'; raw source SHA256 '+b.rawSha256+'; '+(e.snippetLocation??'');
 }
 const attributions=new Map();for(const e of summary.claims.flatMap((c:any)=>c.evidence))attributions.set(e.attribution.sourceUrl+':'+e.attribution.snapshotHash,e.attribution);summary.officialSources=[...attributions.values()];
}
raw.summaries=raw.summaries.map((s:any)=>publicEntitySummarySchema.parse(normalize(s)));
for(const [slug,list]of Object.entries(raw.toolsBySlug)as [string,any[]][]){
 for(const t of list)t.evidence=t.evidence.flatMap((e:any)=>{const snippets=[];let text=e.evidenceSnippet;while(text.length){let end=Math.min(700,text.length);if(end<text.length&&/[\uD800-\uDBFF]/.test(text[end-1]))end--;snippets.push({...e,evidenceSnippet:text.slice(0,end)});text=text.slice(end);}return snippets;});
 raw.toolsBySlug[slug]=list.map((t:any)=>universityToolRecordSchema.parse(t));
}
const snapshots:Record<string,PolicySnapshot>={};
for(const summary of raw.summaries){const slug=summary.entity.slug;const fp=digest(summary);raw.recordRevisions[slug].recordSha256=fp;
 for(const data of Object.values(pages.locales)as any[]){const school=data.schools.find((s:any)=>s.slug===slug);school.fingerprint=fp;school.checkedAt=summary.lastCheckedAt;
  for(const topic of [...school.topics,...school.additionalTopics])for(const c of topic.claims){const actual=summary.claims.find((x:any)=>x.id===c.id);if(actual)c.evidence=actual.evidence.map((e:any)=>({quote:e.evidenceSnippet,url:e.sourceUrl,title:e.attribution.citationTitle,language:e.sourceLanguage??'en',location:e.snippetLocation,retrievedAt:e.retrievedAt??e.attribution.retrievedAt}));}
  if(data.views[slug]){data.views[slug].school=structuredClone(school);data.views[slug].claims=structuredClone(summary.claims);data.views[slug].sources=structuredClone(summary.officialSources);data.views[slug].tools=structuredClone(raw.toolsBySlug[slug]);}
  if(data.localEvidence[slug]){const e=data.localEvidence[slug];e.record=structuredClone(summary);e.fingerprint=fp;}
 }
 const previous=raw.snapshotInputs[slug];if(!previous)continue;
 const basis={claimIds:summary.claims.map((c:any)=>c.id),sources:[...new Map(summary.claims.flatMap((c:any)=>c.evidence.map((e:any)=>[e.sourceUrl,{sourceUrl:e.sourceUrl,sourceSnapshotHash:e.sourceSnapshotHash}]))).values()]};
 // Some URLs have several captured representations. The snapshot contract binds one per URL,
 // consistently with the shared validator, which selects the last referenced representation.
 const fingerprint=computePolicySnapshotBasisFingerprint(raw.datasetReleaseId,basis,summary.claims);const school=pages.locales.en.schools.find((s:any)=>s.slug===slug);
 const statuses=new Set(['allowed','conditionally_allowed','restricted','blocked','required','recommended','not_mentioned','unclear','insufficient_public_evidence']);
 const candidate={...previous,generatedAt:raw.publishedAt,overallStatus:'needs_review',statusReasons:['review_incomplete'],summary:'Scoped current record '+raw.revision+' has reviewed claims; this regenerated student summary awaits independent review against its own evidence basis.',basis,basisFingerprint:fingerprint,
 dimensions:school.topics.map((t:any)=>({key:t.key,status:statuses.has(t.status)?t.status:'unclear',summary:t.summary.length<=280?t.summary:'Check the current source-specific rules for '+t.title+'. Unit, course, degree, supervisor, data and publisher conditions remain distinct; the reviewed claims and original evidence control this pending summary.',actions:{do:[],dont:[]},basis:['not_mentioned','insufficient_public_evidence'].includes(t.status)?{claimIds:[],sources:[]}:{claimIds:basis.claimIds,sources:basis.sources}})),
 review:{reviewMethod:'dual_agent',reviewState:'needs_review',primary:{agentId:'codex-v6-scoped-correction-author',model:'GPT-6',decision:'approve',reviewedAt:raw.publishedAt,notes:'Regenerated from the scoped reviewed record. No independent second review is claimed.'},secondary:{agentId:'independent-review-pending',model:'not-run',decision:'needs_review',reviewedAt:raw.publishedAt,notes:'Timestamp records pending state, not a completed secondary review.'},agreement:'disagree',reviewedAt:raw.publishedAt},translations:[],limitations:[NO_ADVICE_BOUNDARY,'The current record claims are agent-reviewed, but this new summary has not completed independent secondary review.','Old summary approvals are retained with their historical basis; they do not approve this new fingerprint.','Unit, programme, course, publisher and tool/data scopes remain distinct. Tool access is not assessment permission.','English summaries and original-language evidence are distinct; a source check date is not a policy effective date.']};
 snapshots[slug]=policySnapshotSchema.parse(candidate);const validation=validatePolicySnapshotAgainstPublicData(snapshots[slug],summary,raw.datasetReleaseId);if(validation.effectiveStatus!=='needs_review'||validation.expectedBasisFingerprint!==fingerprint)throw Error('Invalid regenerated snapshot basis '+slug);
}
const removePrivatePointers=(o:any)=>{if(Array.isArray(o)){o.forEach(removePrivatePointers);return;}if(o&&typeof o==='object'){delete o.sourceTextArtifact;Object.values(o).forEach(removePrivatePointers);}};removePrivatePointers(pages);raw.snapshots=snapshots;delete raw.snapshotInputs;const body=JSON.stringify(raw,null,2)+'\n';const pageBody=JSON.stringify(pages,null,2)+'\n';
await mkdir('data/public-v6-records/revisions',{recursive:true});await writeFile('data/public-v6-records/revisions/'+raw.revision+'.json',body);await writeFile('data/public-v6-pages/revisions/'+raw.revision+'.json',pageBody);
const filehash=(s:string)=>createHash('sha256').update(s).digest('hex');
await writeFile(dir+'/validated-pointers.json',JSON.stringify({records:{path:'revisions/'+raw.revision+'.json',sha256:filehash(body),revision:raw.revision,slugs:pages.slugs},pages:{path:'revisions/'+raw.revision+'.json',sha256:filehash(pageBody),releaseId:raw.revision,slugs:pages.slugs}},null,2)+'\n');
console.log(JSON.stringify({revision:raw.revision,schools:raw.summaries.length,currentClaims:raw.summaries.reduce((n:number,s:any)=>n+s.claims.length,0),held: Object.values(raw.heldBySlug).reduce((n:number,c:any)=>n+c.length,0),snapshots:Object.keys(snapshots).length,allSnapshots:'needs_review',schemaValidated:true}));

}
main().catch(e=>{console.error(e);process.exitCode=1});
