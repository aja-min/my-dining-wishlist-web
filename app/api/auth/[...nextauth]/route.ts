import NextAuth from 'next-auth';
import { authConfigured, authOptions, dataMode } from '@/lib/auth';
const handler = NextAuth(authOptions);
async function guarded(...args: Parameters<typeof handler>) {
  if (dataMode() !== 'google' || !authConfigured()) return Response.json({ error:'Googleログインは無効または未設定です。' }, { status:503 });
  return handler(...args);
}
export { guarded as GET, guarded as POST };
