import {createHash} from 'node:crypto';
import {NextResponse} from 'next/server';
import {RateLimiter,getClientKey} from '@/lib/rateLimit';
import {getPublicProtoWordById,type PublicProtoWordDetail} from './proto';
const limiter=new RateLimiter({windowMs:60000,maxRequests:120});
const headers={'Access-Control-Allow-Origin':'*','X-Content-Type-Options':'nosniff','Cache-Control':'public, max-age=3600'};
export async function csProto(request:Request,rawId:string,lookup:(id:number)=>Promise<PublicProtoWordDetail|null>=getPublicProtoWordById):Promise<Response>{
 const id=Number(rawId);if(!/^\d+$/.test(rawId)||!Number.isSafeInteger(id)||id<=0)return NextResponse.json({error:{code:'bad_request',message:'Invalid article ID'}},{status:400,headers});
 const rate=limiter.check(getClientKey(request.headers));if(rate.limited)return NextResponse.json({error:{code:'rate_limited',message:'Try again later'}},{status:429,headers:{...headers,'Cache-Control':'no-store','Retry-After':String(rate.retryAfterSeconds)}});
 try{const row=await lookup(id);const safe=row?{id:row.id,lemma:row.lemma,body:row.body,sourceUrl:row.sourceUrl,morphemes:row.morphemes.map(m=>({value:m.value,meaning:m.meaning})),bodySha256:createHash('sha256').update(row.body).digest('hex')}:null;return NextResponse.json(safe??{error:{code:'not_found',message:'Article not found'}},{status:row?200:404,headers});}
 catch{return NextResponse.json({error:{code:'unavailable',message:'Etymologies unavailable'}},{status:503,headers:{...headers,'Cache-Control':'no-store'}});}
}
