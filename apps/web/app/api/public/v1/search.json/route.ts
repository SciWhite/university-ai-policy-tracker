import { NextResponse } from "next/server";
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

export async function GET(request: Request) {
  const url = new URL(request.url);
  const query = url.searchParams.get("q") ?? "";
  const limit = Number(url.searchParams.get("limit") ?? 20);
  const records = await fetchSearchIndexRecords(request.url);
  const results = searchIndexRecords(records, query, { limit });

  return NextResponse.json(buildSearchResponse(query, results), {
    headers: searchCorsHeaders
  });
}

export function OPTIONS() {
  return new Response(null, { headers: searchCorsHeaders });
}

async function fetchSearchIndexRecords(requestUrl: string): Promise<SearchIndexRecord[]> {
  const response = await fetch(
    new URL("/api/public/v1/search/index.json", requestUrl),
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
