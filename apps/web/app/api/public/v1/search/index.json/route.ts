import { NextResponse } from "next/server";
import { getSearchIndexResponse } from "@/lib/entity-search";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(await getSearchIndexResponse());
}
