import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { getLocalV6Bundle, parseLocalV6Bundle } from '../apps/web/lib/policy-v6-bundle';
import { isPolicyV6Preview } from '../apps/web/lib/policy-v6-gate';
const fingerprint='a'.repeat(64);
function fixture(){
 const source={sourceUrl:'https://example.edu/policy',citationTitle:'Test source',snapshotHash:'b'.repeat(64),sourceType:'official_guidance',official:true};
 const evidence={quote:'Test excerpt for contract verification.',url:source.sourceUrl,title:source.citationTitle,language:'en'};
 return {schemaVersion:'uapt-v6-local-view-v1',publicationApproved:false,sourceBundleSha256:fingerprint,
 school:{slug:'test-school',fingerprint,topics:['coursework','exams','disclosure','privacy_data','approved_tools','research_publication'].map(key=>({key,title:key,status:'unclear',statusLabel:'Unclear',summary:'Test summary.',scope:'Test scope.',basisKind:'local_reviewed_bundle',actions:[],sources:[{url:source.sourceUrl,hash:source.snapshotHash}],claims:[{id:'test-source',text:'Test source',evidence:[evidence]}]})),additionalTopics:[]},
 claims:[{id:'test-claim',entitySlug:'test-school',entityType:'university',claimType:'other',claimText:'Test claim.',confidence:0,reviewState:'agent_reviewed',evidence:[{sourceUrl:source.sourceUrl,sourceSnapshotHash:source.snapshotHash,evidenceSnippet:evidence.quote,attribution:source}]}],sources:[source],tools:[],gaps:['Test held gap'],remainingRecordKeys:['held-test'],topicLabels:{coursework:{en:'Coursework',zh:'课程作业'},'coursework:status':{en:'Unclear',zh:'未明确'}},hero:{}};
}
function parse(view:object){const raw=Buffer.from(JSON.stringify(view));return parseLocalV6Bundle(raw,'test-school',{sha256:createHash('sha256').update(raw).digest('hex'),sourceBundleSha256:fingerprint},'zh');}
test('local view preserves held gaps and localizes UI without approving a snapshot',()=>{
 const view=parse(fixture());assert.equal(view.school.topics[0].title,'课程作业');assert.deepEqual(view.remainingRecordKeys,['held-test']);assert.equal(view.publicationApproved,false);assert.equal(view.school.v6ReviewState,undefined);
});
test('exact bytes, identity, topic coverage and nonreviewed claims fail closed',()=>{
 const raw=Buffer.from(JSON.stringify(fixture()));assert.throws(()=>parseLocalV6Bundle(raw,'test-school',{sha256:'0'.repeat(64),sourceBundleSha256:fingerprint},'en'));
 const wrongId=fixture();wrongId.school.slug='different';assert.throws(()=>parse(wrongId));
 const incomplete=fixture();incomplete.school.topics.pop();assert.throws(()=>parse(incomplete));
 const held=fixture();held.claims[0].reviewState='needs_review';assert.throws(()=>parse(held));
 const missingQuote=fixture();missingQuote.school.topics[0].claims[0].evidence[0].quote='';assert.throws(()=>parse(missingQuote));
});
test('UCL is a separate local pilot; production cannot read the private view',()=>{
 assert.equal(isPolicyV6Preview('ucl','v6','development'),true);assert.equal(isPolicyV6Preview('ucl','v6','production'),false);
 const original=process.env.NODE_ENV;process.env.NODE_ENV='production';try {assert.equal(getLocalV6Bundle('ucl','en'),undefined);}finally{if(original===undefined)delete process.env.NODE_ENV;else process.env.NODE_ENV=original;}
});
test('new bundle pilots stay local and reject omitted, held or mis-scoped records',()=>{
 for(const slug of ['california-institute-of-technology','eth-zurich','national-university-of-singapore','anu','edinburgh','cuhk']) {
  assert.equal(isPolicyV6Preview(slug,'v6','development'),true);
  assert.equal(isPolicyV6Preview(slug,'v6','production'),false);
 }
 const held={...fixture(),heldDraftIds:['test-claim']};assert.throws(()=>parse(held));
 const missing={...fixture(),auditCoverage:{publicClaimIds:['test-claim','omitted'],excludedClaims:[],originalObjectCount:2,analysisDimensionKeys:[],institutionAuditStatus:'PARTIAL'}};assert.throws(()=>parse(missing));
 const scoped={...fixture(),scopedToolNames:['Invented service']};assert.throws(()=>parse(scoped));
});

test('local view localizes topic summaries and topic scopes when locale is zh',()=>{
 const f = fixture() as any;
 f.topicSummaries = { coursework: { en: 'Coursework EN', zh: '课程作业中文总结' } };
 f.topicScopes = { coursework: { en: 'Scope EN', zh: '课程作业中文范围' } };
 const rawZh = Buffer.from(JSON.stringify(f));
 const parsedZh = parseLocalV6Bundle(rawZh, 'test-school', {
  sha256: createHash('sha256').update(rawZh).digest('hex'),
  sourceBundleSha256: fingerprint
 }, 'zh');
 assert.equal(parsedZh.school.topics[0].summary, '课程作业中文总结');
 assert.equal(parsedZh.school.topics[0].scope, '课程作业中文范围');

 const rawEn = Buffer.from(JSON.stringify(f));
 const parsedEn = parseLocalV6Bundle(rawEn, 'test-school', {
  sha256: createHash('sha256').update(rawEn).digest('hex'),
  sourceBundleSha256: fingerprint
 }, 'en');
 assert.equal(parsedEn.school.topics[0].summary, 'Coursework EN');
 assert.equal(parsedEn.school.topics[0].scope, 'Scope EN');
});

test('source hold union fails closed if held draft is present in public claims list',()=>{
 const f = fixture();
 (f as any).heldDraftIds = ['test-held-leak'];
 f.claims.push({
  id: 'test-held-leak',
  entitySlug: 'test-school',
  entityType: 'university',
  claimType: 'other',
  claimText: 'Leaked held claim',
  confidence: 0,
  reviewState: 'agent_reviewed',
  evidence: []
 });
 const raw = Buffer.from(JSON.stringify(f));
 assert.throws(() => parseLocalV6Bundle(raw, 'test-school', {
  sha256: createHash('sha256').update(raw).digest('hex'),
  sourceBundleSha256: fingerprint
 }, 'en'));
});

test('private guides bind retained Claims and never grant publication or apply proposed repairs',()=>{
 const f={...fixture(),localReferenceGuide:{topics:{coursework:['test-claim']},submissionClaimIds:['test-claim']},localChangeProposals:[{changeId:'repair-draft',category:'scope correction',status:'draft_pending',publicationApproved:false,productionChangeApplied:false}]};
 assert.equal(parse(f).localChangeProposals?.[0].publicationApproved,false);
 assert.throws(()=>parse({...f,localReferenceGuide:{...f.localReferenceGuide,submissionClaimIds:['held-or-missing']}}),/Unbound local reference/);
 assert.throws(()=>parse({...f,publication:{releaseId:'test',kind:'v6_presentation_integration'}}),/Private projections/);
 assert.throws(()=>parse({...f,localChangeProposals:[{...f.localChangeProposals[0],publicationApproved:true}]}),/approval drift/);
 assert.throws(()=>parse({...f,localChangeProposals:[{...f.localChangeProposals[0],productionChangeApplied:true}]}),/approval drift/);
});
test('English source content remains lang=en under Chinese UI fallback',()=>{
 const f={...fixture(),topicSummaries:{coursework:{en:'Original English scope.',zh:'Original English scope.'}}};
 assert.equal(parse(f).school.topics[0].summaryLanguage,'en');
 for(const slug of ['universite-paris-saclay','lund-university','sorbonne-university','the-university-of-warwick','trinity-college-dublin-the-university-of-dublin']){
  assert.equal(isPolicyV6Preview(slug,'v6','development'),true);
  assert.equal(isPolicyV6Preview(slug,'v6','production'),false);
 }
});
