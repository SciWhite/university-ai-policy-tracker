import test from 'node:test';
import assert from 'node:assert/strict';
import {checkSummaryModality,collectSummaryEvidence} from '../scripts/lib/change-summary-evidence';
import {fixtureInput} from './fixtures/change-event-fixture';
import {buildEventHistories,type ScopedEventSource} from '../apps/web/lib/change-events';
import {bindChangeSummary,summaryHash,acceptReviewedChangeSummary} from '../apps/web/lib/change-summary-binding';
import {summaryReviewChecks,type ChangeSummaryDraft,type ChangeSummaryReview} from '../apps/web/lib/change-summary-types';

test('EPFL should-not evidence cannot silently become a must-not summary',()=>{
 const issues=checkSummaryModality('Students must not use AI during exams or assessments unless explicitly allowed.',[{sourceUrl:'https://school.example',evidenceSnippet:'You should not use AI during exams or assessments unless explicitly allowed.'}]);
 assert(issues.includes('assessment_must_not_conflicts_with_should_not_excerpt'));
 assert(issues.includes('possible_ban_strengthening_against_excerpt'));
 assert.deepEqual(checkSummaryModality('The guide says students should not use AI.',[{sourceUrl:'https://school.example',evidenceSnippet:'Students should not use AI.'}]),[]);
 assert.deepEqual(checkSummaryModality('The tracker lists a tool.',[]),['frozen_excerpt_unavailable']);
});
test('review packets collect only the exact frozen event side; another revision cannot fill a quote gap',()=>{
 const input=fixtureInput(),source=input.schools.school.sources[0] as ScopedEventSource;
 const event=buildEventHistories(input).school.events[0];
 let rows=collectSummaryEvidence(event,input);assert.equal(rows[0].quotes[0].evidenceSnippet,'new');
 source.revision='different-revision';rows=collectSummaryEvidence(event,input);assert.equal(rows[0].quotes.length,0);assert(rows[0].issues.includes('frozen_excerpt_unavailable'));
});
test('full large events bind all items without synthesizing missing Claim IDs; held candidates cannot publish',()=>{
 const input=fixtureInput(),event=buildEventHistories(input).school.events[0];
 event.items=Array.from({length:101},(_,n)=>({...event.items[0],id:`legacy:${n}`,claimId:undefined}));
 const projection={projectionRevision:'event-r1',projectionSha256:'a'.repeat(64),basisSha256:input.basisSha256,rulesVersion:event.rulesVersion};
 const binding=bindChangeSummary(event,projection);assert.equal(binding.items.length,101);assert(binding.items.every(item=>!Object.hasOwn(item,'claimId')));
 const draft:ChangeSummaryDraft={schemaVersion:'uapt-change-summary-draft-v1',binding,language:'en',generatedAt:'2026-10-24T01:00:00Z',generator:{kind:'ai',id:'fixture-author'},text:{whatChanged:'Historical records.',studentImpact:'Check recorded scope.',basisAndScope:'Historical evidence only.'},generationHold:['source review required']};
 const review:ChangeSummaryReview={schemaVersion:'uapt-change-summary-review-v1',decision:'approved',draftSha256:summaryHash(draft),bindingSha256:summaryHash(binding),reviewerId:'fixture-reviewer',reviewedAt:'2026-10-24T02:00:00Z',checks:Object.fromEntries(summaryReviewChecks.map(k=>[k,true])) as ChangeSummaryReview['checks']};
 assert.throws(()=>acceptReviewedChangeSummary(draft,review,event,projection),/held for source/);
});

test('the batch authoring entry cannot write private packets into tracked public data',async()=>{
 const {prepareChangeSummaryCohort}=await import('../scripts/prepare-change-summary-cohort');
 assert.throws(()=>prepareChangeSummaryCohort('unused-package','data','2026-10-24'),/remain private/);
});
