import { NextResponse } from "next/server";
import {
  PUBLIC_API_VERSION,
  publicEntitySummaryResponseSchema,
  publicEntitySummarySchema
} from "@uapt/shared";
import {
  buildSourceFreshnessWidget,
  widgetCorsHeaders
} from "@/lib/developer-surfaces";

export const dynamic = "force-dynamic";

const internalNextBaseUrl = process.env.INTERNAL_NEXT_BASE_URL?.trim();

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
  const [summary, sourceRows] = await Promise.all([
    fetchPublicSummary(_request.url, universitySlug),
    fetchSourceHealthRows(_request.url, universitySlug)
  ]);
  const payload = summary
    ? buildSourceFreshnessWidget(summary, sourceRows)
    : undefined;

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

async function fetchSourceHealthRows(requestUrl: string, slug: string) {
  const baseUrl = internalNextBaseUrl || requestUrl;
  const response = await fetch(
    new URL(`/api/public/${PUBLIC_API_VERSION}/source-health.json`, baseUrl),
    { next: { revalidate: 3600 } }
  );

  if (!response.ok) return [];

  const payload = (await response.json()) as {
    data?: {
      rows?: Array<{
        entitySlug?: string;
        scope?: string;
        status: string;
      }>;
    };
  };
  const rows = Array.isArray(payload.data?.rows) ? payload.data.rows : [];

  return rows.filter(
    (row) => row.scope === "public_release" && row.entitySlug === slug
  );
}
