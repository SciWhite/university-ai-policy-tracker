import {eventIndexResponse} from "@/lib/change-index-events-api";
import { NextResponse } from "next/server";
import { getLatestReleaseDiff } from "@/lib/release-diffs";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if(new URL(request.url).searchParams.get("view")==="events")return eventIndexResponse(request,new URL(request.url).searchParams.get("revision")??"","latest");
  return NextResponse.json(await getLatestReleaseDiff());
}
