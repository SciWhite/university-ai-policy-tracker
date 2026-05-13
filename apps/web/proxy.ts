import { NextResponse, type NextRequest } from "next/server";

export function proxy(request: NextRequest) {
  const url = request.nextUrl.clone();

  if (url.pathname === "/coverage") {
    url.pathname = "/coverage-dashboard";
    return NextResponse.rewrite(url);
  }

  if (url.pathname === "/coverage/qs-2026") {
    url.pathname = "/coverage-dashboard/qs-2026";
    return NextResponse.rewrite(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/coverage", "/coverage/qs-2026"]
};
