import { NextResponse } from "next/server";
import {
  getSourceFreshnessWidget,
  widgetCorsHeaders
} from "@/lib/developer-surfaces";

export const dynamic = "force-dynamic";

interface WidgetSourceFreshnessRouteProps {
  params: Promise<{
    slug: string;
  }>;
}

export async function GET(
  _request: Request,
  { params }: WidgetSourceFreshnessRouteProps
) {
  const { slug } = await params;
  const universitySlug = slug.endsWith(".json")
    ? slug.slice(0, -".json".length)
    : slug;
  const payload = await getSourceFreshnessWidget(universitySlug);

  if (!payload) {
    return NextResponse.json(
      { error: `Source freshness widget not found: ${universitySlug}` },
      {
        headers: {
          ...widgetCorsHeaders,
          "Cache-Control": "no-store"
        },
        status: 404
      }
    );
  }

  return NextResponse.json(payload, { headers: widgetCorsHeaders });
}

export function OPTIONS() {
  return new Response(null, { headers: widgetCorsHeaders });
}
