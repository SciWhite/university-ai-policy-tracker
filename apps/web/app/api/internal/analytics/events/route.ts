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
  eventName?: string;
  pathname?: string;
  properties?: AnalyticsProperties;
  sessionId?: string;
  source?: string;
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

  let body: AnalyticsMirrorRequestBody;
  try {
    body = (await request.json()) as AnalyticsMirrorRequestBody;
  } catch {
    return errorResponse(400);
  }

  const eventName =
    typeof body.eventName === "string" ? body.eventName.trim() : "";
  const pathname =
    typeof body.pathname === "string" ? normalizePathname(body.pathname) : "";
  const source = typeof body.source === "string" ? body.source.trim() : "client";

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

  try {
    await recordMirroredAnalyticsEvent(
      buildAnalyticsEventRecord({
        countryCode: requestAnalyticsContext.countryCode,
        deviceType: requestAnalyticsContext.deviceType,
        eventName,
        pathname,
        properties,
        sessionId: body.sessionId,
        source,
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
  countryCode?: string;
  deviceType?: string;
} {
  return {
    countryCode: normalizeCountryCode(request.headers.get("cf-ipcountry")),
    deviceType: detectDeviceType(request.headers)
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

function errorResponse(status: 400 | 403): NextResponse {
  return NextResponse.json(
    { ok: false },
    {
      headers: {
        "Cache-Control": "no-store"
      },
      status
    }
  );
}
