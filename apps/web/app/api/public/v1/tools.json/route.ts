import { NextResponse } from "next/server";
import { getPublicToolsResponse } from "@/lib/tool-records";

export const dynamic = "force-static";

export async function GET() {
  return NextResponse.json(await getPublicToolsResponse());
}
