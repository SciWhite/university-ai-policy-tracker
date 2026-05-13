import { NextResponse } from "next/server";
import {
  PUBLIC_API_VERSION,
  publicEntitySummaryResponseSchema,
  publicEntitySummarySchema
} from "@uapt/shared";
import {
  buildReviewStateWidget,
  widgetCorsHeaders
} from "@/lib/developer-surfaces";

export const dynamic = "force-dynamic";

interface WidgetReviewStateRouteProps {
  params: Promise<{
    slug: string;
  }>;
}

export async function GET(
  _request: Request,
  { params }: WidgetReviewStateRouteProps
) {
  const { slug } = await params;
  const universitySlug = slug.endsWith(".json")
    ? slug.slice(0, -".json".length)
    : slug;
  const summary = await fetchPublicSummary(_request.url, universitySlug);
  const payload = summary ? buildReviewStateWidget(summary) : undefined;

  if (!payload) {
    return NextResponse.json(
      { error: `Review state widget not found: ${universitySlug}` },
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

async function fetchPublicSummary(requestUrl: string, slug: string) {
  const response = await fetch(
    new URL(
      `/api/public/${PUBLIC_API_VERSION}/universities/${slug}.json`,
      requestUrl
    ),
    { next: { revalidate: 3600 } }
  );

  if (!response.ok) return undefined;

  const payload = await response.json();
  const envelope = publicEntitySummaryResponseSchema.safeParse(payload);
  if (envelope.success) return envelope.data.data;

  const summary = publicEntitySummarySchema.safeParse(payload);
  return summary.success ? summary.data : undefined;
}
