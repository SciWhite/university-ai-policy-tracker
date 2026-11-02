import { NextResponse } from "next/server";
import { readPublishedV6Revision } from "@/lib/policy-v6-published";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ revision: string }> }) {
  const { revision: rawRevision } = await params;
  const revision = rawRevision.replace(/\.json$/, "");
  const data = readPublishedV6Revision(revision);
  return NextResponse.json(data ?? { error: "Revision not found" }, { status: data ? 200 : 404 });
}
