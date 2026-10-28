import { createHash } from "node:crypto";
import { readFile, realpath, stat } from "node:fs/promises";
import path from "node:path";
import type { CitationExperimentSample, SeoGeoCheck, SeoGeoIssue, SeoGeoPage, SeoGeoReport, SeoGeoReports, SeoGeoReportState, SeoGeoTool } from "./seo-geo-report-types";

const SHA256 = /^[a-f0-9]{64}$/;
const SHA = /^[a-f0-9]{40}$/;
const MAX_BYTES = 16 * 1024 * 1024;
type ObjectValue = Record<string, unknown>;
class ReportError extends Error {
  constructor(readonly state: SeoGeoReportState) { super(state); }
}
function object(value: unknown): ObjectValue {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new ReportError("invalid_report");
  return value as ObjectValue;
}
function text(value: unknown, max = 2000): string {
  if (typeof value !== "string" || !value.trim() || value.length > max) throw new ReportError("invalid_report");
  return value;
}
function date(value: unknown): string {
  const result = text(value, 40);
  if (!/T.*(?:Z|[+-]\d\d:\d\d)$/.test(result) || !Number.isFinite(Date.parse(result))) throw new ReportError("invalid_report");
  return result;
}
function array(value: unknown, max = 500): unknown[] {
  if (!Array.isArray(value) || value.length > max) throw new ReportError("invalid_report");
  return value;
}
function url(value: unknown): string {
  const result = new URL(text(value));
  if (!["http:", "https:"].includes(result.protocol) || result.username || result.password || result.search || result.hash) throw new ReportError("invalid_report");
  return result.href;
}
function hash(value: unknown, pattern = SHA256): string {
  if (typeof value !== "string" || !pattern.test(value)) throw new ReportError("missing_provenance");
  return value;
}
function score(value: unknown, max: number): number | null {
  if (value === null) return null;
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > max) throw new ReportError("invalid_report");
  return value;
}
async function boundedRead(file: string): Promise<Buffer> {
  const info = await stat(file);
  if (!info.isFile() || info.size > MAX_BYTES) throw new ReportError("invalid_report");
  return readFile(file);
}
async function artifact(root: string, value: unknown): Promise<{ bytes: Buffer; sha256: string }> {
  const ref = object(value);
  const relative = text(ref.path, 300);
  if (path.isAbsolute(relative) || relative.split(/[\\/]/).includes("..")) throw new ReportError("invalid_report");
  const file = await realpath(path.resolve(root, relative)).catch(() => { throw new ReportError("missing_provenance"); });
  if (!file.startsWith(root + path.sep)) throw new ReportError("invalid_report");
  const bytes = await boundedRead(file);
  const sha256 = hash(ref.sha256);
  if (createHash("sha256").update(bytes).digest("hex") !== sha256) throw new ReportError("missing_provenance");
  return { bytes, sha256 };
}
async function manifest(root: string, filename: string): Promise<ObjectValue> {
  if (!/^[a-z]+\.json$/.test(filename)) throw new ReportError("invalid_report");
  const file = await realpath(path.join(root, filename));
  if (!file.startsWith(root + path.sep)) throw new ReportError("invalid_report");
  return object(JSON.parse((await boundedRead(file)).toString("utf8")));
}
async function issues(root: string, value: unknown, checkIds: Set<string>, requestedUrl: string): Promise<SeoGeoIssue[]> {
  return Promise.all(array(value ?? [], 100).map(async item => {
    const v = object(item), checkId = text(v.checkId, 100), source = text(v.source, 300);
    if (!checkIds.has(checkId) || !/^(apps|packages|scripts)\/[\w./[\]()-]+$/.test(source) || source.split("/").includes("..") || !["P1", "P2", "P3"].includes(String(v.priority)) || !["open", "fixed_pending_retest", "verified", "intentional"].includes(String(v.status))) throw new ReportError("invalid_report");
    const retest = v.retest ? object(v.retest) : undefined;
    if (retest && !["passed", "failed"].includes(String(retest.result))) throw new ReportError("invalid_report");
    if (v.status === "verified" && (!retest || retest.result !== "passed")) throw new ReportError("invalid_report");
    let proof: SeoGeoIssue["retest"];
    if (retest) {
      if (!["local_dev", "candidate", "public"].includes(String(retest.target))) throw new ReportError("missing_provenance");
      const raw = await artifact(root, retest.raw), payload = object(JSON.parse(raw.bytes.toString("utf8")));
      if (new URL(url(payload.requestedUrl ?? payload.url)).pathname !== new URL(requestedUrl).pathname) throw new ReportError("missing_provenance");
      const check = object(object(payload.audits ?? payload.checks)[checkId]);
      const passed = !payload.runtimeError && !payload.error && (payload.audits ? check.score === 1 : check.score === check.max);
      if (retest.result !== (passed ? "passed" : "failed")) throw new ReportError("missing_provenance");
      proof = { runId: text(retest.runId, 100), rawSha256: raw.sha256, result: retest.result as "passed" | "failed", target: retest.target as NonNullable<SeoGeoIssue["retest"]>["target"] };
    }
    return { checkId, source, evidence: text(v.evidence), expected: text(v.expected), priority: v.priority as SeoGeoIssue["priority"], status: v.status as SeoGeoIssue["status"], ...(proof ? { retest: proof } : {}) };
  }));
}
async function page(root: string, value: unknown, tool: SeoGeoTool, device: string, rulesVersion: string): Promise<SeoGeoPage> {
  const entry = object(value);
  const [raw, content] = await Promise.all([artifact(root, entry.raw), artifact(root, entry.content)]);
  const payload = object(JSON.parse(raw.bytes.toString("utf8")));
  const requestedUrl = url(entry.requestedUrl);
  if (url(tool === "unlighthouse" ? payload.requestedUrl : payload.url) !== requestedUrl) throw new ReportError("missing_provenance");
  const failed = Boolean(tool === "unlighthouse" ? payload.runtimeError : payload.error);
  const checks: SeoGeoCheck[] = [];
  const scores: Record<string, number | null> = {};
  let measuredAt: string;
  if (tool === "unlighthouse") {
    if (text(payload.lighthouseVersion, 30) !== rulesVersion || object(payload.configSettings).formFactor !== device) throw new ReportError("missing_provenance");
    measuredAt = date(payload.fetchTime);
    if (!failed) {
      for (const [id, data] of Object.entries(object(payload.categories))) scores[id] = score(object(data).score, 1);
      for (const [id, data] of Object.entries(object(payload.audits))) {
        const audit = object(data);
        if (audit.score === 1 || audit.score === null) continue;
        checks.push({ id, title: text(audit.title), score: score(audit.score, 1), max: 1, evidence: typeof audit.displayValue === "string" ? audit.displayValue.slice(0, 2000) : text(audit.description).slice(0, 2000) });
      }
    }
  } else {
    if (String(payload.score_version) !== rulesVersion) throw new ReportError("missing_provenance");
    measuredAt = date(payload.timestamp);
    if (!failed) {
      scores.readiness = score(payload.score, 100);
      for (const [id, data] of Object.entries(object(payload.checks))) {
        const check = object(data), max = score(check.max, 100);
        if (max === null || max === 0) throw new ReportError("invalid_report");
        checks.push({ id, title: id, score: score(check.score, max), max, evidence: JSON.stringify(check.details).slice(0, 4000) });
      }
    }
  }
  const ids = new Set(Object.keys(object(tool === "unlighthouse" ? payload.audits : payload.checks ?? {})));
  return { requestedUrl, finalUrl: tool === "unlighthouse" ? url(payload.finalDisplayedUrl ?? payload.finalUrl) : url(entry.finalUrl), locale: text(entry.locale, 20), template: text(entry.template, 60), codeSha: hash(entry.codeSha, SHA), rawSha256: raw.sha256, contentSha256: content.sha256, measuredAt, state: failed ? "failed" : "measured", ...(failed ? { error: "upstream_audit_failed" } : {}), scores, checks, recommendations: failed || tool === "unlighthouse" ? [] : array(payload.recommendations).map(v => text(v)), issues: await issues(root, entry.issues, ids, requestedUrl) };
}

async function experiment(root: string, value: unknown): Promise<CitationExperimentSample> {
  const raw = await artifact(root, object(value).raw);
  const sample = object(JSON.parse(raw.bytes.toString("utf8")));
  // Only provider-returned sources qualify; a URL merely written in answer prose does not.
  const sourceUrls = array(sample.providerSources, 100).map(item => url(object(item).url));
  return { promptId: text(sample.promptId, 100), locale: text(sample.locale, 20), model: text(sample.model, 100), answeredAt: date(sample.answeredAt), answer: text(sample.answer, 30000), mention: sample.mention === true, citedUrls: [...new Set(sourceUrls)], rawSha256: raw.sha256 };
}

/** Read-only: no scanner, shell command, provider request or external URL fetch. */
export async function loadSeoGeoReport(directory: string | undefined, filename: string, tool: SeoGeoTool): Promise<SeoGeoReport> {
  const empty = (state: SeoGeoReportState): SeoGeoReport => ({ state, tool, pages: [], experiments: [] });
  if (!directory) return empty("not_configured");
  try {
    const root = await realpath(directory);
    const value = await manifest(root, filename);
    if (value.schemaVersion !== "uapt-seo-geo-report-v1") return empty("unsupported_version");
    const upstream = object(value.tool);
    if (upstream.name !== tool) throw new ReportError("invalid_report");
    if ((tool === "unlighthouse" && (upstream.version !== "0.19.1" || upstream.rulesVersion !== "13.6.0")) || (tool === "geo-optimizer" && (upstream.version !== "4.19.8" || upstream.rulesVersion !== "2")) || (tool === "elmo" && upstream.rulesVersion !== "uapt-citation-experiment-v1")) return empty("unsupported_version");
    const report: SeoGeoReport = { ...empty("ready"), version: text(upstream.version, 60), rulesVersion: text(upstream.rulesVersion, 60), sourceCommit: hash(upstream.sourceCommit, SHA), runId: text(value.runId, 100), completedAt: date(value.completedAt) };
    if (tool === "elmo" && value.status === "not_run") {
      const plan = object(value.plan);
      if (!Number.isInteger(plan.repetitions) || Number(plan.repetitions) < 1) throw new ReportError("invalid_report");
      return { ...report, state: "not_run", plan: { questionSet: text(plan.questionSet, 300), locales: array(plan.locales, 33).map(v => text(v, 20)), models: array(plan.models, 20).map(v => text(v, 100)), repetitions: Number(plan.repetitions) } };
    }
    if (!["public", "candidate", "local_dev"].includes(String(value.target))) throw new ReportError("missing_provenance");
    report.target = value.target as SeoGeoReport["target"];
    report.device = text(value.device, 100);
    report.configSha256 = (await artifact(root, value.config)).sha256;
    report.pages = await Promise.all(array(value.pages, 100).map(v => page(root, v, tool, report.device!, report.rulesVersion!)));
    report.experiments = await Promise.all(array(value.experiments ?? [], 500).map(v => experiment(root, v)));
    if (!report.pages.length && !report.experiments.length) report.state = "not_run";
    return report;
  } catch (error) {
    return empty(error instanceof ReportError ? error.state : error instanceof SyntaxError || error instanceof TypeError ? "invalid_report" : (error as NodeJS.ErrnoException).code === "ENOENT" ? "not_run" : "read_error");
  }
}
export async function getSeoGeoReports(): Promise<SeoGeoReports> {
  const directory = process.env.UAPT_SEO_GEO_REPORT_DIR;
  const [technical, geo, citations] = await Promise.all([loadSeoGeoReport(directory, "technical.json", "unlighthouse"), loadSeoGeoReport(directory, "geo.json", "geo-optimizer"), loadSeoGeoReport(directory, "citations.json", "elmo")]);
  return { technical, geo, citations };
}
