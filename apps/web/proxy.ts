import { NextResponse, type NextRequest } from "next/server";

const PRIVATE_ANALYTICS_USERNAME = "uapt";

export function proxy(request: NextRequest) {
  const token =
    process.env.INTERNAL_ANALYTICS_PASSWORD?.trim() ??
    process.env.INGESTION_TOKEN?.trim() ??
    "";

  if (!token && process.env.NODE_ENV !== "production") {
    return NextResponse.next();
  }

  const auth = request.headers.get("authorization");
  const credentials = parseBasicAuth(auth);

  if (
    !credentials ||
    credentials.username !== PRIVATE_ANALYTICS_USERNAME ||
    credentials.password !== token
  ) {
    return unauthorizedResponse();
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/internal/analytics/:path*"]
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
