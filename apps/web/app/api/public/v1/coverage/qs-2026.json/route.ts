import { NextResponse } from "next/server";
import {
  buildCoverageApiResponse,
  getCoverageDashboardData
} from "@/lib/review-dashboards";
import { readV6RecordCorrections } from "@/lib/v6-effective-records";
import { withIndexProvenance } from "@/lib/index-provenance";

export const dynamic = "force-dynamic";

export async function GET() {
  const body = buildCoverageApiResponse(await getCoverageDashboardData()) as Record<string, unknown>;
  body.datasetGeneratedAt = body.generatedAt;
  body.generatedAt = new Date().toISOString();
  body.timestampSemantics = {
    generatedAt: "Response composition time; not evidence retrieval or policy effective date.",
    datasetGeneratedAt: "Historical base dataset publication time.",
    "appliedRecordCorrection.recordedAt": "Scoped record/package correction time; not policy effective date."
  };
  const indexed = withIndexProvenance(
    body as Record<string, unknown> & { generatedAt: string },
    readV6RecordCorrections()
  );
  indexed.baselineGeneratedAt = body.datasetGeneratedAt;
  indexed.generatedAtMeaning = "response_composition";
  return NextResponse.json(indexed, {
    headers: { "Cache-Control": "private, no-store, no-transform" }
  });
}
