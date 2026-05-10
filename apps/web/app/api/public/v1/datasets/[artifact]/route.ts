import { NextResponse } from "next/server";
import {
  datasetArtifactRouteSegments,
  getDatasetArtifactByRouteSegment
} from "@/lib/dataset-release";

interface DatasetArtifactRouteProps {
  params: Promise<{
    artifact: string;
  }>;
}

export const dynamic = "force-static";
export const dynamicParams = false;

export function generateStaticParams() {
  return datasetArtifactRouteSegments.map((artifact) => ({ artifact }));
}

export async function GET(
  _request: Request,
  { params }: DatasetArtifactRouteProps
) {
  const { artifact: routeSegment } = await params;
  const artifact = await getDatasetArtifactByRouteSegment(routeSegment);

  if (!artifact) {
    return NextResponse.json(
      { error: "Dataset artifact not found" },
      { status: 404 }
    );
  }

  return new Response(artifact.content, {
    headers: {
      "Content-Disposition": `attachment; filename="${artifact.fileName}"`,
      "Content-Type": `${artifact.mediaType}; charset=utf-8`,
      "X-Checksum-SHA256": artifact.sha256
    }
  });
}
