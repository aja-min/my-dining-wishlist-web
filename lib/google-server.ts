import 'server-only';
import { AppError } from './model';
import { SheetsRepository } from './sheets-repository';
import { requireGoogleUser } from './auth';
import type { NextRequest } from 'next/server';
export async function googleRepository(request: NextRequest) {
  const user = await requireGoogleUser(request);
  const id = process.env.GOOGLE_SPREADSHEET_ID;
  const tab = process.env.GOOGLE_SHEET_TAB;
  if (!id || !/^[a-zA-Z0-9_-]+$/.test(id) || !tab) throw new AppError('スプレッドシートID・タブ名を設定してください。', 503);
  return new SheetsRepository(async (suffix, init) => {
    const response = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${id}${suffix}`, {
      ...init, headers: { Authorization: `Bearer ${user.accessToken}`, 'Content-Type':'application/json' }, cache:'no-store', signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) {
      if (response.status === 401) throw new AppError('Googleの接続期限が切れました。再ログインしてください。', 401);
      if (response.status === 403) throw new AppError('Google Sheetsの操作が許可されていません。このアカウントへの編集共有・OAuthの同意・Sheets APIの有効化を確認してください。', 403);
      if (response.status === 404) throw new AppError('設定したスプレッドシートまたはタブが見つかりません。', 404);
      throw new AppError('Google Sheetsへの通信に失敗しました。再読み込みして状態を確認してください。', 502);
    }
    return response.json();
  }, tab, user.author);
}
