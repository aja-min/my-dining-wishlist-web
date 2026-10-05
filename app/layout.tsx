import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = { title:'いきたいお店', description:'Google Mapsのお店を登録・検索し、訪問状態を共有するアプリ。', robots:{index:false,follow:false} };
export default function Layout({ children }: { children: React.ReactNode }) { return <html lang="ja"><body>{children}</body></html>; }
