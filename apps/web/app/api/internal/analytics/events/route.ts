import { NextResponse } from "next/server";
import {
  buildAnalyticsEventRecord,
  isAnalyticsDatabaseEventName,
  sanitizeAnalyticsProperties,
  type AnalyticsProperties
} from "@/lib/analytics-events";
import { recordMirroredAnalyticsEvent } from "@/lib/analytics-store";

export const dynamic = "force-dynamic";

interface AnalyticsMirrorRequestBody {
  eventId?: string;
  eventName?: string;
  pathname?: string;
  properties?: AnalyticsProperties;
  sessionId?: string;
  visitorId?: string;
}

export async function POST(request: Request) {
  const startedAt = Date.now();
  const route = "/api/internal/analytics/events";

  console.log(
    JSON.stringify({
      level: "info",
      msg: "analytics mirror start",
      route,
      requestId: request.headers.get("x-vercel-id")
    })
  );

  if (!isTrustedOrigin(request)) {
    console.warn(
      JSON.stringify({
        level: "warning",
        msg: "analytics mirror rejected",
        route,
        reason: "untrusted_origin"
      })
    );

    return errorResponse(403);
  }

  if (!consumeAnalyticsRateLimit(request)) {
    return errorResponse(429, { "Retry-After": "60" });
  }

  const declaredLength = Number(request.headers.get("content-length") ?? 0);
  if (declaredLength > MAX_ANALYTICS_BODY_BYTES) return errorResponse(413);

  let body: AnalyticsMirrorRequestBody;
  try {
    const raw = await request.text();
    if (new TextEncoder().encode(raw).byteLength > MAX_ANALYTICS_BODY_BYTES) {
      return errorResponse(413);
    }
    body = JSON.parse(raw) as AnalyticsMirrorRequestBody;
  } catch {
    return errorResponse(400);
  }

  const eventName =
    typeof body.eventName === "string" ? body.eventName.trim() : "";
  const pathname =
    typeof body.pathname === "string" ? normalizePathname(body.pathname) : "";
  if (!eventName || !pathname) {
    return errorResponse(400);
  }

  if (!isAnalyticsDatabaseEventName(eventName)) {
    return errorResponse(400);
  }

  const properties = sanitizeAnalyticsProperties(
    isAnalyticsProperties(body.properties) ? body.properties : {}
  );
  const requestAnalyticsContext = getRequestAnalyticsContext(request);
  if (requestAnalyticsContext.botFamily) {
    properties.bot_family = requestAnalyticsContext.botFamily;
  }

  try {
    await recordMirroredAnalyticsEvent(
      buildAnalyticsEventRecord({
        countryCode: requestAnalyticsContext.countryCode,
        deviceType: requestAnalyticsContext.deviceType,
        eventName,
        id: normalizeEventId(body.eventId),
        pathname,
        properties,
        sessionId: body.sessionId,
        source: "client",
        visitorId: body.visitorId
      })
    );
  } catch (error) {
    console.error(
      JSON.stringify({
        level: "error",
        msg: "analytics mirror failed",
        route,
        error: error instanceof Error ? error.message : String(error),
        ms: Date.now() - startedAt
      })
    );

    return emptyResponse();
  }

  console.log(
    JSON.stringify({
      level: "info",
      msg: "analytics mirror done",
      route,
      eventName,
      ms: Date.now() - startedAt
    })
  );

  return emptyResponse();
}

function getRequestAnalyticsContext(request: Request): {
  botFamily?: string;
  countryCode?: string;
  deviceType?: string;
} {
  const botFamily = detectBotFamily(request.headers.get("user-agent"));
  return {
    botFamily,
    countryCode: normalizeCountryCode(request.headers.get("cf-ipcountry")),
    deviceType: botFamily ? "bot" : detectDeviceType(request.headers)
  };
}

function normalizeCountryCode(value: string | null): string | undefined {
  const normalized = value?.trim().toUpperCase();
  if (!normalized || normalized === "XX") return undefined;
  return /^[A-Z]{2}$/.test(normalized) ? normalized : undefined;
}

function detectDeviceType(
  headers: Headers
): "bot" | "desktop" | "mobile" | "unknown" {
  const userAgent = headers.get("user-agent")?.toLowerCase() ?? "";
  if (!userAgent) return "unknown";

  if (
    /(bot|crawler|spider|crawling|slurp|bingpreview|facebookexternalhit|duckduckbot|baiduspider|yandexbot)/i.test(
      userAgent
    )
  ) {
    return "bot";
  }

  const mobileHint = headers.get("sec-ch-ua-mobile");
  if (mobileHint === "?1") return "mobile";
  if (mobileHint === "?0") return "desktop";

  if (
    /(mobile|iphone|ipad|ipod|android|tablet|kindle|silk|opera mini|iemobile)/i.test(
      userAgent
    )
  ) {
    return "mobile";
  }

  return "desktop";
}

function detectBotFamily(userAgentValue: string | null): string | undefined {
  const userAgent = userAgentValue?.toLowerCase() ?? "";
  if (!userAgent) return undefined;
  const families: Array<[string, RegExp]> = [
    ["googlebot", /googlebot|google-inspectiontool/],
    ["bingbot", /bingbot|bingpreview/],
    ["applebot", /applebot/],
    ["duckduckbot", /duckduckbot/],
    ["yandexbot", /yandexbot/],
    ["baiduspider", /baiduspider/],
    ["gptbot", /gptbot|chatgpt-user/],
    ["claudebot", /claudebot|anthropic-ai/],
    ["perplexitybot", /perplexitybot/]
  ];
  for (const [family, pattern] of families) {
    if (pattern.test(userAgent)) return family;
  }
  return /(bot|crawler|spider|crawling|slurp|facebookexternalhit)/.test(userAgent)
    ? "other_bot"
    : undefined;
}

function isTrustedOrigin(request: Request): boolean {
  const trustedOrigins = getTrustedOrigins(request);
  const origin = request.headers.get("origin");
  if (origin) return trustedOrigins.has(origin);

  const referer = request.headers.get("referer");
  if (!referer) return false;

  try {
    return trustedOrigins.has(new URL(referer).origin);
  } catch {
    return false;
  }
}

function getTrustedOrigins(request: Request): Set<string> {
  const origins = new Set<string>([new URL(request.url).origin]);
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  if (siteUrl) {
    try {
      origins.add(new URL(siteUrl).origin);
    } catch {
      // Ignore invalid deployment configuration and fall back to request headers.
    }
  }

  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  const proto = request.headers.get("x-forwarded-proto") ?? "https";
  if (host) origins.add(`${proto}://${host}`);

  return origins;
}

function normalizePathname(pathname: string | undefined): string {
  if (!pathname) return "";
  return pathname.startsWith("/") ? pathname : `/${pathname}`;
}

function normalizeEventId(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized && /^[0-9a-f-]{20,64}$/i.test(normalized)
    ? normalized
    : undefined;
}

function isAnalyticsProperties(
  value: unknown
): value is AnalyticsProperties {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function emptyResponse(): Response {
  return new Response(null, {
    headers: {
      "Cache-Control": "no-store"
    },
    status: 204
  });
}

function errorResponse(
  status: 400 | 403 | 413 | 429,
  headers: Record<string, string> = {}
): NextResponse {
  return NextResponse.json(
    { ok: false },
    {
      headers: {
        "Cache-Control": "no-store",
        ...headers
      },
      status
    }
  );
}

const MAX_ANALYTICS_BODY_BYTES = 8_192;
const ANALYTICS_RATE_LIMIT = 120;
const ANALYTICS_RATE_WINDOW_MS = 60_000;
const analyticsRateBuckets = new Map<string, { count: number; resetAt: number }>();

function consumeAnalyticsRateLimit(request: Request): boolean {
  const address =
    request.headers.get("cf-connecting-ip") ??
    request.headers.get("x-real-ip") ??
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  if (!address) return true;

  const now = Date.now();
  const bucket = analyticsRateBuckets.get(address);
  if (!bucket || bucket.resetAt <= now) {
    analyticsRateBuckets.set(address, { count: 1, resetAt: now + ANALYTICS_RATE_WINDOW_MS });
    return true;
  }
  bucket.count += 1;
  if (analyticsRateBuckets.size > 5_000) {
    for (const [key, value] of analyticsRateBuckets) {
      if (value.resetAt <= now) analyticsRateBuckets.delete(key);
    }
  }
  return bucket.count <= ANALYTICS_RATE_LIMIT;
}
