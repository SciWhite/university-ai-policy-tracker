export { proxy } from "../web/proxy";

export const config = {
  matcher: [
    "/internal/analytics",
    "/internal/analytics/:path*",
    "/api/internal/analytics/dashboard",
    "/api/internal/analytics/dashboard/:path*"
  ]
};
