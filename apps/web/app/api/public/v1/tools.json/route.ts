import { NextResponse } from "next/server";
import { getPublicToolsResponse } from "@/lib/tool-records";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(await getPublicToolsResponse());
}
