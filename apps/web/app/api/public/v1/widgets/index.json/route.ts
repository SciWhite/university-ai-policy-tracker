import { NextResponse } from "next/server";
import {
  getWidgetIndexResponse,
  widgetCorsHeaders
} from "@/lib/developer-surfaces";

export const dynamic = "force-static";

export async function GET() {
  return NextResponse.json(await getWidgetIndexResponse(), {
    headers: widgetCorsHeaders
  });
}

export function OPTIONS() {
  return new Response(null, { headers: widgetCorsHeaders });
}
