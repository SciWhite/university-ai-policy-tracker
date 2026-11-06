import { test } from "node:test";
import assert from "node:assert/strict";
import {
  AUTOMATION_IP_RANGES,
  ANALYTICS_MEASUREMENT_VERSION,
  browserTrafficKind,
  detectSuspectedAutomation,
  isSuspectedAutomationRow,
  markSuspectedAutomation,
  matchAutomationIpRange,
  newestSeenChromeMajor,
  parseChromeMajor,
  requestAutomationHints,
  splitMeasuredTraffic
} from "../apps/web/lib/analytics-traffic";

type Row = { eventName: string; id: string; payload: Record<string, unknown>; sessionId: string; referrerDomain?: string };
let seq = 0;
const view = (sessionId: string, payload: Record<string, unknown> = {}, extra: Partial<Row> = {}): Row =>
  ({ eventName: "page_view", id: `e${++seq}`, payload, sessionId, ...extra });
const event = (sessionId: string, eventName: string, payload: Record<string, unknown> = {}): Row =>
  ({ eventName, id: `e${++seq}`, payload, sessionId });
/** Enough current-Chrome sessions that "newest seen" is 151 in the window. */
const currentChrome = () => ["a", "b", "c"].map(n => view(`current-${n}`, { ua_chrome_major: 151 }, { referrerDomain: "google.com" }));
const verdict = (rows: Row[], session: string) => detectSuspectedAutomation(rows).get(session);

test("collector version is bumped and webdriver no longer masquerades as a QA marker", () => {
  assert.equal(ANALYTICS_MEASUREMENT_VERSION, "2026-11-06-v4");
  assert.equal(browserTrafficKind(), "unclassified");
});

test("IP ranges match on the CIDR boundary, including IPv4-mapped IPv6, and ignore garbage", () => {
  assert.deepEqual(AUTOMATION_IP_RANGES.map(r => r.cidr), ["116.179.0.0/16"]);
  assert.equal(matchAutomationIpRange("116.179.0.0"), "baidu-116.179");
  assert.equal(matchAutomationIpRange("116.179.255.255"), "baidu-116.179");
  assert.equal(matchAutomationIpRange("::ffff:116.179.12.3"), "baidu-116.179");
  assert.equal(matchAutomationIpRange("116.178.255.255"), undefined);
  assert.equal(matchAutomationIpRange("116.180.0.0"), undefined);
  assert.equal(matchAutomationIpRange("999.1.1.1"), undefined);
  assert.equal(matchAutomationIpRange("2001:db8::1"), undefined);
  assert.equal(matchAutomationIpRange(undefined), undefined);
});

test("ingest hints record the matched range id, Chrome major and headless UA, never the IP", () => {
  const chrome = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/99.0.4844.51 Safari/537.36";
  const hints = requestAutomationHints(new Headers({ "cf-connecting-ip": "116.179.37.5", "user-agent": chrome }));
  assert.deepEqual(hints, { automation_ip_range: "baidu-116.179", ua_chrome_major: 99 });
  assert.ok(!JSON.stringify(hints).includes("116.179.37.5"));
  assert.deepEqual(requestAutomationHints(new Headers({ "x-forwarded-for": "8.8.8.8, 116.179.1.1", "user-agent": "HeadlessChrome/120.0.0.0" })), { headless_ua: true, ua_chrome_major: 120 });
  assert.equal(parseChromeMajor("Mozilla/5.0 HeadlessChrome/120.0.0.0 Safari/537.36"), 120);
  assert.equal(parseChromeMajor("Mozilla/5.0 (iPhone) AppleWebKit Version/17.0 Mobile Safari/604.1"), undefined);
  assert.equal(parseChromeMajor("Mozilla/5.0 (iPhone) CriOS/151.0.1 Mobile Safari/604.1"), undefined);
  assert.deepEqual(requestAutomationHints(new Headers()), {});
});

test("signal: a known crawler IP range is enough on its own, even with several pages", () => {
  const rows = [view("ip", { automation_ip_range: "baidu-116.179", ua_chrome_major: 151 }), view("ip"), event("ip", "nav_click")];
  assert.deepEqual(verdict(rows, "ip"), ["ip_range"]);
});

test("signal: webdriver and HeadlessChrome are enough on their own", () => {
  assert.deepEqual(verdict([view("wd", { webdriver: true })], "wd"), ["webdriver", "profile"]);
  assert.deepEqual(verdict([view("hl", { headless_ua: true }), view("hl")], "hl"), ["webdriver"]);
  assert.equal(verdict([view("no-wd", { webdriver: false })], "no-wd"), undefined);
});

test("signal: outdated Chrome (more than 12 behind the newest seen) counts with the single-page profile", () => {
  const rows = [...currentChrome(), view("old", { ua_chrome_major: 99 }), view("edge", { ua_chrome_major: 139 }), view("ok", { ua_chrome_major: 140 })];
  assert.equal(newestSeenChromeMajor(rows), 151);
  assert.deepEqual(verdict(rows, "old"), ["old_chrome", "profile"]);
  assert.equal(verdict(rows, "edge"), undefined, "139 is exactly 12 behind and not flagged");
  assert.equal(verdict(rows, "ok"), undefined);
  assert.equal(verdict(rows, "current-a"), undefined);
});

test("signal: the hard floor (< 120) applies even when the window is too thin to know the newest version", () => {
  const rows = [view("floor", { ua_chrome_major: 119 }), view("above", { ua_chrome_major: 120 })];
  assert.equal(newestSeenChromeMajor(rows), undefined);
  assert.deepEqual(verdict(rows, "floor"), ["old_chrome", "profile"]);
  assert.equal(verdict(rows, "above"), undefined);
});

test("one spoofed far-future Chrome major cannot move the newest-seen reference", () => {
  const rows = [...currentChrome(), view("spoof", { ua_chrome_major: 250 }), view("real", { ua_chrome_major: 145 })];
  assert.equal(newestSeenChromeMajor(rows), 151);
  assert.equal(verdict(rows, "real"), undefined);
});

test("outdated Chrome with any sign of a person is kept: second page, interaction, 10s engagement or a referrer", () => {
  const rows = [
    ...currentChrome(),
    view("two-pages", { ua_chrome_major: 109 }), view("two-pages"),
    view("clicked", { ua_chrome_major: 109 }), event("clicked", "official_source_click"),
    view("engaged", { ua_chrome_major: 109 }), event("engaged", "session_engaged"),
    view("referred", { ua_chrome_major: 109 }, { referrerDomain: "google.com" }),
    view("utm", { ua_chrome_major: 109, utm_source: "newsletter" })
  ];
  for (const s of ["two-pages", "clicked", "engaged", "referred", "utm"]) assert.equal(verdict(rows, s), undefined, s);
  assert.deepEqual(verdict([...rows, view("bounce", { ua_chrome_major: 109 })], "bounce"), ["old_chrome", "profile"]);
});

test("a real single-page human visit stays human: the profile alone never counts", () => {
  const rows = [
    ...currentChrome(),
    view("human-direct", { ua_chrome_major: 151, referrer_domain: "" }),
    view("human-safari"),
    view("legacy-event-without-any-v4-field")
  ];
  for (const s of ["human-direct", "human-safari", "legacy-event-without-any-v4-field"]) assert.equal(verdict(rows, s), undefined, s);
  assert.equal(markSuspectedAutomation(rows).filter(isSuspectedAutomationRow).length, 0);
});

test("the verdict covers the whole session, including events without the stamped fields", () => {
  const rows = [view("s", { automation_ip_range: "baidu-116.179" }), event("s", "session_engaged"), view("other")];
  const marked = markSuspectedAutomation(rows);
  assert.deepEqual(marked.map(isSuspectedAutomationRow), [true, true, false]);
  assert.equal(marked[1].payload.automation_signals, "ip_range");
  assert.equal(rows[0].payload.suspected_automation, undefined, "input rows are not mutated");
});

test("a suspected-automation tag is not an explicit test marker, so QA/internal/monitor handling is unchanged", () => {
  const marked = markSuspectedAutomation([view("x", { webdriver: true }), view("qa", { traffic_kind: "qa" })]);
  const split = splitMeasuredTraffic(marked);
  assert.equal(split.excluded.length, 1);
  assert.equal(split.included.length, 1);
  assert.equal(isSuspectedAutomationRow(split.included[0]), true);
});

// ---- Dashboard: human totals, sources, countries and bot diagnostics ------------------------------------------

const fixtureBase = { created_at: "2026-10-23T12:00:00Z", device_type: "desktop", country_code: "CA", pathname: "/universities/kcl", source: "client", source_category: "direct", source_name: "direct" };
let dbId = 0;
const dbRow = (session: string, name: string, payload: Record<string, unknown> = {}, extra: Record<string, unknown> = {}) =>
  ({ ...fixtureBase, id: `d${++dbId}`, event_name: name, session_id: session, visitor_id: `v-${session}`, payload, ...extra });

async function runDashboard(events: unknown[], query = { from: "2026-10-19", to: "2026-10-25", compare: "none" }) {
  const { getAnalyticsDashboard, parseAnalyticsDashboardQuery } = await import("../apps/web/lib/private-analytics-dashboard");
  const original = globalThis.fetch, saved = { ...process.env };
  process.env.SUPABASE_URL = "https://example.invalid"; process.env.SUPABASE_ANON_KEY = "fixture"; process.env.SUPABASE_ANALYTICS_SECRET = "fixture";
  try {
    globalThis.fetch = async (input, init) => String(input).includes("uapt_private_analytics_rollup") ? Response.json(null)
      : String(input).includes("uapt_list_analytics_events_window") ? Response.json(JSON.parse(String(init?.body)).p_offset === 0 ? events : [])
      : new Response("unconfigured fixture", { status: 503 });
    return await getAnalyticsDashboard(parseAnalyticsDashboardQuery(new URLSearchParams(query)));
  } finally {
    globalThis.fetch = original;
    for (const k of ["SUPABASE_URL", "SUPABASE_ANON_KEY", "SUPABASE_ANALYTICS_SECRET"]) { if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k]; }
  }
}

test("dashboard: suspected automation leaves visitors, page views, sources and countries and is counted in bot diagnostics", async () => {
  const human = { collector_version: ANALYTICS_MEASUREMENT_VERSION, ua_chrome_major: 151 };
  const events = [
    // 3 current-Chrome sessions establish the newest version; two of them are real two-page / referred visits.
    dbRow("h1", "page_view", human, { source_category: "search", source_name: "google", referrer_domain: "google.com", country_code: "US" }),
    dbRow("h1", "page_view", human, { source_category: "search", source_name: "google", referrer_domain: "google.com", country_code: "US" }),
    dbRow("h2", "page_view", human, { country_code: "GB" }), dbRow("h2", "session_engaged", human, { country_code: "GB" }),
    // A real single-page direct visit stays human (no other signal).
    dbRow("h3", "page_view", human, { country_code: "CA" }),
    // Baidu range with a plain Chrome UA: the 2026-11-01 "China direct" shape.
    dbRow("a1", "page_view", { ...human, automation_ip_range: "baidu-116.179" }, { country_code: "CN" }),
    dbRow("a2", "page_view", { ...human, automation_ip_range: "baidu-116.179" }, { country_code: "CN" }),
    // Chrome 99 + single page + no referrer.
    dbRow("a3", "page_view", { ua_chrome_major: 99 }, { country_code: "CN" }),
    // webdriver
    dbRow("a4", "page_view", { webdriver: true }, { country_code: "US" }),
    // known bot (device_type bot) and QA stay in their own buckets
    dbRow("b1", "page_view", {}, { device_type: "bot", country_code: "US" }),
    dbRow("q1", "page_view", { traffic_kind: "qa" })
  ];
  const data = await runDashboard(events);
  const cur = data.onsite.current;
  assert.equal(cur.summary.pageViews, 4, "h1 x2, h2, h3");
  assert.equal(cur.summary.sessions, 3);
  assert.equal(cur.summary.visitors, 3);
  assert.deepEqual(cur.summary.sourceCategories.map(r => [r.label, r.count]).sort(), [["direct", 2], ["search", 2]]);
  assert.equal(cur.summary.countries.some(r => r.countryCode === "CN"), false, "suspected automation no longer produces a China direct spike");
  assert.deepEqual(cur.summary.countries.map(r => r.countryCode).sort(), ["CA", "GB", "US"]);
  assert.equal(cur.bot.suspectedAutomation.pageViews, 4);
  assert.equal(cur.bot.suspectedAutomation.sessions, 4);
  assert.deepEqual(cur.bot.suspectedAutomation.signals.map(s => [s.label, s.count]).sort(), [["ip_range", 2], ["old_chrome", 1], ["profile", 4], ["webdriver", 1]]);
  assert.deepEqual(cur.bot.suspectedAutomation.countries.map(c => [c.label, c.count]).sort(), [["CN", 3], ["US", 1]]);
  assert.equal(cur.quality.excludedTestPageViews, 1, "QA is still counted as test traffic, not as suspected automation");
  assert.equal(data.filterOptions.countries.some(o => o.value === "CN"), false);
  const cn = await runDashboard(events, { from: "2026-10-19", to: "2026-10-25", compare: "none", country: "cn" } as never);
  assert.equal(cn.onsite.current.summary.pageViews, 0, "a country filter cannot pull suspected automation back into human totals");
  assert.equal(cn.onsite.current.bot.suspectedAutomation.pageViews, 4);
});

test("dashboard: historical events without the v4 fields are classified exactly as before", async () => {
  const legacy = [dbRow("l1", "page_view", { collector_version: "2026-10-26-v3" }, { country_code: "CN" }), dbRow("l2", "page_view", {}, { country_code: "CN" })];
  // A distinct date range keeps this call out of the dashboard's in-process result cache.
  const data = await runDashboard(legacy, { from: "2026-10-20", to: "2026-10-25", compare: "none" });
  assert.equal(data.onsite.current.summary.pageViews, 2);
  assert.equal(data.onsite.current.bot.suspectedAutomation.sessions, 0);
});

test("ingest route stamps server-observed facts and overwrites client-supplied copies", async () => {
  const { POST } = await import("../apps/web/app/api/internal/analytics/events/route");
  const original = globalThis.fetch, saved = { ...process.env };
  process.env.SUPABASE_URL = "https://example.invalid"; process.env.SUPABASE_ANON_KEY = "fixture"; process.env.SUPABASE_ANALYTICS_SECRET = "fixture";
  let stored: { payload: Record<string, unknown> } | undefined;
  globalThis.fetch = async (_input, init) => { stored = JSON.parse(String(init?.body)).p_event; return new Response(null, { status: 204 }); };
  try {
    const body = JSON.stringify({ eventName: "page_view", pathname: "/", sessionId: "s1", properties: { webdriver: true, ua_chrome_major: 999, automation_ip_range: "forged", headless_ua: true } });
    const headers = { "cf-connecting-ip": "8.8.8.8", "content-type": "application/json", origin: "https://eduaipolicy.org", "user-agent": "Mozilla/5.0 Chrome/151.0.0.0 Safari/537.36" };
    const url = "https://eduaipolicy.org/api/internal/analytics/events";
    assert.equal((await POST(new Request(url, { body, headers, method: "POST" }))).status, 204);
    assert.equal(stored?.payload.ua_chrome_major, 151);
    assert.equal(stored?.payload.automation_ip_range, undefined);
    assert.equal(stored?.payload.headless_ua, undefined);
    assert.equal(stored?.payload.webdriver, true, "the client's own webdriver claim is kept");
    assert.equal(stored?.payload.measurement_version, ANALYTICS_MEASUREMENT_VERSION);
    await POST(new Request(url, { body, headers: { ...headers, "cf-connecting-ip": "116.179.1.2" }, method: "POST" }));
    assert.equal(stored?.payload.automation_ip_range, "baidu-116.179");
    assert.ok(!JSON.stringify(stored).includes("116.179.1.2"));
  } finally {
    globalThis.fetch = original;
    for (const k of ["SUPABASE_URL", "SUPABASE_ANON_KEY", "SUPABASE_ANALYTICS_SECRET"]) { if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k]; }
  }
});
