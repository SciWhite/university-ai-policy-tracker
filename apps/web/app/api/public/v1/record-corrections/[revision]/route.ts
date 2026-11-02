import { NextResponse } from "next/server";
import {
  readV6RecordCorrectionRevision,
  readV6RecordCorrections
} from "@/lib/v6-effective-records";

export const dynamic = "force-dynamic";

interface RecordCorrectionRouteProps {
  params: Promise<{ revision: string }>;
}

export async function GET(_request: Request, { params }: RecordCorrectionRouteProps) {
  const { revision: rawRevision } = await params;
  const revision = rawRevision.replace(/\.json$/, "");
  const selected = revision === "latest"
    ? readV6RecordCorrections()
    : readV6RecordCorrectionRevision(revision);

  if (!selected) {
    return NextResponse.json({ error: "Correction revision not found" }, { status: 404 });
  }

  return NextResponse.json({
    schemaVersion: "uapt-scoped-record-diff-v1",
    revision: selected.revision,
    datasetReleaseId: selected.datasetReleaseId,
    publishedAt: selected.publishedAt,
    changes: selected.changesBySlug
  });
}
