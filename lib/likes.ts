import {AppError} from './model';
export const LIKES_TAB = 'いいね履歴';
export const LIKE_HEADERS = ['操作ID','お店ID'] as const;
export function likeOperation(value:unknown):string {
  if(typeof value!=='string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value))throw new AppError('いいねの操作IDが不正です。');
  return value.toLowerCase();
}
export function readLikes(rows:unknown[][]):Map<string,Set<string>> {
  if(rows[0]?.length!==2 || LIKE_HEADERS.some((h,i)=>rows[0][i]!==h))throw new AppError('いいね履歴の設定を確認してください。',503);
  const result=new Map<string,Set<string>>();
  for(const row of rows.slice(1)) {
    if(row.every(v=>v===null || v===undefined || v===''))continue;
    const operation=likeOperation(row[0]);const id=String(row[1]??'').toLowerCase();
    if(!/^[0-9a-f-]{36}$/.test(id) || row.slice(2).some(v=>String(v??'').trim()))throw new AppError('いいね履歴の形式が不正です。',503);
    const events=result.get(id)??new Set<string>();events.add(operation);result.set(id,events);
  }
  return result;
}
