import {
  buildPublicUniversityListResponse,
  buildSeedPublicEntitySummaries
} from "@uapt/shared";
import { NextResponse } from "next/server";
import { getSiteBaseUrl } from "../../../../../lib/site-url";

export function GET() {
  const siteBaseUrl = getSiteBaseUrl();
  const summaries = buildSeedPublicEntitySummaries(siteBaseUrl);

  return NextResponse.json(
    buildPublicUniversityListResponse(summaries, siteBaseUrl)
  );
}
