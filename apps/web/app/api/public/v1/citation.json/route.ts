import { NextResponse } from "next/server";
import { getCitationMetadataResponse } from "@/lib/developer-surfaces";

export const dynamic = "force-static";

export function GET() {
  return NextResponse.json(getCitationMetadataResponse());
}
