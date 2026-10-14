import Original,{generateMetadata as metadata} from '../../../../../web/app/(default)/analysis/[slug]/page';
import {notFound} from 'next/navigation';
export const dynamic='force-dynamic';
export async function generateMetadata(props:any){if((await props.params).slug!=='university-of-hong-kong')notFound();return metadata(props);}
export default async function Page(props:any){if((await props.params).slug!=='university-of-hong-kong')notFound();return Original(props);}
