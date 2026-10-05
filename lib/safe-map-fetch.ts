import { lookup as dnsLookup } from 'node:dns/promises';
import { BlockList, isIPv4 } from 'node:net';
import https from 'node:https';
import { mapsUrl } from './model';
const blocked = new BlockList();
for (const [address, prefix] of [['0.0.0.0',8],['10.0.0.0',8],['100.64.0.0',10],['127.0.0.0',8],['169.254.0.0',16],['172.16.0.0',12],['192.0.0.0',24],['192.0.2.0',24],['192.88.99.0',24],['192.168.0.0',16],['198.18.0.0',15],['198.51.100.0',24],['203.0.113.0',24],['224.0.0.0',4],['240.0.0.0',4]] as [string,number][]) blocked.addSubnet(address,prefix,'ipv4');
export function publicAddress(address:string) { return isIPv4(address) && !blocked.check(address,'ipv4'); }
export type PageResponse = { status:number; location?:string; html:string };
export async function safeMapFetch(value:string, signal:AbortSignal): Promise<PageResponse> {
  const url = new URL(mapsUrl(value));
  signal.throwIfAborted();
  const addresses = await new Promise<Awaited<ReturnType<typeof dnsLookup>>>((resolve,reject)=>{
    const abort=()=>reject(new Error('TIMEOUT'));signal.addEventListener('abort',abort,{once:true});
    dnsLookup(url.hostname,{family:4}).then(resolve,reject).finally(()=>signal.removeEventListener('abort',abort));
  });
  signal.throwIfAborted();
  if (!publicAddress(addresses.address)) throw new Error('PRIVATE_ADDRESS');
  return new Promise((resolve,reject)=>{
    const request=https.get(url,{
      signal, family:4, agent:false,
      // Pin the checked address; TLS still validates the original Google hostname.
      lookup: ((_host:unknown,_options:unknown,callback:any)=>callback(null,addresses.address,4)) as any,
      headers:{'Accept':'text/html','Accept-Language':'ja','Accept-Encoding':'identity','User-Agent':'DiningWishlistLinkPreview/1.0'},
    },response=>{
      const status=response.statusCode ?? 0;
      if ([301,302,303,307,308].includes(status)) {response.resume();resolve({status,location:response.headers.location,html:''});return;}
      if (status!==200) {response.resume();reject(new Error('HTTP_ERROR'));return;}
      if (!response.headers['content-type']?.toLowerCase().includes('text/html') || (response.headers['content-encoding'] && response.headers['content-encoding']!=='identity')) {response.destroy();reject(new Error('UNSUPPORTED_CONTENT'));return;}
      const max=2_000_000;
      if (Number(response.headers['content-length'] ?? 0)>max) {response.destroy();reject(new Error('TOO_LARGE'));return;}
      const chunks:Buffer[]=[];let length=0;
      response.on('data',(chunk:Buffer)=>{length+=chunk.length;if(length>max){response.destroy();reject(new Error('TOO_LARGE'));}else chunks.push(chunk);});
      response.on('end',()=>resolve({status,html:Buffer.concat(chunks).toString('utf8')}));
      response.on('error',reject);response.on('aborted',()=>reject(new Error('ABORTED')));
    });
    request.on('error',reject);
  });
}
