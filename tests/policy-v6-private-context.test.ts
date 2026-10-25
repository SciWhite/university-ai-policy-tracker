import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {validatePrivateRecordContext} from '../apps/web/lib/policy-v6-private-context';
import type {LocalV6Bundle} from '../apps/web/lib/policy-v6-bundle';
const fixture=()=>{
 const original={entitySlug:'university-of-glasgow',artifactType:'claim_candidate',runId:'frozen-run',claimId:'original-id',claimText:'Unapproved historical candidate'};
 return {school:{slug:original.entitySlug},claims:[],privateRecordContext:{schemaVersion:'uapt-private-record-context-v1',slug:original.entitySlug,inputSha256:'a'.repeat(64),rows:[{recordKey:'candidate-claim:frozen-run:original-id',kind:'historical',name:'original-id',decision:'UNVERIFIED',reviewState:'needs_review',originalRecord:original,originalRecordSha256:createHash('sha256').update(JSON.stringify(original)).digest('hex'),originalText:original.claimText,scope:'Historical only',reason:'Pending review',evidenceRefs:[]}]}} as unknown as LocalV6Bundle;
};
test('run-keyed historical candidates retain exact original identity without becoming reviewed Claims',()=>{
 const v=fixture();assert.doesNotThrow(()=>validatePrivateRecordContext(v));
 for(const mutate of [(v:LocalV6Bundle)=>{v.school.slug='different-university';v.privateRecordContext!.slug=v.school.slug},(v:LocalV6Bundle)=>{v.privateRecordContext!.rows[0].recordKey='candidate-claim:other-run:original-id'},(v:LocalV6Bundle)=>{v.privateRecordContext!.rows[0].kind='claim'},(v:LocalV6Bundle)=>{v.privateRecordContext!.rows[0].originalRecord.claimText='Changed after freezing'}]){const bad=fixture();mutate(bad);assert.throws(()=>validatePrivateRecordContext(bad));}
});
