import { NextResponse } from "next/server";
import {
  PUBLIC_API_VERSION,
  publicEntitySummaryResponseSchema,
  publicEntitySummarySchema
} from "@uapt/shared";
import {
  buildUniversityStatusWidget,
  widgetCorsHeaders
} from "@/lib/developer-surfaces";

export const dynamic = "force-dynamic";

const internalNextBaseUrl = process.env.INTERNAL_NEXT_BASE_URL?.trim();

interface WidgetStatusRouteProps {
  params: Promise<{
    slug: string;
  }>;
}

export async function GET(_request: Request, { params }: WidgetStatusRouteProps) {
  const { slug } = await params;
  const universitySlug = slug.endsWith(".json")
    ? slug.slice(0, -".json".length)
    : slug;
  const summary = await fetchPublicSummary(_request.url, universitySlug);

  if (!summary) {
    return NextResponse.json(
      { error: `University not found: ${universitySlug}` },
      {
        headers: {
          ...widgetCorsHeaders,
          "Cache-Control": "no-store"
        },
        status: 404
      }
    );
  }

  return NextResponse.json(buildUniversityStatusWidget(summary), {
    headers: widgetCorsHeaders
  });
}

export function OPTIONS() {
  return new Response(null, { headers: widgetCorsHeaders });
}

async function fetchPublicSummary(requestUrl: string, slug: string) {
  const baseUrl = internalNextBaseUrl || requestUrl;
  const response = await fetch(
    new URL(
      `/api/public/${PUBLIC_API_VERSION}/universities/${slug}.json`,
      baseUrl
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
