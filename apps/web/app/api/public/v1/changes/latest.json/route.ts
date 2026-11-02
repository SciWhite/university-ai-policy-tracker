import {eventIndexResponse} from "@/lib/change-index-events-api";
import { NextResponse } from "next/server";
import { getLatestReleaseDiff } from "@/lib/release-diffs";
import { readV6RecordCorrections } from "@/lib/v6-effective-records";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if(new URL(request.url).searchParams.get("view")==="events")return eventIndexResponse(request,new URL(request.url).searchParams.get("revision")??"","latest");
  const correction = readV6RecordCorrections();
  return NextResponse.json({
    ...await getLatestReleaseDiff(),
    ...(correction ? {
      scopedRecordCorrection: {
        revision: correction.revision,
        publishedAt: correction.publishedAt,
        changes: correction.changesBySlug
      }
    } : {})
  });
}
