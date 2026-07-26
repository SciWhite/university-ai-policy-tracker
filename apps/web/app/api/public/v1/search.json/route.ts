import { NextResponse, after } from "next/server";
import {
  getCountBucket,
  getLimitBucket,
  getQueryAnalytics
} from "@/lib/analytics-events";
import {
  getLatencyBucket,
  getServerRequestAnalytics,
  trackServerResearchEvent
} from "@/lib/analytics-server";
import {
  buildSearchResponse,
  getSearchIndexRecords,
  searchIndexRecords
} from "@/lib/entity-search";

export const dynamic = "force-dynamic";

const searchCorsHeaders = {
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Origin": "*"
};

export async function GET(request: Request) {
  const startedAt = Date.now();
  const url = new URL(request.url);
  const query = url.searchParams.get("q") ?? "";
  const limit = Number(url.searchParams.get("limit") ?? 20);
  const records = await getSearchIndexRecords();
  const results = searchIndexRecords(records, query, { limit });
  const analytics = {
    ...getQueryAnalytics(query),
    ...getServerRequestAnalytics(request),
    limit_bucket: getLimitBucket(limit),
    request_latency_bucket: getLatencyBucket(Date.now() - startedAt),
    result_count_bucket: getCountBucket(results.length)
  };
  // Mirror analytics after the response is sent; the write must never add
  // latency to the suggestion hot path.
  after(() =>
    trackServerResearchEvent(
      "api_search_request",
      analytics,
      "/api/public/v1/search.json"
    )
  );

  return NextResponse.json(buildSearchResponse(query, results), {
    headers: searchCorsHeaders
  });
}

export function OPTIONS() {
  return new Response(null, { headers: searchCorsHeaders });
}
