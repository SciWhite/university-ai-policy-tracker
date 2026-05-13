import { NextResponse } from "next/server";
import { getEntityResolutionIndexResponse } from "@/lib/entity-search";

export const dynamic = "force-static";

export async function GET() {
  return NextResponse.json(await getEntityResolutionIndexResponse());
}
