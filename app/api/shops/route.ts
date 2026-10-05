import { type NextRequest } from 'next/server';
import { AppError } from '@/lib/model';
import { googleRepository } from '@/lib/google-server';
export const dynamic = 'force-dynamic';
async function handle(request: NextRequest) {
  try {
    if (request.method !== 'GET') {
      const origin = process.env.NEXTAUTH_URL ? new URL(process.env.NEXTAUTH_URL).origin : null;
      if (!origin || request.headers.get('origin') !== origin || !request.headers.get('content-type')?.startsWith('application/json')) throw new AppError('操作元を確認できません。画面を開き直してください。', 403);
    }
    const repository = await googleRepository(request);
    if (request.method === 'GET') return Response.json({ shops: await repository.list() }, { headers: { 'Cache-Control':'no-store' } });
    const text = await request.text();
    if (text.length > 8192) throw new AppError('入力が長すぎます。', 413);
    let body;
    try { body = JSON.parse(text); } catch { throw new AppError('入力形式が不正です。'); }
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new AppError('入力形式が不正です。');
    if (request.method === 'POST') {
      if (body.action === 'fillMissingIds') return Response.json({ count: await repository.fillMissingIds() });
      if (typeof body.url !== 'string') throw new AppError('Google MapsのURLを入力してください。');
      // Author supplied by a client is deliberately ignored; adapter uses server identity.
      return Response.json({ shop: await repository.add({ url: body.url, author:'なおと' }) }, { status:201 });
    }
    if (typeof body.id !== 'string' || body.id.length > 100) throw new AppError('IDが不正です。');
    if (request.method === 'PATCH') {
      if (typeof body.visited !== 'boolean') throw new AppError('訪問状態が不正です。');
      await repository.setVisited(body.id, body.visited);
    } else if (request.method === 'DELETE') await repository.remove(body.id);
    return Response.json({ ok:true });
  } catch (error) {
    const known = error instanceof AppError;
    return Response.json({ error: known ? error.message : '通信に失敗しました。再読み込みして、保存済みか確認してください。', ...(known && error.existing ? { existing:error.existing } : {}) }, { status: known ? error.status : 502 });
  }
}
export { handle as GET, handle as POST, handle as PATCH, handle as DELETE };
