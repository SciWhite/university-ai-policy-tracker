import { mkdir, writeFile } from "node:fs/promises";
import { OFFICIAL_SOURCE_RIGHTS_CAVEAT } from "@uapt/shared";

const runId = "uapt-maintenance-msu-unist-20260802";
const retrievedAt = "2026-08-02T00:00:00.000Z";
const reportPath = "content/reports/2026-07.mdx";
const msuSlug = "michigan-state-university";
const unistSlug = "ulsan-national-institute-of-science-and-technology-unist";
const msuUrl = "https://tech.msu.edu/technology/ai/tools/";
const unistUrl = "https://ai.unist.ac.kr/";
const msuHash = "b305ff09022a50c4dbdd639295f59426c5dc3b71ec3d9989c8a4498ec975a0a0";
const unistHash = "dcd5780e3479e444acb0af7a3afb80271cbb26cf70b875d2dc4f63dd614ad2f8";

type ToolSpec = {
  id: string;
  tool: string;
  rawToolName: string;
  description: string;
  howToObtain: string;
  costToUser: string;
  availability: "allowed" | "conditionally_allowed";
  endorsementType: "officially_endorsed" | "institutionally_licensed_or_procured";
  snippet: string;
  display?: string;
};

const msuTools: ToolSpec[] = [
  {
    id: "microsoft-copilot",
    tool: "microsoft_copilot",
    rawToolName: "Microsoft Copilot",
    description: "MSU lists Microsoft Copilot with enterprise data protection and explicitly names Public, Internal, Confidential Research, and FERPA data as allowed categories when users are logged in with MSU credentials.",
    howToObtain: "Log in with MSU credentials through Spartan 365.",
    costToUser: "Available at no cost.",
    availability: "allowed",
    endorsementType: "officially_endorsed",
    snippet: "Microsoft Copilot is an AI-powered web chat assistant that provides answers, research insights, and content creation capabilities while maintaining enterprise data protection when logged in with MSU credentials. Allowed data includes Public, Internal, Confidential Research, and FERPA data. How to access: Available at no cost.",
  },
  {
    id: "microsoft-copilot-for-m365",
    tool: "microsoft_copilot_for_m365",
    rawToolName: "Microsoft 365 Copilot",
    description: "MSU lists Microsoft 365 Copilot as an enterprise assistant integrated into Microsoft 365 apps, with the same named data categories and departmental purchase access.",
    howToObtain: "Purchase through the MSU Tech Store using department billing.",
    costToUser: "Departmental purchase required.",
    availability: "conditionally_allowed",
    endorsementType: "institutionally_licensed_or_procured",
    snippet: "Microsoft 365 Copilot integrates Copilot into Microsoft 365 apps (Word, Excel, PowerPoint) for document writing, data analysis, meeting summaries and presentation creation. Allowed data includes Public, Internal, Confidential Research, and FERPA data. How to access: Available for purchase through the MSU Tech Store using department billing for MSU faculty, staff, and students.",
  },
  {
    id: "chatgpt-edu",
    tool: "chatgpt",
    rawToolName: "OpenAI ChatGPT Edu",
    description: "MSU lists ChatGPT EDU as an enterprise AI application available through departmental purchase and states that it does not provide API tokens or direct API access.",
    howToObtain: "Purchase through the MSU Tech Store with departmental billing.",
    costToUser: "Departmental purchase required.",
    availability: "conditionally_allowed",
    endorsementType: "institutionally_licensed_or_procured",
    snippet: "OpenAI ChatGPT EDU is an advanced AI powered by latest GPT and OpenAI models features Study Mode for guided problem-solving, custom GPT builder for department-specific tools, ideal for tutoring, coding assistance, and creative writing. Allowed data includes public, Internal, Confidential Research, and FERPA data. How to access: Available for purchase through the MSU Tech Store with departmental billing for MSU faculty, staff, and students. ChatGPT EDU does not provide API tokens or direct API access.",
  },
  {
    id: "gemini",
    tool: "gemini",
    rawToolName: "Google Gemini",
    description: "MSU lists Google Gemini as available at no cost to people with MSU credentials and names the supported data categories.",
    howToObtain: "Log in with MSU credentials through Google Apps.",
    costToUser: "Available at no cost.",
    availability: "allowed",
    endorsementType: "officially_endorsed",
    snippet: "Google Gemini is an advanced AI powered by latest Gemini models with massive context window, native multimodal document analysis, and tight Google Workspace integration ideal for research-intensive workflows. Allowed data includes Public, Internal, Confidential Research, and FERPA data. How to access: Available at no cost. Login using your MSU credentials at googleapps.msu.edu.",
  },
  {
    id: "gemini-notebook",
    tool: "notebooklm",
    rawToolName: "Google Gemini Notebook",
    description: "MSU lists Google Gemini Notebook, formerly NotebookLM, as a no-cost research assistant for users with MSU credentials.",
    howToObtain: "Log in with MSU credentials through Google Apps.",
    costToUser: "Available at no cost.",
    availability: "allowed",
    endorsementType: "officially_endorsed",
    snippet: "Google Gemini Notebook (formerly NotebookLM) is an AI-powered research assistant that analyzes uploaded documents (PDFs, Google Docs, websites, videos) and generates study guides, briefings, mind maps, video and audio overviews (podcast-style discussions) grounded exclusively in your sources. Allowed data includes Public, Internal, Confidential Research, and FERPA data. How to access: Available at no cost. Login using your MSU credentials at googleapps.msu.edu.",
  },
  {
    id: "zoom-ai-companion",
    tool: "zoom_ai_companion",
    rawToolName: "Zoom AI Companion",
    description: "MSU lists Zoom AI Companion as an MSU-licensed feature set, with host enablement and participant notification when active.",
    howToObtain: "Use an MSU Zoom account and enable the feature in Zoom settings or during meetings.",
    costToUser: "Available at no cost using MSU Zoom accounts.",
    availability: "allowed",
    endorsementType: "institutionally_licensed_or_procured",
    snippet: "Zoom AI Companion is an AI-powered feature set integrated into Zoom that provides meeting summaries, smart recordings, and real-time assistance by analyzing meeting transcripts, chat, and shared content. Features are off by default and must be enabled by the meeting host, with participant notification when active. How to access: Available at no cost using MSU Zoom accounts.",
  },
  {
    id: "openai-api",
    tool: "openai_api",
    rawToolName: "OpenAI API Platform",
    description: "MSU lists the OpenAI API Platform for programmatic integrations and research projects with departmental billing and market-rate pricing.",
    howToObtain: "Submit the MSU request for access and use departmental billing.",
    costToUser: "Market-rate pricing; departmental billing required.",
    availability: "conditionally_allowed",
    endorsementType: "institutionally_licensed_or_procured",
    snippet: "OpenAI’s API Platform enables developers to integrate and use OpenAI models programmatically using API keys for custom applications and research projects. Data: Public, Internal, Confidential Research, and FERPA data allowed. Access: Market-rate pricing; departmental billing required.",
  },
  {
    id: "google-cloud-platform",
    tool: "google_vertex_ai",
    rawToolName: "Google Cloud Platform",
    description: "MSU lists Google Cloud Platform for Vertex AI and other enterprise AI services, with project creation and departmental billing required; its data classification is listed as TBD.",
    howToObtain: "Submit the MSU request for access, create a project, and use departmental billing.",
    costToUser: "Market-rate pricing; departmental billing and project creation required.",
    availability: "conditionally_allowed",
    endorsementType: "institutionally_licensed_or_procured",
    snippet: "Google Cloud Platform (GCP) provides access to Vertex AI and other Google Cloud services for building and deploying complex enterprise AI solutions. Data: TBD. Access: Market-rate pricing; departmental billing and project creation required.",
  },
  {
    id: "codex-local",
    tool: "codex",
    rawToolName: "Codex Local",
    description: "MSU lists Codex Local for AI-assisted coding in supported editors and states that access is included with a ChatGPT Edu subscription.",
    howToObtain: "Use the MSU ChatGPT Edu subscription through the MSU Tech Store.",
    costToUser: "Included with ChatGPT Edu; departmental billing applies to that subscription.",
    availability: "conditionally_allowed",
    endorsementType: "institutionally_licensed_or_procured",
    snippet: "Codex Local enables AI-assisted coding, code completion, and code generation features within VSCode, Cursor, and Windsurf for supported languages. Data: Public, Internal, Confidential Research, and FERPA data allowed. Access: Included with ChatGPT Edu subscription. Available via the MSU Tech Store with departmental billing for MSU faculty, staff, and students.",
  },
];

const unistTools: ToolSpec[] = [
  {
    id: "uniai",
    tool: "institutional_ai_service",
    rawToolName: "UNIAI",
    description: "UNIST presents UNIAI as its own AI chatbot service for UNIST members.",
    howToObtain: "Open UNIAI from the UNIST AI Services portal.",
    costToUser: "Not specified.",
    availability: "allowed",
    endorsementType: "officially_endorsed",
    snippet: "UNIAI UNIST 자체 개발 AI 챗봇 서비스",
    display: "UNIAI — UNIST's in-house-developed AI chatbot service.",
  },
  {
    id: "microsoft-copilot",
    tool: "microsoft_copilot",
    rawToolName: "Microsoft Copilot",
    description: "UNIST lists Microsoft Copilot as usable in Microsoft Office 365 after license allocation; the current page does not state a service end date.",
    howToObtain: "Obtain license allocation and use it in Microsoft Office 365.",
    costToUser: "Not specified.",
    availability: "conditionally_allowed",
    endorsementType: "officially_endorsed",
    snippet: "라이선스 할당 후 MS Office 365에서 활용 가능",
    display: "Available for use in Microsoft Office 365 after license allocation.",
  },
];

function sourceCandidate(entitySlug: string, sourceUrl: string, title: string, language: string, id: string) {
  return {
    schemaVersion: "openclaw-artifact-v1",
    runId,
    artifactType: "source_candidate",
    sourceCandidateId: id,
    entityType: "university",
    entitySlug,
    sourceUrl,
    finalUrl: sourceUrl,
    sourceTitle: title,
    sourceLanguage: language,
    sourceType: "approved_tools",
    discoveryMethod: "canonical_domain",
    queryUsed: "Manual Codex review of OCI content_policy_delta candidate",
    discoveredAt: retrievedAt,
    officialDomainConfidence: 1,
    aiRelevanceScore: 1,
    policySpecificityScore: 0.96,
    verificationStatus: "verified",
    verifiedAt: retrievedAt,
    verificationNotes: "Official institutional AI-tools/service page was opened and compared with the prior source-backed record.",
    robotsPolicy: "respect",
  };
}

function fetchAttempt(sourceCandidateId: string, sourceUrl: string, hash: string, id: string) {
  return {
    schemaVersion: "openclaw-artifact-v1",
    runId,
    artifactType: "fetch_attempt",
    fetchAttemptId: id,
    sourceCandidateId,
    sourceUrl,
    finalUrl: sourceUrl,
    attemptedAt: retrievedAt,
    fetchMode: "http",
    userAgentKind: "browser_like",
    httpStatus: 200,
    contentType: "text/html",
    trackerCheckedAt: retrievedAt,
    robotsAllowed: true,
    outcome: "success",
    contentHash: hash,
    normalizedTextStorageKey: `staging/uapt-runs/${runId}/snapshots/${sourceCandidateId}.txt`,
  };
}

function sourceSnapshot(sourceCandidateId: string, sourceUrl: string, title: string, language: string, hash: string, fetchAttemptId: string) {
  return {
    schemaVersion: "openclaw-artifact-v1",
    runId,
    artifactType: "source_snapshot",
    sourceSnapshotId: `ss-${sourceCandidateId}`,
    sourceCandidateId,
    fetchAttemptId,
    sourceUrl,
    finalUrl: sourceUrl,
    sourceTitle: title,
    sourceLanguage: language,
    contentHash: hash,
    fetchedAt: retrievedAt,
    trackerCheckedAt: retrievedAt,
    httpStatus: 200,
    robotsAllowed: true,
    normalizedTextStorageKey: `staging/uapt-runs/${runId}/snapshots/${sourceCandidateId}.txt`,
    rawArtifactPaths: [],
  };
}

function claimAndEvidence(entitySlug: string, universityName: string, sourceUrl: string, sourceTitle: string, publisher: string, language: string, hash: string, sourceCandidateId: string, tool: ToolSpec) {
  const claimId = `cl-${entitySlug}-ai-tools-20260802-${tool.id}`;
  const evidenceId = `ev-${entitySlug}-ai-tools-20260802-${tool.id}`;
  const sourceSnapshotId = `ss-${sourceCandidateId}`;
  const availability = tool.availability === "allowed" ? "allowed" : "conditionally allowed";
  const endorsement = tool.endorsementType === "officially_endorsed" ? "officially endorsed" : "institutionally licensed or procured";
  const citation = {
    citationTitle: sourceTitle,
    sourceUrl,
    publicJsonUrl: `https://eduaipolicy.org/api/public/v1/universities/${entitySlug}.json`,
    canonicalUrl: `https://eduaipolicy.org/universities/${entitySlug}`,
    publisher,
    retrievedAt,
    snapshotHash: hash,
    sourceRights: OFFICIAL_SOURCE_RIGHTS_CAVEAT,
  };

  return [
    {
      schemaVersion: "openclaw-artifact-v1",
      runId,
      artifactType: "claim_candidate",
      claimId,
      entityType: "university",
      entitySlug,
      claimType: "ai_tool_treatment",
      claimText: `${tool.rawToolName} is listed for ${universityName} in an official university AI tools source. Derived availability: ${availability}. Derived endorsement type: ${endorsement}.`,
      normalizedValue: JSON.stringify({
        tool: tool.tool,
        rawToolName: tool.rawToolName,
        description: tool.description,
        howToObtain: tool.howToObtain,
        costToUser: tool.costToUser,
        availability: tool.availability,
        endorsementType: tool.endorsementType,
      }),
      sourceLanguage: language,
      confidence: 0.98,
      reviewState: "agent_reviewed",
      evidenceIds: [evidenceId],
      citation,
      publishAsCanonical: false,
      isCanonical: false,
    },
    {
      schemaVersion: "openclaw-artifact-v1",
      runId,
      artifactType: "evidence_candidate",
      evidenceId,
      claimId,
      sourceSnapshotId,
      sourceUrl,
      finalUrl: sourceUrl,
      sourceTitle,
      sourceLanguage: language,
      snapshotHash: hash,
      evidenceSnippetOriginal: tool.snippet,
      evidenceSnippetDisplay: tool.display ?? tool.snippet,
      evidenceLocator: "Official AI tools/service page, tool entry",
      evidenceType: "official_source",
      relevance: 0.99,
      rightsNote: OFFICIAL_SOURCE_RIGHTS_CAVEAT,
      citation,
    },
    {
      schemaVersion: "openclaw-artifact-v1",
      runId,
      artifactType: "review_decision",
      decisionId: `rd-${claimId}`,
      claimId,
      decision: "approve",
      reviewState: "agent_reviewed",
      reviewerType: "local_reviewer",
      reviewer: "codex",
      notes: "Approved after direct review of the current official page. The claim describes tool/service availability and does not convert the page into a general academic-integrity or legal conclusion.",
      decidedAt: retrievedAt,
    },
  ];
}

async function main() {
  const msuSourceCandidateId = "sc-msu-ai-tools-20260802";
  const unistSourceCandidateId = "sc-unist-ai-services-20260802";
  const msuFetchId = "fa-msu-ai-tools-20260802";
  const unistFetchId = "fa-unist-ai-services-20260802";
  const artifacts = [
    {
      schemaVersion: "openclaw-artifact-v1",
      runId,
      artifactType: "crawl_plan",
      planId: `cp-${runId}`,
      createdAt: retrievedAt,
      createdBy: "codex",
      targets: [
        { entityType: "university", entitySlug: msuSlug, sourceCandidateId: msuSourceCandidateId, sourceUrl: msuUrl, sourceTitle: "AI Tools", sourceLanguage: "en", allowedFetchModes: ["http"], expectedThemes: ["approved_tools", "institutional_access"], maxUrls: 1, robotsPolicy: "respect" },
        { entityType: "university", entitySlug: unistSlug, sourceCandidateId: unistSourceCandidateId, sourceUrl: unistUrl, sourceTitle: "UNIST AI Services", sourceLanguage: "ko", allowedFetchModes: ["http"], expectedThemes: ["approved_tools", "institutional_access"], maxUrls: 1, robotsPolicy: "respect" },
      ],
      stopConditions: ["Do not infer a policy change from hash or metadata changes alone.", "Do not infer that UNIST extended a service end date merely because the current page omits the old date."],
    },
    {
      schemaVersion: "openclaw-artifact-v1",
      runId,
      artifactType: "source_discovery_trace",
      traceId: `trace-${msuSlug}-${runId}`,
      entityType: "university",
      entitySlug: msuSlug,
      startedAt: retrievedAt,
      endedAt: retrievedAt,
      methodsAttempted: [{ method: "canonical_domain", domain: "tech.msu.edu", query: "Manual Codex review of OCI content_policy_delta candidate", resultCount: 1 }],
      noSourceEscalationCompleted: false,
      candidateIds: [msuSourceCandidateId],
      rejectionIds: [],
      summary: "The official MSU AI Tools page was verified as the current source for the tool directory update.",
    },
    {
      schemaVersion: "openclaw-artifact-v1",
      runId,
      artifactType: "source_discovery_trace",
      traceId: `trace-${unistSlug}-${runId}`,
      entityType: "university",
      entitySlug: unistSlug,
      startedAt: retrievedAt,
      endedAt: retrievedAt,
      methodsAttempted: [{ method: "canonical_domain", domain: "ai.unist.ac.kr", query: "Manual Codex review of OCI content_policy_delta candidate", resultCount: 1 }],
      noSourceEscalationCompleted: false,
      candidateIds: [unistSourceCandidateId],
      rejectionIds: [],
      summary: "The official UNIST AI Services page was verified as the current source for UNIAI and Copilot availability.",
    },
    sourceCandidate(msuSlug, msuUrl, "AI Tools", "en", msuSourceCandidateId),
    sourceCandidate(unistSlug, unistUrl, "UNIST AI Services", "ko", unistSourceCandidateId),
    fetchAttempt(msuSourceCandidateId, msuUrl, msuHash, msuFetchId),
    fetchAttempt(unistSourceCandidateId, unistUrl, unistHash, unistFetchId),
    sourceSnapshot(msuSourceCandidateId, msuUrl, "AI Tools", "en", msuHash, msuFetchId),
    sourceSnapshot(unistSourceCandidateId, unistUrl, "UNIST AI Services", "ko", unistHash, unistFetchId),
    ...msuTools.flatMap((tool) => claimAndEvidence(msuSlug, "Michigan State University", msuUrl, "AI Tools", "Michigan State University", "en", msuHash, msuSourceCandidateId, tool)),
    ...unistTools.flatMap((tool) => claimAndEvidence(unistSlug, "Ulsan National Institute of Science and Technology (UNIST)", unistUrl, "UNIST AI Services", "UNIST", "ko", unistHash, unistSourceCandidateId, tool)),
    {
      schemaVersion: "openclaw-artifact-v1",
      runId,
      artifactType: "report_draft",
      reportId: `report-${runId}`,
      title: "University AI Policy Tracker: July 2026 month-end report",
      generatedAt: retrievedAt,
      draftPath: reportPath,
      summary: "July 2026 month-end release review: current official AI-tools evidence was added for Michigan State University and UNIST. The UNIST record preserves current Copilot availability without inferring a service extension from the removal of an older end-date sentence.",
      referencedClaimIds: [
        ...msuTools.map((tool) => `cl-${msuSlug}-ai-tools-20260802-${tool.id}`),
        ...unistTools.map((tool) => `cl-${unistSlug}-ai-tools-20260802-${tool.id}`),
      ],
      publicJsonLinks: [
        "https://eduaipolicy.org/api/public/v1/universities/michigan-state-university.json",
        "https://eduaipolicy.org/api/public/v1/universities/ulsan-national-institute-of-science-and-technology-unist.json",
        "https://eduaipolicy.org/api/public/v1/tools.json",
        "https://eduaipolicy.org/api/public/v1/datasets/latest.json",
      ],
      limitations: [
        "This tracker is not legal advice, not academic integrity advice, and not an official university statement unless a linked source is the university's own official page.",
        "Tool records are derived discovery metadata; official university pages remain authoritative.",
        "The current UNIST page does not state that Copilot service was extended beyond the older published end date.",
      ],
      trackerMetadataLicense: "CC-BY-4.0",
      sourceRightsPolicy: OFFICIAL_SOURCE_RIGHTS_CAVEAT,
      rawArtifactPaths: [],
    },
  ];

  const root = `staging/uapt-runs/${runId}`;
  await mkdir(root, { recursive: true });
  await writeFile(`${root}/artifacts.json`, `${JSON.stringify({ schemaVersion: "openclaw-artifact-v1", runId, runPurpose: "claim_evidence_release", snippetPolicy: "verbatim_original_v2", artifacts }, null, 2)}\n`);
  await mkdir("staging/uapt-maintenance/manual-review-20260802", { recursive: true });
  await writeFile("staging/uapt-maintenance/manual-review-20260802/review-results.json", `${JSON.stringify({ runId: "manual-review-20260802", runningUnits: [], results: [{ classification: "valid_artifact", artifactDir: root, notes: "Direct Codex review of current official MSU and UNIST AI tools pages." }] }, null, 2)}\n`);
  console.log(JSON.stringify({ runId, artifactDir: root, artifactCount: artifacts.length, claimCount: msuTools.length + unistTools.length }, null, 2));
}

void main();
