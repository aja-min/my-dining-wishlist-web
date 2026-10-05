import Papa from 'papaparse';
export const HEADERS = ['ID', '書いた日にち', '書いた人', 'Google mapのURL', '行ったかどうか'] as const;
export type Author = 'なおと' | 'あずさ';
export type Shop = { id: string; date: string; author: Author; url: string; visited: boolean; row: number };
export type NewShop = { url: string; author: Author };
export class AppError extends Error {
  constructor(message: string, public status = 400, public existing?: Shop) { super(message); }
}
export function assertAuthor(value: unknown): asserts value is Author {
  if (value !== 'なおと' && value !== 'あずさ') throw new AppError('書いた人は「なおと」か「あずさ」にしてください。');
}
export function mapsUrl(value: string): string {
  let url: URL;
  try { url = new URL(value.trim()); } catch { throw new AppError('Google MapsのURLを入力してください。'); }
  const normal = ['www.google.com', 'google.com', 'www.google.co.jp', 'google.co.jp'].includes(url.hostname) && /^\/maps(?:\/|$)/.test(url.pathname);
  const maps = ['maps.google.com', 'maps.google.co.jp'].includes(url.hostname);
  const short = (url.hostname === 'maps.app.goo.gl' && url.pathname.length > 1) || (url.hostname === 'goo.gl' && url.pathname.startsWith('/maps/'));
  if (url.protocol !== 'https:' || url.username || url.password || url.port || !(normal || maps || short) || value.length > 4096) {
    throw new AppError('https:// で始まるGoogle Mapsの通常URLか共有用短縮URLを入力してください。');
  }
  return url.href;
}
export function japanDate(date = new Date()): string {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Tokyo', year:'numeric', month:'2-digit', day:'2-digit' }).format(date);
}
export function parseRows(rows: unknown[][]): Shop[] {
  const headers = (rows[0] ?? []).map(v => String(v ?? '').trim().replace(/^\uFEFF/, ''));
  if (headers.length !== 5 || new Set(headers).size !== 5 || HEADERS.some(h => !headers.includes(h))) {
    throw new AppError('列の構成が違います。5列のヘッダー（ID／書いた日にち／書いた人／Google mapのURL／行ったかどうか）を確認してください。');
  }
  const at = (row: unknown[], name: typeof HEADERS[number]) => String(row[headers.indexOf(name)] ?? '').trim();
  const result: Shop[] = [];
  rows.slice(1).forEach((row, index) => {
    if (row.length > 5 && row.slice(5).some(v => String(v ?? '').trim())) throw new AppError(`${index + 2}行目に想定外の列があります。`);
    const [id, date, author, url, state] = HEADERS.map(h => at(row, h));
    if (!id && !date && !author && !url && ['', 'FALSE'].includes(state.toUpperCase())) return;
    if (!['', 'TRUE', 'FALSE'].includes(state.toUpperCase())) throw new AppError(`${index + 2}行目の訪問状態をTRUE／FALSEにしてください。`);
    assertAuthor(author);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(date)) || new Date(date).toISOString().slice(0,10) !== date) throw new AppError(`${index + 2}行目の日付をYYYY-MM-DDにしてください。`);
    if (id && !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) throw new AppError(`${index + 2}行目のIDはUUIDにしてください。`);
    result.push({ id, date, author, url: mapsUrl(url), visited: state.toUpperCase() === 'TRUE', row: index + 2 });
  });
  return result;
}
export function parseCsv(csv: string): Shop[] {
  const result = Papa.parse<string[]>(csv, { skipEmptyLines: 'greedy' });
  if (result.errors.length) throw new AppError('CSVを読み込めません。クォートや区切りを確認してください。');
  return parseRows(result.data);
}
export function uniqueShop(shops: Shop[], id: string): Shop {
  if (!id) throw new AppError('IDがありません。先にIDを補完してください。', 409);
  const found = shops.filter(s => s.id.toLowerCase() === id.toLowerCase());
  if (found.length !== 1) throw new AppError(found.length ? 'IDが重複しているため変更できません。データを確認してください。' : 'このお店は見つかりません。再読み込みしてください。', 409);
  return found[0];
}
export function duplicate(shops: Shop[], url: string) {
  const existing = shops.find(s => s.url === url);
  if (existing) throw new AppError('同じURLのお店が登録されています。', 409, existing);
}
export function createShop(input: NewShop): Shop {
  assertAuthor(input.author);
  return { id: crypto.randomUUID(), date: japanDate(), author: input.author, url: mapsUrl(input.url), visited: false, row: 0 };
}
export function toRows(shops: Shop[]): unknown[][] {
  return [[...HEADERS], ...shops.map(s => [s.id, s.date, s.author, s.url, s.visited])];
}
