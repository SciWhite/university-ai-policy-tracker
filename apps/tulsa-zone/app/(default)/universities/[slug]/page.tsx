import {redirectAliasSlugPage} from "@/lib/entity-alias-redirect";
import {normalizeLocale} from "@/lib/i18n";
import identityAliases from "@/lib/university-slug-aliases.json";
const identitySlugs=Object.values(identityAliases.aliases);
import UniversityPage,{generateMetadata as metadata} from "../../../../../web/app/(default)/universities/[slug]/page";
import {publishedV5Slugs} from "@/lib/policy-v6-published-gate";
import {publishedV6Slugs} from "@/lib/policy-v6-published";
import {notFound} from "next/navigation";
export const dynamic="force-dynamic";
export async function generateMetadata(props:any){const p=await props.params;await redirectAliasSlugPage(p.slug,normalizeLocale(p.locale),s=>`/universities/${s}`);if(![...publishedV6Slugs,...publishedV5Slugs,...identitySlugs].includes((await props.params).slug))notFound();return metadata(props)}
export default async function Page(props:any){const p=await props.params;await redirectAliasSlugPage(p.slug,normalizeLocale(p.locale),s=>`/universities/${s}`);if(![...publishedV6Slugs,...publishedV5Slugs,...identitySlugs].includes((await props.params).slug))notFound();return UniversityPage(props)}
