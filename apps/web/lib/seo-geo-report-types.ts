/** Private diagnostics are independent of policy approval and organic acquisition. */
export type SeoGeoTool = "unlighthouse" | "geo-optimizer" | "elmo";
export type SeoGeoReportState = "ready" | "not_configured" | "not_run" | "read_error" | "unsupported_version" | "missing_provenance" | "invalid_report";

export interface SeoGeoCheck {
  id: string;
  title: string;
  score: number | null;
  max: number;
  evidence: string;
}
export interface SeoGeoIssue {
  checkId: string;
  evidence: string;
  expected: string;
  priority: "P1" | "P2" | "P3";
  source: string;
  status: "open" | "fixed_pending_retest" | "verified" | "intentional";
  retest?: { runId: string; rawSha256: string; result: "passed" | "failed"; target: "local_dev" | "candidate" | "public" };
}
export interface SeoGeoPage {
  requestedUrl: string;
  finalUrl: string;
  locale: string;
  template: string;
  codeSha: string;
  rawSha256: string;
  contentSha256: string;
  measuredAt: string;
  state: "measured" | "failed";
  error?: string;
  scores: Record<string, number | null>;
  checks: SeoGeoCheck[];
  recommendations: string[];
  issues: SeoGeoIssue[];
}
export interface CitationExperimentSample {
  promptId: string;
  locale: string;
  model: string;
  answeredAt: string;
  answer: string;
  mention: boolean;
  citedUrls: string[];
  rawSha256: string;
}
export interface SeoGeoReport {
  state: SeoGeoReportState;
  tool: SeoGeoTool;
  runId?: string;
  version?: string;
  rulesVersion?: string;
  sourceCommit?: string;
  completedAt?: string;
  target?: "public" | "candidate" | "local_dev";
  device?: string;
  configSha256?: string;
  pages: SeoGeoPage[];
  experiments: CitationExperimentSample[];
  plan?: { questionSet: string; locales: string[]; models: string[]; repetitions: number };
}
export type SeoGeoReports = Record<"technical" | "geo" | "citations", SeoGeoReport>;
