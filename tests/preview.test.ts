import {test} from 'node:test';
import assert from 'node:assert/strict';
import {resolvePreview,parseMetadata,safeImage} from '../lib/resolve-preview';
import {publicAddress} from '../lib/safe-map-fetch';
import {urlPreview} from '../lib/preview';
import {filterShops} from '../lib/query';
const short='https://maps.app.goo.gl/example';
test('Short URLs resolve generically: no per-URL names, HTML entities and OG title',async()=>{
 const calls:string[]=[];
 const result=await resolvePreview(short,async url=>{calls.push(url);return calls.length===1?{status:302,location:'https://www.google.com/maps/place/Test+Cafe',html:''}:{status:200,html:'<meta property="og:title" content="Cafe &amp; Tea - Google Maps"><meta property="og:image" content="https://lh3.googleusercontent.com/p/public-photo">'};});
 assert.equal(result.title,'Cafe & Tea');assert.equal(result.illustration,false);assert.equal(result.image,'https://lh3.googleusercontent.com/p/public-photo');assert.equal(calls.length,2);
});
test('Generic page title keeps query address from resolved URL; timeout keeps link usable',async()=>{
 const target='https://maps.google.com/?q='+encodeURIComponent('〒123-4567 東京都テスト区1-2 テスト食堂');let n=0;
 const value=await resolvePreview(short,async()=>++n===1?{status:302,location:target,html:''}:{status:200,html:'<title>Google マップ</title>'});
 assert.match(value.title,/テスト食堂/);assert.match(value.description,/東京都/);assert.equal(value.source,'url');
 assert.equal((await resolvePreview(short,async()=>{throw new Error('timeout');})).title,'Google Mapsのお店');
});
test('Every redirect destination is validated before network access',async()=>{
 for(const destination of ['http://127.0.0.1/a','https://evil.example/a','https://www.google.com/url?q=https://localhost','https://maps.google.com:444/a','https://user:pass@maps.google.com/a']){
 let calls=0;const result=await resolvePreview(short,async()=>{calls++;return {status:302,location:destination,html:''};});assert.equal(calls,1);assert.equal(result.source,'fallback');
 }
});
test('Redirect loops have a hard bound',async()=>{let calls=0;await resolvePreview(short,async()=>{calls++;return {status:302,location:short,html:''};});assert.equal(calls,6);});
test('Private, link-local, metadata, loopback and reserved addresses cannot be fetched',()=>{
 for(const ip of ['127.0.0.1','10.0.0.1','169.254.169.254','192.168.1.1','172.16.1.1','100.64.0.1','0.0.0.0','224.0.0.1','198.18.0.1','::1','::ffff:127.0.0.1'])assert.equal(publicAddress(ip),false,ip);
 assert.equal(publicAddress('8.8.8.8'),true);
});
test('Only public Google photo hosts are allowed; no arbitrary/static API images',()=>{
 for(const url of ['https://evil.example/p/x','http://lh3.googleusercontent.com/p/x','https://lh3.googleusercontent.com.evil.example/p/x','https://127.0.0.1/p/x','https://maps.google.com/maps/api/staticmap?key=foo','https://lh3.googleusercontent.com/p/x?key=foo'])assert.equal(safeImage(url),undefined);
 const preview=parseMetadata('<title>Test - Google Maps</title><meta property="og:image" content="https://evil.example/x">',urlPreview(short));assert.equal(preview.image,'/images/pin.svg');assert.equal(preview.illustration,true);
});
test('Resolved names participate in combined search with author and state',()=>{
 const shop={id:'20000000-0000-4000-8000-000000000001',url:short,date:'2026-10-04',author:'あずさ' as const,visited:false,row:2};const previews={[short]:{...urlPreview(short),title:'自動取得のカフェ'}};
 assert.equal(filterShops([shop],'カフェ','あずさ','まだ','新しい順',false,previews).length,1);assert.equal(filterShops([shop],'カフェ','なおと','まだ','新しい順',false,previews).length,0);
});

test('Generic OG title does not hide a useful document title',()=>{const value=parseMetadata('<meta property="og:title" content="Google Maps"><title>Actual Cafe - Google Maps</title>',urlPreview(short));assert.equal(value.title,'Actual Cafe');});
