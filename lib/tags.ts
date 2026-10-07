export const PRESET_TAGS = ['デザート', '居酒屋', 'ビストロ', 'ランチ'];
export function normalizeTags(value: unknown): string[] {
  if (!Array.isArray(value) || value.length > 20) throw new Error('タグは20個まで指定できます。');
  const tags: string[] = [];
  for (const item of value) {
    if (typeof item !== 'string') throw new Error('タグは文字で入力してください。');
    const tag = item.normalize('NFKC').trim().replace(/\s+/g, ' ');
    if (!tag || [...tag].length > 32 || /[\u0000-\u001f\u007f]/.test(item)) throw new Error('タグは空欄・改行を含めず、32文字以内で入力してください。');
    if (!tags.includes(tag)) tags.push(tag);
  }
  return tags;
}
export function parseTagsCell(value: unknown): string[] {
  if (value === undefined || value === null || value === '') return [];
  try { return normalizeTags(JSON.parse(String(value))); }
  catch { throw new Error('タグ列の形式が不正です。文字列のJSON配列にしてください。'); }
}
