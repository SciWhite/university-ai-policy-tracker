import assert from 'node:assert/strict';
import test from 'node:test';
import {searchIndexRecords,type SearchIndexRecord} from '../apps/web/lib/entity-search';
const record=(entitySlug:string,aliases:string[],summary:string):SearchIndexRecord=>({entitySlug,entityName:entitySlug,entityType:'university',aliases,canonicalUrl:'https://example.org/'+entitySlug,publicJsonUrl:'https://example.org/'+entitySlug+'.json',claimCount:50,sourceCount:15,reviewState:'agent_reviewed',searchTokens:['清华'],fields:{summary,analysisDimensions:[],claimSummaries:[],sourceTitles:[]}});
test('exact CJK alias precedes partial alias even when the partial record has a legacy ranking bonus',()=>{
 const exact=record('tsinghua-university',['清华','清华大学'],'Tsinghua University, QS 2026 =17.');
 const partial=record('national-tsing-hua-university',['国立清华大学'],'National Tsing Hua University is listed as QS 2026 rank 176.');
 assert.deepEqual(searchIndexRecords([partial,exact],'清华').map(r=>r.entitySlug),['tsinghua-university','national-tsing-hua-university']);
 assert.equal(searchIndexRecords([partial,exact],'国立清华大学')[0].entitySlug,partial.entitySlug);
});
