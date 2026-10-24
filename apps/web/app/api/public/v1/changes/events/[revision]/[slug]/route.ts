import {eventIndexResponse} from "@/lib/change-index-events-api";
import {changeEventsResponse} from "@/lib/change-events-api";
export const dynamic="force-dynamic";
export async function GET(request:Request,{params}:{params:Promise<{revision:string;slug:string}>}) {
  const p=await params,kind=p.slug.replace(/\.json$/, "");
  if(["index","latest","recent"].includes(kind))return eventIndexResponse(request,p.revision,kind as "index"|"latest"|"recent");
  return changeEventsResponse(request,{...p,slug:p.slug.replace(/\.json$/,"")});
}
