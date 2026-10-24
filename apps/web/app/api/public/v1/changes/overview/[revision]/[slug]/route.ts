import {changeEventsResponse} from "@/lib/change-events-api";
export const dynamic="force-dynamic";
export async function GET(request:Request,{params}:{params:Promise<{revision:string;slug:string}>}) {
  const p=await params;return changeEventsResponse(request,{...p,slug:p.slug.replace(/\.json$/,""),kind:"overview"});
}
