import { NextResponse } from "next/server";
import { getMcpManifestResponse } from "@/lib/developer-surfaces";

export const dynamic = "force-static";

export async function GET() {
  return NextResponse.json(await getMcpManifestResponse());
}
