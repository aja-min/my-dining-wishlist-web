import type { Author } from './model';

export function allowedAccounts(naotoValue?: string, azusaValue?: string) {
  const parse = (value?: string) => [...new Set((value ?? '').split(',').map(email => email.trim().toLowerCase()).filter(Boolean))];
  const naoto = parse(naotoValue);
  const azusa = parse(azusaValue);
  const valid = naoto.length > 0 && azusa.length > 0 &&
    [...naoto, ...azusa].every(email => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) &&
    !naoto.some(email => azusa.includes(email));
  return {
    valid,
    displayName(email?: string | null): Author | null {
      const normalized = email?.trim().toLowerCase();
      if (!valid || !normalized) return null;
      return naoto.includes(normalized) ? 'なおと' : azusa.includes(normalized) ? 'あずさ' : null;
    },
  };
}
