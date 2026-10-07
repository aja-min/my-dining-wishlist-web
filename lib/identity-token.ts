import type { JWT } from 'next-auth/jwt';
// Retire Google API credentials from existing encrypted sessions on next access.
export function identityToken(token: JWT, verified?: boolean): JWT {
  const next = { ...token };
  for (const key of ['accessToken', 'accessExpires', 'refreshToken', 'sheetsGranted', 'authError']) delete next[key];
  if (verified !== undefined) next.emailVerified = verified;
  return next;
}
