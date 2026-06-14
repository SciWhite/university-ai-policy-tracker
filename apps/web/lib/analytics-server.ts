import { track } from "@vercel/analytics/server";
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
    ...properties,
    pathname
  });

  try {
    await track(eventName, sanitized);
  } catch {
    // Analytics must not affect public API responses.
  }

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
