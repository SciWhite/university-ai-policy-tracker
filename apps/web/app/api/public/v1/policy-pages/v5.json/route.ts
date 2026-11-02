import { NextResponse } from "next/server";
import { readPublishedV6 } from "@/lib/policy-v6-published";

export const dynamic = "force-dynamic";

export function GET() {
  const data = readPublishedV6();
  if (!data) {
    return NextResponse.json({ error: "Published V5 pages unavailable" }, { status: 404 });
  }

  return NextResponse.json({
    schemaVersion: "uapt-bounded-v5-pages-v1",
    releaseId: data.releaseId,
    slugs: data.v5Slugs ?? [],
    presentation: data.v5Presentation
  }, {
    headers: { "Cache-Control": "private, no-store, no-transform" }
  });
}
