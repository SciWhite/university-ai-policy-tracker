import {revalidatePath} from 'next/cache';
import {timingSafeEqual} from 'node:crypto';
export async function POST(request:Request){
 const token=process.env.UAPT_TULSA_REFRESH_TOKEN;const sent=request.headers.get('authorization')?.replace(/^Bearer /,'');
 if(!token||!sent||Buffer.byteLength(token)!==Buffer.byteLength(sent)||!timingSafeEqual(Buffer.from(token),Buffer.from(sent)))return Response.json({error:'unauthorized'},{status:401});
 const paths=['','/zh','/fr','/pl','/es','/nl','/ms'].map(l=>l+'/universities/university-of-tulsa');
 for(const p of paths)revalidatePath(p);return Response.json({paths});
}
