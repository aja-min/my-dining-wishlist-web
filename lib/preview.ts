import { addressRegion, urlAddress, type Region } from './region';
import { mapsEmbedUrl } from './maps-embed';
import type { Shop } from './model';
export type Preview = Region & { address?: string; title: string; image: string; description: string; illustration: boolean; sample?: boolean; embedUrl?: string; source?: 'url'|'page'|'fallback' };
export function urlPreview(value: string): Preview {
  let address: string | undefined;
  let title = 'Google Mapsのお店';
  let description = '店名を取得できませんでした。Google Mapsで確認できます。';
  try {
    const url = new URL(value);
    const place = url.pathname.match(/\/maps\/place\/([^/]+)/)?.[1];
    const label = place ? decodeURIComponent(place.replace(/\+/g, ' ')) : url.searchParams.get('query') ?? url.searchParams.get('q');
    address = label ? urlAddress(label) : undefined;
    if (label && !/^[@\d.,+\s-]+$/.test(label) && !/^place_id:/.test(label) && label.length < 300) {
      const hasPostalAddress = /^〒\d{3}-\d{4}\s/.test(label);
      const clean = label.replace(/^〒\d{3}-\d{4}\s*/, '').trim();
      const parts = clean.split(/\s+/);
      title = clean;
      description = 'URLに含まれる場所名・住所';
      if (hasPostalAddress && parts.length > 1) {
        // Preserve the exact query words. Split its address and optional floor
        // prefix from the place label without inventing or looking up a name.
        const floor = parts.findLastIndex(part => /^(?:地下)?B?\d+(?:F|階)$/i.test(part));
        const split = floor >= 1 && floor < parts.length - 1 ? floor + 1 : 1;
        title = parts.slice(split).join(' ');
        description = parts.slice(0, split).join(' ');
      } else if (hasPostalAddress) {
        description = 'URLに含まれる住所（店名は未取得）';
      }
    }
  } catch { /* Preview failures must never block data or the original link. */ }
  return { ...(address ? {address,...addressRegion(address)} : {}), title, embedUrl:mapsEmbedUrl(value), image:'/images/pin.svg', description, illustration:true, source:title === 'Google Mapsのお店' ? 'fallback':'url' };
}
export function previewFor(shop: Shop, _demo = false): Preview { return urlPreview(shop.url); }
