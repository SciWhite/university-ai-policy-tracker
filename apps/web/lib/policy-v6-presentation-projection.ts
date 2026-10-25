import {createHash} from 'node:crypto';
import type {SupportedLocale} from './i18n';
import type {LocalV6Bundle} from './policy-v6-bundle';
import type {StudentAction, V6StudentActions} from './policy-v6-student-actions';
import registry from '../../../data/policy-v6-qs51-70-projections.json';

type TopicProjection = {claimIds:string[];en:string;zh:string;status:string};
type Projection = {recordSha256:string;claimsSha256:string;claimTexts:Record<string,string>;
  scope:{en:string;zh:string};topics:Record<string,TopicProjection>;do:StudentAction[];dont:StudentAction[]};
const projections=registry.schools as Record<string,Projection>;
const sha=(value:unknown)=>createHash('sha256').update(JSON.stringify(value)).digest('hex');

/** Explicitly reviewed display mappings, applied by the public pack exporter.
 * No new policy Claims, tool approvals, source checks or student snapshot pins.
 */
export function projectV6Presentation(view:LocalV6Bundle,locale:SupportedLocale):LocalV6Bundle {
  const mapping=projections[view.school.slug];
  if(!mapping)return structuredClone(view);
  if(view.publication?.kind!=='v6_presentation_integration' ||
    mapping.recordSha256!==view.school.fingerprint || mapping.claimsSha256!==sha(view.claims) ||
    view.claims.some(c=>!c.id || mapping.claimTexts[c.id]!==c.claimText || !['agent_reviewed','human_reviewed'].includes(c.reviewState)))
    throw Error('V6 presentation basis changed: '+view.school.slug);
  const next=structuredClone(view),byId=new Map(next.claims.map(c=>[c.id,c]));
  const lang=locale==='zh'?'zh':'en';
  const labels:Record<string,[string,string]>={
    conditionally_allowed:['Subject to the stated conditions','按具体条件使用'],
    restricted:['Restrictions apply','适用限制'],required:['Requirements apply','须按要求执行'],
    recommended:['Source guidance','来源指引'],unclear:['Scope or permission not established','具体许可未明确'],
    insufficient_public_evidence:['Specific rule not established in this record','当前条款未明确具体规则']};
  const guide:V6StudentActions={slug:next.school.slug,name:next.school.name,experience:'compact_evidence',
    presentationRevision:registry.presentationRevision,recordSha256:sha(next.claims),
    schoolFingerprint:next.school.fingerprint,universityRevisionId:next.school.revision,
    scope:mapping.scope,do:mapping.do,dont:mapping.dont,procedures:{investigation:[],outcomes:[],appeal:[]},
    claims:Object.fromEntries(next.claims.map(c=>[c.id,{id:c.id,text:c.claimText,claimType:c.claimType,
      evidence:c.evidence.map(e=>({quote:e.evidenceSnippet,url:e.sourceUrl,language:e.sourceLanguage??'und',
        hash:e.sourceSnapshotHash,location:e.snippetLocation??''}))}])),topics:{},images:[]};
  const summaries:NonNullable<LocalV6Bundle['topicSummaries']>={};
  for(const topic of [...next.school.topics,...next.school.additionalTopics]){
    const projection=mapping.topics[topic.key];
    if(!projection){
      // Previously published supplementary source/history quotations remain in
      // their original evidence entry; they are not a new current policy rule.
      const historical=/archiv|procedur/.test(topic.key);
      const en=historical?'These earlier records provide context; no current investigation, sanction or appeal deadline is established by the published Claims.':'These supplementary source quotations provide context. Use the current published Claims for the rule and its applicable scope.';
      const zh=historical?'这些旧记录仅供查阅背景；当前公开条款未据此确认现行调查、处分或申诉期限。':'这些补充来源引文仅供核对背景；具体规则及适用范围以当前公开条款为准。';
      topic.status='insufficient_public_evidence';topic.statusLabel=lang==='zh'?'背景资料，非现行规则':'Context, not a current rule';
      topic.summary=lang==='zh'?zh:en;topic.summaryLanguage=lang;
      summaries[topic.key]={en,zh};guide.topics![topic.key]={en,zh,meaningEn:en,meaningZh:zh};
      continue;
    }
    const mapped=projection.claimIds.map(id=>{
      const c=byId.get(id);if(!c)throw Error('Unknown public Claim in V6 topic: '+id);
      return {id:id,text:c.claimText,checkedAt:c.lastCheckedAt,
        evidence:c.evidence.map(e=>({quote:e.evidenceSnippet,url:e.sourceUrl,title:e.sourceUrl,
          language:e.sourceLanguage??'und',location:e.snippetLocation,retrievedAt:e.retrievedAt,hash:e.sourceSnapshotHash}))};
    });
    // Keep the pre-existing published source quotations, without presenting
    // them as independently verified policy interpretations.
    const prior=topic.claims.filter(c=>!mapped.some(m=>m.id===c.id));
    topic.claims=[...mapped,...prior];
    topic.sources=[...new Map([...mapped.flatMap(c=>c.evidence.map(e=>({url:e.url,hash:e.hash}))),...topic.sources].map(s=>[s.url+':'+s.hash,s])).values()];
    topic.status=projection.status;topic.statusLabel=labels[projection.status][lang==='zh'?1:0];
    topic.summary=projection[lang];topic.summaryLanguage=lang;topic.scope=mapping.scope[lang];
    topic.evidenceScope=mapping.scope[lang];topic.actions=[];
    if(!projection.claimIds.length)topic.evidenceGap=projection[lang];
    summaries[topic.key]={en:projection.en,zh:projection.zh};
    guide.topics![topic.key]={en:projection.en,zh:projection.zh,meaningEn:mapping.scope.en,meaningZh:mapping.scope.zh};
  }
  for(const action of [...guide.do,...guide.dont]){
    if(!action.claimIds.length||action.claimIds.some(id=>!byId.has(id)))throw Error('Invalid V6 action basis');
  }
  next.topicSummaries=summaries;next.topicScopes=Object.fromEntries(Object.keys(summaries).map(key=>[key,mapping.scope]));
  next.studentActions=guide;
  return next;
}
