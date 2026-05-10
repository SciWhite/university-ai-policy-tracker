import { buildPublicApiIndexResponse } from "@uapt/shared";
import { NextResponse } from "next/server";
import { getSiteBaseUrl } from "../../../../../lib/site-url";

export const dynamic = "force-static";

export function GET() {
  return NextResponse.json(buildPublicApiIndexResponse(getSiteBaseUrl()));
}
