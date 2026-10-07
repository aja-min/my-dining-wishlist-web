'use client';
import { signIn, signOut } from 'next-auth/react';
export function LoginButton() { return <button className="primary" onClick={() => signIn('google', { callbackUrl:'/' })}>Googleでログイン</button>; }
export function LogoutButton() { return <button className="quiet" onClick={() => signOut({ callbackUrl:'/login' })}>ログアウト</button>; }

export function ReconnectButton() { return <button className="quiet" onClick={() => signIn('google', { callbackUrl:'/' }, { prompt:'consent select_account' })}>Googleと再接続</button>; }
