import test from 'node:test';
import assert from 'node:assert/strict';
import {publishedV6Bundle} from '../apps/web/lib/policy-v6-published';
import {isFrozenLegacyV6Input,validateV6Completeness,v6CompletenessContentHash} from '../apps/web/lib/policy-v6-completeness';
import type {V6SchoolInput} from '../apps/web/lib/policy-v6-input';
import type {LocalV6Bundle} from '../apps/web/lib/policy-v6-bundle';
import {getLocalV6StudentActions} from '../apps/web/lib/policy-v6-bundle';
import legacy from '../data/policy-v6-legacy-completeness.json';
import {editorialContentHash,validateV6EditorialProjection} from '../apps/web/lib/policy-v6-editorial-projection';
process.env.UAPT_V6_PUBLISHED_PAGES='1';

function fixture(): V6SchoolInput & {bundle:LocalV6Bundle} {
  const view=publishedV6Bundle('lund-university','zh')!;
  for(const topic of [...view.school.topics,...view.school.additionalTopics]) {
    topic.title=view.topicLabels[topic.key].zh;
    topic.statusLabel=view.topicLabels[topic.key+':status'].zh;
    topic.summary=view.topicSummaries![topic.key].zh;
    topic.scope=view.topicScopes![topic.key].zh;
  }
  const input={school:view.school,bundle:view};
  view.completenessReview={schemaVersion:'uapt-v6-completeness-review-v1',contentSha256:v6CompletenessContentHash(input),reviewer:'test-fixture-only',reviewedAt:'2026-10-25T23:00:00Z',scope:'presentation_only',policySemanticsApproved:false};
  return input;
}
test('editorial review retains additional school-specific topics while requiring all nine core topics',()=>{
  const view=fixture().bundle;
  const extra=structuredClone(view.school.additionalTopics[0]);extra.key='applications';view.school.additionalTopics.push(extra);
  view.topicSummaries!.applications=structuredClone(view.topicSummaries![view.school.additionalTopics[0].key]);
  view.studentActions!.topics.applications=structuredClone(view.studentActions!.topics[view.school.additionalTopics[0].key]);
  delete view.publication;view.candidateOnly=true;
  for(const c of Object.values(view.studentActions!.claims))if(c.basisObjectType==='presentation_evidence')c.basisObjectType='private_evidence';
  view.editorialProjection={schemaVersion:'uapt-v6-editorial-projection-v1',canonicalRecordSha256:view.school.fingerprint,contentSha256:editorialContentHash(view),reviewState:'pending_independent_presentation_review',researchApprovalGranted:false,publicationApprovalGranted:false};
  assert.doesNotThrow(()=>validateV6EditorialProjection(view));
  view.school.additionalTopics=view.school.additionalTopics.filter(t=>t.key!=='security_procurement');
  assert.throws(()=>validateV6EditorialProjection(view),/Nine bilingual/);
});
test('complete bilingual presentation passes; exact older input remains readable without extending its approval',()=>{
  assert.doesNotThrow(()=>validateV6Completeness(fixture(),'zh',false));
  // Read the exact archived input the frozen registry accepted, not today's bundle.
  const old=publishedV6Bundle('lund-university','zh',legacy.releaseId)!;
  assert.equal(isFrozenLegacyV6Input({school:old.school,bundle:old},'zh'),true);
  assert.doesNotThrow(()=>validateV6Completeness({school:old.school,bundle:old},'zh'));
  assert.throws(()=>validateV6Completeness({school:old.school,bundle:old},'zh',false),/rendered locale/);
  old.school.topics[0].summary+=' Changed after acceptance.';
  assert.equal(isFrozenLegacyV6Input({school:old.school,bundle:old},'zh'),false);
  assert.throws(()=>validateV6Completeness({school:old.school,bundle:old},'zh'),/rendered locale/);
});
const failures: [string,(input:ReturnType<typeof fixture>)=>void][]=[
  ['missing studentActions',x=>{delete x.bundle.studentActions;}],
  ['missing Chinese summary',x=>{delete x.bundle.topicSummaries!.coursework.zh;}],
  ['missing supplementary topic',x=>{x.school.additionalTopics=x.school.additionalTopics.filter(t=>t.key!=='security_procurement');}],
  ['English status rendered on Chinese page',x=>{x.school.topics[0].statusLabel=x.bundle.topicLabels['coursework:status'].en;}],
  ['English status disguised as Chinese mapping',x=>{x.bundle.topicLabels['coursework:status'].zh='Read scoped evidence; review pending';x.school.topics[0].statusLabel=x.bundle.topicLabels['coursework:status'].zh;}],
  ['generic summary placeholder',x=>{x.bundle.topicSummaries!.coursework.en='Read scoped evidence; review pending';}],
  ['FAQ/action topic drift',x=>{x.bundle.studentActions!.topics!.coursework.zh='全校考核均可使用';}],
  ['dangling action evidence',x=>{x.bundle.studentActions!.do[0].claimIds=['absent-claim'];}],
  ['empty Do side',x=>{x.bundle.studentActions!.do=[];}],
  ['missing procedure evidence arrays',x=>{x.bundle.studentActions!.procedures={} as NonNullable<LocalV6Bundle['studentActions']>['procedures'];}],
  ['dangling procedure evidence',x=>{x.bundle.studentActions!.procedures.outcomes=['absent-claim'];}],
  ['stale review after state-label edit',x=>{x.bundle.topicLabels['coursework:status'].zh='核对本课程范围';x.school.topics[0].statusLabel='核对本课程范围';}],
  ['missing independent review',x=>{delete x.bundle.completenessReview;}],
];
for(const [name,mutate]of failures)test(`reject ${name} even when every card still exists`,()=>{
  const input=fixture();mutate(input);
  assert.equal(isFrozenLegacyV6Input(input,'zh'),false);
  assert.throws(()=>validateV6Completeness(input,'zh'));
});
test('new school cannot inherit a legacy exemption',()=>{
  const input=fixture();input.school.slug='new-school';delete input.bundle.studentActions;
  assert.equal(isFrozenLegacyV6Input(input,'zh'),false);
  assert.throws(()=>validateV6Completeness(input,'zh'),/studentActions required/);
});

test('local action projection rejects missing procedure keys instead of letting the reader crash',()=>{
  const view=fixture().bundle;
  assert.ok(getLocalV6StudentActions(view));
  view.studentActions!.procedures={} as NonNullable<LocalV6Bundle['studentActions']>['procedures'];
  assert.equal(getLocalV6StudentActions(view),undefined);
});

test('explicit empty procedure arrays preserve an evidence gap without inventing a process',()=>{
  const input=fixture();
  input.bundle.candidateOnly=true;
  input.bundle.studentActions!.procedures={investigation:[],outcomes:[],appeal:[]};
  assert.doesNotThrow(()=>validateV6Completeness(input,'zh',false));
});
