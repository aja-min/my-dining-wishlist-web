import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {notifyShopAdded,addAndNotify} from '../lib/line-notification.ts';
import {handleLineWebhook} from '../lib/line-webhook.ts';
const shop={id:'10000000-0000-4000-8000-000000000001',author:'あずさ',url:'https://maps.app.goo.gl/example',date:'2026-10-10',visited:false,row:2};
const config={token:'test-token',groupId:'C'+'a'.repeat(32),appUrl:'https://app.example/'};
test('push sends exact three lines, fixed group and stable retry key; retries 5xx and accepts deduplication',async()=>{
 const calls=[],logs=[];
 await notifyShopAdded(shop,config,async(url,init)=>{calls.push({url,...init});return calls.length===1?new Response('',{status:500}):new Response(null,{status:409,headers:{'x-line-accepted-request-id':'accepted'}});},m=>logs.push(m));
 assert.equal(calls.length,2);assert.equal(calls[0].headers['X-Line-Retry-Key'],shop.id);assert.deepEqual(calls[0].headers,calls[1].headers);assert.equal(calls[0].body,calls[1].body);assert.ok(calls[0].signal);
 assert.deepEqual(JSON.parse(calls[0].body),{to:config.groupId,messages:[{type:'text',text:`🍽️ あずさが「いきたいお店」を追加しました\nGoogleマップ: ${shop.url}\nURL: https://app.example/`}]});assert.ok(!logs.join('').includes(config.token));
});
test('network retry uses same key; 4xx and missing configuration do not retry; errors never escape',async()=>{
 let n=0;const keys=[];await notifyShopAdded(shop,config,async(_u,i)=>{keys.push(i.headers['X-Line-Retry-Key']);if(++n===1)throw new Error('secret');return new Response(null,{status:200});},()=>{});assert.deepEqual(keys,[shop.id,shop.id]);
 n=0;await notifyShopAdded(shop,config,async()=>{n++;return new Response(null,{status:401});},()=>{});assert.equal(n,1);
 await notifyShopAdded(shop,{},async()=>{throw new Error('must not send');},()=>{});
});
test('save failure prevents notification; server-returned author wins; notification rejection still returns saved shop',async()=>{
 let sends=0;await assert.rejects(()=>addAndNotify({add:async()=>{throw new Error('save failed');}},{url:shop.url,author:'なおと'},async()=>{sends++;}));assert.equal(sends,0);
 const result=await addAndNotify({add:async()=>shop},{url:shop.url,author:'なおと'},async(saved)=>{assert.equal(saved.author,'あずさ');sends++;throw new Error('push failed');});assert.equal(result,shop);assert.equal(sends,1);
});
const secret='test-secret';
function request(raw,signature=createHmac('sha256',secret).update(raw).digest('base64')){return new Request('https://app.example/api/line/webhook',{method:'POST',headers:{'x-line-signature':signature},body:raw});}
test('webhook checks unmodified bytes before JSON; valid empty events return 200',async()=>{
 const raw=' { "events": [] }\n';assert.equal((await handleLineWebhook(request(raw),secret)).status,200);
 assert.equal((await handleLineWebhook(request(raw+' ',request(raw).headers.get('x-line-signature')),secret)).status,401);
 assert.equal((await handleLineWebhook(request('not json','bad'),secret)).status,401);
 assert.equal((await handleLineWebhook(request('not json'),secret)).status,400);
 assert.equal((await handleLineWebhook(request('{}'),secret)).status,400);
});
test('webhook logs only groupId for join or exact setup text; does not log other events or invalid signatures',async()=>{
 const group={type:'group',groupId:config.groupId,userId:'private-user'};const logs=[];
 const raw=JSON.stringify({events:[{type:'join',source:group},{type:'message',source:group,message:{type:'text',text:'通知設定'}},{type:'message',source:group,message:{type:'text',text:'private message'}},{type:'message',source:{type:'user',userId:'private-user'},message:{type:'text',text:'通知設定'}},null]});
 assert.equal((await handleLineWebhook(request(raw),secret,m=>logs.push(m))).status,200);assert.deepEqual(logs,[config.groupId,config.groupId]);
 await handleLineWebhook(request(raw,'bad'),secret,m=>logs.push(m));assert.equal(logs.length,2);
});
