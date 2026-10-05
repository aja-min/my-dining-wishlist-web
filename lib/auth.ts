import 'server-only';
import { getServerSession, type NextAuthOptions } from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
import { getToken } from 'next-auth/jwt';
import type { NextRequest } from 'next/server';
import { AppError, type Author } from './model';
import { allowedAccounts } from './allowed-accounts';
export const SHEETS_SCOPE = 'https://www.googleapis.com/auth/spreadsheets';
export function dataMode() { return process.env.DATA_MODE === 'google' ? 'google' : 'local'; }
export function displayName(email?: string | null): Author | null {
  return allowedAccounts(process.env.NAOTO_EMAIL, process.env.AZUSA_EMAIL).displayName(email);
}
export function authConfigured() {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && process.env.NEXTAUTH_SECRET && process.env.NEXTAUTH_URL && allowedAccounts(process.env.NAOTO_EMAIL, process.env.AZUSA_EMAIL).valid);
}
export const authOptions: NextAuthOptions = {
  secret: process.env.NEXTAUTH_SECRET,
  providers: [GoogleProvider({ clientId: process.env.GOOGLE_CLIENT_ID ?? '', clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? '', authorization: { params: { prompt: 'consent select_account', scope: `openid email profile ${SHEETS_SCOPE}`, access_type: 'online' } } })],
  session: { strategy: 'jwt', maxAge: 8 * 60 * 60 },
  pages: { signIn:'/login', error:'/login' },
  callbacks: {
    async signIn({ account, profile }) {
      return dataMode() === 'google' && authConfigured() && account?.provider === 'google' && (profile as { email_verified?: boolean })?.email_verified === true && Boolean(displayName(profile?.email));
    },
    async jwt({ token, account, profile }) {
      if (account) {
        token.accessToken = account.access_token;
        token.accessExpires = (account.expires_at ?? 0) * 1000;
        token.emailVerified = (profile as { email_verified?: boolean })?.email_verified === true;
        token.sheetsGranted = account.scope?.split(' ').includes(SHEETS_SCOPE) === true;
      }
      return token;
    },
    async session({ session, token }) {
      // No Google token is exposed through /api/auth/session or client props.
      if (session.user) { session.user.email = token.email; session.user.name = displayName(token.email); session.user.image = null; }
      return session;
    },
  },
};
export async function currentUser() {
  if (!authConfigured() || dataMode() !== 'google') return null;
  const session = await getServerSession(authOptions);
  const name = displayName(session?.user?.email);
  return name ? { name } : null;
}
export async function requireGoogleUser(request: NextRequest) {
  if (dataMode() !== 'google') throw new AppError('デモモードではGoogle Sheetsにアクセスしません。', 403);
  if (!authConfigured()) throw new AppError('Googleログインの環境変数が未設定です。READMEを確認してください。', 503);
  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
  const author = displayName(token?.email);
  if (!author || token?.emailVerified !== true) throw new AppError('許可されたGoogleアカウントでログインしてください。', 401);
  if (!token.sheetsGranted) throw new AppError('スプレッドシートの編集権限への同意が必要です。再ログインしてください。', 403);
  if (typeof token.accessToken !== 'string' || typeof token.accessExpires !== 'number' || Date.now() >= token.accessExpires - 30_000) throw new AppError('Googleの接続期限が切れました。再ログインしてください。', 401);
  return { author, accessToken: token.accessToken };
}
