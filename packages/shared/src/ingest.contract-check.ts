import {
  crawlPlanSchema,
  crawlRunIngestPayloadSchema,
  extractionCandidateIngestPayloadSchema,
  sourceSnapshotIngestPayloadSchema,
  type CrawlPlan,
  type CrawlRunIngestPayload,
  type ExtractionCandidateIngestPayload,
  type SourceSnapshotIngestPayload
} from "./ingest";

export const ingestContractExamples = {
  crawlPlan: crawlPlanSchema.parse({
    planId: "local-sample-plan",
    name: "Local sample crawl plan",
    createdAt: "2026-05-04T00:00:00.000Z",
    targets: [
      {
        url: "https://www.harvard.edu",
        universitySlug: "harvard",
        expectedThemes: ["academic_integrity"]
      }
    ]
  }) satisfies CrawlPlan,
  crawlRun: crawlRunIngestPayloadSchema.parse({
    universitySlug: "harvard",
    sourceUrl: "https://www.harvard.edu",
    requestedUrl: "https://www.harvard.edu",
    status: "succeeded",
    fetchMode: "http"
  }) satisfies CrawlRunIngestPayload,
  sourceSnapshot: sourceSnapshotIngestPayloadSchema.parse({
    universitySlug: "harvard",
    sourceUrl: "https://www.harvard.edu",
    documentStatus: "specific_unit_policy_or_guidance",
    fetchedAt: "2026-05-04T00:00:00.000Z",
    contentHash:
      "0000000000000000000000000000000000000000000000000000000000000000",
    normalizedText: "Sample normalized policy text."
  }) satisfies SourceSnapshotIngestPayload,
  extractionCandidate: extractionCandidateIngestPayloadSchema.parse({
    sourceSnapshotId: "sample-snapshot-id",
    documentStatus: "specific_unit_policy_or_guidance",
    aiServiceStatus: "third_party_service",
    serviceTreatment: "conditionally_allowed",
    aiTools: ["chatgpt"],
    themes: ["academic_integrity"],
    evidence: [
      {
        url: "https://www.harvard.edu",
        retrievedAt: "2026-05-04T00:00:00.000Z"
      }
    ],
    confidence: 0.25
  }) satisfies ExtractionCandidateIngestPayload
};
