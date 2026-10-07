import { getSession } from 'next-auth/react';
import { AppError, type Shop, type NewShop } from './model';
import type { ShopRepository } from './repository';
export class HttpRepository implements ShopRepository {
  private async request(method: string, body?: unknown) {
    // Renew the login session cookie and remove legacy Google API credentials.
    await getSession();
    const response = await fetch('/api/shops', { method, credentials: 'same-origin', cache:'no-store', headers: { 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) });
    const data = await response.json();
    if (!response.ok) throw new AppError(data.error ?? '通信に失敗しました。再読み込みしてください。', response.status, data.existing);
    return data;
  }
  async list(): Promise<Shop[]> { return (await this.request('GET')).shops; }
  async add(input: NewShop): Promise<Shop> { return (await this.request('POST', { url: input.url, tags: input.tags })).shop; }
  async remove(id: string) { await this.request('DELETE', { id }); }
  async setVisited(id: string, visited: boolean) { await this.request('PATCH', { id, visited }); }
  async setTags(id: string, tags: string[]) { await this.request('PATCH', { id, tags }); }
  async fillMissingIds(): Promise<number> { return (await this.request('POST', { action: 'fillMissingIds' })).count; }
}
