import { test } from "node:test";
import assert from "node:assert/strict";
import { validateAssessmentEvidence } from "../scripts/validate-assessment-evidence";

const tools = [{ id: "tool", claimType: "ai_tool_treatment" }];
const empty = { key: "exams", status: "unclear", evidenceClaimIds: [] };

test("tool access cannot establish assessment permission or assessment coverage", () => {
  for (const status of ["conditionally_allowed", "allowed", "restricted", "unclear"]) {
    assert.throws(() => validateAssessmentEvidence(tools, { dimensions: [
      { key: "coursework", status, evidenceClaimIds: ["tool"] }, empty
    ] }), /Tool-only assessment basis/);
  }
});

test("missing and foreign basis IDs fail; evidence gaps remain explicit", () => {
  assert.throws(() => validateAssessmentEvidence(tools, { dimensions: [
    { key: "coursework", status: "allowed", evidenceClaimIds: ["other"] }, empty
  ] }), /Unknown assessment basis/);
  assert.throws(() => validateAssessmentEvidence(tools, { dimensions: [
    { key: "coursework", status: "allowed", evidenceClaimIds: [] }, empty
  ] }), /without evidence/);
  validateAssessmentEvidence(tools, { dimensions: [
    { key: "coursework", status: "unclear", evidenceClaimIds: [] }, empty
  ] });
});

test("an assessment claim passes structure only, retaining independent semantic review", () => {
  validateAssessmentEvidence([...tools, { id: "course-rule", claimType: "teaching" }], {
    dimensions: [{ key: "coursework", status: "conditionally_allowed", evidenceClaimIds: ["course-rule"] }, empty]
  });
  assert.throws(() => validateAssessmentEvidence(tools, { dimensions: [empty, empty] }), /Missing or duplicate/);
});


test('insufficient public evidence needs an assessment basis and never a tool-only basis', () => {
  const exam = {key:'exams',status:'insufficient_public_evidence',evidenceClaimIds:['general-exam-rule']};
  validateAssessmentEvidence([...tools,{id:'general-exam-rule',claimType:'academic_integrity'}],{dimensions:[{key:'coursework',status:'not_mentioned',evidenceClaimIds:[]},exam]});
  assert.throws(()=>validateAssessmentEvidence(tools,{dimensions:[{key:'coursework',status:'not_mentioned',evidenceClaimIds:[]},{...exam,evidenceClaimIds:['tool']}]}),/Tool-only assessment basis/);
});

test('berkeley analysis dimensions pass structural gate with zero tools for exams and coursework', () => {
  const berkeleyClaims = [
    { id: 'claim-university-of-california-berkeley-5', claimType: 'academic_integrity' },
    { id: 'claim-university-of-california-berkeley-8', claimType: 'teaching' },
    { id: 'claim-university-of-california-berkeley-15', claimType: 'teaching' },
    { id: 'claim-university-of-california-berkeley-17', claimType: 'teaching' },
    { id: 'claim-university-of-california-berkeley-18', claimType: 'teaching' },
    { id: 'claim-university-of-california-berkeley-student-conduct-cheating-definition', claimType: 'academic_integrity' },
    { id: 'cl-university-of-california-berkeley-chatgpt-140', claimType: 'ai_tool_treatment' }
  ];
  const profile = {
    dimensions: [
      {
        key: 'coursework',
        status: 'conditionally_allowed',
        evidenceClaimIds: [
          'claim-university-of-california-berkeley-5',
          'claim-university-of-california-berkeley-8',
          'claim-university-of-california-berkeley-15',
          'claim-university-of-california-berkeley-17',
          'claim-university-of-california-berkeley-student-conduct-cheating-definition'
        ]
      },
      {
        key: 'exams',
        status: 'conditionally_allowed',
        evidenceClaimIds: [
          'claim-university-of-california-berkeley-5',
          'claim-university-of-california-berkeley-18',
          'claim-university-of-california-berkeley-student-conduct-cheating-definition'
        ]
      }
    ]
  };
  validateAssessmentEvidence(berkeleyClaims, profile);

  // Deriving exams from tools must throw Tool-only assessment basis error
  const invalidProfile = {
    dimensions: [
      profile.dimensions[0],
      {
        key: 'exams',
        status: 'conditionally_allowed',
        evidenceClaimIds: ['cl-university-of-california-berkeley-chatgpt-140']
      }
    ]
  };
  assert.throws(() => validateAssessmentEvidence(berkeleyClaims, invalidProfile), /Tool-only assessment basis: exams/);
});
