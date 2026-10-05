# いきたいお店 — my-dining-wishlist-web

お店の登録・検索・訪問状態を夫婦で共有する、日本語のスマホ向けWebアプリ。ローカルCSVを初期データとして使うMVPです。Google認証・Google Sheets連携に対応し、Vercelで運用します。

## ローカル起動

Node.js 20.9以上（検証環境: Node.js 24.14.0）。初回の依存インストール後は、Googleログイン・APIキー・外部ネット接続なしで使えます。

```bash
cd /Users/ajamin/develop/my-dining-wishlist-web
npm ci
npm run dev
```

http://localhost:3001 を開きます。既存の `my-lifelog-web` と同時起動できるようポート3001にしています。環境変数がなくてもローカルモードで動きます。

```bash
npm run build
npm start
```

本番ビルドのローカル起動も同じポートです。devとstartを同時に起動しないでください。インターネットなしでも検索・追加・削除・訪問更新は可能ですが、リンク先のGoogle Mapsを閲覧するときは接続が必要です。ローカルサーバーは127.0.0.1に限定しています。

## できること

- 「なおと／あずさ」のデモユーザー切り替え、URLからの新規登録（UUID・日本時間の日付・書いた人・FALSEを設定）。
- 登録済みのお店の検索、書いた人・訪問状態の複合フィルタ、登録日の並び替え。初期値は「まだ／新しい順」。
- Google Maps自身の地図・店舗情報をiframeで表示し、元のGoogle Maps URLも新規タブで開けます。訪問更新・削除は埋め込みの外側で独立した操作です。
- ふたり共通の「行った／まだ」の更新、店名を表示した確認ダイアログからの削除。
- リロード後も追加・削除・訪問更新を維持。リセットでユーザー提供の実URL10件へ戻す。
- 同一URLの重複検出と登録済みカードへの案内、ボタン連打防止。
- 読み込み中・保存中・取得／保存失敗・空リスト・検索結果なしを表示。キーボード操作、ラベル、モーダルのフォーカス制御。
- ID欠落を読み取り時には変更せず、明示的な確認操作で補完。ID重複／欠落した対象の更新・削除は停止。
- 再読み込み、画面復帰、別タブの保存イベントで再取得。

## CSVと保存先

`public/data/shops.csv` はUTF-8の初期データです。列は以下の5つのみです。

| 列 | ヘッダー | 値 |
|---|---|---|
| A | ID | UUID（登録後は不変） |
| B | 書いた日にち | YYYY-MM-DD、日本時間 |
| C | 書いた人 | なおと／あずさ |
| D | Google mapのURL | HTTPSのGoogle Maps URL |
| E | 行ったかどうか | TRUE＝行った、FALSE・空欄＝まだ |

Papa Parseでクォート・カンマ・改行・BOMを処理します。ヘッダー名から列を対応付け、ヘッダーの過不足・重複や不正値はエラーにします。完全な空行と、E列だけFALSEでA〜Dが空の行を無視します。TRUEだけ入った行や、日付・書いた人・URLが欠けた不完全な行はエラーにし、黙って捨てません。IDの空欄だけは許容します。

ブラウザの `localStorage`（キー `ikitai-omise.demo.v1`）がデモ中の変更保存先です。**ブラウザから元のCSVを書き換える処理はありません。** 変更を保存した後にCSVを編集しても、保存済みの内容が優先されます。サンプルにリセットすると最新のCSVを初期値として読み直します。削除されたレコードだけ復活するような自動マージはしません。

保存先はブラウザ・プロファイル・オリジン単位です。localhostと127.0.0.1、異なるポートは別データです。デモは別端末・夫婦のブラウザ間で共有されません。Web Locks対応ブラウザでは同一オリジンの複数タブの書き込みを直列化します。非対応ブラウザでの同時編集には上書きの可能性があります。

初期データはユーザー提供のGoogle Maps実URL10件です。書いた人・登録日・訪問状態はデモ用の値で、実際の登録者や訪問履歴を表しません。店名の固定fixtureはありません。表示情報はURLと公開ページから取得し、CSVやGoogle Sheetsに表示用の列を追加しません。独自の店舗画像・イラストカードは表示しません。埋め込み表示の内容（地図、店名、住所、評価、Googleロゴ等）はGoogle自身が描画します。旧8件の架空CSVは回帰テスト専用の `tests/fixtures/shops.csv` に移しました。

## 実装の構成

```text
app/                         Next.js App Router、ログイン画面、API
components/shop-app.tsx       両モード共通のUI
lib/model.ts                 スキーマ、CSVパース、URL検証、日付、ID解決
lib/repository.ts            list/add/remove/setVisited/fillMissingIdsの共通契約
lib/local-repository.ts      CSV初期値＋localStorage
lib/http-repository.ts       認証済みサーバーAPIへのクライアントAdapter
lib/sheets-repository.ts     Sheets Adapter（IDから最新行番号を解決）
lib/google-server.ts         1ユーザーのOAuthトークンと設定対象に束縛した通信
lib/auth.ts                  NextAuth、アカウント許可・表示名対応
lib/maps-embed.ts            元URLの場所ID・CID・queryからGoogle埋め込みURLを生成
lib/preview.ts               URLのパス・query/qから検索用の表示情報を解釈
lib/resolve-preview.ts       短縮URLの解決、HTMLのtitle/OG解析、短期キャッシュ
lib/safe-map-fetch.ts        ホスト・IP制限、DNS固定、取得上限
lib/use-previews.ts          一覧表示後の非同期取得（2件ずつ）
app/api/preview/route.ts     認証と表示情報取得のAPI境界
lib/query.ts                 検索・フィルタ・並び替え
```

参照元は `/Users/ajamin/develop/my-lifelog-web` の `AGENTS.md`、`lib/auth.ts`、`lib/googleDrive.ts`、`app/globals.css`、`.env.example`、`package.json` です。参照元は変更していません。Next.js 16.3.6／React 19.3.0／TypeScript／NextAuth 4.24.15、白・くすみ水色、サーバー境界での認可、JWTセッション（8時間）を引き継ぎました。Next.js同梱ドキュメントでApp RouterとRoute Handlerを確認しています。

既存実装はGoogleログイン（単一許可アカウント）と、別のサービスアカウントによるDrive閲覧を分離しています。本アプリは要件に合わせ、2アカウントの許可リストと**その操作をした本人のOAuth権限**に変更しました。サービスアカウント鍵や相手のトークンは使用しません。

## Google Sheetsへの切り替え

なおとのアカウントでログイン・追加・訪問更新と実シートへの反映を確認済みです。あずさのアカウントは実環境での確認待ちです。

1. `.env.example` を `.env.local` にコピーします。実際の夫婦のメールアドレス・シークレットは推測せず、各自で設定してください。
2. Google Cloudプロジェクトで **Google Sheets API** を有効化します。
3. OAuth同意画面を設定し、テスト公開の場合は夫婦のGoogleアカウントをテストユーザーに追加します。
4. Webアプリケーション用のOAuthクライアントを作成します。承認済みJavaScript生成元は `http://localhost:3001`、リダイレクトURIは **`http://localhost:3001/api/auth/callback/google`** にします。
5. `GOOGLE_CLIENT_ID`、`GOOGLE_CLIENT_SECRET`、`NAOTO_EMAIL`、`AZUSA_EMAIL` を設定します。メールは異なる2つが必要です。`NEXTAUTH_SECRET` は `openssl rand -base64 32` で生成します。`NEXTAUTH_URL=http://localhost:3001` とアクセスURLを揃えてください。
6. 対象スプレッドシートを**両方のGoogleアカウントに編集者として共有**します。ログイン許可とSheetsの編集権限は別です。
7. `GOOGLE_SPREADSHEET_ID=1Wm7dB8nt_BykgeZ2j5gLJqx5Xs67e2Y7vB2oJRFJZRE`、`GOOGLE_SHEET_TAB=お店` を確認します。A〜E列は指定のヘッダー順にし、B列の表示形式を `yyyy-mm-dd`、E列をチェックボックスにしてください。余分なデータ列は受け付けません。
8. `DATA_MODE=google` に変更してサーバーを再起動します。同じUIがSheets Adapterを使用し、デモユーザー切り替え・デモリセットは表示されなくなります。設定不足はログイン画面で案内します。
9. それぞれのGoogleアカウントでログインし、Sheetsへの編集権限に同意します。別々のブラウザプロファイルでの確認を推奨します。

モードは**サーバー側環境変数**で切り替えます。URLパラメータやフロントからのユーザー名で本番認証を迂回することはできません。ローカルモードではSheets APIは全操作を拒否し、デモデータを実スプレッドシートへ送るインポート処理もありません。

### 認証・認可とトークン

- NextAuthのGoogle OAuth/OIDCフローで認証結果を検証し、`email_verified` とサーバーの許可メールを確認します。表示名はサーバー設定から決定し、APIに渡された書いた人は無視します。
- 全てのSheets API操作でJWTの検証、許可アカウント、Googleトークン期限、Sheetsスコープを再確認します。書き込みは同一Origin＋JSONに限定します。NextAuthのログイン処理はNextAuthのCSRF保護を使います。
- `openid email profile` に `https://www.googleapis.com/auth/spreadsheets` を追加します。既存Drive閲覧権限やサービスアカウントは流用しません。再ログイン時に同意画面を表示します。
- 指定済みIDのスプレッドシートを直接開く構成なので、Sheets編集スコープを使用します。このOAuthスコープ自体は1ファイルに限定できません。アプリのAPI境界では環境変数で設定した1ファイル・1タブに限定しています。より狭い `drive.file` を使うにはGoogle Picker等で対象ファイルを承認する追加フローが必要です（未実装）。
- Googleアクセストークンは暗号化されたHttpOnlyのNextAuth JWT Cookie内に保持し、クライアント向けセッションレスポンスには含めません。localStorage・CSV・Git・ログには保存しません。HTTPS環境ではSecure Cookieを利用します。
- **自動トークン更新は未実装**です。Googleのアクセストークン期限（通常約1時間）が切れたら、8時間のアプリセッション内でも再ログインが必要です。refresh_tokenは要求・保存しません。期限切れや権限不足を画面で案内し、保存したように扱いません。
- 本番利用前に、ふたりのアカウント、第三者拒否、共有権限なし、同意拒否、期限切れを実環境で検証してください。

### Sheetsの書き込みと競合

- 追加は実データの最初の空き行に行を挿入し、A〜Eの5セルを同じbatchUpdateで書き込みます。チェックボックスだけの行を追加位置の判定に含めません。
- 訪問更新は、直前の再取得でIDに一致する唯一の行を探し、**そのE列だけ**に目的状態TRUE/FALSEを書きます。反転命令は送りません。
- 削除は、タブの数値IDを取得し、最新データのIDから解決した行をdeleteDimensionで削除します。画面の並びや検索後の配列位置をSheets行番号に使用しません。
- 読み取りはID補完を書き込みません。画面の「IDを補完」→確認で、実データのあるID空欄行のA列だけを補完します。日付・書いた人・URLが不正な行は先にスプレッドシートで修正してください。
- 変更後は再取得します。再取得だけ失敗した場合は「保存は完了したが再取得できなかった」と区別して表示します。

**残る競合:** IDはトランザクションやロックではありません。直前の再取得より前に起きた行挿入・並び替え・削除は追従できますが、再取得から書き込みまでの間に手動編集や他のアプリが並び替え・削除した場合、別の行へ作用する可能性が残ります。ID補完にも同じ競合があります。また2つのリクエストが同時に同じURLを追加すると、重複チェックを双方が通過する可能性があります。Sheetsと手動編集の間の条件付き行更新は実装していません。共同利用開始時は行の並び替え等とアプリ編集を同時に行わない運用にしてください。完全な競合防止が必要なら、書き込みを仲介する単一バックエンド／別データストア等が必要です。

## Google Maps自身の埋め込み表示

各カードにはGoogle Mapsの地図・店舗情報を **iframeでそのまま表示** します。独自の画像カード、ピンの代替画像、Googleカードを模したHTMLは表示しません。外側にはアプリの書いた人・登録日・訪問状態・更新／削除ボタンと元URLリンクだけを置きます。Googleのロゴ・表示情報を隠すオーバーレイは使いません。

- 入力が短縮URLならサーバーで通常のリダイレクトを解決します。URLに含まれる `ftid` または `!1s` の場所識別子から同じ場所のCIDを導き、Googleの公開埋め込み表示 `https://maps.google.com/maps?cid=…&output=embed&hl=ja` へ渡します。Google側で通常の `www.google.com/maps/embed?...` に遷移します。
- CIDや場所IDがない通常URLでは、元URLの `query_place_id`・`query`・`q`・場所パスを使います。特定店舗向けの固定名・対応表・推測名は使いません。短縮コードだけから場所を推測しません。
- 今回の10件はすべて場所識別子を持ち、10件ともGoogle標準の埋め込みURLを生成できることを確認しました。従来、店名取得ができなかったURLでも、Google側は場所IDを使ってその店舗を表示できます。
- Googleの埋め込みに表示される店名や評価等をアプリ側で管理・複製しません。検索用の名前は従来どおりURLや公開HTMLから取れる範囲なので、Google内部の埋め込みだけに表示される店名まで検索できるとは限りません。
- 埋め込み先を特定できない場合は説明と元のGoogle Mapsリンクを表示します。登録・保存・訪問更新・削除は続けられます。
- この公開埋め込み形式は今回キーなしで動作確認したものです。Googleが公開URLの挙動を変更した場合は調整が必要です。Maps Embed API v1（APIキーが必要な別方式）は使っていません。

Google側の地図・店舗情報の描画にはネット接続が必要です。ブラウザからGoogleへ通常の埋め込みリクエストが発生します。ネットがない場合もローカルのリスト操作は可能です。自動取得は一覧表示後に行い、外部ページの描画を保存操作の条件にしません。

参考: [Google Mapsの共有・埋め込み](https://support.google.com/maps/answer/7101463?hl=ja)。

### 取得制限

- Google MapsのHTTPSホストとパスだけを許可。リダイレクトは最大5回で、各転送先を再検証。任意URL、認証情報付きURL、カスタムポート、Googleの汎用リダイレクトURLも拒否。
- DNSで得たIPv4がprivate/loopback/link-local/metadata/reserved等でないことを確認。検証済みIPを接続先に固定し、TLSは元のホスト名を検証。IPv6へのフォールバックはしません。
- 1取得全体8秒、HTML最大2 MB、非HTMLと圧縮応答を拒否。DNS解決も待ち時間制限の対象。GoogleへのCookie・OAuthトークンは送信しません。
- カードはGoogle Mapsのiframeを表示します。公開OG解析モジュールの画像情報はカードには使いません。Googleのフレーム内コンテンツはGoogleが管理し、アプリは任意URLをiframeに渡しません。
- 同時取得はサーバーで最大4件、キャッシュは100件まで。公開ページ由来は15分、URL情報・fallbackは1分。データはサーバーのメモリだけで、固定店舗データではありません。
- GoogleモードはプレビューAPIでもサーバー側の認証・認可を確認します。ローカルモードの表示情報取得は公開Googleページのみで、Sheetsへは送信しません。

ネット接続がなくてもCSV/localStorageでの主要操作は可能です。プレビュー取得だけ失敗し、URLから直接読める情報・元リンクで表示します。Google Mapsへの遷移・標準埋め込み・公開ページからの情報取得にはネット接続が必要です。

以前のlocalStorageデータは初期CSVの変更で上書きしません。以前のサンプルを保存済みの場合は、保存内容が不要なら「サンプルにリセット」で実URL10件に戻せます。

## 検証

```bash
npm test             # 26件のドメイン／Adapter／プレビュー安全性テスト
npm run typecheck
npm run build
npm start            # 別ターミナルで起動
npm run test:browser  # インストール済みGoogle Chromeを使用
```

ブラウザテストは既定で `http://127.0.0.1:3001` を使用します。変更時は `TEST_BASE_URL` を指定します。独立した一時ブラウザプロファイルを使い、利用中のデータを変更しません。スクリーンショットは `test-results/desktop.png` と `test-results/mobile.png` に出力します。

- ドメイン／Adapter: CSVの空行・FALSEのみ行・TRUE/FALSE/空欄、BOM・クォート・カンマ・改行、不正ヘッダー、JST日付、URL許可リスト、永続化・リセット、保存失敗、表示情報fallback、URLからの表示情報・複合フィルタ、ID欠落・重複停止、並び替え後の行識別、E列限定更新、行削除、サーバー由来の書いた人、明示的なID補完。
- ブラウザ: 複合検索、2人それぞれの登録、追加・削除・訪問更新のリロード後維持、同一URLの案内、連打、失敗時の状態維持、確認ダイアログ、Escapeとフォーカス復帰、空・取得失敗・保存失敗表示、埋め込み不可時の元リンク、リセット、390pxのスマホレイアウト、プレビュー503時の動作、デモ時のGoogle Sheets API拒否。回帰テストでは旧8件CSVとプレビュー503をモックします。`node tests/real-urls.mjs` では実URL10件・自動取得後の店名検索・スマホ表示も検証します。

複数端末同時編集、あずさのログイン、OAuth再同意・期限切れの実ブラウザ確認は未検証です。単体テストのSheets通信は偽の通信関数を使い、実スプレッドシートを変更しません。

## 参考資料

- [Sheets values.update](https://developers.google.com/workspace/sheets/api/reference/rest/v4/spreadsheets.values/update)
- [Sheets batchUpdateと行削除](https://developers.google.com/workspace/sheets/api/guides/batchupdate)
- [Google SheetsのOAuthスコープ](https://developers.google.com/workspace/sheets/api/scopes)
- [NextAuth JWTセッション](https://next-auth.js.org/configuration/options#jwt)

実URLの確認では提供された10件に同じ取得処理を適用し、結果は `test-results/real-previews.json` に記録します。取得結果はGoogle側の応答や通信状態で変わります。特定の店名を得るための分岐は実装していません。

### 同じ人が複数のGoogleアカウントを使う場合

`AZUSA_EMAIL`（`NAOTO_EMAIL`も同様）はカンマ区切りで複数指定できます。例: `AZUSA_EMAIL=first@example.com,second@example.com`。どちらも同じ書いた人として扱います。全アカウントをOAuthのテストユーザーに登録し、対象スプレッドシートの編集権限を付けてください。なおと・あずさの両方に同じメールを設定した場合は認証を無効にします。環境変数の変更後はサーバーを再起動してください。

## Vercel運用

本番環境には `DATA_MODE=google` とOAuth・Sheetsの環境変数を設定します。`NEXTAUTH_URL` は本番のHTTPS URL、`NEXTAUTH_SECRET` は本番専用のランダム値を使用します。Google OAuthクライアントの承認済みリダイレクトURIに、本番URLの `/api/auth/callback/google` を追加してください。秘密値はGitに含めず、Vercelの環境変数で管理します。
