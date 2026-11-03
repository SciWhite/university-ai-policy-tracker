import { NextResponse } from "next/server";
import {
  getReleaseClaimSnapshotRows,
  getReleaseSnapshotManifest,
  getReleaseSourceSnapshotRows,
  toJsonLines
} from "@/lib/release-diffs";

interface ReleaseSnapshotArtifactRouteProps {
  params: Promise<{
    artifact: string;
    releaseId: string;
  }>;
}

export const dynamic = "force-static";
export const dynamicParams = true;

export function generateStaticParams() {
  // Preserve every historical URL without rebuilding all historical exports.
  // The immutable GET output is cached on its first request.
  return [];
}

export async function GET(
  _request: Request,
  { params }: ReleaseSnapshotArtifactRouteProps
) {
  const { artifact, releaseId } = await params;

  if (artifact === "claims.jsonl") {
    const rows = await getReleaseClaimSnapshotRows(releaseId);
    if (!rows) return notFound();
    return textResponse(toJsonLines(rows), "application/jsonl");
  }

  if (artifact === "sources.jsonl") {
    const rows = await getReleaseSourceSnapshotRows(releaseId);
    if (!rows) return notFound();
    return textResponse(toJsonLines(rows), "application/jsonl");
  }

  if (artifact === "manifest.json") {
    const manifest = await getReleaseSnapshotManifest(releaseId);
    if (!manifest) return notFound();
    return NextResponse.json(manifest);
  }

  return notFound();
}

function textResponse(content: string, contentType: string): Response {
  return new Response(content, {
    headers: {
      "Content-Type": `${contentType}; charset=utf-8`
    }
  });
}

function notFound(): NextResponse {
  return NextResponse.json({ error: "Release snapshot artifact not found" }, { status: 404 });
}
