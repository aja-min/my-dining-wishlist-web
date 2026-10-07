import type { JWT } from 'next-auth/jwt';
export const SHEETS_SCOPE = 'https://www.googleapis.com/auth/spreadsheets';
export async function refreshGoogleToken(token: JWT, clientId: string, clientSecret: string, fetcher: typeof fetch = fetch, now = Date.now()): Promise<JWT> {
  if (typeof token.accessToken === 'string' && typeof token.accessExpires === 'number' && now < token.accessExpires - 60_000) return token;
  if (typeof token.refreshToken !== 'string') return { ...token, accessToken: undefined, authError: 'ReconnectRequired' };
  try {
    const response = await fetcher('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, grant_type: 'refresh_token', refresh_token: token.refreshToken }), cache: 'no-store', signal: AbortSignal.timeout(10_000) });
    const data = await response.json();
    if (!response.ok) return { ...token, accessToken: undefined, authError: data.error === 'invalid_grant' ? 'ReconnectRequired' : 'RefreshFailed' };
    if (typeof data.access_token !== 'string' || typeof data.expires_in !== 'number' || data.expires_in <= 0) throw new Error('Invalid token response');
    return { ...token, accessToken: data.access_token, accessExpires: now + data.expires_in * 1000, refreshToken: typeof data.refresh_token === 'string' ? data.refresh_token : token.refreshToken, sheetsGranted: typeof data.scope === 'string' ? data.scope.split(' ').includes(SHEETS_SCOPE) : token.sheetsGranted, authError: undefined };
  } catch { return { ...token, accessToken: undefined, authError: 'RefreshFailed' }; }
}
