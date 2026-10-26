import test from 'node:test';
import assert from 'node:assert/strict';
import {publishedV6Bundle} from '../apps/web/lib/policy-v6-published';
import {isFrozenLegacyV6Input,validateV6Completeness,v6CompletenessContentHash} from '../apps/web/lib/policy-v6-completeness';
import type {V6SchoolInput} from '../apps/web/lib/policy-v6-input';
import type {LocalV6Bundle} from '../apps/web/lib/policy-v6-bundle';
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
test('complete bilingual presentation passes; exact older input remains readable without extending its approval',()=>{
  assert.doesNotThrow(()=>validateV6Completeness(fixture(),'zh',false));
  const old=publishedV6Bundle('lund-university','zh')!;
  assert.equal(isFrozenLegacyV6Input({school:old.school,bundle:old},'zh'),true);
  assert.doesNotThrow(()=>validateV6Completeness({school:old.school,bundle:old},'zh'));
  assert.throws(()=>validateV6Completeness({school:old.school,bundle:old},'zh',false),/rendered locale/);
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
