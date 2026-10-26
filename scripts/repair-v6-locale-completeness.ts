import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {isDeepStrictEqual} from 'node:util';
import {v6CompletenessContentHash,validateV6Completeness} from '../apps/web/lib/policy-v6-completeness';
import {editorialContentHash,validateV6EditorialProjection} from '../apps/web/lib/policy-v6-editorial-projection';
import {presentationEvidenceHash} from '../apps/web/lib/policy-v6-presentation-evidence';
import {acceptV6Release} from './lib/v6-release-contract';

// Explicit immutable input/output. This does not select a public pointer or deploy.
const [source,output,revision]=process.argv.slice(2);
if(!source||!output||!revision||!/^[a-z0-9-]+$/.test(revision))throw Error('Usage: repair-v6-locale-completeness <frozen-parent> <NEW-output> <revision>');
mkdirSync(output);const read=(name:string)=>JSON.parse(readFileSync(resolve(source,name),'utf8'));
const pages=read('pages.json'),records=read('records.json'),oldRecords=structuredClone(records),oldPages=structuredClone(pages);
const at=new Date().toISOString(),slugs=pages.slugs.slice(-20),deltas:unknown[]=[],receipts:unknown[]=[];
if(slugs[0]!=='universite-paris-saclay'||slugs.at(-1)!=='purdue-university')throw Error('Unexpected frozen repair cohort');
pages.releaseId=revision;pages.publishedAt=at;records.parentRevisionId=records.revision;records.revision=revision;records.publishedAt=at;
for(const slug of slugs){
 const prior=records.recordRevisions[slug];records.recordRevisions[slug]={...prior,universityRevisionId:revision,previousRevisionId:prior.universityRevisionId,publishedAt:at};
 for(const [locale,data]of Object.entries(pages.locales)as [string,any][]){
  const view=data.views[slug],oldView=oldPages.locales[locale].views[slug],language=locale==='zh'?'zh':'en';
  for(const topic of [...view.school.topics,...view.school.additionalTopics]){
   for(const [field,value]of Object.entries({title:view.topicLabels[topic.key][language],statusLabel:view.topicLabels[topic.key+':status'][language],summary:view.topicSummaries[topic.key][language],scope:view.topicScopes[topic.key][language]})){
    if(topic[field]!==value){deltas.push({slug,locale,topic:topic.key,field,before:topic[field],after:value});topic[field]=value;}
   }
   for(const [field,value]of Object.entries({meaningEn:view.topicScopes[topic.key].en,meaningZh:view.topicScopes[topic.key].zh})){
    const target=view.studentActions.topics[topic.key];
    if(target[field]!==value){deltas.push({slug,locale,topic:topic.key,field:'studentActions.topics.'+field,before:target[field],after:value});target[field]=value;}
   }
  }
  view.school.revision=revision;view.studentActions.universityRevisionId=revision;
  view.publication={...view.publication,releaseId:revision,publishedAt:at};
  // Prior evidence/actions are retained byte for byte apart from the presentation revision.
  const oldActions=structuredClone(oldView.studentActions),newActions=structuredClone(view.studentActions);
  delete oldActions.universityRevisionId;delete newActions.universityRevisionId;
  // Scope popovers now use the already accepted explicit scope mapping, rather than repeating the summary.
  delete oldActions.topics;delete newActions.topics;
  if(!isDeepStrictEqual(oldActions,newActions)||!isDeepStrictEqual(view.claims,oldView.claims)||!isDeepStrictEqual(view.tools,oldView.tools))throw Error('Policy/action/evidence mutation');
  const contentSha256=editorialContentHash(view),reviewer='coordinator-v6-locale-mapping-and-completeness-review';
  view.editorialProjection={...view.editorialProjection,contentSha256,acceptance:{contentSha256,reviewer,reviewedAt:at,scope:'presentation_only'}};
  if(view.presentationEvidenceAcceptance)view.presentationEvidenceAcceptance={...view.presentationEvidenceAcceptance,contentSha256,evidenceSha256:presentationEvidenceHash(view),reviewer,reviewedAt:at};
  const school=data.schools.find((s:any)=>s.slug===slug);Object.assign(school,structuredClone(view.school));
  const input={school,bundle:view};
  view.completenessReview={schemaVersion:'uapt-v6-completeness-review-v1',contentSha256:v6CompletenessContentHash(input),reviewer,reviewedAt:at,scope:'presentation_only',policySemanticsApproved:false};
  validateV6Completeness(input,locale as any,false);validateV6EditorialProjection(view);
  receipts.push({slug,locale,priorEditorialContentSha256:oldView.editorialProjection.contentSha256,...view.completenessReview});
 }
}
for(const key of ['summaries','snapshots','toolsBySlug','heldBySlug','historical','changesBySlug','analysisOverrides'])if(!isDeepStrictEqual(records[key],oldRecords[key]))throw Error('Canonical surface changed: '+key);
const coverage=acceptV6Release(pages,records);
const save=(name:string,value:unknown)=>writeFileSync(resolve(output,name),JSON.stringify(value)+'\n',{flag:'wx'});
save('pages.json',pages);save('records.json',records);save('mapping-delta.json',deltas);
save('metadata.json',{revision,preparedAt:at,slugs,parentRevision:oldRecords.revision,parentPagesSha256:createHash('sha256').update(readFileSync(resolve(source,'pages.json'))).digest('hex'),publicationOccurred:false});
save('completeness-review.json',{schemaVersion:'uapt-v6-completeness-review-report-v1',receipts,canonicalRecordsUnchanged:true,actionsAndEvidenceUnchanged:true,browserAcceptance:'pending',policySemanticsApproved:false,coverage});
console.log(JSON.stringify({revision,schools:slugs.length,changedFields:deltas.length,coverage}));
