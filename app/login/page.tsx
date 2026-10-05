import { authConfigured, dataMode } from '@/lib/auth';
import { LoginButton } from '@/components/auth-button';
export const dynamic = 'force-dynamic';
export default function Login() { return <main className="login"><h1>いきたいお店</h1>{dataMode() === 'local' ? <><p>デモモードでお試しいただけます。</p><a className="primary button" href="/">デモを開く</a></> : authConfigured() ? <><p>なおと・あずさのGoogleアカウントでログインしてください。</p><p className="muted">ログインできない場合は、許可アカウント・同意画面の設定を確認してください。接続期限が切れた場合も、ここから再ログインできます。</p><LoginButton /></> : <><p role="alert">Google連携の設定が不足しています。</p><p>READMEに沿って環境変数を設定してください。ローカルで試す場合は DATA_MODE=local にして再起動してください。</p></>}</main>; }
