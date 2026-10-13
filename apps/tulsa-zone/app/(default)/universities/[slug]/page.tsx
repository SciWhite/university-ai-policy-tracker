import UniversityPage,{generateMetadata as metadata} from "../../../../../web/app/(default)/universities/[slug]/page";
import {publishedV6Slugs} from "@/lib/policy-v6-published";
import {notFound} from "next/navigation";
export const dynamic="force-dynamic";
export async function generateMetadata(props:any){if(!publishedV6Slugs.includes((await props.params).slug))notFound();return metadata(props)}
export default async function Page(props:any){if(!publishedV6Slugs.includes((await props.params).slug))notFound();return UniversityPage(props)}
