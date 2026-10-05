import type { NextRequest } from 'next/server';
import { dataMode, requireGoogleUser } from '@/lib/auth';
import { AppError, mapsUrl } from '@/lib/model';
import { cachedPreview } from '@/lib/resolve-preview';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function GET(request:NextRequest) {
  try {
    if(dataMode()==='google')await requireGoogleUser(request);
    const input=request.nextUrl.searchParams.get('url');
    if(!input || input.length>4096)throw new AppError('Google MapsのURLを指定してください。');
    const result=await cachedPreview(mapsUrl(input));
    return Response.json(result,{headers:{'Cache-Control':'no-store'}});
  } catch(error) {
    return Response.json({error:error instanceof AppError?error.message:'表示情報を取得できませんでした。'},{status:error instanceof AppError?error.status:502});
  }
}
