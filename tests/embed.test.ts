import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mapsEmbedUrl} from '../lib/maps-embed';
import {resolvePreview} from '../lib/resolve-preview';
test('Google embed uses exact CID derived from the linked place, even without a name',async()=>{
 const fid='0x6018ebef6e154891:0x4e4185e88e44ec8e';
 const result=await resolvePreview('https://maps.app.goo.gl/test',async url=>url.includes('goo.gl')?{status:302,location:'https://maps.google.com?ftid='+fid,html:''}:{status:200,html:'<title>Google Maps</title>'});
 const embed=new URL(result.embedUrl!);assert.equal(embed.origin,'https://maps.google.com');assert.equal(embed.searchParams.get('cid'),'5638935442310360206');assert.equal(embed.searchParams.get('output'),'embed');
});
test('No guessed shop labels: exact place ID, cid or query goes to Google',()=>{
 assert.equal(new URL(mapsEmbedUrl('https://www.google.com/maps/search/?api=1&query=Test+Cafe&query_place_id=ChIJexample')!).searchParams.get('q'),'place_id:ChIJexample');
 assert.equal(new URL(mapsEmbedUrl('https://www.google.com/maps?cid=123')!).searchParams.get('cid'),'123');
 assert.equal(new URL(mapsEmbedUrl('https://www.google.com/maps/place/Tea+Room')!).searchParams.get('q'),'Tea Room');
 assert.equal(new URL(mapsEmbedUrl('https://www.google.com/maps/place/Name/data=!1s0x12:0x2a')!).searchParams.get('cid'),'42');
});
test('Short unresolved links and untrusted hosts are not iframe sources',()=>{
 assert.equal(mapsEmbedUrl('https://maps.app.goo.gl/unknown'),undefined);assert.equal(mapsEmbedUrl('https://evil.example/?q=abc'),undefined);assert.equal(mapsEmbedUrl('javascript:alert(1)'),undefined);
});
