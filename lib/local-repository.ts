import { AppError, createShop, duplicate, parseCsv, parseRows, toRows, uniqueShop, type NewShop, type Shop } from './model';
import type { ShopRepository } from './repository';
export const STORAGE_KEY = 'ikitai-omise.demo.v1';
type StorageLike = Pick<Storage, 'getItem' | 'setItem'>;
export class LocalRepository implements ShopRepository {
  constructor(private seed: () => Promise<string>, private storage: StorageLike) {}
  async list() {
    try {
      const saved = this.storage.getItem(STORAGE_KEY);
      if (saved === null) return parseCsv(await this.seed());
      const data = JSON.parse(saved);
      if (data.version !== 1 || !Array.isArray(data.rows)) throw new Error();
      return parseRows(data.rows);
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError('保存データを読み込めません。ブラウザの保存設定を確認するか、サンプルにリセットしてください。');
    }
  }
  private write(shops: Shop[]) {
    try { this.storage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, rows: toRows(shops) })); }
    catch { throw new AppError('保存できませんでした。ブラウザの保存容量・設定を確認してください。'); }
  }
  private async edit<T>(change: (shops: Shop[]) => T): Promise<T> {
    const run = async () => { const shops = await this.list(); const result = change(shops); this.write(shops); return result; };
    // Serialize same-origin tabs when Web Locks are supported.
    if (typeof navigator !== 'undefined' && navigator.locks) return navigator.locks.request(STORAGE_KEY, run);
    return run();
  }
  async add(input: NewShop) { const shop = createShop(input); return this.edit(shops => { duplicate(shops, shop.url); shops.push(shop); return shop; }); }
  async remove(id: string) { await this.edit(shops => { const shop = uniqueShop(shops, id); shops.splice(shops.indexOf(shop), 1); }); }
  async setVisited(id: string, visited: boolean) { await this.edit(shops => { uniqueShop(shops, id).visited = visited; }); }
  async fillMissingIds() { return this.edit(shops => { let n = 0; shops.forEach(s => { if (!s.id) { s.id = crypto.randomUUID(); n++; } }); return n; }); }
  async reset() { const shops = parseCsv(await this.seed()); this.write(shops); }
}
export const loadSeed = async () => {
  const response = await fetch('/data/shops.csv', { cache: 'no-store' });
  if (!response.ok) throw new AppError('サンプルCSVを読み込めません。再読み込みしてください。');
  return response.text();
};
