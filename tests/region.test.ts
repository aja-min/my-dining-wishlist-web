import {test} from 'node:test';
import assert from 'node:assert/strict';
import {addressRegion} from '../lib/region';
import {urlPreview} from '../lib/preview';
import {resolvePreview} from '../lib/resolve-preview';
import {filterShops} from '../lib/query';
const url=(address:string)=>'https://maps.google.com/?q='+encodeURIComponent(address);
test('Japanese URL addresses derive prefecture and Tokyo wards/cities without using shop names or coordinates',()=>{
  for(const [address,prefecture,municipality] of [
    ['〒150-0001 東京都渋谷区神宮前４丁目１３−２０','東京都','渋谷区'],
    ['日本、〒180-0001 東京都武蔵野市吉祥寺北町1-2','東京都','武蔵野市'],
    ['東京都西多摩郡奥多摩町氷川215','東京都','奥多摩町'],
    ['埼玉県和光市下新倉２丁目４９−１ テスト店','埼玉県',undefined],
    ['北海道札幌市中央区北1条','北海道',undefined],
  ]) {
    const preview=urlPreview(url(address!));
    assert.equal(preview.prefecture,prefecture);assert.equal(preview.municipality,municipality);
  }
  for(const label of ['東京都カフェ','渋谷区の居酒屋','35.6,139.7','東京駅','京都府料理店','東京都カフェ1'])assert.equal(urlPreview(url(label)).prefecture,undefined);
  assert.deepEqual(addressRegion('東京都未確認地域'),{prefecture:'東京都'});
});
test('Address from a redirect survives later name-only URLs and HTML title',async()=>{
 const responses=[{status:302,location:url('〒150-0001 東京都渋谷区神宮前4-1'),html:''},{status:302,location:'https://www.google.com/maps/place/Test',html:''},{status:200,html:'<title>Test Cafe - Google Maps</title>'}];
 const preview=await resolvePreview('https://maps.app.goo.gl/test',async()=>responses.shift()!);
 assert.equal(preview.title,'Test Cafe');assert.equal(preview.prefecture,'東京都');assert.equal(preview.municipality,'渋谷区');
});
test('Region filters combine with search, author and visit state; unknown prefecture and unknown Tokyo municipality are distinct',()=>{
 const addresses=['東京都渋谷区神宮前4-1','東京都武蔵野市吉祥寺1-2','埼玉県和光市下新倉1-2','不明','東京都不明町1-2'];
 const shops=addresses.map((a,i)=>({id:String(i),url:url(a),author:'なおと' as const,date:'2026-10-07',visited:i===1,row:i+2}));
 const filter=(pref:string,area='すべて',status='すべて',author='全員',query='')=>filterShops(shops,query,author,status,'新しい順',true,{},pref,area).map(s=>s.id);
 assert.deepEqual(filter('東京都'),['0','1','4']);
 assert.deepEqual(filter('東京都','渋谷区'),['0']);
 assert.deepEqual(filter('東京都','武蔵野市','まだ'),[]);
 assert.deepEqual(filter('東京都','渋谷区','まだ','あずさ'),[]);
 assert.deepEqual(filter('東京都','渋谷区','まだ','なおと','神宮前'),['0']);
 assert.deepEqual(filter('特定不可'),['3']);
 assert.deepEqual(filter('東京都','特定不可'),['4']);
 assert.deepEqual(filter('すべて'),['0','1','2','3','4']);
});
