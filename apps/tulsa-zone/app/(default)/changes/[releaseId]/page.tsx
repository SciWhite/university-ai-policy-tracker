import Original,{generateMetadata as metadata} from "../../../../../web/app/(default)/changes/[releaseId]/page";
import {readPublishedV6Revision} from "@/lib/policy-v6-published";
import {V6ChangeNote} from "@zone/components/v6-change-note";
export const dynamic="force-dynamic";
export async function generateMetadata(props:any){const p=await props.params;return !!readPublishedV6Revision(p.releaseId)?{title:"V6 reviewed page supplement release | University AI Policy Tracker"}:metadata(props)}
export default async function Page(props:any){const p=await props.params;if(!!readPublishedV6Revision(p.releaseId))return <main><V6ChangeNote locale={p.locale} revision={p.releaseId}/></main>;return <><V6ChangeNote locale={p.locale} slug={p.releaseId}/>{await Original(props)}</>}
