'use client';
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { MapPin, Plus, Search, ArrowUpRight, Check, RotateCcw, RefreshCw, Trash2, X, Bookmark, Coffee, AlertCircle } from 'lucide-react';
import { AppError, mapsUrl, type Author, type Shop } from '@/lib/model';
import { LocalRepository, loadSeed } from '@/lib/local-repository';
import { HttpRepository } from '@/lib/http-repository';
import type { ShopRepository } from '@/lib/repository';
import { usePreviews } from '@/lib/use-previews';
import { filterShops } from '@/lib/query';
import { LogoutButton } from './auth-button';
type DialogState = { type:'add' } | { type:'delete'; shop:Shop } | { type:'reset' } | { type:'ids' } | null;
export default function ShopApp({ mode, initialAuthor }: { mode:'local'|'google'; initialAuthor:Author }) {
  const demo = mode === 'local';
  const [author, setAuthor] = useState<Author>(initialAuthor);
  const [shops, setShops] = useState<Shop[]>([]);
  const [previewRefresh,setPreviewRefresh]=useState(0);
  const {previews,pending,display}=usePreviews(shops,previewRefresh);
  const [query, setQuery] = useState('');
  const [by, setBy] = useState('全員');
  const [status, setStatus] = useState('まだ');
  const [order, setOrder] = useState('新しい順');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [dialogState, setDialogState] = useState<DialogState>(null);
  const [url, setUrl] = useState('');
  const [formError, setFormError] = useState('');
  const [existing, setExisting] = useState<Shop|null>(null);
  const [highlight, setHighlight] = useState('');
  const repository = useRef<ShopRepository|null>(null);
  const lock = useRef(false);
  const loadingRef = useRef(false);
  const generation = useRef(0);
  const dialog = useRef<HTMLDialogElement>(null);
  const lastFocus = useRef<HTMLElement|null>(null);
  const refresh = useCallback(async () => {
    if (!repository.current || lock.current || loadingRef.current) return;
    loadingRef.current = true;
    const version = ++generation.current;
    setLoading(true); setError('');
    try { const items = await repository.current.list(); if (version === generation.current) setShops(items); }
    catch (e) { if (version === generation.current) { setError(e instanceof Error ? e.message : '読み込みに失敗しました。'); } }
    finally { loadingRef.current = false; if (version === generation.current) setLoading(false); }
  }, []);
  useEffect(() => {
    try { repository.current = demo ? new LocalRepository(loadSeed, window.localStorage) : new HttpRepository(); }
    catch { setError('ブラウザの保存機能が無効です。設定を確認してください。'); setLoading(false); return; }
    void refresh();
    const visible = () => { if (document.visibilityState === 'visible') void refresh(); };
    const changed = () => void refresh();
    document.addEventListener('visibilitychange', visible); window.addEventListener('focus', changed); window.addEventListener('storage', changed);
    return () => { document.removeEventListener('visibilitychange', visible); window.removeEventListener('focus', changed); window.removeEventListener('storage', changed); };
  }, [demo, refresh]);
  useEffect(() => {
    if (dialogState) { lastFocus.current = document.activeElement as HTMLElement; dialog.current?.showModal(); }
    else { dialog.current?.close(); lastFocus.current?.focus(); }
  }, [dialogState]);
  const visible = useMemo(() => filterShops(shops, query, by, status, order, demo, previews), [shops, query, by, status, order, demo, previews]);
  const remaining = shops.filter(s => !s.visited).length;
  const missing = shops.filter(s => !s.id).length;
  const counts = new Map<string,number>(); shops.forEach(s => { if (s.id) counts.set(s.id.toLowerCase(), (counts.get(s.id.toLowerCase()) ?? 0) + 1); });
  const repeated = [...counts.values()].some(n => n > 1);
  const open = (state: DialogState) => { setFormError(''); setExisting(null); setUrl(''); setDialogState(state); };
  const close = () => { if (!lock.current) setDialogState(null); };
  async function mutate(action: () => Promise<unknown>, message: string, inDialog = false) {
    if (lock.current || !repository.current) return;
    lock.current = true; ++generation.current; setBusy(true); setError(''); setNotice(''); setFormError(''); setExisting(null);
    let saved = false;
    try {
      await action(); saved = true; setDialogState(null);
      const items = await repository.current.list(); setShops(items); setNotice(message);
    } catch (e) {
      const text = e instanceof Error ? e.message : '保存できませんでした。';
      if (inDialog && !saved) { setFormError(text); if (e instanceof AppError && e.existing) setExisting(e.existing); }
      else setError(saved ? `保存は完了しましたが、再取得できませんでした。再読み込みしてください。${text}` : text);
    } finally { lock.current = false; setBusy(false); setLoading(false); }
  }
  async function add(event: FormEvent) {
    event.preventDefault(); if (lock.current) return;
    try { mapsUrl(url); } catch (e) { setFormError((e as Error).message); return; }
    await mutate(async () => { await repository.current!.add({ url, author }); setQuery(''); setBy('全員'); setStatus('まだ'); setOrder('新しい順'); }, 'お店を追加しました。', true);
  }
  function showExisting() {
    if (!existing) return;
    setQuery(''); setBy('全員'); setStatus('すべて'); setHighlight(existing.id); close();
    setTimeout(() => document.getElementById(`shop-${existing.id}`)?.scrollIntoView({ behavior:'smooth', block:'center' }), 100);
  }
  return <>
    <div className="modebar"><div><span className="dot" />{demo ? 'デモモード' : 'Google Sheets 連携中'}<span className="mode-description">{demo ? 'このブラウザに保存されます' : 'ふたりで共有しているリストです'}</span></div></div>
    <header className="header"><a href="/" className="brand" aria-label="いきたいお店 ホーム"><span className="brand-icon"><MapPin size={24} /></span><span>いきたいお店</span></a><div className="user"><span className={`avatar ${author === 'あずさ' ? 'azusa' : ''}`}>{author.slice(0,1)}</span>{demo ? <label className="user-label">デモユーザー<select value={author} onChange={e => setAuthor(e.target.value as Author)} disabled={busy} aria-label="デモユーザー"><option>なおと</option><option>あずさ</option></select></label> : <><span>{author}</span><LogoutButton /></>}</div></header>
    <main className="main">
      <section className="intro"><div><h1>お店一覧</h1></div><button className="primary add-button" onClick={() => open({type:'add'})} disabled={busy || loading}><Plus size={18} />お店を追加</button></section>
      <div className="summary"><Bookmark size={17} /><span>まだ行っていないお店 <strong>{remaining}</strong> 件</span><span className="summary-divider"/><Check size={17} /><span>行ったお店 <strong>{shops.length - remaining}</strong> 件</span></div>
      <section className="filters" aria-label="お店の検索と絞り込み"><label className="search"><Search size={20}/><span className="sr-only">登録したお店を検索</span><input type="search" placeholder="店名、書いた人、URLで検索" value={query} onChange={e => setQuery(e.target.value)} /></label><div className="filter-row"><div className="filter-group"><span id="status-label">訪問状態</span><div className="segments" role="group" aria-labelledby="status-label">{['すべて','まだ','行った'].map(value => <button key={value} aria-pressed={status === value} onClick={() => setStatus(value)}>{value === '行った' && <Check size={14}/>} {value}</button>)}</div></div><label className="select-label">書いた人<select aria-label="書いた人" value={by} onChange={e => setBy(e.target.value)}><option>全員</option><option>なおと</option><option>あずさ</option></select></label><label className="select-label sort">登録日<select aria-label="登録日" value={order} onChange={e => setOrder(e.target.value)}><option>新しい順</option><option>古い順</option></select></label></div></section>
      <div className="results-bar"><p aria-live="polite"><strong>{visible.length}</strong> 件のお店 <span className="muted">{`／ 全 ${shops.length} 件`}</span></p><button className="quiet" onClick={() => {void refresh();setPreviewRefresh(value=>value+1);}} disabled={busy || loading}><RefreshCw size={15} className={loading ? 'spinning' : ''}/>{loading ? '読み込み中' : '再読み込み'}</button></div>
      {error && <div className="message error" role="alert"><AlertCircle size={18}/><div>{error}{!demo && <p><a href="/login">再ログインする</a></p>}</div></div>}
      {notice && <div className="message success" role="status"><Check size={18}/>{notice}</div>}
      {busy && <div className="saving" role="status">保存中…</div>}
      {(missing > 0 || repeated) && <div className="message warning"><div>{missing > 0 && <p>IDのないお店が {missing} 件あります。更新する前にIDを補完してください。</p>}{repeated && <p>IDが重複したお店は更新・削除できません。元データのIDを修正してください。</p>}</div>{missing > 0 && <button disabled={busy || loading} onClick={() => open({type:'ids'})}>IDを補完</button>}</div>}
      {loading && shops.length === 0 ? <div className="grid" aria-label="読み込み中">{[1,2,3].map(i=><div className="skeleton" key={i}/>)}</div> : visible.length ? <section className="grid" aria-label="お店の一覧">{visible.map(shop => {
        const preview = display(shop); const invalid = !shop.id || (counts.get(shop.id.toLowerCase()) ?? 0) > 1;
        return <article id={`shop-${shop.id}`} className={`shop-card ${highlight === shop.id ? 'highlight' : ''}`} key={`${shop.id}-${shop.row}`} aria-label={preview.title} data-title={preview.title} data-preview-pending={pending.has(shop.url)}>
          <h2 className="shop-heading"><a href={shop.url} target="_blank" rel="noopener noreferrer">{preview.source === 'fallback' ? (pending.has(shop.url) ? '店名・住所を取得中…' : '店名・住所未取得') : preview.title}</a></h2>
          <div className="native-map">
            {preview.embedUrl ? <iframe src={preview.embedUrl} title={`${preview.title}のGoogle Maps`} loading="lazy" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" /> : <div className="map-unavailable"><p>{pending.has(shop.url) ? 'Google Mapsを読み込み中…' : 'Google Mapsを表示できませんでした。'}</p><a href={shop.url} target="_blank" rel="noopener noreferrer">Google Mapsで開く <ArrowUpRight size={15}/></a></div>}
          </div>
          <div className="card-content">
            <div className="card-meta"><span className={`mini-avatar ${shop.author === 'あずさ' ? 'azusa' : ''}`}>{shop.author.slice(0,1)}</span><span>{shop.author}</span><time dateTime={shop.date}>{shop.date.replaceAll('-','.')}</time><span className={`native-status ${shop.visited ? 'visited' : ''}`}>{shop.visited ? '行った' : 'まだ'}</span></div>
            <a className="maps-link" href={shop.url} target="_blank" rel="noopener noreferrer"><MapPin size={15}/>Google Mapsで開く<ArrowUpRight size={14}/></a>
            <div className="card-actions"><button className={shop.visited ? 'visit done' : 'visit'} disabled={busy || loading || invalid} onClick={() => void mutate(() => repository.current!.setVisited(shop.id, !shop.visited), shop.visited ? '「まだ」に戻しました。' : '「行った」に更新しました。')}>{shop.visited ? <RotateCcw size={16}/> : <Check size={17}/>} {shop.visited ? 'まだに戻す' : '行った！'}</button><button className="delete" aria-label={`${preview.title}を削除`} disabled={busy || loading || invalid} onClick={() => open({type:'delete',shop})}><Trash2 size={16}/></button></div>{invalid && <p className="invalid">IDの確認が必要です</p>}
          </div>
        </article>;
      })}</section> : !error && <div className="empty"><Coffee size={36}/><h2>{shops.length ? '条件に合うお店がありません' : 'お店が登録されていません'}</h2><p>{shops.length ? '検索や絞り込みの条件を変えてみてください。' : 'Google MapsのURLから、お店を追加できます。'}</p>{shops.length ? <button onClick={() => {setQuery('');setBy('全員');setStatus('すべて');}}>絞り込みをクリア</button> : <button onClick={() => open({type:'add'})}>お店を追加</button>}</div>}
      <footer>{demo && <button className="quiet" disabled={busy} onClick={() => open({type:'reset'})}><RotateCcw size={14}/>サンプルにリセット</button>}<p>{demo ? 'CSVは初期データです。変更はこのブラウザにのみ保存され、Google Sheetsには送信されません。初期データは共有された実URL10件です。書いた人・日付はデモ用です。' : '相手の変更は再読み込み・画面への復帰時に確認できます。'}</p></footer>
    </main>
    <dialog ref={dialog} aria-labelledby="dialog-title" onCancel={e => {e.preventDefault();close();}} onClick={e => {if(e.target === dialog.current) close();}}>
      <div className="dialog-body"><button className="dialog-close quiet" aria-label="閉じる" onClick={close} disabled={busy}><X size={21}/></button>
        {dialogState?.type === 'add' ? <><span className="dialog-icon"><MapPin size={25}/></span><h2 id="dialog-title">お店を追加</h2><p>Google Mapsの「共有」からコピーしたURLを貼り付けてください。</p><form onSubmit={add}><label htmlFor="shop-url">Google MapsのURL <span className="required">必須</span></label><input id="shop-url" type="url" value={url} onChange={e => setUrl(e.target.value)} placeholder="https://maps.app.goo.gl/…" required autoFocus maxLength={4096} disabled={busy} aria-describedby="url-help form-error"/><p id="url-help" className="muted">{author}として登録します。店名が取得できなくても追加できます。</p>{formError && <div className="message error" id="form-error" role="alert">{formError}</div>}{existing && <div className="existing"><strong>{display(existing).title}</strong><span>{existing.author} · {existing.date}</span><button type="button" onClick={showExisting}>登録済みのお店を表示</button></div>}<div className="dialog-actions"><button type="button" onClick={close} disabled={busy}>キャンセル</button><button className="primary" type="submit" disabled={busy}>{busy ? '保存中…' : 'お店を登録'}</button></div></form></> : <><h2 id="dialog-title">{dialogState?.type === 'delete' ? 'このお店を削除しますか？' : dialogState?.type === 'ids' ? 'IDを補完しますか？' : 'サンプルに戻しますか？'}</h2><p>{dialogState?.type === 'delete' ? `「${display(dialogState.shop).title}」を一覧から削除します。` : dialogState?.type === 'ids' ? `実データがありIDのない ${missing} 件にUUIDを付けます。空の行は変更しません。` : 'このブラウザで追加・変更した内容を削除し、初期データ10件に戻します。'}</p>{formError && <div className="message error" role="alert">{formError}</div>}<div className="dialog-actions"><button onClick={close} disabled={busy} autoFocus>キャンセル</button><button className={dialogState?.type === 'delete' ? 'danger' : 'primary'} disabled={busy} onClick={() => {if(dialogState?.type === 'delete') void mutate(()=>repository.current!.remove(dialogState.shop.id),'お店を削除しました。',true);else if(dialogState?.type === 'ids') void mutate(()=>repository.current!.fillMissingIds(),'IDを補完しました。',true);else void mutate(async()=>{await (repository.current as LocalRepository).reset();setQuery('');setBy('全員');setStatus('まだ');setOrder('新しい順');},'サンプルにリセットしました。',true);}}>{busy ? '保存中…' : dialogState?.type === 'delete' ? '削除する' : dialogState?.type === 'ids' ? 'IDを補完する' : 'リセットする'}</button></div></>}
      </div>
    </dialog>
  </>;
}
