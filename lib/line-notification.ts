import 'server-only';
import type { NewShop, Shop } from './model';
import type { ShopRepository } from './repository';
type Config = { token?: string; groupId?: string; appUrl?: string };
export async function notifyShopAdded(shop: Shop, config: Config = {token:process.env.LINE_CHANNEL_ACCESS_TOKEN,groupId:process.env.LINE_GROUP_ID,appUrl:process.env.APP_URL}, send:typeof fetch = fetch, log:(message:string)=>void = console.warn):Promise<void> {
  try {
    if(!config.token || !config.groupId || !config.appUrl){log('[line] notification skipped: missing configuration');return;}
    const appUrl=new URL(config.appUrl);
    if(appUrl.protocol!=='https:' || appUrl.username || appUrl.password || /[\r\n]/.test(config.appUrl) || !/^C[0-9a-f]{32}$/i.test(config.groupId)){log('[line] notification skipped: invalid configuration');return;}
    const text=`🍽️ ${shop.author}が「いきたいお店」を追加しました\nGoogleマップ: ${shop.url}\nURL: ${config.appUrl}`;
    if(text.length>5000){log('[line] notification skipped: message too long');return;}
    // One saved shop = one stable UUID, including every retry of this push.
    const signal=AbortSignal.timeout(4000);
    const body=JSON.stringify({to:config.groupId,messages:[{type:'text',text}]});
    for(let attempt=0;attempt<2;attempt++){
      try {
        const response=await send('https://api.line.me/v2/bot/message/push',{method:'POST',headers:{Authorization:`Bearer ${config.token}`,'Content-Type':'application/json','X-Line-Retry-Key':shop.id},body,signal});
        // Do not log LINE response bodies (they can contain request data).
        await response.body?.cancel();
        if(response.ok || (response.status===409 && response.headers.has('x-line-accepted-request-id')))return;
        log(`[line] push failed: HTTP ${response.status}, attempt ${attempt+1}`);
        if(response.status<500 || attempt===1)return;
      }catch{log(`[line] push network failure or timeout, attempt ${attempt+1}`);if(signal.aborted || attempt===1)return;}
      await new Promise(resolve=>setTimeout(resolve,100));
    }
  } catch { log('[line] notification failed'); }
}
// Await completion, but never turn a committed save into a failed addition.
export async function addAndNotify(repository: Pick<ShopRepository,'add'>, input:NewShop, notify:(shop:Shop)=>Promise<void>=notifyShopAdded):Promise<Shop> {
  const shop=await repository.add(input);
  try {await notify(shop);}catch{console.warn('[line] notification failed after save');}
  return shop;
}
