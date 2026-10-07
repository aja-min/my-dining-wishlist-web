import type { Metadata, Viewport } from 'next';
import './globals.css';
export const metadata: Metadata = { title:'いきたいお店', description:'Google Mapsのお店を登録・検索し、訪問状態を共有するアプリ。', robots:{index:false,follow:false}, appleWebApp:{capable:true,title:'いきたいお店',statusBarStyle:'default'}, icons:{apple:'/icons/apple-touch-icon.png'} };
export const viewport: Viewport = { width:'device-width', initialScale:1, viewportFit:'cover', themeColor:'#f4f7f9' };
export default function Layout({ children }: { children: React.ReactNode }) { return <html lang="ja"><body>{children}</body></html>; }
