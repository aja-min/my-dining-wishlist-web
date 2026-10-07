import type { Shop } from './model';
import { previewFor, type Preview } from './preview';
export function filterShops(shops: Shop[], query: string, author: string, status: string, order: string, demo = true, previews:Record<string,Preview> = {}, prefecture = 'すべて', municipality = 'すべて', selectedTags: string[] = []) {
  const words = query.toLocaleLowerCase().trim().split(/\s+/).filter(Boolean);
  return shops.filter(s => {
    const preview = previews[s.url] ?? previewFor(s, demo);
    const haystack = `${preview.title} ${preview.description} ${s.author} ${s.url} ${(s.tags ?? []).join(' ')}`.toLocaleLowerCase();
    const regionMatches = (prefecture === 'すべて' || (preview.prefecture ?? '特定不可') === prefecture) && (prefecture !== '東京都' || municipality === 'すべて' || (preview.municipality ?? '特定不可') === municipality);
    const tagMatches = !selectedTags.length || selectedTags.every(tag => (s.tags ?? []).includes(tag));
    return tagMatches && regionMatches && words.every(word => haystack.includes(word)) && (author === '全員' || s.author === author) && (status === 'すべて' || s.visited === (status === '行った'));
  }).sort((a,b) => (order === '古い順' ? 1 : -1) * a.date.localeCompare(b.date) || a.row - b.row);
}
