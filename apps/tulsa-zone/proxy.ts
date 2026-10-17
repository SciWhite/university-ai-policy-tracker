import type { NextRequest } from "next/server";
import { proxy as webProxy } from "../web/proxy";

export function proxy(request: NextRequest) {
  return webProxy(request);
}

export const config = {
  matcher: [
    "/internal/analytics",
    "/internal/analytics/:path*",
    "/api/internal/analytics/dashboard",
    "/api/internal/analytics/dashboard/:path*"
  ]
};
