import assert from "node:assert/strict";
import {
  deriveUniversityToolRecordsForSummary,
  formatToolAvailability,
  formatToolLabel,
  publicToolsResponseSchema,
  buildPublicToolsResponse,
  type ClaimReviewState,
  type PolicyClaim,
  type PublicEntitySummary
} from "@uapt/shared";

const snapshotHash = "a".repeat(64);

const mitSummary = buildSummary("mit-tools-fixture", "MIT Tools Fixture", [
  buildClaim(
    "Google Gemini | Text-based AI chatbot | MIT faculty, staff, and students | Free with an MIT Google Workspace account | Access Gemini via Touchstone with your MIT Kerberos account"
  ),
  buildClaim(
    "Google NotebookLM | Research assistant and note-taking tool | MIT faculty, staff, and students | Free with an MIT Google Workspace account | Access NotebookLM via Touchstone with your MIT Kerberos account"
  ),
  buildClaim(
    "Microsoft Copilot for M365 | AI add-on for Microsoft 365 products | MIT faculty, staff, and students | Institute cost object required | Request an account through the IS&T ServiceNow portal"
  ),
  buildClaim(
    "Open AI ChatGPT | Advanced version of publicly available ChatGPT tool with added security and features | MIT faculty | Free | We recommend that faculty interested in ChatGPT contact IS&T about Parley"
  ),
  buildClaim(
    "Parley | Secure, MIT-hosted platform that allows users to interact with multiple popular generative AI models | MIT faculty, staff, and students | Free | Parley is available to all faculty, staff, and students"
  ),
  buildClaim(
    "AWS Bedrock | Developer access to third-party large language models via API | MIT faculty and staff | Institute cost object required | Register for an AWS account through IS&T's MIT Cloud Accounts program"
  ),
  buildClaim(
    "AWS Sagemaker | Managed AI/ML model access and training | MIT faculty and staff | Institute cost object required | Register for an AWS account through IS&T's MIT Cloud Accounts program"
  ),
  buildClaim(
    "Azure OpenAI | Developer access to Azure OpenAI and other cognitive services | MIT faculty and staff | Institute cost object required | Register for an Azure account through IS&T's MIT Cloud Accounts program"
  ),
  buildClaim(
    "Google Vertex | Developer access to Google's AI models | MIT faculty and staff | Institute cost object required | Register for a GCP account through IS&T's MIT Cloud Accounts program"
  ),
  buildClaim(
    "Adobe Firefly | Generate or modify images via text prompts | MIT faculty, staff, and students | Free | MIT's Adobe Creative Cloud license"
  ),
  buildClaim(
    "Salesforce Einstein | Delivers AI-powered predictions and generated content | MIT faculty and staff | Institute cost object required | Contact IS&T's Salesforce Licensing"
  ),
  buildClaim(
    "Zoom AI Companion | AI add-on for meeting summaries and smart recording | MIT faculty, staff, students, and affiliates | Free | Enable features by signing into MIT's Zoom portal via Touchstone"
  )
]);

const mitRecords = deriveUniversityToolRecordsForSummary(mitSummary);
assert.equal(mitRecords.find((record) => record.tool === "gemini")?.rawToolName, "Google Gemini");
assert.equal(mitRecords.find((record) => record.tool === "notebooklm")?.rawToolName, "Google NotebookLM");
assert.equal(
  mitRecords.find((record) => record.tool === "microsoft_copilot_for_m365")?.rawToolName,
  "Microsoft Copilot for M365"
);
assert.equal(mitRecords.find((record) => record.tool === "chatgpt")?.rawToolName, "Open AI ChatGPT");
assert.equal(mitRecords.find((record) => record.tool === "self_deploy")?.rawToolName, "Parley");
assert.equal(mitRecords.find((record) => record.tool === "aws_bedrock")?.rawToolName, "AWS Bedrock");
assert.equal(mitRecords.find((record) => record.tool === "aws_sagemaker")?.rawToolName, "AWS Sagemaker");
assert.equal(mitRecords.find((record) => record.tool === "azure_openai")?.rawToolName, "Azure OpenAI");
assert.equal(mitRecords.find((record) => record.tool === "google_vertex_ai")?.rawToolName, "Google Vertex");
assert.equal(mitRecords.find((record) => record.tool === "adobe_firefly")?.rawToolName, "Adobe Firefly");
assert.equal(
  mitRecords.find((record) => record.tool === "salesforce_einstein")?.rawToolName,
  "Salesforce Einstein"
);
assert.equal(
  mitRecords.find((record) => record.tool === "zoom_ai_companion")?.rawToolName,
  "Zoom AI Companion"
);
assert.equal(
  formatToolLabel("notebooklm"),
  "NotebookLM / Google"
);
assert.equal(formatToolLabel("self_deploy"), "University-hosted platform");

const chinaSummary = buildSummary("china-tools-fixture", "China Tools Fixture", [
  buildClaim("Kimi | Available to students and staff through the university portal"),
  buildClaim("GLM | Available to students and staff through the university portal"),
  buildClaim("MiniMax | Available to students and staff through the university portal"),
  buildClaim("Doubao | Available to students and staff through the university portal"),
  buildClaim("Qwen | Available to students and staff through the university portal"),
  buildClaim("ERNIE | Available to students and staff through the university portal"),
  buildClaim("Hunyuan | Available to students and staff through the university portal"),
  buildClaim("Tencent Yuanbao | Available to students and staff through the university portal")
]);

const chinaRecords = deriveUniversityToolRecordsForSummary(chinaSummary);
assert.deepEqual(
  chinaRecords.map((record) => record.tool).sort(),
  ["doubao", "ernie", "glm", "hunyuan", "kimi", "minimax", "qwen", "yuanbao"]
);

const genericSummary = buildSummary("generic-tools-fixture", "Generic Tools Fixture", [
  buildClaim("AI tools are available through the university help center.")
]);

const genericRecords = deriveUniversityToolRecordsForSummary(genericSummary);
assert.deepEqual(
  genericRecords.map((record) => record.tool),
  ["unspecified_ai_tool"]
);
assert.equal(genericRecords[0]?.rawToolName, "AI tools");
assert.equal(genericRecords[0]?.availability, "allowed");

const selfDeploySummary = buildSummary(
  "self-deploy-tools-fixture",
  "Self Deploy Tools Fixture",
  [
    buildClaim(
      "Stanford AI Playground | A university-hosted platform where users can try various AI models from OpenAI, Google, and Anthropic"
    )
  ]
);

const selfDeployRecords = deriveUniversityToolRecordsForSummary(selfDeploySummary);
assert.deepEqual(selfDeployRecords.map((record) => record.tool), ["self_deploy"]);
assert.equal(selfDeployRecords[0]?.rawToolName, "Stanford AI Playground");

const institutionalSummary = buildSummary(
  "institutional-tools-fixture",
  "Institutional Tools Fixture",
  [buildClaim("An institutional AI platform is available for faculty and staff.")]
);

const institutionalRecords = deriveUniversityToolRecordsForSummary(institutionalSummary);
assert.deepEqual(
  institutionalRecords.map((record) => record.tool),
  ["institutional_ai_service"]
);

const blockedSummary = buildSummary("blocked-tools-fixture", "Blocked Tools Fixture", [
  buildClaim("Claude is not allowed for student assessment submissions.")
]);

const blockedRecords = deriveUniversityToolRecordsForSummary(blockedSummary);
assert.equal(blockedRecords[0]?.tool, "claude");
assert.equal(blockedRecords[0]?.availability, "restricted_or_blocked");
assert.equal(
  formatToolAvailability(blockedRecords[0]?.availability ?? "not_mentioned"),
  "Blocked / restricted"
);

publicToolsResponseSchema.parse(
  buildPublicToolsResponse([
    ...mitRecords,
    ...chinaRecords,
    ...genericRecords,
    ...selfDeployRecords,
    ...institutionalRecords,
    ...blockedRecords
  ])
);

console.log(
  `Validated ${mitRecords.length + chinaRecords.length + genericRecords.length + selfDeployRecords.length + institutionalRecords.length + blockedRecords.length} derived tool fixture records.`
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
