import 'server-only';
import { JWT } from 'google-auth-library';
import { AppError } from './model';
let client: JWT | undefined;
export async function sheetsAccessToken(): Promise<string> {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const key = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, '\n');
  if (!email || !key) throw new AppError('Google Sheetsへの接続設定が不足しています。管理者に確認してください。', 503);
  try {
    client ??= new JWT({ email, key, scopes: ['https://www.googleapis.com/auth/spreadsheets'] });
    const result = await client.getAccessToken();
    if (!result.token) throw new Error('Missing access token');
    return result.token;
  } catch { throw new AppError('Google Sheetsへの接続認証に失敗しました。管理者に確認してください。', 503); }
}
