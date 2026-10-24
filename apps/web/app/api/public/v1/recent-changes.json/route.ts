import {eventIndexResponse} from "@/lib/change-index-events-api";
import { NextResponse } from "next/server";
import { getStagedRecentChangesEnvelope } from "@/lib/staged-public-data";

export const dynamic = "force-dynamic";

export async function GET(request?:Request) {
  if(request&&new URL(request.url).searchParams.get("view")==="events")return eventIndexResponse(request,new URL(request.url).searchParams.get("revision")??"","recent");
  return NextResponse.json(await getStagedRecentChangesEnvelope());
}
