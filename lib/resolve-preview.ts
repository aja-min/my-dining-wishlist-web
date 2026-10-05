import { Parser } from 'htmlparser2';
import { mapsUrl } from './model';
import { urlPreview, type Preview } from './preview';
import { safeMapFetch, type PageResponse } from './safe-map-fetch';
export function safeImage(value:string): string | undefined {
  try {
    const url=new URL(value);
    if (url.protocol!=='https:' || url.username || url.password || url.port) return;
    if (!/^lh[3-6]\.googleusercontent\.com$/.test(url.hostname)) return;
    if (!/^\/(?:p|gps-cs-s)\//.test(url.pathname)) return;
    if (url.searchParams.has('key') || value.length>2048) return;
    return url.href;
  } catch { return; }
}
export function parseMetadata(html:string, fallback:Preview): Preview {
  const meta:Record<string,string>={};let inTitle=false;let title='';
  const parser=new Parser({
    onopentag(name,attrs){if(name==='title')inTitle=true;if(name==='meta'){const key=(attrs.property ?? attrs.name ?? attrs.itemprop ?? '').toLowerCase();if(attrs.content && !meta[key])meta[key]=attrs.content;}},
    ontext(text){if(inTitle && title.length<500)title+=text;},onclosetag(name){if(name==='title')inTitle=false;},
  },{decodeEntities:true});parser.write(html);parser.end();
  const raw=[meta['og:title'],meta['twitter:title'],title].filter(Boolean).map(value=>value.replace(/\s*[-–—|·]\s*Google\s*(?:Maps|マップ)\s*$/i,'').trim()).find(value=>value.length>0 && value.length<300 && !/^(?:Google\s*(?:Maps|マップ)|Google|地図)$/i.test(value) && !/Before you continue|consent|captcha|unusual traffic/i.test(value));
  const meaningful=Boolean(raw);
  const image=safeImage(meta['og:image'] ?? meta['twitter:image'] ?? '');
  return { ...fallback, ...(meaningful ? {title:raw,description:'Google Mapsの公開ページから取得',source:'page' as const}:{}), ...(image ? {image,illustration:false}: {}) };
}
export type FetchPage=(url:string,signal:AbortSignal)=>Promise<PageResponse>;
export async function resolvePreview(input:string, fetchPage:FetchPage=safeMapFetch):Promise<Preview> {
  let current=mapsUrl(input);let fallback=urlPreview(current);
  const signal=AbortSignal.timeout(8000);
  try {
    for(let redirects=0;redirects<=5;redirects++){
      const response=await fetchPage(current,signal);
      if([301,302,303,307,308].includes(response.status)){
        if(!response.location || redirects===5)break;
        // Every destination is independently allowlisted before DNS or HTTP access.
        current=mapsUrl(new URL(response.location,current).href);
        const next=urlPreview(current);if(next.source!=='fallback' || next.embedUrl)fallback=next;
        continue;
      }
      if(response.status!==200)break;
      return parseMetadata(response.html,fallback);
    }
  } catch { /* Network, timeout, oversized page or blocked redirect: keep usable URL metadata. */ }
  return fallback;
}
const cache=new Map<string,{value:Preview;expires:number}>();
const pending=new Map<string,Promise<Preview>>();
export async function cachedPreview(input:string):Promise<Preview> {
  const url=mapsUrl(input);const saved=cache.get(url);
  if(saved && saved.expires>Date.now())return saved.value;
  const existing=pending.get(url);if(existing)return existing;
  if(pending.size>=4)return urlPreview(url);
  const work=resolvePreview(url).then(value=>{if(cache.size>=100)cache.delete(cache.keys().next().value!);cache.set(url,{value,expires:Date.now()+(value.source==='page'?15*60_000:60_000)});return value;}).finally(()=>pending.delete(url));
  pending.set(url,work);return work;
}
