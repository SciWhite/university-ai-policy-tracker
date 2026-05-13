import { NextResponse } from "next/server";
import {
  getPolicyCoverageWidget,
  widgetCorsHeaders
} from "@/lib/developer-surfaces";

export const dynamic = "force-dynamic";

interface WidgetPolicyCoverageRouteProps {
  params: Promise<{
    slug: string;
  }>;
}

export async function GET(
  _request: Request,
  { params }: WidgetPolicyCoverageRouteProps
) {
  const { slug } = await params;
  const universitySlug = slug.endsWith(".json")
    ? slug.slice(0, -".json".length)
    : slug;
  const payload = await getPolicyCoverageWidget(universitySlug);

  if (!payload) {
    return NextResponse.json(
      { error: `Policy coverage widget not found: ${universitySlug}` },
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
