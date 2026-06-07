import { NextResponse } from "next/server";
import { getChangeIndexResponse } from "@/lib/change-records";

export const dynamic = "force-static";

export async function GET() {
  return NextResponse.json(await getChangeIndexResponse());
}
