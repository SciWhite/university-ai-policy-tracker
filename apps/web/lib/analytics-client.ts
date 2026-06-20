"use client";

import {
  sanitizeAnalyticsProperties,
  type AnalyticsDatabaseEventName,
  type AnalyticsEventName,
  type AnalyticsProperties
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
