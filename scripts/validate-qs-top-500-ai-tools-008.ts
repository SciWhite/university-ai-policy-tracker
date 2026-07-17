import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

type Json = Record<string, any>;

const baselinePath = "staging/ai-tools/release-candidates/uapt-ai-tools-qs-top-430-20260715-005/tool_records.json";
const source007Path = "staging/ai-tools/release-candidates/uapt-ai-tools-qs-431-500-20260717-007/tool_records.json";
const extensionPath = "staging/ai-tools/release-candidates/uapt-ai-tools-qs-431-500-20260718-008/tool_records.json";
const top500Path = "staging/ai-tools/release-candidates/uapt-ai-tools-qs-top-500-20260718-008/tool_records.json";
const candidatePath = "staging/ai-tools/release-candidates/uapt-ai-tools-qs-top-500-20260718-008/candidate-manifest.json";
const ledgerPath = "staging/ai-tools/audits/qs-431-500-ai-tools-audit-ledger-20260718-008.json";
const reviewPath = "staging/ai-tools/audits/qs-431-500-high-risk-semantic-review-20260718-008.json";
const publicCandidatePath = "data/public-releases/candidates/public-release-20260718-008.json";
const currentPath = "data/public-releases/current.json";
const priorProductionPath = "data/public-releases/history/public-release-20260717-001.json";
const openClawPath = "staging/uapt-runs/uapt-ai-tools-qs-top-500-20260718-008/artifacts.json";

const requiredRegressions = [
  "hiroshima-university:microsoft_copilot:Copilot Chat",
  "hiroshima-university:gemini:Google Gemini",
  "hiroshima-university:notebooklm:NotebookLM",
  "university-of-guelph:microsoft_copilot:Microsoft 365 Copilot Chat",
  "american-university:microsoft_copilot:Microsoft Copilot Chat",
  "american-university:perplexity:Perplexity Enterprise Pro"
];

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

async function main(): Promise<void> {
  const [baseline, source007, extension, top500, candidate, ledger, review, publicCandidate, current, priorProduction, openClaw] = await Promise.all(
    [baselinePath, source007Path, extensionPath, top500Path, candidatePath, ledgerPath, reviewPath, publicCandidatePath, currentPath, priorProductionPath, openClawPath].map(json)
  );
  const failures: string[] = [];
  const extensionRecords = extension.records as Json[];
  const top500Records = top500.records as Json[];
  if (baseline.records.length !== 880) failures.push("immutable 005 baseline record count changed");
  if (sha(await readFile(baselinePath)) !== candidate.immutableBaseline.toolRecordsSha256) failures.push("immutable 005 baseline hash mismatch");
  if (source007.records.length !== 33 || extensionRecords.length !== 39) failures.push("008 extension is not the 33-record 007 source plus six repairs");
  if (new Set(extensionRecords.map((record) => record.universitySlug)).size !== 24) failures.push("008 extension must cover 24 universities");
  if (top500Records.length !== 919 || new Set(top500Records.map((record) => record.universitySlug)).size !== 314) failures.push("Top500 expected 919 records / 314 universities");
  for (const id of requiredRegressions) if (!extensionRecords.some((record) => recordId(record) === id)) failures.push(`missing permanent regression ${id}`);
  const source007Ids = new Set(source007.records.map(recordId));
  for (const record of source007.records) {
    const repaired = extensionRecords.find((candidateRecord) => recordId(candidateRecord) === recordId(record));
    if (!repaired || JSON.stringify(repaired) !== JSON.stringify(record)) failures.push(`007 record changed or missing: ${recordId(record)}`);
  }
  if (extensionRecords.filter((record) => !source007Ids.has(recordId(record))).length !== 6) failures.push("008 must add exactly six records to 007");
  const union = [...baseline.records, ...extensionRecords];
  const unionMap = new Map(union.map((record) => [recordId(record), record]));
  if (unionMap.size !== top500Records.length) failures.push("Top500 is not an exact no-collision union of 005 and 008");
  for (const record of top500Records) if (JSON.stringify(record) !== JSON.stringify(unionMap.get(recordId(record)))) failures.push(`Top500 record mutated: ${recordId(record)}`);

  const ledgerCounts = ledger.entries.reduce((counts: Json, entry: Json) => { counts[entry.auditStatus] = (counts[entry.auditStatus] ?? 0) + 1; return counts; }, {});
  if (ledger.entries.length !== 70 || ledgerCounts.audited !== 24 || ledgerCounts.blocked !== 46) failures.push(`ledger expected 70 rows / 24 audited / 46 blocked, got ${JSON.stringify(ledgerCounts)}`);
  if (ledger.entries.some((entry: Json) => entry.verifiedZero === true)) failures.push("008 extension must not assert verified zero");
  for (const row of [447, 474, 494]) {
    const entry = ledger.entries.find((candidateEntry: Json) => candidateEntry.qsRow === row);
    if (!entry || entry.auditStatus !== "audited" || entry.blockingReason !== null || entry.highRiskSemanticReview008?.outcome !== "positive_records_added") failures.push(`ledger row ${row} was not repaired correctly`);
  }
  if (review.summary.reviewed !== 21 || review.summary.falseNegativesRepaired !== 3 || review.summary.blockedNullRetained !== 18 || review.summary.verifiedZero !== 0) failures.push("high-risk semantic review expected 21 reviewed / 3 repaired / 18 blocked / 0 zero");
  if (review.decisions.some((decision: Json) => !["false_negative_repaired", "blocked_null_retained"].includes(decision.decision))) failures.push("high-risk review contains an invalid or inconclusive decision");

  for (const record of extensionRecords.filter((record) => requiredRegressions.includes(recordId(record)))) {
    for (const evidence of record.evidence) {
      const bytes = await readFile(evidence.snapshotPath);
      if (sha(bytes) !== evidence.snapshotHash) failures.push(`snapshot hash mismatch: ${recordId(record)}`);
      if (!normalizeSnapshot(bytes.toString("utf8")).includes(normalize(evidence.evidenceSnippetOriginal))) failures.push(`non-continuous evidence quote: ${recordId(record)}`);
      const hostname = new URL(evidence.sourceUrl).hostname;
      if (!hostname.endsWith(rowDomain(record.qsRow))) failures.push(`non-official evidence domain: ${recordId(record)}`);
    }
  }

  const sourceCount = new Set(top500Records.flatMap((record) => record.evidence.map((evidence: Json) => `${record.universitySlug}\u0000${evidence.sourceUrl}`))).size;
  if (sourceCount !== 388 || candidate.sourceCount !== sourceCount || candidate.recordCount !== 919 || candidate.toolRecordsSha256 !== sha(await readFile(top500Path))) failures.push("candidate counts or hashes do not match Top500 records");
  const runDirectory = "staging/uapt-runs/uapt-ai-tools-qs-top-500-20260718-008";
  if (publicCandidate.releaseId !== "public-release-20260718-008") failures.push("wrong public candidate releaseId");
  if (JSON.stringify(publicCandidate.includeStagedArtifactDirectories) !== JSON.stringify([...priorProduction.includeStagedArtifactDirectories, runDirectory])) failures.push("public candidate must extend the immediately prior production manifest by exactly one run");
  if (current.releaseId === publicCandidate.releaseId && JSON.stringify(current) !== JSON.stringify(publicCandidate)) failures.push("promoted current manifest differs from the validated public candidate");

  const artifacts = openClaw.artifacts as Json[];
  const counts = artifacts.reduce((result: Json, artifact: Json) => { result[artifact.artifactType] = (result[artifact.artifactType] ?? 0) + 1; return result; }, {});
  for (const type of ["crawl_plan", "source_candidate", "source_discovery_trace", "fetch_attempt", "source_snapshot", "claim_candidate", "evidence_candidate", "review_decision", "report_draft"]) if (!counts[type]) failures.push(`OpenClaw missing ${type}`);
  if (counts.claim_candidate !== 919 || counts.review_decision !== 919 || counts.source_candidate !== 388 || counts.fetch_attempt !== 388) failures.push(`OpenClaw counts mismatch: ${JSON.stringify(counts)}`);
  if (failures.length) throw new Error(failures.slice(0, 40).join("\n"));
  console.log(`Top500 008 validation passed: 919 records, 314 universities, 388 official sources; 21 high-risk rows semantically reviewed and 6 permanent regressions present.`);
}

function rowDomain(row: number): string { return ({ 447: "hiroshima-u.ac.jp", 474: "uoguelph.ca", 494: "american.edu" } as Record<number, string>)[row]; }
function recordId(record: Json): string { return `${record.universitySlug}:${record.tool}:${record.rawToolName}`; }
function normalize(value: string): string { return value.normalize("NFKC").replace(/[\u00a0\s]+/g, " ").trim(); }
function normalizeSnapshot(value: string): string { return normalize(value.replace(/[*_#`|]/g, " ").replace(/\[([^\]]+)\]\([^\)]+\)/g, "$1")); }
function sha(value: string | Uint8Array): string { return createHash("sha256").update(value).digest("hex"); }
async function json(file: string): Promise<Json> { return JSON.parse(await readFile(file, "utf8")); }
