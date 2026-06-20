import { NextResponse } from "next/server";
import {
  getCountBucket,
  getLimitBucket,
  getQueryAnalytics
} from "@/lib/analytics-events";
import { trackServerResearchEvent } from "@/lib/analytics-server";
import {
  buildSearchResponse,
  searchIndexRecords,
  type SearchIndexRecord
} from "@/lib/entity-search";

export const dynamic = "force-dynamic";

const searchCorsHeaders = {
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Origin": "*"
};
const internalNextBaseUrl = process.env.INTERNAL_NEXT_BASE_URL?.trim();

export async function GET(request: Request) {
  const url = new URL(request.url);
  const query = url.searchParams.get("q") ?? "";
  const limit = Number(url.searchParams.get("limit") ?? 20);
  const records = await fetchSearchIndexRecords(request.url);
  const results = searchIndexRecords(records, query, { limit });
  await trackServerResearchEvent("api_search_request", {
    ...getQueryAnalytics(query),
    limit_bucket: getLimitBucket(limit),
    result_count_bucket: getCountBucket(results.length)
  }, "/api/public/v1/search.json");

  return NextResponse.json(buildSearchResponse(query, results), {
    headers: searchCorsHeaders
  });
}

export function OPTIONS() {
  return new Response(null, { headers: searchCorsHeaders });
}

async function fetchSearchIndexRecords(requestUrl: string): Promise<SearchIndexRecord[]> {
  const baseUrl = internalNextBaseUrl || requestUrl;
  const response = await fetch(
    new URL("/api/public/v1/search/index.json", baseUrl),
    { next: { revalidate: 3600 } }
  );

  if (!response.ok) return [];

  const payload = (await response.json()) as {
    data?: {
      records?: SearchIndexRecord[];
    };
  };

  return Array.isArray(payload.data?.records) ? payload.data.records : [];
}
