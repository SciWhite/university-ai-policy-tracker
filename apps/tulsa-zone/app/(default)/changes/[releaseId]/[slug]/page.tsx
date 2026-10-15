import Original,{generateMetadata as metadata} from "../../../../../../web/app/(default)/changes/[releaseId]/[slug]/page";
import {V6ChangeDetail} from "@zone/components/v6-change-detail";
import {readPublishedV6Revision} from "@/lib/policy-v6-published";
import {V6ChangeNote} from "@zone/components/v6-change-note";
import {publishedV6School,publishedV6Bundle,publishedV6Evidence,publishedV6Slugs} from "@/lib/policy-v6-published";
import {notFound} from "next/navigation";
export const dynamic="force-dynamic";
export async function generateMetadata(props:any){const p=await props.params;return !!readPublishedV6Revision(p.releaseId)?{title:p.slug+" policy evidence history | University AI Policy Tracker"}:metadata(props)}
export default async function Page(props:any){const p=await props.params;if(!readPublishedV6Revision(p.releaseId))return Original(props);if(![...publishedV6Slugs,...(readPublishedV6Revision(p.releaseId)?.v5Slugs??[])].includes(p.slug))notFound();return <V6ChangeDetail revision={p.releaseId} slug={p.slug} locale={p.locale}/>}
