import {GET as original} from '../../../../web/app/feeds/recent-changes.xml/route';
export const dynamic='force-dynamic';
// The canonical feed already includes corrected records and their actual revisions.
export async function GET(){const response=await original();return new Response(await response.text(),{status:response.status,headers:response.headers})}
