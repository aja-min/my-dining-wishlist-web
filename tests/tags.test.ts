import {test} from 'node:test';
import assert from 'node:assert/strict';
import {normalizeTags} from '../lib/tags';
import {HEADERS,parseRows,toRows,createShop} from '../lib/model';
import {LocalRepository,STORAGE_KEY} from '../lib/local-repository';
import {SheetsRepository} from '../lib/sheets-repository';
import {filterShops} from '../lib/query';
const id='10000000-0000-4000-8000-000000000001';
const id2='10000000-0000-4000-8000-000000000002';
const row=(uid=id)=>[uid,'2026-10-08','なおと','https://maps.google.com/?q='+encodeURIComponent('東京都渋谷区神宮前1-2'),false];
test('Tags normalize and deduplicate, preserve commas/quotes, and reject malformed or oversized values',()=>{
 assert.deepEqual(normalizeTags([' 居酒屋 ','居酒屋','Ｃａｆｅ','パン,ケーキ','"夜"']),['居酒屋','Cafe','パン,ケーキ','"夜"']);
 for(const value of [null,'ランチ',[1],[''],['a\nb'],['x'.repeat(33)],Array(21).fill('a')])assert.throws(()=>normalizeTags(value));
 assert.deepEqual(normalizeTags([]),[]);
});
test('Legacy five columns load as untagged and six-column serialization preserves arbitrary tags',()=>{
 const shops=parseRows([[...HEADERS],row()]);assert.deepEqual(shops[0].tags,[]);
 shops[0].tags=['居酒屋','パン,ケーキ','=1+1'];
 assert.deepEqual(parseRows(toRows(shops)),shops);
 assert.throws(()=>parseRows([[...HEADERS,'タグ'],[...row(),'not json']]));
 assert.throws(()=>parseRows([[...HEADERS,'タグ'],['','','','','FALSE','["ランチ"]']]));
 assert.throws(()=>parseRows([[...HEADERS],[...row(),'unlabelled value']]));
});
test('Local tags persist, removal preserves other fields and old storage upgrades without data loss',async()=>{
 let saved=JSON.stringify({version:1,rows:[[...HEADERS],row()]});
 const storage={getItem:()=>saved,setItem:(_k:string,v:string)=>{saved=v;}};
 let repo=new LocalRepository(async()=>'',storage);
 await repo.setTags(id,['デザート','ランチ']);repo=new LocalRepository(async()=>'',storage);
 assert.deepEqual((await repo.list())[0].tags,['デザート','ランチ']);
 await repo.setVisited(id,true);assert.deepEqual((await repo.list())[0].tags,['デザート','ランチ']);
 await repo.setTags(id,[]);assert.equal((await repo.list())[0].visited,true);assert.deepEqual((await repo.list())[0].tags,[]);
 const added=await repo.add({url:'https://maps.app.goo.gl/new',author:'あずさ',tags:['ビストロ']});assert.deepEqual(added.tags,['ビストロ']);
});
test('Sheets tags update only current F cell using RAW; missing header, duplicate ID and wrong order cannot write',async()=>{
 const calls:{suffix:string;init?:RequestInit}[]=[];
 let rows:unknown[][]=[[...HEADERS,'タグ'],[...row(id2),'[]'],[],[...row(),'["ランチ"]']];
 const repo=new SheetsRepository(async(suffix,init)=>{calls.push({suffix,init});return {values:rows};},'お店','あずさ');
 await repo.setTags(id,['=1+1','居酒屋']);const last=calls.at(-1)!;
 assert.match(decodeURIComponent(last.suffix),/!F4\?valueInputOption=RAW/);assert.deepEqual(JSON.parse(last.init!.body as string).values,[['["=1+1","居酒屋"]']]);
 for(const invalid of [[[...HEADERS],row()],[[...HEADERS,'タグ'],row(),row()],[[...HEADERS,'タグ'].reverse(),[...row(),'[]'].reverse()]]){
  rows=invalid;const writes=calls.filter(c=>c.init).length;await assert.rejects(()=>repo.setTags(id,[]));assert.equal(calls.filter(c=>c.init).length,writes);
 }
});
test('Sheets creation writes tags as stringValue, uses server author and retains checkbox',async()=>{
 const writes:RequestInit[]=[];
 const repo=new SheetsRepository(async(suffix,init)=>{if(init){writes.push(init);return {}; }return suffix.startsWith('?')?{sheets:[{properties:{title:'お店',sheetId:7}}]}:{values:[[...HEADERS,'タグ']]};},'お店','あずさ');
 await repo.add({url:'https://maps.app.goo.gl/new',author:'なおと',tags:['居酒屋','ランチ']});
 const values=JSON.parse(writes[0].body as string).requests[1].updateCells.rows[0].values;
 assert.equal(values[2].userEnteredValue.stringValue,'あずさ');assert.equal(values[4].userEnteredValue.boolValue,false);assert.equal(values[5].userEnteredValue.stringValue,'["居酒屋","ランチ"]');
});
test('Tag filter combines with region, visit state, author and text, with untagged independent of a literal 未分類 tag',()=>{
 const shops=parseRows([[...HEADERS,'タグ'],[...row(),'["居酒屋","ランチ"]'],[...row(id2),'[]']]);
 const filter=(tag:string,author='全員',query='')=>filterShops(shops,query,author,'まだ','新しい順',true,{},'東京都','渋谷区',tag);
 assert.equal(filter('tag:ランチ').length,1);assert.equal(filter('tag:ランチ','あずさ').length,0);assert.equal(filter('tag:ランチ','なおと','居酒屋').length,1);
 assert.equal(filter('').length,2);assert.equal(filter('tag:未分類').length,0);
});
