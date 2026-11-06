/** Measurement labels, never authorization or a claim that unmarked clients are human. */
export const ANALYTICS_MEASUREMENT_VERSION = "2026-11-06-v4";
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
  // navigator.webdriver is no longer mapped to "qa" (v4): it is reported as a `webdriver` signal and
  // classified at read time as suspected automation. Explicit markers above still win.
  return "unclassified";
}
/** True when the browser says it is driven by automation. Sent as a plain property, never as a traffic kind. */
export function browserWebdriver(): boolean {
  return typeof navigator !== "undefined" && navigator.webdriver === true;
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

/**
 * ---------------------------------------------------------------------------
 * Suspected automation (read-time classification, never rewrites stored events)
 * ---------------------------------------------------------------------------
 * Unknown-UA automation without a referrer used to land in "direct" human traffic. Stored events carry no IP
 * or user agent, so the facts below are stamped by the ingest route (collector v4+) as small payload fields and
 * judged here at read time. Older events have none of them and stay exactly as they were classified before:
 * only the single-page profile exists for them, and it never counts alone.
 *
 * Signals:
 *  - ip_range:  `automation_ip_range` — request IP is inside AUTOMATION_IP_RANGES (stamped at ingest; the IP is
 *               not stored, only the matched range id).
 *  - webdriver: client `webdriver: true` (navigator.webdriver) or ingest `headless_ua: true` (HeadlessChrome UA).
 *  - old_chrome: `ua_chrome_major` below max(newest major seen on enough sessions in the same window - 12, 120).
 *  - profile:   one pageview, no external referrer or UTM, no non-pageview events (clicks, session_engaged 10s+).
 *
 * Rule: a session is suspected automation when ip_range OR webdriver, or when old_chrome AND profile. The profile
 * alone is never enough, so a real one-page visit stays human. old_chrome additionally needs the profile because
 * real people still run Chrome 109 (Windows 7/8) or old Android WebViews; if they read a second page, click, stay
 * 10s or arrive from a referrer they are kept.
 */
export interface AutomationIpRange { id: string; cidr: string; note: string }
/** Keep this list small and explicit; every entry needs evidence. */
export const AUTOMATION_IP_RANGES: readonly AutomationIpRange[] = [
  {id: "baidu-116.179", cidr: "116.179.0.0/16", note: "Baidu crawler range that sends a plain Chrome UA (293 events, 2026-10-31..11-06)"}
];
export const AUTOMATION_CHROME_LAG = 12;
export const AUTOMATION_CHROME_FLOOR = 120;
/** A major version counts as "newest seen" only after this many distinct sessions, so one odd UA cannot move it. */
export const AUTOMATION_NEWEST_MIN_SESSIONS = 3;
const MAX_PLAUSIBLE_CHROME_MAJOR = 250;
export type AutomationSignal = "ip_range" | "webdriver" | "old_chrome" | "profile";

function ipv4ToInt(ip: string): number | undefined {
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(ip.trim().replace(/^::ffff:/i, ""));
  if (!m) return undefined;
  const parts = m.slice(1).map(Number);
  return parts.some(n => n > 255) ? undefined : (((parts[0] * 256 + parts[1]) * 256 + parts[2]) * 256 + parts[3]);
}
export function matchAutomationIpRange(ip: string | null | undefined, ranges: readonly AutomationIpRange[] = AUTOMATION_IP_RANGES): string | undefined {
  const value = ip ? ipv4ToInt(ip) : undefined;
  if (value === undefined) return undefined;
  for (const range of ranges) {
    const [base, bits] = range.cidr.split("/");
    const start = ipv4ToInt(base), size = 2 ** (32 - Number(bits));
    if (start !== undefined && Math.floor(value / size) === Math.floor(start / size)) return range.id;
  }
  return undefined;
}
export function requestClientIp(headers: Headers): string | undefined {
  return headers.get("cf-connecting-ip") ?? headers.get("x-real-ip") ?? headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? undefined;
}
export function parseChromeMajor(userAgent: string | null | undefined): number | undefined {
  const m = /(?:^|[^A-Za-z])(?:Headless)?Chrome\/(\d{1,3})\./.exec(userAgent ?? "");
  return m ? Number(m[1]) : undefined;
}
/** Server-side facts for one request; spread into the event payload after removing any client-supplied copies. */
export function requestAutomationHints(headers: Headers): {automation_ip_range?: string; headless_ua?: true; ua_chrome_major?: number} {
  const ua = headers.get("user-agent");
  const range = matchAutomationIpRange(requestClientIp(headers));
  const major = parseChromeMajor(ua);
  return {
    ...(range ? {automation_ip_range: range} : {}),
    ...(/HeadlessChrome/i.test(ua ?? "") ? {headless_ua: true as const} : {}),
    ...(major !== undefined ? {ua_chrome_major: major} : {})
  };
}
export const AUTOMATION_SERVER_KEYS = ["automation_ip_range", "headless_ua", "ua_chrome_major"] as const;

interface AutomationRow {
  eventName: string;
  id?: string;
  payload?: unknown;
  referrerDomain?: string | null;
  sessionId?: string | null;
  utmSource?: string | null;
  visitorId?: string | null;
}
function payloadValue(row: {payload?: unknown}, key: string): unknown {
  return row.payload && typeof row.payload === "object" && !Array.isArray(row.payload) ? (row.payload as Record<string, unknown>)[key] : undefined;
}
function textValue(row: {payload?: unknown}, key: string, direct?: string | null): string {
  const v = direct ?? payloadValue(row, key);
  return typeof v === "string" ? v.trim() : "";
}
/** Newest Chrome major that enough distinct sessions report; undefined when the window is too thin to say. */
export function newestSeenChromeMajor(rows: readonly AutomationRow[]): number | undefined {
  const sessionsByMajor = new Map<number, Set<string>>();
  rows.forEach((row, i) => {
    const major = payloadValue(row, "ua_chrome_major");
    if (typeof major !== "number" || !Number.isInteger(major) || major < 1 || major > MAX_PLAUSIBLE_CHROME_MAJOR) return;
    const set = sessionsByMajor.get(major) ?? new Set<string>();
    set.add(row.sessionId ?? row.visitorId ?? `row:${row.id ?? i}`);
    sessionsByMajor.set(major, set);
  });
  const eligible = [...sessionsByMajor].filter(([, sessions]) => sessions.size >= AUTOMATION_NEWEST_MIN_SESSIONS).map(([major]) => major);
  return eligible.length ? Math.max(...eligible) : undefined;
}
export function isOutdatedChromeMajor(major: number, newest: number | undefined): boolean {
  return major < AUTOMATION_CHROME_FLOOR || (newest !== undefined && major < newest - AUTOMATION_CHROME_LAG);
}
/**
 * Returns the signals per session key. Pass the whole loaded window (all dates, before any dashboard filter) so
 * "newest seen" and session membership do not depend on the selected period or filters.
 */
export function detectSuspectedAutomation(rows: readonly AutomationRow[]): Map<string, AutomationSignal[]> {
  const newest = newestSeenChromeMajor(rows);
  const sessions = new Map<string, {pageViews: number; interaction: boolean; referrer: boolean; ip: boolean; webdriver: boolean; old: boolean}>();
  rows.forEach((row, i) => {
    const key = row.sessionId ?? row.visitorId ?? `row:${row.id ?? i}`;
    const s = sessions.get(key) ?? {pageViews: 0, interaction: false, referrer: false, ip: false, webdriver: false, old: false};
    if (row.eventName === "page_view") s.pageViews += 1; else s.interaction = true;
    if (textValue(row, "referrer_domain", row.referrerDomain) || textValue(row, "utm_source", row.utmSource)) s.referrer = true;
    if (textValue(row, "automation_ip_range")) s.ip = true;
    if (payloadValue(row, "webdriver") === true || payloadValue(row, "headless_ua") === true) s.webdriver = true;
    const major = payloadValue(row, "ua_chrome_major");
    if (typeof major === "number" && isOutdatedChromeMajor(major, newest)) s.old = true;
    sessions.set(key, s);
  });
  const result = new Map<string, AutomationSignal[]>();
  for (const [key, s] of sessions) {
    const profile = s.pageViews === 1 && !s.interaction && !s.referrer;
    const signals: AutomationSignal[] = [];
    if (s.ip) signals.push("ip_range");
    if (s.webdriver) signals.push("webdriver");
    if (s.old) signals.push("old_chrome");
    // The profile never counts alone, and old_chrome needs it (see rule above).
    if (signals.length && (s.ip || s.webdriver || profile)) {
      if (profile) signals.push("profile");
      result.set(key, signals);
    }
  }
  return result;
}
/** Tag rows of suspected-automation sessions so every downstream split sees the same verdict. */
export function markSuspectedAutomation<T extends AutomationRow>(rows: T[]): T[] {
  const verdicts = detectSuspectedAutomation(rows);
  if (!verdicts.size) return rows;
  return rows.map((row, i) => {
    const signals = verdicts.get(row.sessionId ?? row.visitorId ?? `row:${row.id ?? i}`);
    if (!signals) return row;
    const base = row.payload && typeof row.payload === "object" && !Array.isArray(row.payload) ? row.payload : {};
    return {...row, payload: {...base, suspected_automation: true, automation_signals: signals.join(",")}};
  });
}
export function isSuspectedAutomationRow(row: {payload?: unknown}): boolean {
  return payloadValue(row, "suspected_automation") === true;
}
export function automationSignalsOf(row: {payload?: unknown}): string[] {
  const v = payloadValue(row, "automation_signals");
  return typeof v === "string" && v ? v.split(",") : [];
}
