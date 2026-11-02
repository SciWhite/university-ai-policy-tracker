import { NextResponse } from "next/server";
import {
  PUBLIC_API_VERSION,
  policyAnalysisProfileResponseSchema,
  publicEntitySummaryResponseSchema,
  publicEntitySummarySchema
} from "@uapt/shared";
import {
  buildPolicyCoverageWidget,
  getPolicyCoverageWidget,
  widgetCorsHeaders
} from "@/lib/developer-surfaces";
import { v6RecordRevision } from "@/lib/v6-effective-records";

export const dynamic = "force-dynamic";

const internalNextBaseUrl = process.env.INTERNAL_NEXT_BASE_URL?.trim();

interface WidgetPolicyCoverageRouteProps {
  params: Promise<{ slug: string }>;
}

export async function GET(
  request: Request,
  { params }: WidgetPolicyCoverageRouteProps
) {
  const { slug: rawSlug } = await params;
  const slug = rawSlug.endsWith(".json") ? rawSlug.slice(0, -".json".length) : rawSlug;

  if (v6RecordRevision(slug)) {
    const payload = await getPolicyCoverageWidget(slug);
    return NextResponse.json(payload ?? { error: "Repair widget unavailable" }, {
      status: payload ? 200 : 503,
      headers: { ...widgetCorsHeaders, "Cache-Control": "private, no-store, no-transform" }
    });
  }

  const [profile, summary] = await Promise.all([
    fetchAnalysisProfile(request.url, slug),
    fetchPublicSummary(request.url, slug)
  ]);
  const payload = profile ? buildPolicyCoverageWidget(profile, summary) : undefined;

  if (!payload) {
    return NextResponse.json(
      { error: `Policy coverage widget not found: ${slug}` },
      { headers: { ...widgetCorsHeaders, "Cache-Control": "no-store" }, status: 404 }
    );
  }

  return NextResponse.json(payload, { headers: widgetCorsHeaders });
}

export function OPTIONS() {
  return new Response(null, { headers: widgetCorsHeaders });
}

async function fetchAnalysisProfile(requestUrl: string, slug: string) {
  const baseUrl = internalNextBaseUrl || requestUrl;
  const response = await fetch(
    new URL(`/api/public/${PUBLIC_API_VERSION}/analysis/universities/${slug}.json`, baseUrl),
    { next: { revalidate: 3600 } }
  );
  if (!response.ok) return undefined;
  const payload = await response.json();
  const envelope = policyAnalysisProfileResponseSchema.safeParse(payload);
  return envelope.success ? envelope.data.data : undefined;
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
