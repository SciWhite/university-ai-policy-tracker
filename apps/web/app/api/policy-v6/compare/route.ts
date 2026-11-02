// Share the published V6 comparison handler with the existing V6 runtime zone.
import { GET as compare } from "../../../../../tulsa-zone/app/api/policy-v6/compare/route";
export const dynamic = "force-dynamic";
export function GET(request: Request) {
  return compare(request);
}
