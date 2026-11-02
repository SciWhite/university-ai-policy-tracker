import { NextResponse } from "next/server";
import { readPublishedV6 } from "@/lib/policy-v6-published";

export const dynamic = "force-dynamic";

export function GET() {
  const data = readPublishedV6();
  if (!data) return NextResponse.json({ error: "Published V6 pages unavailable" }, { status: 404 });
  return NextResponse.json(data, {
    headers: { "Cache-Control": "private, no-store, no-transform" }
  });
}
