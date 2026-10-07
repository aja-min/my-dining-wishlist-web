'use client';
import { signIn, signOut } from 'next-auth/react';
export function LoginButton({ reconnect = false }: { reconnect?: boolean }) { return <button className="primary" onClick={() => signIn('google', { callbackUrl:'/' }, reconnect ? { prompt:'consent select_account' } : undefined)}>Googleでログイン</button>; }
export function LogoutButton() { return <button className="quiet" onClick={() => signOut({ callbackUrl:'/login' })}>ログアウト</button>; }
