import {createHash} from 'node:crypto';
import {policyAnalysisDimensionSchema, type PublicEntitySummary} from '@uapt/shared';
import repair from '../../../data/public-analysis-repairs/paris-northwestern-20261023.json';

export const scopedAnalysisRepairRevision=repair.revision;

const dimensions = ['policy_presence','coursework','exams','ai_disclosure','privacy_data_entry','academic_integrity','approved_tools','named_ai_services','teaching_guidance','research_guidance','security_procurement'];
type AnalysisPin = {recordSha256:string; dimensions:Record<string,{claimIds:string[];status:string;summary:string}>};

/** Bind reviewed interpretations to exact current records; retired IDs are never aliases. */
export function validateScopedAnalysisRepair(summary:PublicEntitySummary, pin:AnalysisPin) {
 if (createHash('sha256').update(JSON.stringify(summary)).digest('hex') !== pin.recordSha256) throw new Error('Scoped analysis record hash mismatch');
 if (Object.keys(pin.dimensions).length !== dimensions.length || dimensions.some(key=>!Object.hasOwn(pin.dimensions,key))) throw new Error('Scoped analysis requires all eleven dimensions');
 const claims = new Map(summary.claims.map(c=>[c.id,c]));
 for (const [key, dimension] of Object.entries(pin.dimensions)) {
  policyAnalysisDimensionSchema.shape.status.parse(dimension.status);
  if (!dimension.summary.trim() || new Set(dimension.claimIds).size !== dimension.claimIds.length) throw new Error('Invalid scoped analysis dimension');
  const basis = dimension.claimIds.map(id=>{
   const claim=claims.get(id);
   if (!claim || !['agent_reviewed','human_reviewed'].includes(claim.reviewState) || !claim.evidence.length) throw new Error(`Scoped analysis missing current reviewed claim: ${id}`);
   return claim;
  });
  if (!basis.length && !['unclear','not_mentioned'].includes(dimension.status)) throw new Error(`Scoped analysis without basis: ${key}`);
  if (['coursework','exams'].includes(key) && basis.length && basis.every(c=>c.claimType==='ai_tool_treatment')) throw new Error(`Scoped analysis tool-only assessment basis: ${key}`);
 }
 return pin.dimensions;
}

export function scopedAnalysisRepair(summary:PublicEntitySummary) {
 const pin=(repair.universities as Record<string,AnalysisPin>)[summary.entity.slug];
 // A later reviewed record must receive its own semantic mapping rather than inherit this one.
 if (!pin || createHash('sha256').update(JSON.stringify(summary)).digest('hex') !== pin.recordSha256) return undefined;
 return validateScopedAnalysisRepair(summary,pin);
}
