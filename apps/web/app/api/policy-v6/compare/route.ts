// Local web preview uses the same comparison handler as the existing V6 zone.
// Production routing stays owned by the V6 runtime zone.
import { GET as compare } from "../../../../../tulsa-zone/app/api/policy-v6/compare/route";
export const dynamic = "force-dynamic";
export function GET(request: Request) {
  if (process.env.NODE_ENV !== "development")
    return new Response(null, { status: 404 });
  return compare(request);
}
