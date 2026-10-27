import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import type {LocalV6Bundle} from '../apps/web/lib/policy-v6-bundle';
import {presentationEvidenceHash} from '../apps/web/lib/policy-v6-presentation-evidence';
import {editorialContentHash} from '../apps/web/lib/policy-v6-editorial-projection';
import {acceptedToolPresentation,toolPresentationHash} from '../apps/web/lib/policy-v6-tool-presentation';

test('tool presentation acceptance binds exact display, canonical records and independent presentation review', () => {
  const tool={universitySlug:'example',rawToolName:'Example tool',evidence:[{sourceUrl:'https://example.edu/ai',evidenceSnippet:'Available to students with university login.',reviewState:'agent_reviewed'}]};
  const view={publicationApproved:false,publication:{releaseId:'test-only',kind:'v6_presentation_integration'},school:{slug:'example',fingerprint:'a'.repeat(64),topics:[],additionalTopics:[]},tools:[tool],topicSummaries:{},topicScopes:{},studentActions:{},toolDisplayCopy:{zh:{'Example tool':{basisSha256:'b'.repeat(64),description:'工具',howToObtain:'大学账户',costToUser:'未核实'}}}} as unknown as LocalV6Bundle;
  const contentSha256=editorialContentHash(view),reviewer='synthetic unit-test receipt only',reviewedAt='2026-10-27T00:00:00Z';
  view.editorialProjection={schemaVersion:'uapt-v6-editorial-projection-v1',canonicalRecordSha256:view.school.fingerprint,contentSha256,reviewState:'accepted_presentation',acceptance:{contentSha256,reviewer,reviewedAt,scope:'presentation_only'},researchApprovalGranted:false,publicationApprovalGranted:false};
  view.presentationEvidenceAcceptance={schemaVersion:'uapt-v6-presentation-evidence-acceptance-v1',canonicalRecordSha256:view.school.fingerprint,contentSha256,evidenceSha256:presentationEvidenceHash(view),reviewer,reviewedAt,scope:'presentation_only'};
  assert.equal(acceptedToolPresentation(view,[]),false);
  view.toolPresentationAcceptance={schemaVersion:'uapt-v6-tool-presentation-acceptance-v1',canonicalToolsSha256:createHash('sha256').update('[]').digest('hex'),displaySha256:toolPresentationHash(view),reviewer,reviewedAt,scope:'presentation_only'};
  assert.equal(acceptedToolPresentation(view,[]),true);
  for(const mutate of [
    (v:LocalV6Bundle)=>{v.tools[0].evidence[0].evidenceSnippet='Changed official evidence';},
    (v:LocalV6Bundle)=>{v.tools[0].universitySlug='another-school';},
    (v:LocalV6Bundle)=>{v.toolDisplayCopy!.zh['Example tool'].description='改写';},
    (v:LocalV6Bundle)=>{delete v.presentationEvidenceAcceptance;},
    (v:LocalV6Bundle)=>{v.candidateOnly=true;},
    (v:LocalV6Bundle)=>{v.toolPresentationAcceptance!.reviewer='';},
  ]){const changed=structuredClone(view);mutate(changed);assert.equal(acceptedToolPresentation(changed,[]),false);}
  assert.equal(acceptedToolPresentation(view,[tool] as never),false,'A changed canonical tool collection invalidates the display receipt');
});
