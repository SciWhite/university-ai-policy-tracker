/** Measurement labels, never authorization or a claim that unmarked clients are human. */
export const ANALYTICS_MEASUREMENT_VERSION = "2026-10-26-v3";
export type AnalyticsTrafficKind = "qa" | "internal" | "monitor" | "unclassified";
export function normalizeTrafficKind(value: unknown): AnalyticsTrafficKind {
  return value === "qa" || value === "internal" || value === "monitor" ? value : "unclassified";
}
export function requestTrafficKind(headers: Headers): AnalyticsTrafficKind {
  const explicit = normalizeTrafficKind(headers.get("x-uapt-traffic-kind"));
  if (explicit !== "unclassified") return explicit;
  const cookie = /(?:^|;\s*)uapt_traffic_kind=(qa|internal|monitor)(?:;|$)/.exec(headers.get("cookie") ?? "");
  if (cookie) return normalizeTrafficKind(cookie[1]);
  if (/UAPT-Monitor\//i.test(headers.get("user-agent") ?? "")) return "monitor";
  return /UAPT-(?:Release-Smoke|QA)\//i.test(headers.get("user-agent") ?? "") ? "qa" : "unclassified";
}
export function browserTrafficKind(): AnalyticsTrafficKind {
  if (typeof window === "undefined") return "unclassified";
  const cookie = requestTrafficKind(new Headers({cookie: document.cookie}));
  if (cookie !== "unclassified") return cookie;
  return typeof navigator !== "undefined" && navigator.webdriver === true ? "qa" : "unclassified";
}
export function eventTrafficKind(payload: unknown): AnalyticsTrafficKind {
  return payload && typeof payload === "object" && !Array.isArray(payload)
    ? normalizeTrafficKind((payload as Record<string, unknown>).traffic_kind) : "unclassified";
}
export function splitMeasuredTraffic<T extends {payload?: unknown;sessionId?: string | null}>(rows: T[]) {
  const excludedSessions = new Set(rows.filter(row => eventTrafficKind(row.payload) !== "unclassified").map(row => row.sessionId).filter(Boolean));
  const excluded: T[] = [], included: T[] = [];
  for (const row of rows) (eventTrafficKind(row.payload) !== "unclassified" || row.sessionId && excludedSessions.has(row.sessionId) ? excluded : included).push(row);
  return {included, excluded};
}

/** Propagate an explicit marker before date/source filters can hide that marker event. */
export function inheritSessionTrafficKinds<T extends {payload?: unknown; sessionId?: string | null}>(rows: T[]): T[] {
  const kinds = new Map<string, AnalyticsTrafficKind>();
  for (const row of rows) { const kind = eventTrafficKind(row.payload); if (row.sessionId && kind !== "unclassified") kinds.set(row.sessionId, kind); }
  return rows.map(row => {
    const kind = row.sessionId && kinds.get(row.sessionId);
    return kind && eventTrafficKind(row.payload) === "unclassified" ? {...row, payload: {...(row.payload && typeof row.payload === "object" && !Array.isArray(row.payload) ? row.payload : {}), traffic_kind: kind}} : row;
  });
}
