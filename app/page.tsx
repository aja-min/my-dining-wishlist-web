import ShopApp from '@/components/shop-app';
import { currentUser, dataMode, authConfigured } from '@/lib/auth';
import { redirect } from 'next/navigation';
export const dynamic = 'force-dynamic';
export default async function Page() {
  const mode = dataMode();
  if (mode === 'google') {
    if (!authConfigured()) redirect('/login');
    const user = await currentUser();
    if (!user) redirect('/login');
    return <ShopApp mode="google" initialAuthor={user.name} />;
  }
  return <ShopApp mode="local" initialAuthor="なおと" />;
}
