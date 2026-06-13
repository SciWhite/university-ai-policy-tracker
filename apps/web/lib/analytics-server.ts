import { recordAnalyticsEvent } from "@uapt/db";
import { track } from "@vercel/analytics/server";
import {
  buildAnalyticsEventRecord,
  sanitizeAnalyticsProperties,
  type AnalyticsEventName,
  type AnalyticsProperties
} from "@/lib/analytics-events";

export async function trackServerResearchEvent(
  eventName: AnalyticsEventName,
  properties: AnalyticsProperties = {},
  pathname = "/"
) {
  const sanitized = sanitizeAnalyticsProperties({
    ...properties,
    pathname
  });

  try {
    await track(eventName, sanitized);
  } catch {
    // Analytics must not affect public API responses.
  }

  try {
    await recordAnalyticsEvent(
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
