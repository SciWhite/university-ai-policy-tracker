import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import repair from '../data/public-analysis-repairs/paris-northwestern-20261023.json';
import {validateScopedAnalysisRepair,scopedAnalysisRepair} from '../apps/web/lib/scoped-analysis-repair';
import {v6CorrectedSummary} from '../apps/web/lib/v6-effective-records';
import {buildPolicyAnalysisProfile} from '../apps/web/lib/policy-analysis';
process.env.UAPT_V6_PUBLISHED_PAGES='1';
for (const slug of Object.keys(repair.universities)) {
 test(`${slug}: current IDs and exact evidence support every public dimension and score component`,()=>{
  const summary=v6CorrectedSummary(slug)!;const profile=buildPolicyAnalysisProfile(summary);const claims=new Map(summary.claims.map(c=>[c.id,c]));const pin=repair.universities[slug as keyof typeof repair.universities];
  assert.equal(profile.dimensions.length,11);assert.equal(profile.confidence,0);assert(profile.limitations.some(x=>x.includes(repair.revision)));assert.deepEqual(scopedAnalysisRepair(summary),pin.dimensions);
  for(const id of [...profile.basedOnClaimIds,...profile.coverageScore.components.flatMap(c=>c.evidenceClaimIds)])assert(claims.has(id),id);
  for(const d of profile.dimensions){assert.deepEqual(d.evidenceClaimIds,pin.dimensions[d.key as keyof typeof pin.dimensions].claimIds);for(const b of d.basis){const claim=claims.get(b.claimId)!;assert(claim.evidence.some(e=>e.sourceUrl===b.sourceUrl&&e.sourceSnapshotHash===b.sourceSnapshotHash&&e.evidenceSnippet===b.evidenceSnippet));}}
  if(slug==='northwestern-university'){assert.equal(profile.dimensions.find(d=>d.key==='exams')!.status,'unclear');assert.equal(profile.coverageScore.components.find(c=>c.key==='exams')!.points,0);}
  else {const tools=profile.dimensions.find(d=>d.key==='approved_tools')!;assert.equal(tools.status,'not_mentioned');assert.deepEqual(tools.evidenceClaimIds,[]);assert.equal(profile.coverageScore.components.find(c=>c.key==='approved_tools')!.points,0);}
 });
 test(`${slug}: reject retired IDs, tool-only assessment, missing dimensions and mismatched record`,()=>{
  const summary=v6CorrectedSummary(slug)!;const pin=structuredClone(repair.universities[slug as keyof typeof repair.universities]);
  const retired=structuredClone(pin);retired.dimensions.exams.claimIds=['retired-policy-claim'];assert.throws(()=>validateScopedAnalysisRepair(summary,retired),/missing current reviewed claim/);
  const missing=structuredClone(pin) as any;delete missing.dimensions.coursework;assert.throws(()=>validateScopedAnalysisRepair(summary,missing),/eleven/);
  const hash=structuredClone(pin);hash.recordSha256='0'.repeat(64);assert.throws(()=>validateScopedAnalysisRepair(summary,hash),/hash mismatch/);
  const changed=structuredClone(summary);changed.summary+=' Future revision.';assert.equal(scopedAnalysisRepair(changed),undefined);
  const toolSummary=structuredClone(summary);toolSummary.claims[0].claimType='ai_tool_treatment';const toolPin=structuredClone(pin);toolPin.recordSha256=createHash('sha256').update(JSON.stringify(toolSummary)).digest('hex');toolPin.dimensions.coursework.claimIds=[toolSummary.claims[0].id!];assert.throws(()=>validateScopedAnalysisRepair(toolSummary,toolPin),/tool-only assessment/);
 });
}
