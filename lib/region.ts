// Only classify explicit Japanese addresses, never a map viewport or shop name.
export const PREFECTURES = '北海道 青森県 岩手県 宮城県 秋田県 山形県 福島県 茨城県 栃木県 群馬県 埼玉県 千葉県 東京都 神奈川県 新潟県 富山県 石川県 福井県 山梨県 長野県 岐阜県 静岡県 愛知県 三重県 滋賀県 京都府 大阪府 兵庫県 奈良県 和歌山県 鳥取県 島根県 岡山県 広島県 山口県 徳島県 香川県 愛媛県 高知県 福岡県 佐賀県 長崎県 熊本県 大分県 宮崎県 鹿児島県 沖縄県'.split(' ');
const TOKYO_AREAS = '千代田区 中央区 港区 新宿区 文京区 台東区 墨田区 江東区 品川区 目黒区 大田区 世田谷区 渋谷区 中野区 杉並区 豊島区 北区 荒川区 板橋区 練馬区 足立区 葛飾区 江戸川区 八王子市 立川市 武蔵野市 三鷹市 青梅市 府中市 昭島市 調布市 町田市 小金井市 小平市 日野市 東村山市 国分寺市 国立市 福生市 狛江市 東大和市 清瀬市 東久留米市 武蔵村山市 多摩市 稲城市 羽村市 あきる野市 西東京市 瑞穂町 日の出町 檜原村 奥多摩町 大島町 利島村 新島村 神津島村 三宅村 御蔵島村 八丈町 青ヶ島村 小笠原村'.split(' ');
export type Region = { prefecture?: string; municipality?: string };
export function addressRegion(address: string): Region {
  const clean = address.normalize('NFKC').replace(/^(?:日本[、,]?\s*)?(?:〒?\d{3}-?\d{4}\s*)?/, '').trim();
  const prefecture = PREFECTURES.find(value => clean.startsWith(value));
  if (!prefecture) return {};
  const rest = clean.slice(prefecture.length).trim().replace(/^(?:西多摩郡|大島支庁|三宅支庁|八丈支庁|小笠原支庁)\s*/, '');
  const municipality = prefecture === '東京都' ? TOKYO_AREAS.find(value => rest.startsWith(value)) : undefined;
  return { prefecture, ...(municipality ? { municipality } : {}) };
}
export function urlAddress(label: string): string | undefined {
  const text = label.normalize('NFKC').trim();
  // Address-bearing queries normally include a postal code or street number.
  const region = addressRegion(text);
  if (!region.prefecture || !/[市区町村]/.test(text.slice(text.indexOf(region.prefecture) + region.prefecture.length))) return;
  return /(?:〒?\d{3}-\d{4}|[0-9]+(?:丁目|番|号|条|[-−ー])|[0-9]+(?:\s|$))/.test(text) ? text : undefined;
}
