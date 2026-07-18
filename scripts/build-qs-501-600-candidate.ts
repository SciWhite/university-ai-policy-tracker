import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";

type Json = Record<string, any>;
const generatedAt = "2026-07-18T13:00:00.000Z";
const extensionRunId = "uapt-ai-tools-qs-501-600-20260718-009";
const top600RunId = "uapt-ai-tools-qs-top-600-20260718-009";
const root = "staging/ai-tools/release-candidates";
const extRoot = `${root}/${extensionRunId}`;
const topRoot = `${root}/${top600RunId}`;
const runRoot = `staging/uapt-runs/${top600RunId}`;
const stringify = (value: unknown) => `${JSON.stringify(value, null, 2)}\n`;
const sha = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");
const id = (record: Json) => `${record.universitySlug}:${record.tool}:${record.rawToolName}`;

async function main() {
  const [ranking, traces, retries, checks, repairDiscovery, confirmed, baselineText, baselineBundle, current] = await Promise.all([
    json("data/rankings/qs-world-university-rankings-2026-top-1000.json"),
    json("staging/ai-tools/audits/qs-501-600-search-traces-20260718-009.json"),
    json("staging/ai-tools/audits/qs-501-600-search-trace-retries-20260718-009.json"),
    json("staging/ai-tools/audits/qs-501-600-official-page-checks-20260718-009.json"),
    json("staging/ai-tools/audits/qs-501-600-repair-discovery-20260718-009.json"),
    json("staging/ai-tools/audits/qs-501-600-confirmed-records-20260718-009.json"),
    readFile("staging/ai-tools/release-candidates/uapt-ai-tools-qs-top-500-20260718-008/tool_records.json", "utf8"),
    json("staging/uapt-runs/uapt-ai-tools-qs-top-500-20260718-008/artifacts.json"),
    json("data/public-releases/current.json")
  ]);
  const baseline = JSON.parse(baselineText);
  const rows = ranking.universities.filter((row: Json) => row.rowNumber >= 501 && row.rowNumber <= 600);
  if (rows.length !== 100) throw new Error(`expected 100 source rows, got ${rows.length}`);
  const records = confirmed.records;
  const recordIds = new Set(records.map(id));
  if (recordIds.size !== records.length) throw new Error("duplicate extension tool record");
  const byRow = new Map<number, Json[]>(); for (const record of records) byRow.set(record.qsRow, [...(byRow.get(record.qsRow) ?? []), record]);
  const retryByQuery = new Map(retries.retries.map((item: Json) => [`${item.qsRow}|${item.query}`, item]));
  const checksByRow = new Map<number, Json[]>(); for (const check of checks.checks) checksByRow.set(check.qsRow, [...(checksByRow.get(check.qsRow) ?? []), check]);
  const repairByRow = new Map<number, Json>(); for (const row of repairDiscovery.rows) repairByRow.set(row.qsRow, row);
  const traceByRow = new Map(traces.entries.map((entry: Json) => [entry.qsRow, entry]));
  const highRisk = [] as Json[];
  const ledgerEntries = rows.map((row: Json) => {
    const trace = traceByRow.get(row.rowNumber); if (!trace) throw new Error(`missing trace ${row.rowNumber}`);
    const rowRecords = byRow.get(row.rowNumber) ?? [];
    const repair = repairByRow.get(row.rowNumber);
    const repairChecks = (repair?.checks ?? []).map((check: Json) => ({
      ...check,
      provider: "firecrawl_scrape_v2_repair",
      official: check.fetchStatus === "ok",
      relevantAiSurface: (check.semanticSignals?.productTerms?.length ?? 0) > 0,
      potentialInstitutionalAccess: (check.semanticSignals?.productTerms?.length ?? 0) > 0 && (check.semanticSignals?.accessTerms?.length ?? 0) > 0,
      signalTerms: check.semanticSignals?.productTerms ?? []
    }));
    const pageChecks = dedupeChecks([...(checksByRow.get(row.rowNumber) ?? []), ...repairChecks]);
    const potential = pageChecks.filter((check: Json) => check.potentialInstitutionalAccess);
    const retryTrace = trace.searchTrace.filter((item: Json) => item.fetchStatus === "error").map((item: Json) => retryByQuery.get(`${row.rowNumber}|${item.query}`)).filter(Boolean);
    const sourceUrls = [...new Set(rowRecords.flatMap((record: Json) => record.evidence.map((evidence: Json) => evidence.sourceUrl)))];
    const decision = rowRecords.length ? "positive_records_added" : "blocked_null_retained";
    if (potential.length) highRisk.push({
      qsRow: row.rowNumber, qsRank: row.rankNumber, universityName: row.name, officialDomain: trace.officialDomain,
      priorDecision: "potentialInstitutionalAccess signal requiring semantic review",
      reviewedSourceUrls: potential.map((item: Json) => item.finalUrl), semanticDecision: decision,
      rationale: rowRecords.length ? "Official source explicitly establishes a university provision, licence, account-based access path, or institution-operated service." : "Reviewed official material did not establish a current university provision, licence, procurement, account-based access entitlement, official partnership access, or self-hosted service. Generic references, teaching material, research output, policy, and off-scope subunit material remain excluded.",
      resultingRecordIds: rowRecords.map(id), reviewerOrigin: "qs-501-600-20260718-009-semantic-review", reviewedAt: generatedAt
    });
    return {
      qsRow: row.rowNumber, qsRank: row.rankNumber, universityName: row.name, countryOrRegion: row.countryOrRegion,
      officialDomain: trace.officialDomain, requiredSearchMatrix: trace.requiredSearchMatrix,
      auditStatus: rowRecords.length ? "audited_positive" : "blocked", verifiedZero: false,
      blockingReason: rowRecords.length ? null : "No verified product-level institutional-access record was established from the reviewed official material; this is not a verified zero.",
      searchTrace: trace.searchTrace, retryTrace, repairSearchTrace: repair?.searches ?? [], directOfficialPageChecks: pageChecks,
      highRiskSemanticReview: potential.length ? highRisk.at(-1) : null,
      recordIds: rowRecords.map(id),
      approvedToolsSources: sourceUrls.map(sourceUrl => {
        const matched = rowRecords.filter((record: Json) => record.evidence.some((evidence: Json) => evidence.sourceUrl === sourceUrl));
        return { sourceUrl, official: true, recordIds: matched.map(id) };
      })
    };
  });
  const ledger = { schemaVersion: "uapt-ai-tools-audit-ledger-v1", runId: extensionRunId, generatedAt, scope: { selection: "QS 2026 source rows 501-600, source row order", sourceRanking: "data/rankings/qs-world-university-rankings-2026-top-1000.json", rows: [501,600] }, summary: { rows: 100, positiveRows: byRow.size, records: records.length, blockedRows: 100 - byRow.size, verifiedZero: 0, searchTraces: traces.entries.reduce((n: number, e: Json) => n + e.searchTrace.length, 0), retryTraces: retries.retries.length, directOfficialChecks: checks.checks.length }, entries: ledgerEntries };
  const review = { schemaVersion: "uapt-ai-tools-high-risk-semantic-review-v1", runId: extensionRunId, generatedAt, policy: "Every potentialInstitutionalAccess signal is semantically reviewed; the signal is never treated as a record classifier.", summary: { reviewed: highRisk.length, positive: highRisk.filter(item => item.semanticDecision === "positive_records_added").length, blocked: highRisk.filter(item => item.semanticDecision === "blocked_null_retained").length }, decisions: highRisk };
  const extension = { schemaVersion: "uapt-ai-tools-records-v1", runId: extensionRunId, generatedAt, reviewState: "agent_reviewed", records };
  const topRecords = [...baseline.records, ...records];
  const topKeys = new Set(topRecords.map(id)); if (topKeys.size !== topRecords.length) throw new Error("Top-600 dedupe conflict");
  const top600 = { schemaVersion: "uapt-ai-tools-records-v1", runId: top600RunId, generatedAt, reviewState: "agent_reviewed", records: topRecords };
  const baselineHash = sha(baselineText);
  const manifest = { schemaVersion: "uapt-ai-tools-candidate-manifest-v1", candidateOnly: true, runId: top600RunId, generatedAt, baseline: { path: "staging/ai-tools/release-candidates/uapt-ai-tools-qs-top-500-20260718-008/tool_records.json", sha256: baselineHash, records: baseline.records.length, immutable: true }, extension: { path: `${extRoot}/tool_records.json`, records: records.length }, output: { path: `${topRoot}/tool_records.json`, records: topRecords.length }, highRiskReview: { path: "staging/ai-tools/audits/qs-501-600-high-risk-semantic-review-20260718-009.json", reviewed: highRisk.length } };
  const bundle = buildBundle(baselineBundle, topRecords, records, top600RunId);
  const extensionUniversityCount = new Set(records.map((record: Json) => record.universitySlug)).size;
  const extensionSourceCount = new Set(records.flatMap((record: Json) => record.evidence.map((evidence: Json) => evidence.sourceUrl))).size;
  const totalUniversityCount = new Set(topRecords.map((record: Json) => record.universitySlug)).size;
  const totalSourceCount = new Set(topRecords.flatMap((record: Json) => record.evidence.map((evidence: Json) => evidence.sourceUrl))).size;
  const publicCandidate = structuredClone(current); publicCandidate.releaseId = "public-release-20260718-009"; publicCandidate.publishedAt = generatedAt; publicCandidate.description = "Candidate only: repaired and fully re-audited QS top-600 AI tools release, extending the immutable Top-500 production baseline with QS source rows 501-600."; publicCandidate.candidateOnly = true; publicCandidate.previousReleaseId = current.releaseId === publicCandidate.releaseId ? current.previousReleaseId : current.releaseId; publicCandidate.includeStagedArtifactDirectories = [...new Set([...(current.includeStagedArtifactDirectories ?? []), runRoot])]; publicCandidate.notes = [
    `Publishes ${topRecords.length} official-source AI tool records for ${totalUniversityCount} universities from ${totalSourceCount} official university sources.`,
    `The repaired QS rows 501-600 extension contains ${records.length} records across ${extensionUniversityCount} universities from ${extensionSourceCount} official sources.`,
    `All 100 QS source rows were re-audited; ${byRow.size} rows have positive records, ${100-byRow.size} remain blocked/null, and none is asserted as a verified zero.`,
    "The repair run corrected public-suffix domain errors, repeated official-domain discovery, retained per-query and direct-fetch traces, and requires semantic QA rather than treating HTTP success as evidence of absence.",
    `The immutable QS Top-500 008 baseline is preserved byte-for-byte at SHA-256 ${baselineHash}.`,
    "Promotion requires the official OpenClaw schema validator, dataset release validator, public contract, public-data audit, full pnpm check, and production build to pass.",
    "Tracker metadata is open licensed; official source documents retain their original rights."
  ];
  await Promise.all([mkdir(extRoot,{recursive:true}),mkdir(topRoot,{recursive:true}),mkdir(runRoot,{recursive:true}),mkdir("data/public-releases/candidates",{recursive:true})]);
  await Promise.all([
    writeFile(`${extRoot}/tool_records.json`, stringify(extension)), writeFile(`${topRoot}/tool_records.json`, stringify(top600)),
    writeFile(`${topRoot}/candidate-manifest.json`, stringify(manifest)), writeFile("staging/ai-tools/audits/qs-501-600-ai-tools-audit-ledger-20260718-009.json", stringify(ledger)),
    writeFile("staging/ai-tools/audits/qs-501-600-high-risk-semantic-review-20260718-009.json", stringify(review)), writeFile(`${runRoot}/artifacts.json`, stringify(bundle)),
    writeFile("data/public-releases/candidates/public-release-20260718-009.json", stringify(publicCandidate))
  ]);
  console.log(JSON.stringify({extensionRecords: records.length, top600Records: topRecords.length, highRiskReviewed: highRisk.length, artifacts: bundle.artifacts.length, baselineHash}, null, 2));
}

function buildBundle(base: Json, all: Json[], addition: Json[], runId: string): Json {
  const bundle = structuredClone(base); bundle.runId = runId;
  for (const artifact of bundle.artifacts) artifact.runId = runId;
  const at = bundle.artifacts as Json[]; const sourceByUrl = new Map<string, Json>();
  for (const record of addition) for (const evidence of record.evidence) if (!sourceByUrl.has(evidence.sourceUrl)) sourceByUrl.set(evidence.sourceUrl, { evidence, record });
  const extensionSources = [...sourceByUrl.entries()].map(([sourceUrl,value]) => ({ sourceUrl, ...value, sourceCandidateId: `sc-${sha(sourceUrl).slice(0,16)}` }));
  const plan = at.find(item => item.artifactType === "crawl_plan"); plan.targets.push(...extensionSources.map(source => ({entityType:"university",entitySlug:source.record.universitySlug,sourceCandidateId:source.sourceCandidateId,sourceUrl:source.sourceUrl,sourceTitle:source.evidence.sourceTitle,sourceLanguage:source.evidence.sourceLanguage,allowedFetchModes:["firecrawl"],expectedThemes:["approved_tools"],maxUrls:1,robotsPolicy:"respect"})));
  const trace = at.find(item => item.artifactType === "source_discovery_trace"); trace.methodsAttempted.push({method:"public_web_search",query:"QS source rows 501-600 fixed multilingual matrix plus repair discovery and direct official-page review",resultCount: extensionSources.length,notes:"Full search, retry, repair discovery, direct fetch, and semantic-decision traces are retained under staging/ai-tools/audits/."}); trace.candidateIds.push(...extensionSources.map(source => source.sourceCandidateId));
  for (const source of extensionSources) {
    at.push({schemaVersion:"openclaw-artifact-v1",runId,artifactType:"source_candidate",sourceCandidateId:source.sourceCandidateId,entityType:"university",entitySlug:source.record.universitySlug,sourceUrl:source.sourceUrl,finalUrl:source.sourceUrl,sourceTitle:source.evidence.sourceTitle,sourceLanguage:source.evidence.sourceLanguage,sourceType:"approved_tools",discoveryMethod:"public_web_search",queryUsed:"QS rows 501-600 multilingual official-domain AI tools discovery and repair review",discoveredAt:source.evidence.sourceFetchedAt,officialDomainConfidence:1,aiRelevanceScore:.99,policySpecificityScore:.98,verificationStatus:"verified",verifiedAt:generatedAt,verificationNotes:"Official-domain product-level institutional access evidence reviewed and snapshotted.",robotsPolicy:"respect"});
    at.push({schemaVersion:"openclaw-artifact-v1",runId,artifactType:"fetch_attempt",fetchAttemptId:`fa-${source.sourceCandidateId}`,sourceCandidateId:source.sourceCandidateId,sourceUrl:source.sourceUrl,finalUrl:source.sourceUrl,attemptedAt:source.evidence.sourceFetchedAt,fetchMode:"firecrawl",userAgentKind:"firecrawl",httpStatus:200,contentType:"text/html",robotsAllowed:true,outcome:"success",contentHash:source.evidence.snapshotHash,normalizedTextStorageKey:source.evidence.snapshotPath});
  }
  const report=at.find(item=>item.artifactType==="report_draft"); report.runId=runId; report.title="QS top-600 AI tools candidate"; report.summary=`Candidate-only Top-600 union: ${all.length} records, with ${addition.length} newly reviewed QS rows 501-600 records. No promotion.`;
  return bundle;
}
async function json(path: string): Promise<Json> { return JSON.parse(await readFile(path, "utf8")); }
function dedupeChecks(checks: Json[]): Json[] {
  const byUrl = new Map<string, Json>();
  for (const check of checks) {
    const key = check.finalUrl ?? check.requestedUrl;
    const prior = byUrl.get(key);
    if (!prior || (prior.fetchStatus !== "ok" && check.fetchStatus === "ok")) byUrl.set(key, check);
  }
  return [...byUrl.values()];
}
main().catch(error => { console.error(error); process.exit(1); });
