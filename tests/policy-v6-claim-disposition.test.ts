import test from 'node:test';import assert from 'node:assert/strict';import{createHash}from'node:crypto';
import{validatePublicClaimDispositions,currentReferenceClaims}from'../apps/web/lib/policy-v6-claim-disposition';import type{LocalV6Bundle}from'../apps/web/lib/policy-v6-bundle';
const sha=(v:unknown)=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
const fixture=()=>{const claims=[{id:'current',claimText:'Scoped original rule'},{id:'old',claimText:'Original historical text'}];return{claims,school:{slug:'example',topics:[{claims:[{id:'current'}]}],additionalTopics:[]},claimDispositions:claims.map(c=>({claimId:c.id,claimSha256:sha(c),mode:c.id==='current'?'scoped_reference':'historical_only',scope:'Source audience and year',reason:'Currentness incomplete',historyHref:'/changes/example'})),publicReferenceGuide:{topics:{coursework:['current']},submissionClaimIds:['current']}}as unknown as LocalV6Bundle;};
test('full record retains excluded original while every conclusion projection stays bounded',()=>{const v=fixture();assert.doesNotThrow(()=>validatePublicClaimDispositions(v));assert.deepEqual(currentReferenceClaims(v).map(c=>c.id),['current']);assert.equal(v.claims.length,2);
 for(const mutate of [(v:LocalV6Bundle)=>v.claimDispositions!.pop(),(v:LocalV6Bundle)=>{v.claims[1].claimText='silently changed'},(v:LocalV6Bundle)=>{v.publicReferenceGuide!.submissionClaimIds.push('old')},(v:LocalV6Bundle)=>{v.school.topics[0].claims.push({id:'old'}as never)},(v:LocalV6Bundle)=>{v.claimDispositions![1].historyHref='/changes/foreign'},(v:LocalV6Bundle)=>{v.localChangeProposals=[]}]){const bad=fixture();mutate(bad);assert.throws(()=>validatePublicClaimDispositions(bad));}});

import React from 'react';import{renderToStaticMarkup}from'react-dom/server';import{PolicyV6PublicClaimDisposition}from'../apps/web/components/policy-v6-public-claim-disposition';import{readV6RecordCorrections}from'../apps/web/lib/v6-effective-records';
test('excluded records use distinct popovers and preserve original Claim anchors',()=>{
 process.env.UAPT_V6_PUBLISHED_PAGES='1';(globalThis as typeof globalThis&{React:typeof React}).React=React;
 const sample=readV6RecordCorrections()!.summaries[0].claims[0],claims=['old-one','old-two'].map(id=>({...sample,id}));const view={school:{slug:sample.entitySlug},claims,claimDispositions:claims.map(c=>({claimId:c.id,claimSha256:sha(c),mode:'historical_only',scope:'Historical audience',reason:'Not current permission',historyHref:'/changes/'+sample.entitySlug}))}as unknown as LocalV6Bundle;
 const html=renderToStaticMarkup(React.createElement(PolicyV6PublicClaimDisposition,{view,locale:'en'}));const ids=[...html.matchAll(/\sid="([^"]+)"/g)].map(m=>m[1]);assert.equal(new Set(ids).size,ids.length);assert(ids.includes('claim-old-one')&&ids.includes('claim-old-two'));assert.match(html,/excluded-old-one-group/);assert.match(html,/excluded-old-two-group/);
});

test('independent draft evidence stays bounded to unpublished candidates and never revives excluded Claims',()=>{
 const v=fixture();v.candidateOnly=true;v.publicationApproved=false;
 v.studentActions={claims:{'coursework:draft':{basisObjectType:'private_evidence'}},do:[{claimIds:['coursework:draft']}],dont:[]} as never;
 assert.doesNotThrow(()=>validatePublicClaimDispositions(v));
 for(const mutate of [(x:LocalV6Bundle)=>{delete x.candidateOnly},(x:LocalV6Bundle)=>{x.publication={releaseId:'example',kind:'v6_presentation_integration'}},(x:LocalV6Bundle)=>{x.studentActions!.do[0].claimIds=['old']}]){const bad=structuredClone(v);mutate(bad);assert.throws(()=>validatePublicClaimDispositions(bad));}
});
