import { recordAnalyticsEvent } from "@uapt/db";
import { NextResponse } from "next/server";
import {
  buildAnalyticsEventRecord,
  isAnalyticsDatabaseEventName,
  sanitizeAnalyticsProperties,
  type AnalyticsProperties
} from "@/lib/analytics-events";

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

  try {
    await recordAnalyticsEvent(
      buildAnalyticsEventRecord({
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

function isTrustedOrigin(request: Request): boolean {
  const expectedOrigin = new URL(request.url).origin;
  const origin = request.headers.get("origin");
  if (origin) return origin === expectedOrigin;

  const referer = request.headers.get("referer");
  if (!referer) return false;

  try {
    return new URL(referer).origin === expectedOrigin;
  } catch {
    return false;
  }
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
