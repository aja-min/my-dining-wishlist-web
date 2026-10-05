'use client';
import { useEffect, useState } from 'react';
import { urlPreview, type Preview } from './preview';
import type { Shop } from './model';
export function usePreviews(shops:Shop[], refresh:number) {
  const [previews,setPreviews]=useState<Record<string,Preview>>({});
  const [pending,setPending]=useState<Set<string>>(new Set());
  const key=[...new Set(shops.map(shop=>shop.url))].sort().join('\n');
  useEffect(()=>{
    const urls=key?key.split('\n'):[];
    const controller=new AbortController();
    setPending(new Set(urls));let cursor=0;
    async function worker(){
      while(cursor<urls.length && !controller.signal.aborted){
        const url=urls[cursor++];
        try {
          const response=await fetch(`/api/preview?${new URLSearchParams({url})}`,{signal:controller.signal,cache:'no-store'});
          if(response.ok){const value=await response.json() as Preview;if(!controller.signal.aborted)setPreviews(old=>({...old,[url]:value}));}
        } catch { /* Offline or preview error: leave the saved record and original URL usable. */ }
        finally {if(!controller.signal.aborted)setPending(old=>{const next=new Set(old);next.delete(url);return next;});}
      }
    }
    void worker();void worker();
    return ()=>controller.abort();
  },[key,refresh]);
  return {previews,pending,display:(shop:Shop)=>previews[shop.url] ?? urlPreview(shop.url)};
}
