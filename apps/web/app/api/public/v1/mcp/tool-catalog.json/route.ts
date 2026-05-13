import { NextResponse } from "next/server";
import { getMcpToolCatalogResponse } from "@/lib/developer-surfaces";

export const dynamic = "force-static";

export function GET() {
  return NextResponse.json(getMcpToolCatalogResponse());
}
