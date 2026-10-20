import Page, {generateMetadata as metadata} from "@/app/(default)/rankings/[slug]/page";
export const dynamic="force-dynamic";
async function props(p:any){return {...p,params:Promise.resolve({...await p.params,slug:"qs-2026"})}}
export async function generateMetadata(p:any){return metadata(await props(p))}
export default async function QS(p:any){return Page(await props(p))}
