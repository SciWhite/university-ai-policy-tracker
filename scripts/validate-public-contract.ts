import {
  publicContractExamples,
  publicApiIndexResponseSchema,
  publicEntitySummaryResponseSchema,
  publicEntitySummarySchema,
  publicRecentChangesEnvelopeSchema,
  publicRecentChangesResponseSchema,
  publicToolsResponseSchema,
  publicUniversityListResponseSchema
} from "@uapt/shared";

const apiIndex = publicApiIndexResponseSchema.parse(
  publicContractExamples.apiIndex
);
const universityList = publicUniversityListResponseSchema.parse(
  publicContractExamples.universityList
);
const tools = publicToolsResponseSchema.parse(publicContractExamples.toolsResponse);
const summaries = publicContractExamples.universities.map((summary) =>
  publicEntitySummarySchema.parse(summary)
);
const summaryResponses = publicContractExamples.universityResponses.map((response) =>
  publicEntitySummaryResponseSchema.parse(response)
);
const recentChanges = publicRecentChangesResponseSchema.parse(
  publicContractExamples.recentChanges
);
const recentChangesEnvelope = publicRecentChangesEnvelopeSchema.parse(
  publicContractExamples.recentChangesEnvelope
);

const claimCount = summaries.reduce(
  (total, summary) => total + summary.claims.length,
  0
);
const evidenceCount = summaries.reduce(
  (total, summary) =>
    total +
    summary.claims.reduce(
      (claimTotal, claim) => claimTotal + claim.evidence.length,
      0
    ),
  0
);

console.log(
  `Validated ${apiIndex.data.endpoints.length} public endpoints, ${universityList.data.count} listed universities, ${tools.data.count} derived tool records, ${summaryResponses.length} enveloped university records, ${summaries.length} public entity examples, ${claimCount} claims, ${evidenceCount} evidence records, and ${recentChanges.changes.length}/${recentChangesEnvelope.data.changes.length} recent-change records.`
);
