import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getLocaleFromPathname } from "@/lib/i18n";

export function proxy(request: NextRequest) {
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(
    "x-uapt-locale",
    getLocaleFromPathname(request.nextUrl.pathname)
  );

  return NextResponse.next({
    request: {
      headers: requestHeaders
    }
  });
}

export const config = {
  matcher: "/((?!api|feeds|_next|_vercel|.*\\..*).*)"
};
