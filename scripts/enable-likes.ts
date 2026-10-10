import {loadEnvConfig} from '@next/env';
import {randomInt} from 'node:crypto';
import {sheetsAccessToken} from '../lib/service-account';
import {LIKES_TAB,LIKE_HEADERS,readLikes} from '../lib/likes';
async function main(){
 loadEnvConfig(process.cwd());
 const id=process.env.GOOGLE_SPREADSHEET_ID;
 if(!id || !/^[a-zA-Z0-9_-]+$/.test(id))throw new Error('Missing spreadsheet configuration');
 const token=await sheetsAccessToken();
 async function request(suffix:string,init?:RequestInit){
  const response=await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${id}${suffix}`,{...init,headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},signal:AbortSignal.timeout(15000)});
  if(!response.ok)throw new Error(`Sheets status ${response.status}`);return response.json();
 }
 const meta=await request('?fields=sheets.properties');
 if(!meta.sheets?.some((s:any)=>s.properties.title===LIKES_TAB)){
  const sheetId=randomInt(1,2147483647);
  await request(':batchUpdate',{method:'POST',body:JSON.stringify({requests:[
   {addSheet:{properties:{sheetId,title:LIKES_TAB,gridProperties:{columnCount:2,frozenRowCount:1}}}},
   {updateCells:{start:{sheetId,rowIndex:0,columnIndex:0},rows:[{values:LIKE_HEADERS.map(stringValue=>({userEnteredValue:{stringValue}}))}],fields:'userEnteredValue'}}
  ]})});
 }
 readLikes((await request(`/values/${encodeURIComponent(`'${LIKES_TAB}'!A:B`)}`)).values??[]);
 console.log('Likes history ready. Existing shop data unchanged.');
}
main().catch(error=>{console.error(error instanceof Error?error.message:'Setup failed');process.exitCode=1;});
