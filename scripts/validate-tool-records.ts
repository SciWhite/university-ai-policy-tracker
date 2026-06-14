import assert from "node:assert/strict";
import {
  deriveUniversityToolRecordsForSummary,
  formatToolAvailability,
  publicToolsResponseSchema,
  buildPublicToolsResponse,
  type ClaimReviewState,
  type PolicyClaim,
  type PublicEntitySummary
} from "@uapt/shared";

const snapshotHash = "a".repeat(64);

const mixedRecord = buildSummary("mixed-tools-university", "Mixed Tools University", [
  buildClaim(
    "ChatGPT is discussed in university guidance. Microsoft Copilot is institutionally licensed and approved for staff use."
  )
]);
const mixedTools = deriveUniversityToolRecordsForSummary(mixedRecord);
const chatGpt = mixedTools.find((record) => record.tool === "chatgpt");
const copilot = mixedTools.find((record) => record.tool === "microsoft_copilot");

assert.equal(chatGpt?.availability, "not_mentioned");
assert.equal(chatGpt?.endorsementType, "not_specified");
assert.equal(copilot?.availability, "allowed");
assert.equal(
  copilot?.endorsementType,
  "institutionally_licensed_or_procured"
);

const genericRecord = buildSummary("generic-tools-university", "Generic Tools University", [
  buildClaim("AI tools are available through the university help center.")
]);
const genericTools = deriveUniversityToolRecordsForSummary(genericRecord);
assert.deepEqual(
  genericTools.map((record) => record.tool),
  ["unspecified_ai_tool"]
);
assert.equal(genericTools[0]?.availability, "allowed");

const blockedRecord = buildSummary("blocked-tools-university", "Blocked Tools University", [
  buildClaim("Claude is not allowed for student assessment submissions.")
]);
const blockedTools = deriveUniversityToolRecordsForSummary(blockedRecord);
assert.equal(blockedTools[0]?.tool, "claude");
assert.equal(blockedTools[0]?.availability, "restricted_or_blocked");
assert.equal(
  formatToolAvailability(blockedTools[0]?.availability ?? "not_mentioned"),
  "Blocked / restricted"
);

const endorsementRecord = buildSummary(
  "endorsement-tools-university",
  "Endorsement Tools University",
  [
    buildClaim("Gemini is a self-hosted system for internal research data."),
    buildClaim("DeepSeek is a third-party vendor service and is not institutionally licensed.")
  ]
);
const endorsementTools = deriveUniversityToolRecordsForSummary(endorsementRecord);
assert.equal(
  endorsementTools.find((record) => record.tool === "gemini")?.endorsementType,
  "self_hosted_system"
);
assert.equal(
  endorsementTools.find((record) => record.tool === "deepseek")?.endorsementType,
  "third_party_service"
);

publicToolsResponseSchema.parse(
  buildPublicToolsResponse([
    ...mixedTools,
    ...genericTools,
    ...blockedTools,
    ...endorsementTools
  ])
);

console.log(
  `Validated ${mixedTools.length + genericTools.length + blockedTools.length + endorsementTools.length} derived tool fixture records.`
);

function buildSummary(
  slug: string,
  name: string,
  claims: PolicyClaim[]
): PublicEntitySummary {
  return {
    schemaVersion: "v1",
    citationTitle: `${name} AI Policy Tracker record`,
    canonicalUrl: `https://example.test/universities/${slug}`,
    publicPageUrl: `https://example.test/universities/${slug}`,
    apiUrl: `https://example.test/api/public/v1/universities/${slug}.json`,
    entityType: "university",
    entitySlug: slug,
    entity: {
      type: "university",
      slug,
      name,
      canonicalUrl: `https://example.test/universities/${slug}`,
      aliases: [],
      summary: `${name} fixture summary.`
    },
    summary: `${name} fixture summary.`,
    confidence: 0.9,
    reviewState: "agent_reviewed",
    license: "CC-BY-4.0",
    trackerMetadataLicense: "CC-BY-4.0",
    sourcePolicy:
      "Tracker metadata is open licensed. Official source documents, page text, PDFs, and other source materials retain their original rights and terms.",
    sourceRightsPolicy:
      "Tracker metadata is open licensed. Official source documents, page text, PDFs, and other source materials retain their original rights and terms.",
    limitations: [
      "This tracker is not legal advice, not academic integrity advice, and not an official university statement unless a linked source is the university's own official page."
    ],
    officialSources: [
      {
        sourceUrl: `https://example.test/${slug}/ai-tools`,
        citationTitle: `${name} AI tools guidance`,
        publisher: name,
        snapshotHash,
        sourceType: "official_guidance",
        official: true,
        sourceRights:
          "Tracker metadata is open licensed. Official source documents, page text, PDFs, and other source materials retain their original rights and terms."
      }
    ],
    claims: claims.map((claim) => ({
      ...claim,
      entitySlug: slug
    })),
    suggestedCitation: `${name} AI Policy Tracker record.`
  };
}

function buildClaim(
  text: string,
  reviewState: ClaimReviewState = "agent_reviewed"
): PolicyClaim {
  return {
    entitySlug: "fixture",
    entityType: "university",
    claimType: "ai_tool_treatment",
    claimText: text,
    confidence: 0.9,
    reviewState,
    evidence: [
      {
        sourceUrl: "https://example.test/ai-tools",
        sourceLanguage: "en",
        sourceSnapshotHash: snapshotHash,
        evidenceSnippet: text,
        attribution: {
          sourceUrl: "https://example.test/ai-tools",
          citationTitle: "AI tools guidance",
          publisher: "Fixture University",
          snapshotHash,
          sourceType: "official_guidance",
          official: true,
          sourceRights:
            "Tracker metadata is open licensed. Official source documents, page text, PDFs, and other source materials retain their original rights and terms."
        }
      }
    ]
  };
}
