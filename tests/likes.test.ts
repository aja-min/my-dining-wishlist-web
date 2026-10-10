import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readLikes,LIKE_HEADERS,likeOperation} from '../lib/likes';
import {LocalRepository} from '../lib/local-repository';
import {SheetsRepository} from '../lib/sheets-repository';
import {HEADERS} from '../lib/model';
import {filterShops} from '../lib/query';
const id='10000000-0000-4000-8000-000000000001';
const row=[id,'2026-10-11','なおと','https://maps.app.goo.gl/test',false];
const op=()=>crypto.randomUUID();
test('History deduplicates retries but counts distinct clicks from the same person',()=>{
 const a=op(),b=op();const counts=readLikes([[...LIKE_HEADERS],[a,id],[a,id],[b,id]]);assert.equal(counts.get(id)?.size,2);assert.throws(()=>likeOperation('invalid'));assert.throws(()=>readLikes([['wrong']]));
});
test('Local repeated likes persist and other edits preserve the count',async()=>{
 let data=JSON.stringify({version:1,rows:[[...HEADERS],row]});const storage={getItem:()=>data,setItem:(_k:string,v:string)=>{data=v;}};
 let repo=new LocalRepository(async()=>'',storage);const a=op();await repo.like(id,a);await repo.like(id,a);await repo.like(id,op());await repo.setVisited(id,true);await repo.setTags(id,['ランチ']);
 repo=new LocalRepository(async()=>'',storage);assert.equal((await repo.list())[0].likes,2);assert.equal((await repo.list())[0].visited,true);
});
test('Concurrent Sheets appends do not overwrite counts, retries deduplicate, and invalid shop cannot write',async()=>{
 const history:unknown[][]=[[...LIKE_HEADERS]];let writes=0;
 const request=async(suffix:string,init?:RequestInit)=>{
  if(init){assert.match(suffix,/:append\?valueInputOption=RAW&insertDataOption=INSERT_ROWS/);history.push(...JSON.parse(init.body as string).values);writes++;return {};}
  return {values:decodeURIComponent(suffix).includes('いいね履歴')?history.map(row=>[...row]):[[...HEADERS],row]};
 };
 const repo=new SheetsRepository(request,'お店','あずさ',true);const same=op();
 await Promise.all([repo.like(id,same),repo.like(id,same),repo.like(id,op()),repo.like(id,op())]);
 assert.equal((await repo.list())[0].likes,3);await repo.like(id,same);assert.equal((await repo.list())[0].likes,3);
 const before=writes;await assert.rejects(()=>repo.like('missing',op()));assert.equal(writes,before);
});
test('Likes sort descending, missing counts are zero and ties use newest date',()=>{
 const base={id,date:'2026-10-11',author:'なおと' as const,url:'https://maps.app.goo.gl/test',visited:false,row:2};
 const shops=[base,{...base,id:'b',likes:3,date:'2026-10-10'},{...base,id:'c',likes:3}];
 assert.deepEqual(filterShops(shops,'','全員','まだ','いいねが多い順').map(s=>s.id),['c','b',id]);
});
