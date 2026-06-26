"use client";

import {
  sanitizeAnalyticsProperties,
  type AnalyticsDatabaseEventName,
  type AnalyticsEventName,
  type AnalyticsProperties,
  type AnalyticsValue
} from "@/lib/analytics-events";

export function trackResearchEvent(
  eventName: AnalyticsEventName,
  properties: AnalyticsProperties = {}
) {
  const pathname = getCurrentPathname();
  if (isInternalAnalyticsPath(pathname)) return;

  const sanitized = sanitizeAnalyticsProperties({
    ...properties,
    pathname
  });

  void mirrorAnalyticsEvent({
    eventName,
    pathname,
    properties: sanitized,
    source: "client",
    visitorId: getAnalyticsVisitorId(),
    sessionId: getAnalyticsSessionId()
  });
}

export function trackPageView(properties: AnalyticsProperties = {}) {
  try {
    const pathname = getCurrentPathname();
    if (isInternalAnalyticsPath(pathname)) return;

    const sanitized = sanitizeAnalyticsProperties({
      ...getLandingAnalyticsProperties(pathname),
      ...properties,
      pathname
    });

    void mirrorAnalyticsEvent({
      eventName: "page_view",
      pathname,
      properties: sanitized,
      source: "client",
      visitorId: getAnalyticsVisitorId(),
      sessionId: getAnalyticsSessionId()
    });
  } catch {
    // Analytics must not affect navigation or interaction handlers.
  }
}

interface MirrorAnalyticsEventInput {
  eventName: AnalyticsDatabaseEventName | string;
  pathname: string;
  properties: Record<string, string | number | boolean>;
  sessionId?: string;
  source: string;
  visitorId?: string;
}

async function mirrorAnalyticsEvent(input: MirrorAnalyticsEventInput) {
  if (typeof window === "undefined") return;
  if (isInternalAnalyticsPath(input.pathname)) return;

  const body = JSON.stringify({
    eventName: input.eventName,
    pathname: input.pathname,
    properties: input.properties,
    sessionId: input.sessionId,
    source: input.source,
    visitorId: input.visitorId
  });

  const blob = new Blob([body], { type: "application/json" });

  try {
    if (navigator.sendBeacon("/api/internal/analytics/events", blob)) return;
  } catch {
    // Fall back to fetch below.
  }

  try {
    await fetch("/api/internal/analytics/events", {
      body,
      cache: "no-store",
      keepalive: true,
      headers: {
        "content-type": "application/json"
      },
      method: "POST"
    });
  } catch {
    // Best-effort telemetry only.
  }
}

function getCurrentPathname(): string {
  if (typeof window === "undefined") return "/";
  return window.location.pathname || "/";
}

const LANDING_CONTEXT_KEY = "uapt.analytics.landing_context";

function getLandingAnalyticsProperties(pathname: string): AnalyticsProperties {
  if (typeof window === "undefined") {
    return {
      landingPath: pathname,
      sourceCategory: "unknown",
      sourceName: "unknown"
    };
  }

  const stored = readStoredLandingContext();
  if (stored) return stored;

  const searchParams = new URLSearchParams(window.location.search);
  const utm = getUtmProperties(searchParams);
  const referrerDomain = getExternalReferrerDomain(document.referrer);
  const source = classifyInboundSource(utm.utmSource, referrerDomain);
  const context: AnalyticsProperties = {
    landingPath: pathname,
    referrerDomain,
    sourceCategory: source.category,
    sourceName: source.name,
    ...utm
  };

  try {
    window.sessionStorage.setItem(LANDING_CONTEXT_KEY, JSON.stringify(context));
  } catch {
    // Session attribution is best-effort only.
  }

  return context;
}

function readStoredLandingContext(): AnalyticsProperties | undefined {
  if (typeof window === "undefined") return undefined;

  try {
    const raw = window.sessionStorage.getItem(LANDING_CONTEXT_KEY);
    if (!raw) return undefined;
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return {
      landingPath: getStringValue(parsed.landingPath),
      referrerDomain: getStringValue(parsed.referrerDomain),
      sourceCategory: getStringValue(parsed.sourceCategory),
      sourceName: getStringValue(parsed.sourceName),
      utmSource: getStringValue(parsed.utmSource),
      utmMedium: getStringValue(parsed.utmMedium),
      utmCampaign: getStringValue(parsed.utmCampaign),
      utmTerm: getStringValue(parsed.utmTerm),
      utmContent: getStringValue(parsed.utmContent)
    };
  } catch {
    return undefined;
  }
}

function getUtmProperties(searchParams: URLSearchParams): AnalyticsProperties {
  return {
    utmSource: getSearchParam(searchParams, "utm_source"),
    utmMedium: getSearchParam(searchParams, "utm_medium"),
    utmCampaign: getSearchParam(searchParams, "utm_campaign"),
    utmTerm: getSearchParam(searchParams, "utm_term"),
    utmContent: getSearchParam(searchParams, "utm_content")
  };
}

function getSearchParam(
  searchParams: URLSearchParams,
  key: string
): string | undefined {
  const value = searchParams.get(key)?.trim();
  return value || undefined;
}

function getExternalReferrerDomain(referrer: string): string | undefined {
  if (!referrer) return undefined;

  try {
    const referrerUrl = new URL(referrer);
    if (referrerUrl.hostname === window.location.hostname) return undefined;
    return normalizeDomain(referrerUrl.hostname);
  } catch {
    return undefined;
  }
}

function classifyInboundSource(
  utmSource: AnalyticsValue | undefined,
  referrerDomain: string | undefined
): { category: string; name: string } {
  const source = typeof utmSource === "string" ? utmSource : undefined;
  const candidate = normalizeSourceName(source ?? referrerDomain ?? "");
  if (!candidate) {
    return {
      category: "direct",
      name: "direct"
    };
  }

  if (matchesAny(candidate, ["chatgpt", "openai", "oai"])) {
    return { category: "ai", name: "chatgpt" };
  }
  if (candidate.includes("perplexity")) {
    return { category: "ai", name: "perplexity" };
  }
  if (matchesAny(candidate, ["claude", "anthropic"])) {
    return { category: "ai", name: "claude" };
  }
  if (matchesAny(candidate, ["gemini", "bard"])) {
    return { category: "ai", name: "gemini" };
  }
  if (matchesAny(candidate, ["copilot", "microsoftcopilot"])) {
    return { category: "ai", name: "copilot" };
  }
  if (candidate.includes("google")) {
    return { category: "search", name: "google" };
  }
  if (candidate.includes("bing")) {
    return { category: "search", name: "bing" };
  }
  if (matchesAny(candidate, ["duckduckgo", "ddg"])) {
    return { category: "search", name: "duckduckgo" };
  }
  if (matchesAny(candidate, ["yahoo", "baidu", "yandex", "ecosia"])) {
    return { category: "search", name: candidate };
  }
  if (matchesAny(candidate, ["linkedin", "facebook", "twitter", "x", "reddit"])) {
    return { category: "social", name: candidate };
  }

  return {
    category: source ? "campaign" : "referral",
    name: candidate
  };
}

function matchesAny(value: string, needles: string[]): boolean {
  return needles.some((needle) => value.includes(needle));
}

function normalizeSourceName(value: string): string {
  return normalizeDomain(value)
    .replace(/\.(com|org|net|ai|io|co|edu|gov|ca|uk|cn|de|fr|au|jp)$/i, "")
    .replace(/[^a-z0-9]+/gi, "")
    .toLowerCase();
}

function normalizeDomain(value: string): string {
  return value.trim().toLowerCase().replace(/^www\./, "");
}

function getStringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function getAnalyticsVisitorId(): string | undefined {
  return getOrCreateAnalyticsId(
    "uapt.analytics.visitor_id",
    () => visitorIdFallback
  );
}

function getAnalyticsSessionId(): string | undefined {
  return getOrCreateAnalyticsId(
    "uapt.analytics.session_id",
    () => sessionIdFallback
  );
}

function getOrCreateAnalyticsId(
  storageKey: string,
  fallback: () => string | undefined
): string | undefined {
  if (typeof window === "undefined") return fallback();

  try {
    const storage = storageKey.includes("session")
      ? window.sessionStorage
      : window.localStorage;
    const stored = storage.getItem(storageKey);
    if (stored) return stored;

    const generated = crypto.randomUUID();
    storage.setItem(storageKey, generated);
    return generated;
  } catch {
    const current = fallback();
    if (current) return current;

    const generated = crypto.randomUUID();
    if (storageKey.includes("session")) {
      sessionIdFallback = generated;
    } else {
      visitorIdFallback = generated;
    }

    return generated;
  }
}

function isInternalAnalyticsPath(pathname: string): boolean {
  return pathname.startsWith("/internal/analytics");
}

let visitorIdFallback: string | undefined;
let sessionIdFallback: string | undefined;
