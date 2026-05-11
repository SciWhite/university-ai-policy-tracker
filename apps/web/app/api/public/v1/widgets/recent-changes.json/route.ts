import { NextResponse } from "next/server";
import {
  getRecentChangesWidget,
  widgetCorsHeaders
} from "@/lib/developer-surfaces";

export const dynamic = "force-static";

export async function GET() {
  return NextResponse.json(await getRecentChangesWidget(10), {
    headers: widgetCorsHeaders
  });
}

export function OPTIONS() {
  return new Response(null, { headers: widgetCorsHeaders });
}
