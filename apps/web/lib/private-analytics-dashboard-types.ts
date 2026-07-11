import type { GscMetricRow, GscSummary } from "@/lib/google-search-console";
import type {
  AnalyticsPeriod,
  PrivateAnalyticsSummary,
  PrivateAnalyticsTrendRow
} from "@/lib/private-analytics";

export type AnalyticsDashboardFocus =
  | "country"
  | "device"
  | "landing"
  | "locale"
  | "metric"
  | "page"
  | "query"
  | "source";

export interface AnalyticsDashboardFilters {
  countries: string[];
  devices: string[];
  locales: string[];
  sources: string[];
}

export interface AnalyticsDashboardQuery {
  compare: boolean;
  filters: AnalyticsDashboardFilters;
  focus?: AnalyticsDashboardFocus;
  focusKey?: string;
  from: string;
  grain: AnalyticsPeriod;
  previousFrom: string;
  previousTo: string;
  to: string;
}

export interface AnalyticsDashboardFilterOption {
  count: number;
  label: string;
  value: string;
}

export interface AnalyticsDashboardFilterOptions {
  countries: AnalyticsDashboardFilterOption[];
  devices: AnalyticsDashboardFilterOption[];
  locales: AnalyticsDashboardFilterOption[];
  sources: AnalyticsDashboardFilterOption[];
}

export interface AnalyticsDashboardSourceTrendRow {
  ai: number;
  direct: number;
  label: string;
  other: number;
  referral: number;
  search: number;
}

export interface AnalyticsDashboardPeriod {
  botPageViews: number;
  botTrend: PrivateAnalyticsTrendRow[];
  latestEventAt?: string;
  sourceTrend: AnalyticsDashboardSourceTrendRow[];
  summary: PrivateAnalyticsSummary;
  unknownSourceShare: number;
}

export interface AnalyticsDashboardMover {
  change: number | null;
  current: number;
  label: string;
  previous: number;
}

export interface AnalyticsDashboardOpportunity extends GscMetricRow {
  opportunityScore: number;
}

export interface AnalyticsDashboardInsight {
  detail: { en: string; zh: string };
  id: string;
  score: number;
  title: { en: string; zh: string };
  tone: "attention" | "negative" | "positive" | "warning";
}

export interface AnalyticsDashboardDetail {
  current: number;
  key: string;
  kind: AnalyticsDashboardFocus;
  previous: number;
  rows: Array<{ label: string; value: string }>;
}

export interface AnalyticsDashboardResponse {
  detail?: AnalyticsDashboardDetail;
  filterOptions: AnalyticsDashboardFilterOptions;
  gsc: {
    current: GscSummary;
    movers: {
      pages: AnalyticsDashboardMover[];
      queries: AnalyticsDashboardMover[];
    };
    opportunities: AnalyticsDashboardOpportunity[];
    previous: GscSummary;
  };
  insights: AnalyticsDashboardInsight[];
  meta: {
    dataStatus: {
      gsc: "connected" | "unavailable";
      onsite: "connected" | "unavailable";
      rpc: "fallback" | "ready";
    };
    generatedAt: string;
    partialDay: boolean;
    query: AnalyticsDashboardQuery;
    timeZone: "America/Toronto";
  };
  onsite: {
    current: AnalyticsDashboardPeriod;
    movers: {
      pages: AnalyticsDashboardMover[];
      sources: AnalyticsDashboardMover[];
    };
    previous: AnalyticsDashboardPeriod;
  };
}
