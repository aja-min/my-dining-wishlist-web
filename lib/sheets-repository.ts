import { normalizeTags } from './tags';
import { AppError, HEADERS, createShop, duplicate, parseRows, uniqueShop, type Author, type NewShop, type Shop } from './model';
import type { ShopRepository } from './repository';
export type SheetsRequest = (suffix: string, init?: RequestInit) => Promise<any>;
// This adapter receives an authenticated server-side request function
// and one configured spreadsheet. It never receives a spreadsheet ID from the UI.
export class SheetsRepository implements ShopRepository {
  private range: string;
  constructor(private request: SheetsRequest, private tab: string, private author: Author) { this.range = `'${tab.replace(/'/g, "''")}'`; }
  private async snapshot(requireTags = false) {
    const data = await this.request(`/values/${encodeURIComponent(this.range)}?valueRenderOption=FORMATTED_VALUE&dateTimeRenderOption=FORMATTED_STRING`);
    const rows: unknown[][] = data.values ?? [];
    // Writes must keep A–E in the prescribed order. Reads still map by header names.
    const shops = parseRows(rows);
    if (HEADERS.some((h, i) => rows[0][i] !== h)) throw new AppError('Google SheetsのA〜E列を指定のヘッダー順に戻してください。');
    if (rows[0].length === 6 && rows[0][5] !== 'タグ') throw new AppError('Google SheetsのF列を「タグ」にしてください。');
    if (requireTags && rows[0][5] !== 'タグ') throw new AppError('タグ保存用の列が未設定です。管理者に確認してください。', 503);
    return shops;
  }
  async list() { return this.snapshot(); }
  private async writeCell(range: string, values: unknown[][]) {
    await this.request(`/values/${encodeURIComponent(`${this.range}!${range}`)}?valueInputOption=RAW`, { method: 'PUT', body: JSON.stringify({ values }) });
  }
  async add(input: NewShop) {
    const shop = createShop({ url: input.url, author: this.author, tags: input.tags });
    const metadata = await this.request('?fields=sheets.properties');
    const sheet = metadata.sheets?.find((s: { properties: { title: string } }) => s.properties.title === this.tab);
    if (!Number.isInteger(sheet?.properties.sheetId)) throw new AppError('設定したタブが見つかりません。');
    const shops = await this.snapshot(Boolean(shop.tags?.length));
    duplicate(shops, shop.url);
    // Insert at the first gap in actual shop rows, ignoring checkbox-only rows.
    // Insertion and writing are one atomic batch, so existing rows are not overwritten.
    const occupied = new Set(shops.map(item => item.row));
    let row = 2;
    while (occupied.has(row)) row++;
    const sheetId = sheet.properties.sheetId;
    await this.request(':batchUpdate', { method: 'POST', body: JSON.stringify({ requests: [
      { insertDimension: { range: { sheetId, dimension: 'ROWS', startIndex: row - 1, endIndex: row }, inheritFromBefore: row > 2 } },
      { updateCells: { start: { sheetId, rowIndex: row - 1, columnIndex: 0 }, rows: [{ values: [...[shop.id, shop.date, shop.author, shop.url].map(stringValue => ({ userEnteredValue: { stringValue } })), { userEnteredValue: { boolValue: false } }, ...(shop.tags?.length ? [{userEnteredValue:{stringValue:JSON.stringify(shop.tags)}}] : [])] }], fields: 'userEnteredValue' } },
      { setDataValidation: { range: { sheetId, startRowIndex: row - 1, endRowIndex: row, startColumnIndex: 4, endColumnIndex: 5 }, rule: { condition: { type: 'BOOLEAN' }, strict: true, showCustomUi: true } } },
    ] }) });
    return shop;
  }
  async setVisited(id: string, visited: boolean) {
    if (typeof visited !== 'boolean') throw new AppError('訪問状態が不正です。');
    const shop = uniqueShop(await this.snapshot(), id);
    await this.writeCell(`E${shop.row}`, [[visited]]);
  }
  async setTags(id: string, tags: string[]) {
    let value: string[];
    try { value = normalizeTags(tags); } catch(e) { throw new AppError((e as Error).message); }
    const shop = uniqueShop(await this.snapshot(true), id);
    await this.writeCell(`F${shop.row}`, [[JSON.stringify(value)]]);
  }
  async remove(id: string) {
    const metadata = await this.request('?fields=sheets.properties');
    const sheet = metadata.sheets?.find((s: { properties: { title: string } }) => s.properties.title === this.tab);
    if (!Number.isInteger(sheet?.properties.sheetId)) throw new AppError('設定したタブが見つかりません。');
    const shop = uniqueShop(await this.snapshot(), id);
    await this.request(':batchUpdate', { method: 'POST', body: JSON.stringify({ requests: [{ deleteDimension: { range: { sheetId: sheet.properties.sheetId, dimension: 'ROWS', startIndex: shop.row - 1, endIndex: shop.row } } }] }) });
  }
  async fillMissingIds() {
    const shops = await this.snapshot();
    const data = shops.filter(s => !s.id).map(s => ({ range: `${this.range}!A${s.row}`, values: [[crypto.randomUUID()]] }));
    if (data.length) await this.request('/values:batchUpdate', { method:'POST', body: JSON.stringify({ valueInputOption:'RAW', data }) });
    return data.length;
  }
}
