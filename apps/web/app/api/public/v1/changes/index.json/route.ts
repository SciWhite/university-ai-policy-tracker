import {eventIndexResponse} from "@/lib/change-index-events-api";
import { NextResponse } from "next/server";
import { getChangeIndexResponse } from "@/lib/change-records";

export const dynamic = "force-dynamic";

export async function GET(request?:Request) {
  if(request&&new URL(request.url).searchParams.get("view")==="events")return eventIndexResponse(request,new URL(request.url).searchParams.get("revision")??"","index");
  return NextResponse.json(await getChangeIndexResponse());
}
