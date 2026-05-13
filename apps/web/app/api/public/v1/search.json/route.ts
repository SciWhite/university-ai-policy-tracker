import { NextResponse } from "next/server";
import { getSearchResponse } from "@/lib/entity-search";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const query = url.searchParams.get("q") ?? "";
  const limit = Number(url.searchParams.get("limit") ?? 20);

  return NextResponse.json(await getSearchResponse(query, { limit }));
}
