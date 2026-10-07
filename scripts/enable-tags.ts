// Run after deploying the backwards-compatible reader. Adds only F1.
import env from '@next/env';
import { HEADERS, parseRows } from '../lib/model';
import { sheetsAccessToken } from '../lib/service-account';
async function main() {
  env.loadEnvConfig(process.cwd());
  const id=process.env.GOOGLE_SPREADSHEET_ID;
  const tab=process.env.GOOGLE_SHEET_TAB;
  if(!id || !/^[a-zA-Z0-9_-]+$/.test(id) || !tab) throw new Error('Missing spreadsheet configuration');
  const range=`'${tab.replace(/'/g,"''")}'`;
  const token=await sheetsAccessToken();
  const endpoint=`https://sheets.googleapis.com/v4/spreadsheets/${id}/values/`;
  async function request(suffix:string,init?:RequestInit) {
    const response=await fetch(endpoint+suffix,{...init,headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},signal:AbortSignal.timeout(15000)});
    if(!response.ok)throw new Error(`Sheets request failed: ${response.status}`);
    return response.json();
  }
  const before=await request(encodeURIComponent(range));
  const rows:unknown[][]=before.values??[];
  parseRows(rows); // Reject unknown columns or nonempty data outside the known schema.
  if(HEADERS.some((header,index)=>rows[0]?.[index]!==header))throw new Error('Unexpected column order');
  if(rows[0]?.[5]==='タグ'){console.log('Tag column already enabled.');return;}
  if(rows.some(row=>row.slice(5).some(value=>String(value??'').trim())))throw new Error('F column is not empty');
  await request(encodeURIComponent(range+'!F1')+'?valueInputOption=RAW',{method:'PUT',body:JSON.stringify({values:[['タグ']]})});
  const after=await request(encodeURIComponent(range));
  parseRows(after.values??[]);
  if(after.values?.[0]?.[5]!=='タグ')throw new Error('Tag header verification failed');
  console.log('Tag column enabled: wrote F1 only. Existing shop cells were not written.');
}
main().catch(()=>{console.error('Tag column setup failed; check the configured spreadsheet and column layout.');process.exitCode=1;});
