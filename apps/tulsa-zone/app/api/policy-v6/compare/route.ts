import {NextResponse} from 'next/server';
import {getPolicyV6School} from '@/lib/policy-v6';
import {isSupportedLocale} from '@/lib/i18n';
export const dynamic='force-dynamic';
export async function GET(request:Request){const q=new URL(request.url).searchParams,slugs=(q.get('slugs')??'').split(','),locale=q.get('locale')??'en';if(!isSupportedLocale(locale)||slugs.length>4||!slugs.length||new Set(slugs).size!==slugs.length||slugs.some(s=>!/^[-a-z0-9]+$/.test(s)||s.length>160))return NextResponse.json({error:'Outside published V6 comparison scope'},{status:400});return NextResponse.json({schools:await Promise.all(slugs.map(s=>getPolicyV6School(locale,s)))},{headers:{'Cache-Control':'private, no-store, no-transform','X-Robots-Tag':'noindex'}})}
