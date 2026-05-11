import { NextResponse } from "next/server";
import {
  PUBLIC_API_VERSION,
  publicRecentChangesEnvelopeSchema,
  publicRecentChangesResponseSchema
} from "@uapt/shared";
import {
  buildRecentChangesWidgetFromPublicChanges,
  widgetCorsHeaders
} from "@/lib/developer-surfaces";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const changes = await fetchRecentChanges(request.url);

  return NextResponse.json(buildRecentChangesWidgetFromPublicChanges(changes, 10), {
    headers: widgetCorsHeaders
  });
}

export function OPTIONS() {
  return new Response(null, { headers: widgetCorsHeaders });
}

async function fetchRecentChanges(requestUrl: string) {
  const response = await fetch(
    new URL(`/api/public/${PUBLIC_API_VERSION}/recent-changes.json`, requestUrl),
    { next: { revalidate: 3600 } }
  );

  if (!response.ok) return [];

  const payload = await response.json();
  const envelope = publicRecentChangesEnvelopeSchema.safeParse(payload);
  if (envelope.success) return envelope.data.data.changes;

  const direct = publicRecentChangesResponseSchema.safeParse(payload);
  return direct.success ? direct.data.changes : [];
}
