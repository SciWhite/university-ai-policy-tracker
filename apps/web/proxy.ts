import { NextResponse, type NextRequest } from "next/server";
import {
  isMultilingualPhaseTwoEnabled,
  isPhaseTwoLocalizablePath,
  stripLocalePrefix
} from "@/lib/i18n";

const PRIVATE_ANALYTICS_USERNAME = "uapt";
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MS = 15 * 60 * 1000;

interface AuthFailureState {
  attempts: number;
  lastAttemptAt: number;
  lockedUntil?: number;
}

const authFailures = new Map<string, AuthFailureState>();

export function proxy(request: NextRequest) {
  const localizedPath = stripLocalePrefix(request.nextUrl.pathname);

  if (localizedPath.hadLocalePrefix) {
    if (
      !isMultilingualPhaseTwoEnabled() &&
      isPhaseTwoLocalizablePath(localizedPath.pathname)
    ) {
      return new NextResponse("Not Found", {
        headers: { "Cache-Control": "no-store" },
        status: 404
      });
    }

    return NextResponse.next();
  }

  const token =
    process.env.INTERNAL_ANALYTICS_PASSWORD?.trim() ??
    process.env.INGESTION_TOKEN?.trim() ??
    "";

  if (!token && process.env.NODE_ENV !== "production") {
    return NextResponse.next();
  }

  const auth = request.headers.get("authorization");
  const credentials = parseBasicAuth(auth);
  const failureKey = getFailureKey(request, credentials?.username);
  const lockedUntil = getLockedUntil(failureKey);

  if (lockedUntil) {
    return lockedResponse(lockedUntil);
  }

  if (
    !credentials ||
    credentials.username !== PRIVATE_ANALYTICS_USERNAME ||
    credentials.password !== token
  ) {
    recordFailedAttempt(failureKey);
    return unauthorizedResponse();
  }

  authFailures.delete(failureKey);
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/:locale(zh|fr|pl|es|nl|ms)/:path*",
    "/internal/analytics/:path*",
    "/api/internal/analytics/dashboard/:path*"
  ]
};

function parseBasicAuth(
  header: string | null
): { password: string; username: string } | null {
  if (!header || !header.startsWith("Basic ")) return null;

  try {
    const encoded = header.slice("Basic ".length).trim();
    const decoded = atob(encoded);
    const separatorIndex = decoded.indexOf(":");

    if (separatorIndex <= 0) return null;

    return {
      password: decoded.slice(separatorIndex + 1),
      username: decoded.slice(0, separatorIndex)
    };
  } catch {
    return null;
  }
}

function unauthorizedResponse() {
  return new NextResponse("Unauthorized", {
    headers: {
      "Cache-Control": "no-store",
      "WWW-Authenticate": 'Basic realm="Private analytics", charset="UTF-8"'
    },
    status: 401
  });
}

function lockedResponse(lockedUntil: number) {
  const retryAfterSeconds = Math.max(
    1,
    Math.ceil((lockedUntil - Date.now()) / 1000)
  );

  return new NextResponse("Too many failed login attempts", {
    headers: {
      "Cache-Control": "no-store",
      "Retry-After": String(retryAfterSeconds)
    },
    status: 429
  });
}

function getFailureKey(request: NextRequest, username: string | undefined) {
  const forwardedFor = request.headers.get("x-forwarded-for");
  const clientIp =
    forwardedFor?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown";

  return `${clientIp}:${username || "unknown"}`;
}

function getLockedUntil(key: string) {
  const now = Date.now();
  const state = authFailures.get(key);

  if (!state) return null;

  if (state.lockedUntil && state.lockedUntil > now) {
    return state.lockedUntil;
  }

  if (now - state.lastAttemptAt > LOCKOUT_MS) {
    authFailures.delete(key);
  }

  return null;
}

function recordFailedAttempt(key: string) {
  const now = Date.now();
  const current = authFailures.get(key);
  const attempts =
    current && now - current.lastAttemptAt <= LOCKOUT_MS
      ? current.attempts + 1
      : 1;

  authFailures.set(key, {
    attempts,
    lastAttemptAt: now,
    lockedUntil: attempts >= MAX_FAILED_ATTEMPTS ? now + LOCKOUT_MS : undefined
  });
}
