import 'server-only';
import {createHmac,timingSafeEqual} from 'node:crypto';
export async function handleLineWebhook(request:Request,secret=process.env.LINE_CHANNEL_SECRET,log:(groupId:string)=>void=console.log):Promise<Response> {
  if(!secret){console.warn('[line] webhook unavailable: missing channel secret');return new Response(null,{status:503});}
  const raw=Buffer.from(await request.arrayBuffer());
  const signature=request.headers.get('x-line-signature');
  const expected=createHmac('sha256',secret).update(raw).digest();
  if(!signature || !/^[A-Za-z0-9+/]{43}=$/.test(signature))return new Response(null,{status:401});
  const received=Buffer.from(signature,'base64');
  if(received.length!==expected.length || !timingSafeEqual(expected,received))return new Response(null,{status:401});
  let payload;
  try {payload=JSON.parse(raw.toString('utf8'));}catch{return new Response(null,{status:400});}
  if(!payload || !Array.isArray(payload.events))return new Response(null,{status:400});
  for(const event of payload.events){
    if(event?.source?.type!=='group' || typeof event.source.groupId!=='string' || !/^C[0-9a-f]{32}$/i.test(event.source.groupId))continue;
    if(event.type==='join' || (event.type==='message' && event.message?.type==='text' && event.message.text==='通知設定'))log(event.source.groupId);
  }
  return new Response(null,{status:200});
}
