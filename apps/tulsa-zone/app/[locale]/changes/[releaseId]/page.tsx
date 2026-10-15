import {ImperialUxChangeNote} from "@zone/components/imperial-ux-change-note";
import {MitStudentGuideChangeNote} from "@zone/components/mit-student-guide-change-note";
import Original,{generateMetadata as metadata} from "../../../../../web/app/(default)/changes/[releaseId]/page";
import {readPublishedV6Revision} from "@/lib/policy-v6-published";
import {V6ChangeNote} from "@zone/components/v6-change-note";
export const dynamic="force-dynamic";
export async function generateMetadata(props:any){const p=await props.params;return !!readPublishedV6Revision(p.releaseId)?{title:(readPublishedV6Revision(p.releaseId)?.v5Slugs?.length?"V5 policy evidence release":"V6 reviewed page supplement release")+" | University AI Policy Tracker"}:metadata(props)}
export default async function Page(props:any){const p=await props.params;if(!!readPublishedV6Revision(p.releaseId))return <main><V6ChangeNote locale={p.locale} revision={p.releaseId}/></main>;return <>{p.releaseId==="massachusetts-institute-of-technology"?<MitStudentGuideChangeNote locale={p.locale}/>:null}{p.releaseId==="imperial-college-london"?<ImperialUxChangeNote locale={p.locale}/>:null}<V6ChangeNote locale={p.locale} slug={p.releaseId}/>{await Original(props)}</>}
