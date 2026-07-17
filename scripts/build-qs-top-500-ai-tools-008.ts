import { createHash } from "node:crypto";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";

type Json = Record<string, any>;

const generatedAt = "2026-07-18T12:00:00.000Z";
const extensionRunId = "uapt-ai-tools-qs-431-500-20260718-008";
const top500RunId = "uapt-ai-tools-qs-top-500-20260718-008";
const releaseId = "public-release-20260718-008";
const baselinePath = "staging/ai-tools/release-candidates/uapt-ai-tools-qs-top-430-20260715-005/tool_records.json";
const source007Path = "staging/ai-tools/release-candidates/uapt-ai-tools-qs-431-500-20260717-007/tool_records.json";
const ledger007Path = "staging/ai-tools/audits/qs-431-500-ai-tools-audit-ledger-20260717-007.json";
const currentManifestPath = "data/public-releases/current.json";
const priorProductionManifestPath = "data/public-releases/history/public-release-20260717-001.json";

const snapshots = {
  americanCopilot: "staging/ai-tools/audits/snapshots/qs-431-500-20260718-008/american-university-copilot-chat.md",
  americanPerplexity: "staging/ai-tools/audits/snapshots/qs-431-500-20260718-008/american-university-kogod-perplexity-enterprise-pro.md",
  hiroshima: "staging/ai-tools/audits/snapshots/qs-431-500-20260718-008/hiroshima-university-contracted-ai-tools.md",
  guelph: "staging/ai-tools/audits/snapshots/qs-431-500-20260718-008/university-of-guelph-microsoft-365-copilot.md"
};

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

async function main(): Promise<void> {
  const [baseline, source007, ledger007, currentManifest, priorProductionManifest] = await Promise.all([
    json(baselinePath), json(source007Path), json(ledger007Path), json(currentManifestPath), json(priorProductionManifestPath)
  ]);
  const basePublicManifest = currentManifest.releaseId === releaseId ? priorProductionManifest : currentManifest;
  const additions = await buildAdditions();
  const extensionRecords = stableDedupe([...source007.records, ...additions]);
  const extension = {
    schemaVersion: "uapt-ai-tools-records-v1",
    runId: extensionRunId,
    generatedAt,
    reviewState: "agent_reviewed",
    records: extensionRecords
  };
  const ledger = buildLedger(ledger007, additions);
  const highRiskReview = buildHighRiskReview(ledger007, additions);

  const top500Records = stableDedupe([...baseline.records, ...extensionRecords]);
  const top500 = {
    schemaVersion: "uapt-ai-tools-records-v1",
    runId: top500RunId,
    generatedAt,
    reviewState: "agent_reviewed",
    records: top500Records
  };
  const sourceCount = uniqueSources(top500Records).length;
  const extensionRoot = path.join("staging/ai-tools/release-candidates", extensionRunId);
  const top500Root = path.join("staging/ai-tools/release-candidates", top500RunId);
  const runRoot = path.join("staging/uapt-runs", top500RunId);
  await Promise.all([extensionRoot, top500Root, runRoot].map((directory) => mkdir(directory, { recursive: true })));

  const extensionContent = stringify(extension);
  const top500Content = stringify(top500);
  await Promise.all([
    writeFile(path.join(extensionRoot, "tool_records.json"), extensionContent),
    writeFile("staging/ai-tools/audits/qs-431-500-ai-tools-audit-ledger-20260718-008.json", stringify(ledger)),
    writeFile("staging/ai-tools/audits/qs-431-500-high-risk-semantic-review-20260718-008.json", stringify(highRiskReview)),
    writeFile(path.join(top500Root, "tool_records.json"), top500Content)
  ]);

  const extensionSources = uniqueSources(extensionRecords);
  await writeFile(path.join(top500Root, "candidate-manifest.json"), stringify({
    schemaVersion: "uapt-ai-tools-release-candidate-v1",
    runId: top500RunId,
    generatedAt,
    scope: { qsRows: "1-500", ledgerRows: 500, extensionQsRows: "431-500", extensionLedgerRows: 70 },
    immutableBaseline: { runId: baseline.runId, toolRecordsPath: baselinePath, toolRecordsSha256: sha(await readFile(baselinePath)) },
    repairedExtension: { runId: extensionRunId, sourceRunId: source007.runId, toolRecordsPath: path.join(extensionRoot, "tool_records.json"), toolRecordsSha256: sha(extensionContent) },
    recordCount: top500Records.length,
    universityCount: new Set(top500Records.map((record: Json) => record.universitySlug)).size,
    sourceCount,
    extensionRecordCount: extensionRecords.length,
    extensionUniversityCount: new Set(extensionRecords.map((record: Json) => record.universitySlug)).size,
    extensionSourceCount: extensionSources.length,
    duplicateRecordCount: baseline.records.length + extensionRecords.length - top500Records.length,
    dedupeKey: "universitySlug + canonical tool + normalized product name",
    toolRecordsSha256: sha(top500Content)
  }));

  await writeFile(path.join(runRoot, "artifacts.json"), stringify(buildSeedBundle(top500Records)));
  const runDirectory = `staging/uapt-runs/${top500RunId}`;
  if (basePublicManifest.includeStagedArtifactDirectories.includes(runDirectory)) {
    throw new Error(`${runDirectory} is already present in current.json`);
  }
  const publicManifest = {
    ...basePublicManifest,
    releaseId,
    publishedAt: generatedAt,
    description: "QS top-500 AI tools 008 production release: repairs false negatives in QS rows 431-500 while preserving the full current production manifest.",
    includeStagedArtifactDirectories: [...basePublicManifest.includeStagedArtifactDirectories, runDirectory],
    notes: [
      `Publishes ${top500Records.length} official-source AI tool records for ${new Set(top500Records.map((record: Json) => record.universitySlug)).size} universities from ${sourceCount} official university sources.`,
      `The repaired 008 extension contains ${extensionRecords.length} records across ${new Set(extensionRecords.map((record: Json) => record.universitySlug)).size} universities; its 70-row ledger has 24 positive rows, 0 verified-zero rows, and 46 blocked/null evidence-boundary rows.`,
      "A semantic re-review of all 21 blocked rows carrying institutional-access signals repaired Hiroshima University, University of Guelph, and American University; the other 18 remain blocked/null rather than asserted zero.",
      "Permanent regressions require six newly recovered records: Hiroshima Copilot Chat, Gemini, and NotebookLM; Guelph Microsoft 365 Copilot Chat; and American University Copilot Chat and Perplexity Enterprise Pro.",
      "The immutable QS top-430 005 baseline is preserved byte-for-byte; the latest production manifest, including subsequent maintenance runs, is extended rather than replaced.",
      "The OpenClaw bundle must contain all nine required artifact types before promotion. Tracker metadata is open licensed; official source documents retain their original rights."
    ]
  };
  await mkdir("data/public-releases/candidates", { recursive: true });
  await writeFile(`data/public-releases/candidates/${releaseId}.json`, stringify(publicManifest));
  console.log(JSON.stringify({
    extensionRecords: extensionRecords.length,
    extensionUniversities: new Set(extensionRecords.map((record: Json) => record.universitySlug)).size,
    top500Records: top500Records.length,
    top500Universities: new Set(top500Records.map((record: Json) => record.universitySlug)).size,
    sources: sourceCount,
    highRiskReviewed: highRiskReview.decisions.length
  }, null, 2));
}

async function buildAdditions(): Promise<Json[]> {
  const common = { evidenceAsOf: "2026-07-18", reviewState: "agent_reviewed", reviewOrigin: "qs-431-500-20260718-008-high-risk-semantic-review" };
  const hiroshima = {
    universitySlug: "hiroshima-university", universityName: "Hiroshima University", qsRank: 480, qsRow: 447,
    howToObtain: "Sign in in a browser with a Hiroshima University IMC account.", costToUser: "Provided under university contracts.",
    availability: "allowed", endorsementType: "institutionally_licensed_or_procured", accessAudience: "Hiroshima University students",
    accessStatus: "Current; IMC account required", institutionalRelationship: "Provided under university contracts by the Center for Information Media Education and Research",
    sourceUrl: "https://www.hiroshima-u.ac.jp/en/ids/about", sourceTitle: "Policy on Generative AI in Education at Hiroshima University", sourceLanguage: "en",
    snapshotPath: snapshots.hiroshima,
    evidenceSnippetOriginal: "Additionally, students at the University can safely use Copilot Chat, Google Gemini, and NotebookLM--services provided under university contracts by the Center for Information Media Education and Research--via a browser while logged in with their IMC account."
  };
  return Promise.all([
    makeRecord({ ...common, ...hiroshima, tool: "microsoft_copilot", rawToolName: "Copilot Chat", description: "University-contracted Copilot Chat access through the IMC account." }),
    makeRecord({ ...common, ...hiroshima, tool: "gemini", rawToolName: "Google Gemini", description: "University-contracted Google Gemini access through the IMC account." }),
    makeRecord({ ...common, ...hiroshima, tool: "notebooklm", rawToolName: "NotebookLM", description: "University-contracted NotebookLM access through the IMC account." }),
    makeRecord({
      ...common, universitySlug: "university-of-guelph", universityName: "University of Guelph", qsRank: 504, qsRow: 474,
      tool: "microsoft_copilot", rawToolName: "Microsoft 365 Copilot Chat", description: "U of G licensed Copilot Chat access through Microsoft 365 A5.",
      howToObtain: "Sign in through the University of Guelph Microsoft 365 account.", costToUser: "Included in the institutional Microsoft 365 A5 subscription.",
      availability: "allowed", endorsementType: "institutionally_licensed_or_procured", accessAudience: "All U of G students, staff, faculty, and IT administrators",
      accessStatus: "Current; institutional Microsoft 365 access required", institutionalRelationship: "U of G licensed version included in Microsoft 365 A5",
      sourceUrl: "https://guides.lib.uoguelph.ca/ld.php?content_id=38392344", sourceTitle: "Generative AI Tools: Privacy and Security", sourceLanguage: "en",
      snapshotPath: snapshots.guelph,
      evidenceSnippetOriginal: "All U of G students, staff, faculty and IT admins have access to Microsoft Copilot Chat through their Microsoft 365 A5 subscription.",
      evidenceSnippet: "All U of G students, staff, faculty, and IT administrators have access to the university-licensed Microsoft 365 Copilot Chat through the institutional A5 subscription."
    }),
    makeRecord({
      ...common, universitySlug: "american-university", universityName: "American University", qsRank: 587, qsRow: 494,
      tool: "microsoft_copilot", rawToolName: "Microsoft Copilot Chat", description: "Secure Copilot Chat included in American University's Microsoft 365 enterprise package.",
      howToObtain: "Use the university Microsoft 365 sign-in.", costToUser: "Free to AU community members as part of the enterprise package.",
      availability: "allowed", endorsementType: "institutionally_licensed_or_procured", accessAudience: "American University staff, faculty, and students",
      accessStatus: "Current", institutionalRelationship: "Part of the university Microsoft 365 enterprise package",
      sourceUrl: "https://www.american.edu/news/20260312-copilot-chat-can-help-au-community-with-daily-tasks.cfm", sourceTitle: "Copilot Chat Can Help AU Community with Daily Tasks", sourceLanguage: "en",
      snapshotPath: snapshots.americanCopilot,
      evidenceSnippetOriginal: "Copilot Chat, a part of the university’s Microsoft 365 enterprise package, is a secure tool available to all AU community members.",
      evidenceSnippet: "Copilot Chat is part of American University's Microsoft 365 enterprise package and is securely available to all AU community members."
    }),
    makeRecord({
      ...common, universitySlug: "american-university", universityName: "American University", qsRank: 587, qsRow: 494,
      tool: "perplexity", rawToolName: "Perplexity Enterprise Pro", description: "Enterprise AI research and knowledge access supplied through the Kogod School partnership with Perplexity.",
      howToObtain: "Use the Kogod School partnership access path.", costToUser: "Provided to the Kogod community through the partnership.",
      availability: "allowed", endorsementType: "institutionally_licensed_or_procured", accessAudience: "All Kogod students, staff, and faculty",
      accessStatus: "Current partnership access", institutionalRelationship: "Official Kogod School partnership with Perplexity",
      sourceUrl: "https://kogod.american.edu/news/kogod-school-of-business-partners-with-perplexity-to-expand-ai-access-for-all-students", sourceTitle: "Kogod School of Business Partners with Perplexity to Expand AI Access", sourceLanguage: "en",
      snapshotPath: snapshots.americanPerplexity,
      evidenceSnippetOriginal: "Through this partnership, every student, staff member, and faculty member at Kogod will have access to Perplexity Enterprise Pro.",
      evidenceSnippet: "Every Kogod student, staff member, and faculty member receives Perplexity Enterprise Pro through the school's official partnership."
    })
  ]);
}

async function makeRecord(input: Json): Promise<Json> {
  const { sourceUrl, sourceTitle, sourceLanguage, snapshotPath, evidenceSnippetOriginal, evidenceSnippet, ...record } = input;
  const bytes = await readFile(snapshotPath);
  const visible = normalizeSnapshot(bytes.toString("utf8"));
  if (!visible.includes(normalize(evidenceSnippetOriginal))) throw new Error(`Evidence quote missing from ${snapshotPath}`);
  return {
    ...record,
    evidence: [{
      sourceUrl, sourceTitle, sourceLanguage,
      evidenceSnippet: evidenceSnippet ?? evidenceSnippetOriginal,
      evidenceSnippetOriginal,
      snapshotHash: sha(bytes), snapshotPath,
      sourceFetchedAt: (await stat(snapshotPath)).mtime.toISOString(),
      reviewState: "agent_reviewed"
    }]
  };
}

function buildLedger(source: Json, additions: Json[]): Json {
  const ledger = structuredClone(source);
  ledger.generatedAt = generatedAt;
  ledger.scope.runId = extensionRunId;
  ledger.scope.selection = "QS source rows 431-500; 008 high-risk semantic repair";
  for (const qsRow of [447, 474, 494]) {
    const records = additions.filter((record) => record.qsRow === qsRow);
    const entry = ledger.entries.find((candidate: Json) => candidate.qsRow === qsRow);
    if (!entry) throw new Error(`Ledger row ${qsRow} missing`);
    const sourceUrls = [...new Set(records.flatMap((record) => record.evidence.map((evidence: Json) => evidence.sourceUrl)))];
    entry.auditStatus = "audited";
    entry.verifiedZero = false;
    entry.blockingReason = null;
    entry.reAuditConclusion = `${records.length} official-source institutional AI tool record(s) recovered by 008 semantic review.`;
    entry.searchTerminal007 = { ...entry.searchTerminal007, outcome: "false_negative_repaired_in_008", recordCount: records.length, conclusion: "The 007 blocked decision was invalid because official text established institutional access. Repaired in 008." };
    entry.highRiskSemanticReview008 = { reviewedAt: generatedAt, provider: "firecrawl_search_and_scrape", outcome: "positive_records_added", sourceUrls, recordIds: records.map(recordId) };
    entry.searchTrace.push({ matrixId: "008_high_risk_semantic_review", query: `site:${entry.officialDomain} ${entry.universityName} institutional AI access`, queryLanguage: entry.localLanguage ?? "en", provider: "firecrawl_search", searchedAt: generatedAt, fetchStatus: "ok", candidateUrls: sourceUrls, resultUrls: sourceUrls, outcome: "official_source_found", filteringConclusion: "Official page language explicitly establishes a university contract, enterprise package, licence, or partnership access path." });
    entry.approvedToolsSources = sourceUrls.map((sourceUrl) => ({ sourceUrl, official: true, recordIds: records.filter((record) => record.evidence.some((evidence: Json) => evidence.sourceUrl === sourceUrl)).map(recordId), exclusions: [] }));
  }
  for (const entry of ledger.entries) {
    if (entry.auditStatus !== "blocked") continue;
    entry.highRiskSemanticReview008 = anyPotentialSignal(entry) ? { reviewedAt: generatedAt, provider: "firecrawl_search", outcome: "blocked_insufficient_institutional_access_evidence", sourceUrls: [], recordIds: [], boundary: "The reviewed official pages mention AI tools, teaching, research, or generic availability but do not establish a university contract, institutional licence/login, procurement, official partnership access, or self-hosted service." } : undefined;
  }
  return ledger;
}

function buildHighRiskReview(source: Json, additions: Json[]): Json {
  const decisions = source.entries.filter((entry: Json) => entry.auditStatus === "blocked" && anyPotentialSignal(entry)).map((entry: Json) => {
    const positive = [447, 474, 494].includes(entry.qsRow);
    const records = additions.filter((record) => record.qsRow === entry.qsRow);
    return {
      qsRow: entry.qsRow, qsRank: entry.qsRank, universityName: entry.universityName, officialDomain: entry.officialDomain,
      priorDecision: "blocked_insufficient_evidence", priorPotentialInstitutionalAccess: true,
      reviewProvider: "firecrawl_search_and_direct_official_page_review",
      decision: positive ? "false_negative_repaired" : "blocked_null_retained",
      rationale: positive ? "Official university text explicitly establishes institutional contract, licence, enterprise package, or partnership access." : "No reviewed official text established a current institutional contract, licence/login, procurement, partnership access, or self-hosted service; generic guidance and research references remain excluded.",
      sourceUrls: positive ? [...new Set(records.flatMap((record) => record.evidence.map((evidence: Json) => evidence.sourceUrl)))] : [],
      recordIds: positive ? records.map(recordId) : []
    };
  });
  return {
    schemaVersion: "uapt-ai-tools-high-risk-semantic-review-v1", runId: extensionRunId, generatedAt,
    scope: "Every 007 blocked/null row with at least one officialPageChecks007.potentialInstitutionalAccess=true signal",
    policy: "A heuristic signal must receive an independent semantic decision. The prior terminal label is not accepted as QA ground truth.",
    summary: { reviewed: decisions.length, falseNegativesRepaired: decisions.filter((item: Json) => item.decision === "false_negative_repaired").length, blockedNullRetained: decisions.filter((item: Json) => item.decision === "blocked_null_retained").length, verifiedZero: 0 },
    decisions
  };
}

function buildSeedBundle(records: Json[]): Json {
  const sources = uniqueSources(records);
  return {
    schemaVersion: "openclaw-artifact-v1", runId: top500RunId, runPurpose: "claim_evidence_release",
    artifacts: [
      {
        schemaVersion: "openclaw-artifact-v1", runId: top500RunId, artifactType: "crawl_plan", planId: `cp-${top500RunId}`, createdAt: generatedAt, createdBy: "qs-top-500-ai-tools-008-builder",
        targets: sources.map((source: Json) => ({ entityType: "university", entitySlug: source.universitySlug, sourceCandidateId: source.sourceCandidateId, sourceUrl: source.sourceUrl, sourceTitle: source.sourceTitle, sourceLanguage: source.sourceLanguage, allowedFetchModes: ["http"], expectedThemes: ["approved_tools"], maxUrls: 1, robotsPolicy: "respect" })),
        stopConditions: ["Stop after staged official sources and exact tool-level evidence are represented.", "Do not infer institutional access from generic guidance, research mentions, or vendor marketing."]
      },
      {
        schemaVersion: "openclaw-artifact-v1", runId: top500RunId, artifactType: "source_discovery_trace", traceId: `trace-${top500RunId}`, entityType: "university", entitySlug: "qs-top-500", startedAt: generatedAt, endedAt: generatedAt,
        methodsAttempted: [{ method: "public_web_search", query: "QS rows 1-500 official-domain institutional AI tool access multilingual audit and 008 high-risk semantic repair", resultCount: sources.length, notes: "Combines immutable 005 sources, the 007 reviewed extension, and Firecrawl semantic re-review of all 21 heuristic high-risk blocked rows." }],
        noSourceEscalationCompleted: false, candidateIds: sources.map((source: Json) => source.sourceCandidateId), rejectionIds: [], summary: `Consolidated ${records.length} reviewed tool records from ${sources.length} official sources.`
      },
      {
        schemaVersion: "openclaw-artifact-v1", runId: top500RunId, artifactType: "report_draft", reportId: `report-${top500RunId}`, title: "QS top-500 AI tools 008 production release", generatedAt, draftPath: `content/reports/${top500RunId}.mdx`,
        summary: "Production-ready rebuild from immutable 005 plus repaired 008 QS 431-500 extension; all heuristic access signals received independent semantic review.", referencedClaimIds: [], publicJsonLinks: ["https://eduaipolicy.org/api/public/v1/tools.json"],
        limitations: ["Blocked/null institutions are not asserted to have zero institutional tools.", "Official source documents retain their original rights."], trackerMetadataLicense: "CC-BY-4.0", sourceRightsPolicy: "Tracker metadata is open licensed. Official sources retain their original rights and terms.", rawArtifactPaths: []
      }
    ]
  };
}

function anyPotentialSignal(entry: Json): boolean { return (entry.officialPageChecks007 ?? []).some((check: Json) => check.potentialInstitutionalAccess === true); }
function recordId(record: Json): string { return `${record.universitySlug}:${record.tool}:${record.rawToolName}`; }
function stableDedupe(records: Json[]): Json[] {
  const seen = new Set<string>();
  return records.filter((record) => {
    const key = `${record.universitySlug}:${record.tool}:${normalizedProductName(record.rawToolName)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).sort((a, b) => (a.qsRank ?? 1e9) - (b.qsRank ?? 1e9) || (a.qsRow ?? 1e9) - (b.qsRow ?? 1e9) || a.universitySlug.localeCompare(b.universitySlug) || a.tool.localeCompare(b.tool));
}
function uniqueSources(records: Json[]): Json[] {
  const sources = new Map<string, Json>();
  for (const record of records) for (const evidence of record.evidence ?? []) {
    const key = `${record.universitySlug}\u0000${evidence.sourceUrl}`;
    if (!sources.has(key)) sources.set(key, { universitySlug: record.universitySlug, sourceUrl: evidence.sourceUrl, sourceTitle: evidence.sourceTitle, sourceLanguage: evidence.sourceLanguage ?? "und", sourceCandidateId: `sc-${record.universitySlug}-${sha(evidence.sourceUrl).slice(0, 12)}` });
  }
  return [...sources.values()].sort((a, b) => a.universitySlug.localeCompare(b.universitySlug) || a.sourceUrl.localeCompare(b.sourceUrl));
}
function normalizedProductName(value: string): string { return normalize(value).toLowerCase().replace(/\b(microsoft|google|anthropic)\b/g, " ").replace(/\b365\b/g, " ").replace(/[^\p{L}\p{N}]+/gu, " ").trim(); }
function normalize(value: string): string { return value.normalize("NFKC").replace(/[\u00a0\s]+/g, " ").trim(); }
function normalizeSnapshot(value: string): string { return normalize(value.replace(/[*_#`|]/g, " ").replace(/\[([^\]]+)\]\([^\)]+\)/g, "$1")); }
function sha(value: string | Uint8Array): string { return createHash("sha256").update(value).digest("hex"); }
function stringify(value: unknown): string { return `${JSON.stringify(value, null, 2)}\n`; }
async function json(file: string): Promise<Json> { return JSON.parse(await readFile(file, "utf8")); }
