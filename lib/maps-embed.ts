import { mapsUrl } from './model';
// Let Google render its own place card and map. Never generate a map image,
// reconstruct Google's UI, or guess a place name from an opaque short code.
export function mapsEmbedUrl(input:string):string | undefined {
  try {
    const source=new URL(mapsUrl(input));
    const result=new URL('https://maps.google.com/maps');
    const placeData=decodeURIComponent(source.pathname).match(/!1s(0x[0-9a-f]+:0x[0-9a-f]+)/i)?.[1];
    const fid=source.searchParams.get('ftid') ?? placeData;
    const cid=source.searchParams.get('cid');
    if(fid && /^0x[0-9a-f]+:0x[0-9a-f]{1,16}$/i.test(fid)) result.searchParams.set('cid',BigInt(fid.split(':')[1]).toString());
    else if(cid && /^\d{1,20}$/.test(cid)) result.searchParams.set('cid',cid);
    else {
      const placeId=source.searchParams.get('query_place_id');
      const query=source.searchParams.get('query') ?? source.searchParams.get('q');
      const place=source.pathname.match(/\/maps\/place\/([^/]+)/)?.[1];
      const label=placeId ? `place_id:${placeId}` : query ?? (place ? decodeURIComponent(place.replace(/\+/g,' ')) : undefined);
      if(!label || label.length>500)return;
      result.searchParams.set('q',label);
    }
    result.searchParams.set('output','embed');
    result.searchParams.set('hl','ja');
    return result.href;
  } catch { return; }
}
