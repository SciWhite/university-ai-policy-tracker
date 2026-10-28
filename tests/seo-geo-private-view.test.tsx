import React from "react";
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { PrivateSeoGeoReports } from "../apps/web/components/private-seo-geo-reports";
import type { SeoGeoReports } from "../apps/web/lib/seo-geo-report-types";
import { proxy, config } from "../apps/web/proxy";

test("diagnostics remain inside the existing authenticated private no-store API", () => {
  const previousToken = process.env.INTERNAL_ANALYTICS_PASSWORD, previousMode = process.env.NODE_ENV;
  process.env.INTERNAL_ANALYTICS_PASSWORD = "synthetic-test-token";
  Object.assign(process.env, { NODE_ENV: "production" });
  try {
    assert(config.matcher.includes("/api/internal/analytics/dashboard/:path*"));
    const request = (authorization?: string) => ({ nextUrl: new URL("https://eduaipolicy.org/api/internal/analytics/dashboard"), headers: new Headers(authorization ? { authorization } : {}) }) as Parameters<typeof proxy>[0];
    const response = proxy(request());
    assert.equal(response.status, 401); assert.equal(response.headers.get("Cache-Control"), "no-store");
    const authorized = proxy(request("Basic " + Buffer.from("uapt:synthetic-test-token").toString("base64")));
    assert.equal(authorized.status, 200);
    const route = readFileSync(new URL("../apps/web/app/api/internal/analytics/dashboard/route.ts", import.meta.url), "utf8");
    assert(route.includes('"private, no-store, max-age=0"'));
  } finally {
    if (previousToken === undefined) delete process.env.INTERNAL_ANALYTICS_PASSWORD; else process.env.INTERNAL_ANALYTICS_PASSWORD = previousToken;
    Object.assign(process.env, { NODE_ENV: previousMode });
  }
});
test("unrun experiments show an unknown rate and untrusted reports render as text", () => {
  const reports: SeoGeoReports = { technical: { state: "not_run", tool: "unlighthouse", pages: [], experiments: [] }, geo: { state: "ready", tool: "geo-optimizer", pages: [{ state: "measured", requestedUrl: "https://eduaipolicy.org/universities/ucl", finalUrl: "https://eduaipolicy.org/universities/ucl", codeSha: "a".repeat(40), rawSha256: "b".repeat(64), contentSha256: "c".repeat(64), locale: "en", template: "bundle", measuredAt: "2026-10-28T12:00:00Z", scores: { readiness: 69 }, checks: [], recommendations: ['<script>alert("untrusted")</script>'], issues: [] }], experiments: [] }, citations: { state: "not_run", tool: "elmo", pages: [], experiments: [] } };
  const html = renderToStaticMarkup(<PrivateSeoGeoReports reports={reports} locale="en" />);
  assert(!html.includes("<script>")); assert(html.includes("&lt;script&gt;"));
  assert(html.replace(/<!--.*?-->/g, "").includes("Site citation rate: —"));
  assert(!html.includes("0%"));
});
