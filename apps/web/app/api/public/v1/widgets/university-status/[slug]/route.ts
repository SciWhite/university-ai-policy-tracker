import { NextResponse } from "next/server";
import {
  PUBLIC_API_VERSION,
  publicEntitySummaryResponseSchema,
  publicEntitySummarySchema
} from "@uapt/shared";
import {
  buildUniversityStatusWidget,
  getUniversityStatusWidget,
  widgetCorsHeaders
} from "@/lib/developer-surfaces";
import { v6RecordRevision } from "@/lib/v6-effective-records";

export const dynamic = "force-dynamic";

const internalNextBaseUrl = process.env.INTERNAL_NEXT_BASE_URL?.trim();

interface WidgetRouteProps {
  params: Promise<{ slug: string }>;
}

export async function GET(request: Request, { params }: WidgetRouteProps) {
  const { slug: rawSlug } = await params;
  const slug = rawSlug.endsWith(".json") ? rawSlug.slice(0, -".json".length) : rawSlug;
  if (v6RecordRevision(slug)) {
    const payload = await getUniversityStatusWidget(slug);
    return NextResponse.json(payload ?? { error: "Repair widget unavailable" }, {
      status: payload ? 200 : 503,
      headers: { ...widgetCorsHeaders, "Cache-Control": "private, no-store, no-transform" }
    });
  }

  const summary = await fetchPublicSummary(request.url, slug);
  if (!summary) {
    return NextResponse.json(
      { error: `University not found: ${slug}` },
      { headers: { ...widgetCorsHeaders, "Cache-Control": "no-store" }, status: 404 }
    );
  }
  return NextResponse.json(buildUniversityStatusWidget(summary), { headers: widgetCorsHeaders });
}

export function OPTIONS() {
  return new Response(null, { headers: widgetCorsHeaders });
}

async function fetchPublicSummary(requestUrl: string, slug: string) {
  const baseUrl = internalNextBaseUrl || requestUrl;
  const response = await fetch(
    new URL(`/api/public/${PUBLIC_API_VERSION}/universities/${slug}.json`, baseUrl),
    { next: { revalidate: 3600 } }
  );
  if (!response.ok) return undefined;
  const payload = await response.json();
  const envelope = publicEntitySummaryResponseSchema.safeParse(payload);
  if (envelope.success) return envelope.data.data;
  const summary = publicEntitySummarySchema.safeParse(payload);
  return summary.success ? summary.data : undefined;
}
