import type { AnalyticsEventRecordInput } from "@uapt/db";
import { getLocaleFromPathname } from "@/lib/i18n";

export const ANALYTICS_EVENT_NAMES = [
  "api_link_click",
  "api_search_request",
  "autocomplete_json_click",
  "autocomplete_keyboard_open",
  "autocomplete_result_click",
  "citation_copy",
  "footer_link_click",
  "github_click",
  "language_suggestion_accept",
  "language_suggestion_dismiss",
  "locale_switch",
  "nav_click",
  "official_source_click",
  "quick_query_click",
  "record_canonical_click",
  "record_public_json_click",
  "search_reset_click",
  "search_result_json_click",
  "search_result_record_click",
  "search_submit",
  "theme_change"
] as const;

export type AnalyticsEventName = (typeof ANALYTICS_EVENT_NAMES)[number];

export const ANALYTICS_DATABASE_EVENT_NAMES = [
  ...ANALYTICS_EVENT_NAMES,
  "page_view"
] as const;

export type AnalyticsDatabaseEventName =
  (typeof ANALYTICS_DATABASE_EVENT_NAMES)[number];

export type AnalyticsValue = string | number | boolean;
export type AnalyticsProperties = Record<string, AnalyticsValue | undefined>;

const MAX_ANALYTICS_LENGTH = 255;

export interface BuildAnalyticsEventRecordInput {
  createdAt?: Date;
  eventName: AnalyticsDatabaseEventName | string;
  pathname: string;
  properties?: AnalyticsProperties;
  sessionId?: string;
  source?: string;
  visitorId?: string;
}

export function sanitizeAnalyticsProperties(
  properties: AnalyticsProperties = {}
): Record<string, AnalyticsValue> {
  const sanitized: Record<string, AnalyticsValue> = {};

  for (const [key, value] of Object.entries(properties)) {
    if (!key || value === undefined) continue;
    const safeKey = truncateAnalyticsString(toSnakeCase(key));

    if (typeof value === "string") {
      sanitized[safeKey] = truncateAnalyticsString(value);
    } else if (typeof value === "number") {
      if (Number.isFinite(value)) sanitized[safeKey] = value;
    } else if (typeof value === "boolean") {
      sanitized[safeKey] = value;
    }
  }

  return sanitized;
}

export function buildAnalyticsEventRecord(
  input: BuildAnalyticsEventRecordInput
): AnalyticsEventRecordInput {
  const pathname = normalizePathname(input.pathname);
  const sanitized = sanitizeAnalyticsProperties(input.properties);
  const locale =
    getStringProperty(sanitized, "locale") ?? getLocaleFromPathname(pathname);
  const pageType =
    getStringProperty(sanitized, "page_type") ?? getPageType(pathname);
  const entitySlug =
    getStringProperty(sanitized, "entity_slug") ??
    getEntitySlugFromPathname(pathname);

  return {
    createdAt: input.createdAt,
    entitySlug,
    eventName: truncateAnalyticsString(input.eventName),
    locale,
    pageType,
    pathname,
    payload: sanitized,
    queryKind: getStringProperty(sanitized, "query_kind"),
    queryLengthBucket: getStringProperty(sanitized, "query_length_bucket"),
    resultCountBucket: getStringProperty(sanitized, "result_count_bucket"),
    resultRank: getNumberProperty(sanitized, "result_rank"),
    resultSource: getStringProperty(sanitized, "result_source"),
    source: input.source ?? "client",
    sourceDomain: getStringProperty(sanitized, "source_domain"),
    targetKind: getStringProperty(sanitized, "target_kind"),
    visitorId: truncateAnalyticsStringIfPresent(input.visitorId),
    sessionId: truncateAnalyticsStringIfPresent(input.sessionId),
    copyTarget: getStringProperty(sanitized, "copy_target"),
    endpointKind: getStringProperty(sanitized, "endpoint_kind"),
    exampleKey: getStringProperty(sanitized, "example_key"),
    footerGroup: getStringProperty(sanitized, "footer_group"),
    fromLocale: getStringProperty(sanitized, "from_locale"),
    fromTheme: getStringProperty(sanitized, "from_theme"),
    limitBucket: getStringProperty(sanitized, "limit_bucket"),
    navArea: getStringProperty(sanitized, "nav_area"),
    toLocale: getStringProperty(sanitized, "to_locale"),
    toTheme: getStringProperty(sanitized, "to_theme")
  };
}

export function getQueryAnalytics(query: string): AnalyticsProperties {
  const trimmed = query.trim();

  return {
    has_query: trimmed.length > 0,
    query_kind: getQueryKind(trimmed),
    query_length_bucket: getLengthBucket(trimmed.length)
  };
}

export function getQueryKind(query: string): string {
  if (!query) return "empty";
  if (/^https?:\/\//i.test(query)) return "url_like";
  if (/^[\w.-]+\.[a-z]{2,}$/i.test(query)) return "domain_like";
  if (query.length <= 3) return "short";
  if (/\b(university|college|institut|school)\b/i.test(query)) {
    return "institution";
  }
  if (/\b(ai|policy|privacy|citation|disclosure|copilot|chatgpt|gemini)\b/i.test(query)) {
    return "topic";
  }
  if (query.length > 80) return "long_text";
  return "general";
}

export function getLengthBucket(length: number): string {
  if (length <= 0) return "0";
  if (length <= 2) return "1-2";
  if (length <= 10) return "3-10";
  if (length <= 25) return "11-25";
  if (length <= 50) return "26-50";
  return "51+";
}

export function getCountBucket(count: number): string {
  if (!Number.isFinite(count) || count <= 0) return "0";
  if (count <= 5) return "1-5";
  if (count <= 10) return "6-10";
  if (count <= 25) return "11-25";
  if (count <= 50) return "26-50";
  return "51+";
}

export function getLimitBucket(limit: number): string {
  if (!Number.isFinite(limit) || limit <= 0) return "invalid";
  if (limit <= 8) return "1-8";
  if (limit <= 20) return "9-20";
  if (limit <= 50) return "21-50";
  return "51+";
}

export function getPageType(pathname: string): string {
  const path = stripLocalePrefix(pathname);
  if (path === "/") return "home";
  if (path === "/search") return "search";
  if (path === "/universities") return "universities_index";
  if (path.startsWith("/universities/")) return "university_record";
  if (path.startsWith("/analysis/")) return "analysis_detail";
  if (path === "/analysis") return "analysis";
  if (path.startsWith("/changes/")) return "changes_detail";
  if (path === "/changes") return "changes";
  if (path.startsWith("/reports/")) return "reports_detail";
  if (path === "/reports") return "reports";
  if (path === "/datasets") return "datasets";
  if (path === "/api-reference") return "api_reference";
  if (path === "/citation") return "citation";
  if (path === "/methodology") return "methodology";
  if (path === "/contribute") return "contribute";
  if (path === "/widgets") return "widgets";
  if (path === "/source-health") return "source_health";
  if (path.startsWith("/coverage")) return "coverage";
  return path.split("/").filter(Boolean)[0] || "other";
}

export function getEndpointKind(href: string): string {
  const pathname = getPathnameFromHref(href);
  if (!pathname) return "unknown";
  if (pathname.includes("/search.json")) return "search";
  if (pathname.includes("/search/index.json")) return "search_index";
  if (pathname.includes("/entities/")) return "entities";
  if (pathname.includes("/universities/")) return "university_record";
  if (pathname.endsWith("/universities.json")) return "universities_index";
  if (pathname.includes("/analysis/")) return "analysis";
  if (pathname.includes("/datasets/")) return "dataset";
  if (pathname.includes("/reports/")) return "report";
  if (pathname.includes("/widgets/")) return "widget";
  if (pathname.includes("/changes/")) return "changes";
  if (pathname.includes("/claims/")) return "claim";
  if (pathname.includes("/source-health")) return "source_health";
  if (pathname.includes("/review/")) return "review";
  if (pathname.includes("/mcp/")) return "mcp";
  if (pathname.startsWith("/api/")) return "api";
  if (pathname.endsWith(".json") || pathname.endsWith(".jsonl")) return "json";
  if (pathname.endsWith(".xml")) return "feed";
  return "other";
}

export function getTargetKind(href: string): string {
  const pathname = getPathnameFromHref(href);
  if (pathname?.startsWith("/api/")) return "api";
  if (pathname?.endsWith(".json") || pathname?.endsWith(".jsonl")) {
    return "public_json";
  }
  if (pathname?.startsWith("/feeds/") || pathname?.endsWith(".xml")) return "feed";
  if (href.startsWith("http")) return "external";
  return "internal";
}

export function getSourceDomain(href: string): string | undefined {
  try {
    const url = new URL(href);
    return url.hostname.replace(/^www\./, "");
  } catch {
    return undefined;
  }
}

export function getPathnameFromHref(href: string): string | undefined {
  try {
    const url = new URL(href, "https://eduaipolicy.org");
    return url.pathname;
  } catch {
    return undefined;
  }
}

export function getEntitySlugFromPathname(pathname: string): string | undefined {
  const path = stripLocalePrefix(pathname);
  const match = path.match(/^\/universities\/([^/?#]+)/);
  return match?.[1];
}

export function isAnalyticsEventName(value: string): value is AnalyticsEventName {
  return (ANALYTICS_EVENT_NAMES as readonly string[]).includes(value);
}

export function isAnalyticsDatabaseEventName(
  value: string
): value is AnalyticsDatabaseEventName {
  return (ANALYTICS_DATABASE_EVENT_NAMES as readonly string[]).includes(value);
}

function normalizePathname(pathname: string): string {
  const normalized = pathname.startsWith("/") ? pathname : `/${pathname}`;
  return truncateAnalyticsString(normalized) || "/";
}

function getStringProperty(
  properties: Record<string, AnalyticsValue>,
  key: string
): string | undefined {
  const value = properties[key];
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function getNumberProperty(
  properties: Record<string, AnalyticsValue>,
  key: string
): number | undefined {
  const value = properties[key];
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : undefined;
}

function stripLocalePrefix(pathname: string): string {
  return pathname.replace(/^\/(zh|fr|pl|es|nl|ms)(?=\/|$)/, "") || "/";
}

function truncateAnalyticsString(value: string): string {
  return value.length > MAX_ANALYTICS_LENGTH
    ? value.slice(0, MAX_ANALYTICS_LENGTH)
    : value;
}

function truncateAnalyticsStringIfPresent(value: unknown): string | undefined {
  if (typeof value !== "string" || !value) return undefined;
  return truncateAnalyticsString(value);
}

function toSnakeCase(value: string): string {
  return value
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .replace(/[^a-zA-Z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toLowerCase();
}
