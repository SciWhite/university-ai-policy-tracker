import Original,{generateMetadata as metadata} from "../../../../../web/app/(default)/changes/[releaseId]/page";
import {V6ChangeNote} from "@zone/components/v6-change-note";
export const dynamic="force-dynamic";
export async function generateMetadata(props:any){const p=await props.params;return p.releaseId==="v6-pages-20261013"?{title:"V6 reviewed page supplement release | University AI Policy Tracker"}:metadata(props)}
export default async function Page(props:any){const p=await props.params;if(p.releaseId==="v6-pages-20261013")return <main><V6ChangeNote locale={p.locale}/></main>;return <><V6ChangeNote locale={p.locale} slug={p.releaseId}/>{await Original(props)}</>}
