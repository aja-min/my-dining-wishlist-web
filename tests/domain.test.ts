import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { HEADERS, parseCsv, parseRows, mapsUrl, japanDate, uniqueShop, type Shop } from '../lib/model';
import { LocalRepository, STORAGE_KEY } from '../lib/local-repository';
import { previewFor } from '../lib/preview';
import { filterShops } from '../lib/query';
import { SheetsRepository, type SheetsRequest } from '../lib/sheets-repository';
const csv = readFileSync(new URL('./fixtures/shops.csv', import.meta.url), 'utf8');
const id = '10000000-0000-4000-8000-000000000001';
const id2 = '10000000-0000-4000-8000-000000000002';
const row = (uid = id, visited: unknown = 'FALSE') => [uid,'2026-10-04','なおと','https://maps.app.goo.gl/test',visited];
function memory() { const data = new Map<string,string>(); return { getItem: (k:string) => data.get(k) ?? null, setItem: (k:string,v:string) => { data.set(k,v); } }; }
test('CSV samples: 8 real rows, both people, true/false and checkbox-only rows', () => {
 const shops = parseCsv(csv); assert.equal(shops.length,8); assert.equal(shops.filter(s=>s.visited).length,2); assert.equal(shops.filter(s=>s.author==='なおと').length,4);
 assert.equal(parseRows([[...HEADERS],row(id,''),['','','','','FALSE'],[]]).length,1);
 assert.equal(parseRows([[...HEADERS],row(id,true)])[0].visited,true);
});
test('CSV quoted comma, quote, newline and BOM; malformed CSV fails', () => {
 const value = '\uFEFF'+HEADERS.join(',')+'\r\n"'+id+'","2026-10-04","なおと","https://www.google.com/maps/place/Cafe,Blue?note=""hi""\nthere",FALSE\r\n';
 assert.equal(parseCsv(value).length,1); assert.ok(parseCsv(value)[0].url.includes('Cafe,Blue'));
 assert.throws(()=>parseCsv(HEADERS.join(',')+'\n"unclosed'),/CSV/);
});
test('Headers map by name, invalid or extra columns and bad dates/status reject', () => {
 assert.equal(parseRows([[...HEADERS].reverse(),row().reverse()])[0].id,id);
 for (const headers of [[...HEADERS,'extra'],[...HEADERS.slice(0,4),'wrong']]) assert.throws(()=>parseRows([headers,row()]));
 assert.throws(()=>parseRows([[...HEADERS],row(id,'yes')]));
 const invalid=row();invalid[1]='2026-02-30';assert.throws(()=>parseRows([[...HEADERS],invalid]));
});
test('JST date at UTC day boundary',()=>assert.equal(japanDate(new Date('2026-10-03T15:00:00Z')),'2026-10-04'));
test('Maps allowlist blocks arbitrary hosts, credentials, ports, non-HTTPS',()=>{
 for(const url of ['https://www.google.com/maps/place/test','https://maps.app.goo.gl/abc','https://goo.gl/maps/abc','https://maps.google.co.jp/?q=cafe']) assert.ok(mapsUrl(url));
 for(const url of ['javascript:alert(1)','http://maps.google.com','https://google.com.evil.com/maps','https://google.com/search','https://user@maps.google.com','https://maps.google.com:444/maps','https://127.0.0.1/maps','https://goo.gl/else']) assert.throws(()=>mapsUrl(url));
});
test('Local add/update/delete survive new repository; reset restores CSV',async()=>{
 const storage=memory();let repo=new LocalRepository(async()=>csv,storage);
 const added=await repo.add({author:'あずさ',url:'https://maps.app.goo.gl/new'});assert.equal(added.author,'あずさ');assert.equal(added.visited,false);
 repo=new LocalRepository(async()=>csv,storage);assert.equal((await repo.list()).length,9);
 await repo.setVisited(added.id,true);await repo.setVisited(added.id,true);assert.equal((await repo.list()).find(s=>s.id===added.id)?.visited,true);
 await repo.remove(id);repo=new LocalRepository(async()=>csv,storage);assert.equal((await repo.list()).length,8);assert.ok(!(await repo.list()).find(s=>s.id===id));
 await repo.reset();assert.equal((await repo.list()).length,8);assert.ok((await repo.list()).find(s=>s.id===id));
});
test('Exact URL duplicate returns existing shop without adding',async()=>{
 const repo=new LocalRepository(async()=>csv,memory());const shop=(await repo.list())[0];
 await assert.rejects(()=>repo.add({author:'なおと',url:shop.url}),e=>{assert.equal((e as any).existing.id,shop.id);return true;});assert.equal((await repo.list()).length,8);
});
test('Read never fills IDs; explicit fill touches real rows only, duplicates stop writes',async()=>{
 const storage=memory();storage.setItem(STORAGE_KEY,JSON.stringify({version:1,rows:[[...HEADERS],row(''),['','','','','FALSE'],row(id),row(id)]}));
 const repo=new LocalRepository(async()=>csv,storage);const before=storage.getItem(STORAGE_KEY);
 assert.equal((await repo.list())[0].id,'');assert.equal(storage.getItem(STORAGE_KEY),before);
 await assert.rejects(()=>repo.remove(id),/重複/);await assert.rejects(()=>repo.setVisited(id,true),/重複/);await assert.rejects(()=>repo.remove(id2),/見つかりません/);
 assert.equal(await repo.fillMissingIds(),1);assert.equal((await repo.list()).length,3);assert.ok((await repo.list())[0].id);
});
test('Storage failure leaves old data intact; corrupt persistence is not silently reset',async()=>{
 const repo=new LocalRepository(async()=>csv,{getItem:()=>null,setItem:()=>{throw new Error('quota');}});
 await assert.rejects(()=>repo.setVisited(id,true),/保存できません/);assert.equal((await repo.list())[0].visited,false);
 const broken=new LocalRepository(async()=>csv,{getItem:()=>'{broken',setItem:()=>{}});await assert.rejects(()=>broken.list(),/保存データ/);
});
test('Search combines author/status and fixture title; ordering; fallback preview',()=>{
 const shops=parseCsv(csv);assert.equal(filterShops(shops,'喫茶','なおと','まだ','新しい順').length,1);assert.equal(filterShops(shops,'喫茶','あずさ','まだ','新しい順').length,0);
 const sorted=filterShops(shops,'','全員','すべて','古い順');assert.equal(sorted[0].date,'2026-10-01');
 const plain={...shops[0],id:id2,url:'https://maps.app.goo.gl/unknown'};assert.equal(previewFor(plain).title,'Google Mapsのお店');assert.equal(previewFor(plain).image,'/images/pin.svg');
 assert.equal(previewFor({...plain,url:'https://www.google.com/maps/place/Tea+Room'}).title,'Tea Room');
});
function mockSheets(initial: unknown[][]) {
 let rows=initial;const calls:{suffix:string;init?:RequestInit}[]=[];
 const request:SheetsRequest=async(suffix,init)=>{calls.push({suffix,init});if(suffix==='?fields=sheets.properties')return {sheets:[{properties:{title:'お店',sheetId:7}}]};if(!init)return {values:rows};return {};};
 return { repo:new SheetsRepository(request,'お店','あずさ'),calls,setRows:(next:unknown[][])=>{rows=next;} };
}
test('Sheets update resolves latest ID after reorder and writes ONLY E cell, absolute boolean',async()=>{
 const mock=mockSheets([[...HEADERS],row(id),row(id2)]);await mock.repo.list();mock.setRows([[...HEADERS],[],row(id2),row(id)]);
 await mock.repo.setVisited(id,true);const call=mock.calls.at(-1)!;assert.ok(decodeURIComponent(call.suffix).includes("'お店'!E4"));assert.deepEqual(JSON.parse(call.init!.body as string),{values:[[true]]});
});
test('Sheets delete resolves latest row, uses configured tab numeric ID',async()=>{
 const mock=mockSheets([[...HEADERS],row(id2),[],row(id)]);await mock.repo.remove(id);
 assert.deepEqual(JSON.parse(mock.calls.at(-1)!.init!.body as string).requests[0].deleteDimension.range,{sheetId:7,dimension:'ROWS',startIndex:3,endIndex:4});
});
test('Sheets missing and duplicate IDs stop updates and deletes',async()=>{
 for(const rows of [[[...HEADERS],row(id2)],[[...HEADERS],row(id),row(id)]]) {
  const mock=mockSheets(rows);await assert.rejects(()=>mock.repo.setVisited(id,true));await assert.rejects(()=>mock.repo.remove(id));assert.equal(mock.calls.filter(c=>c.init).length,0);
 }
});
test('Sheets insert ignores checkbox-only rows, preserves later shops, and uses server author',async()=>{
 const mock=mockSheets([[...HEADERS],row(),...Array.from({length:998},()=>['','','','','FALSE']),row(id2)]);const shop=await mock.repo.add({author:'なおと',url:'https://maps.app.goo.gl/added'});assert.equal(shop.author,'あずさ');
 const call=mock.calls.at(-1)!;assert.equal(call.suffix,':batchUpdate');const requests=JSON.parse(call.init!.body as string).requests;assert.equal(requests[0].insertDimension.range.startIndex,2);assert.equal(requests[1].updateCells.start.rowIndex,2);const values=requests[1].updateCells.rows[0].values;assert.equal(values.length,5);assert.equal(values[2].userEnteredValue.stringValue,'あずさ');assert.equal(values[4].userEnteredValue.boolValue,false);assert.equal(requests[2].setDataValidation.rule.condition.type,'BOOLEAN');
 const writes=mock.calls.filter(c=>c.init).length;await assert.rejects(()=>mock.repo.add({author:'なおと',url:'https://maps.app.goo.gl/test'}));assert.equal(mock.calls.filter(c=>c.init).length,writes);
});
test('Sheets missing-ID repair is explicit and only writes A of populated rows',async()=>{
 const mock=mockSheets([[...HEADERS],row(''),['','','','','FALSE'],row(id)]);await mock.repo.list();assert.equal(mock.calls.filter(c=>c.init).length,0);assert.equal(await mock.repo.fillMissingIds(),1);
 const data=JSON.parse(mock.calls.at(-1)!.init!.body as string).data;assert.equal(data.length,1);assert.equal(data[0].range,"'お店'!A2");
});
