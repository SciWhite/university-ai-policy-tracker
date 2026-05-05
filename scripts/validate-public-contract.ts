import {
  publicContractExamples,
  publicEntitySummarySchema,
  publicRecentChangesResponseSchema
} from "@uapt/shared";

const summaries = publicContractExamples.universities.map((summary) =>
  publicEntitySummarySchema.parse(summary)
);
const recentChanges = publicRecentChangesResponseSchema.parse(
  publicContractExamples.recentChanges
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
  `Validated ${summaries.length} public entity examples, ${claimCount} claims, ${evidenceCount} evidence records, and ${recentChanges.changes.length} recent-change records.`
);
