import {
  buildAnalyticsEventRecord,
  sanitizeAnalyticsProperties,
  type AnalyticsEventName,
  type AnalyticsProperties
} from "@/lib/analytics-events";
import { recordMirroredAnalyticsEvent } from "@/lib/analytics-store";

export async function trackServerResearchEvent(
  eventName: AnalyticsEventName,
  properties: AnalyticsProperties = {},
  pathname = "/"
) {
  const sanitized = sanitizeAnalyticsProperties({
    collectorVersion: "2026-07-13-v2",
    ...properties,
    pathname
  });

  try {
    await recordMirroredAnalyticsEvent(
      buildAnalyticsEventRecord({
        eventName,
        pathname,
        properties: sanitized,
        source: "server"
      })
    );
  } catch {
    // Private analytics must not affect public API responses.
  }
}

export function getServerRequestAnalytics(
  request: Request
): AnalyticsProperties {
  const userAgent = request.headers.get("user-agent")?.toLowerCase() ?? "";
  const botFamily = getBotFamily(userAgent);
  return {
    bot_family: botFamily,
    client_kind: botFamily
      ? "bot"
      : request.headers.has("sec-fetch-site")
        ? "browser"
        : "api"
  };
}

export function getLatencyBucket(ms: number): string {
  if (ms < 100) return "<100ms";
  if (ms < 300) return "100-299ms";
  if (ms < 1_000) return "300-999ms";
  return "1000ms+";
}

function getBotFamily(userAgent: string): string | undefined {
  const families: Array<[string, RegExp]> = [
    ["googlebot", /googlebot|google-inspectiontool/],
    ["bingbot", /bingbot|bingpreview/],
    ["gptbot", /gptbot|chatgpt-user/],
    ["claudebot", /claudebot|anthropic-ai/],
    ["perplexitybot", /perplexitybot/]
  ];
  for (const [family, pattern] of families) {
    if (pattern.test(userAgent)) return family;
  }
  return /(bot|crawler|spider|crawling|slurp)/.test(userAgent)
    ? "other_bot"
    : undefined;
}
